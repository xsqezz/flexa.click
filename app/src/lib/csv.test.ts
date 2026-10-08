import { describe, expect, it } from 'vitest'
import { createDemo } from './demo'
import { csvCell, mealsCsv, measurementsCsv, toCsv, workoutsCsv } from './csv'

describe('CSV export', () => {
  it('escapes separators, quotes, line breaks and spreadsheet formulas', () => {
    expect(csvCell('Jogurt naturalny')).toBe('Jogurt naturalny')
    expect(csvCell('Ser; żółty')).toBe('"Ser; żółty"')
    expect(csvCell('Baton "Mocny"')).toBe('"Baton ""Mocny"""')
    expect(csvCell('linia\ndruga')).toBe('"linia\ndruga"')
    expect(csvCell(' spacja ')).toBe('" spacja "')
    expect(csvCell('=SUMA(A1)')).toBe("'=SUMA(A1)")
    expect(csvCell('@cmd')).toBe("'@cmd")
    expect(csvCell('-2+3;x')).toBe(`"'-2+3;x"`)
  })

  it('writes decimal commas, empty unknowns and yes/no flags', () => {
    expect(csvCell(12.345)).toBe('12,35')
    expect(csvCell(-1.5)).toBe('-1,5')
    expect(csvCell(100)).toBe('100')
    expect(csvCell(null)).toBe('')
    expect(csvCell(Number.NaN)).toBe('')
    expect(csvCell(true)).toBe('tak')
  })

  it('starts with a BOM and uses CRLF rows with a Polish header', () => {
    const text = toCsv(['Data', 'Wartość'], [['2026-10-08', 1.5], ['2026-10-09', null]])
    expect(text).toBe('\uFEFFData;Wartość\r\n2026-10-08;1,5\r\n2026-10-09;\r\n')
  })

  it('exports meals, workouts and measurements sorted by date', () => {
    const journal = createDemo()
    const meals = mealsCsv(journal).slice(1).split('\r\n')
    expect(meals[0]).toBe('Data;Posiłek;Produkt;Marka;Porcja;Jednostka;Energia (kcal);Białko (g);Węglowodany (g);Tłuszcze (g);Błonnik (g);Źródło;Wartości szacunkowe')
    expect(meals).toHaveLength(journal.meals.length + 2)
    const dates = meals.slice(1, -1).map((line) => line.split(';')[0])
    expect(dates).toEqual([...dates].sort())
    expect(meals[1]).toMatch(/^\d{4}-\d{2}-\d{2};Śniadanie;Płatki owsiane;Produkt demonstracyjny;/)
    expect(workoutsCsv(journal).split('\r\n')[0]).toContain('Czas (min)')
    const measurements = measurementsCsv({ ...journal, measurements: [{ id: crypto.randomUUID(), date: '2026-10-01', weightKg: 74.25, waistCm: 80 }] })
    expect(measurements).toBe('\uFEFFData;Masa ciała (kg);Obwód talii (cm)\r\n2026-10-01;74,25;80\r\n')
  })
})
