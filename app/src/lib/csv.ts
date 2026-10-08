import { mealNames, workoutNames, type Journal } from '../../../shared/domain'
import { sourceNames } from './sources'

export type CsvCell = string | number | boolean | null | undefined

export const CSV_SEPARATOR = ';'
export const csvFormatHint = 'Pliki CSV mają średnik jako separator i przecinek dziesiętny, tak jak polska wersja Excela i LibreOffice. Puste pole oznacza brak danych, nie zero.'

const formulaStart = /^[=+\-@\t\r]/

/** Formats one cell: decimal comma for numbers, quotes when needed and a leading apostrophe against spreadsheet formulas. */
export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'tak' : 'nie'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return ''
    return String(Math.round(value * 100) / 100).replace('.', ',')
  }
  const text = formulaStart.test(value) ? `'${value}` : value
  return /[";\r\n]/.test(text) || text !== text.trim() ? `"${text.replaceAll('"', '""')}"` : text
}

/** UTF-8 BOM (so Excel detects the encoding), CRLF line endings, a header row and one line per record. */
export function toCsv(header: readonly string[], rows: readonly (readonly CsvCell[])[]): string {
  return `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(CSV_SEPARATOR)).join('\r\n')}\r\n`
}

const byDate = <T extends { date: string }>(items: readonly T[]) => [...items].sort((a, b) => a.date.localeCompare(b.date))

export function mealsCsv(journal: Journal): string {
  const amount = (value: number | null, portion: number) => value === null ? null : value * portion / 100
  return toCsv(
    ['Data', 'Posiłek', 'Produkt', 'Marka', 'Porcja', 'Jednostka', 'Energia (kcal)', 'Białko (g)', 'Węglowodany (g)', 'Tłuszcze (g)', 'Błonnik (g)', 'Źródło', 'Wartości szacunkowe'],
    byDate(journal.meals).map((meal) => {
      const { nutrients } = meal.food
      return [
        meal.date, mealNames[meal.meal], meal.food.name, meal.food.brand, meal.portion, meal.food.unit,
        amount(nutrients.kcal, meal.portion), amount(nutrients.protein, meal.portion), amount(nutrients.carbs, meal.portion),
        amount(nutrients.fat, meal.portion), amount(nutrients.fiber, meal.portion), sourceNames[meal.food.source], Boolean(meal.food.estimated),
      ]
    }),
  )
}

export function workoutsCsv(journal: Journal): string {
  const withSets = journal.workouts.some((workout) => workout.sets?.length)
  return toCsv(
    ['Data', 'Nazwa', 'Rodzaj', 'Czas (min)', 'Dystans (km)', 'Energia (kcal)', 'Wysiłek (1–10)', 'Przewyższenie (m)', 'Import z pliku', ...withSets ? ['Liczba serii'] : []],
    byDate(journal.workouts).map((workout) => [
      workout.date, workout.name, workoutNames[workout.kind], workout.minutes, workout.distanceKm,
      workout.calories, workout.effort, workout.elevationM, workout.importHash !== null,
      ...withSets ? [workout.sets?.length ?? 0] : [],
    ]),
  )
}

const optionalMeasurements = [
  ['waistCm', 'Obwód talii (cm)'], ['hipsCm', 'Obwód bioder (cm)'], ['bodyFatPct', 'Tkanka tłuszczowa (%)'],
] as const

export function measurementsCsv(journal: Journal): string {
  const records = journal.measurements
  const extra = optionalMeasurements.filter(([key]) => records.some((record) => record[key] != null))
  return toCsv(
    ['Data', 'Masa ciała (kg)', ...extra.map(([, label]) => label)],
    byDate(records).map((record) => [record.date, record.weightKg, ...extra.map(([key]) => record[key])]),
  )
}

export const csvExports = {
  meals: { label: 'Posiłki', file: 'posilki', build: mealsCsv },
  workouts: { label: 'Treningi', file: 'treningi', build: workoutsCsv },
  measurements: { label: 'Pomiary', file: 'pomiary', build: measurementsCsv },
} as const
export type CsvExportKind = keyof typeof csvExports
