import { mealSchema, type Food, type Meal } from '../../../shared/domain'

export const kcalOnlyPrefix = 'kcal-'
export const maxKcalEntry = 4000

/** A meal typed in as bare calories has no real weight; the diary shows it as "wpis kcal" instead of grams. */
export function isKcalOnly(food: Food): boolean {
  return food.id.startsWith(kcalOnlyPrefix)
}

export type KcalEntryInput = { date: string; meal: string; name: string; kcal: string; protein: string; carbs: string; fat: string }

function amount(text: string): number | null | undefined {
  const value = text.trim().replace(',', '.')
  if (value === '') return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : undefined
}

/**
 * Stores the entered totals as a "per 100 g" food eaten in a 100 g (or 200 g for very large entries) portion, so the
 * usual nutrition maths yields exactly the numbers the user typed. Unknown macros stay unknown, never zero.
 */
export function kcalOnlyMeal(input: KcalEntryInput): { ok: true; meal: Omit<Meal, 'id'> } | { ok: false; error: string } {
  const kcal = amount(input.kcal)
  if (kcal === null || kcal === undefined || kcal < 1 || kcal > maxKcalEntry) return { ok: false, error: `Wpisz energię od 1 do ${maxKcalEntry} kcal.` }
  const macros = { protein: amount(input.protein), carbs: amount(input.carbs), fat: amount(input.fat) }
  if (Object.values(macros).some((value) => value === undefined)) return { ok: false, error: 'Makroskładniki to liczby nieujemne albo puste pola.' }
  const portion = kcal > 2000 ? 200 : 100
  const scale = (value: number | null | undefined) => value === null || value === undefined ? null : Math.round(value * 100 / portion * 10) / 10
  const parsed = mealSchema.omit({ id: true }).safeParse({
    date: input.date, meal: input.meal, portion,
    food: {
      id: `${kcalOnlyPrefix}${crypto.randomUUID()}`, name: input.name.trim() || 'Wpis kcal', brand: 'Same kcal', barcode: null, unit: 'g', source: 'custom', estimated: true,
      nutrients: { kcal: Math.round(kcal * 100 / portion * 10) / 10, protein: scale(macros.protein), carbs: scale(macros.carbs), fat: scale(macros.fat), fiber: null },
    },
  })
  return parsed.success ? { ok: true, meal: parsed.data } : { ok: false, error: 'Sprawdź nazwę, posiłek i wartości.' }
}

/** What the diary shows next to a meal: grams for products, a plain label for calorie-only entries. */
export function portionLabel(entry: Pick<Meal, 'food' | 'portion'>, format: (value: number) => string): string {
  return isKcalOnly(entry.food) ? 'wpis kcal' : `${format(entry.portion)} ${entry.food.unit}`
}
