import { journalSchema, type Food, type Journal } from '../../../shared/domain'
import { shiftDate, today } from './dates'

export const DEMO_KEY = 'flexa:demo:v1'

export const demoFoods: Food[] = [
  ['Płatki owsiane', 370, 13, 60, 7, 10],
  ['Jogurt naturalny', 61, 4.3, 4.7, 3.2, 0],
  ['Banan', 89, 1.1, 22.8, 0.3, 2.6],
  ['Pierś z kurczaka', 165, 31, 0, 3.6, 0],
  ['Ryż gotowany', 130, 2.7, 28.2, 0.3, 0.4],
  ['Brokuły', 34, 2.8, 6.6, 0.4, 2.6],
  ['Chleb pełnoziarnisty', 247, 13, 41, 4.2, 7],
  ['Jajko', 143, 12.6, 0.7, 9.5, 0],
  ['Awokado', 160, 2, 8.5, 14.7, 6.7],
  ['Serek wiejski', 97, 11, 2, 5, 0],
  ['Jabłko', 52, 0.3, 13.8, 0.2, 2.4],
  ['Oliwa z oliwek', 884, 0, 0, 100, 0],
].map(([name, kcal, protein, carbs, fat, fiber], index) => ({
  id: `demo-${index}`,
  name: String(name),
  brand: 'Produkt demonstracyjny',
  barcode: null,
  source: 'demo' as const,
  unit: 'g' as const,
  nutrients: {
    kcal: Number(kcal), protein: Number(protein), carbs: Number(carbs),
    fat: Number(fat), fiber: Number(fiber),
  },
}))

export function createDemo(): Journal {
  const end = today()
  const meals: Journal['meals'] = []
  for (let offset = -6; offset <= 0; offset++) {
    const date = shiftDate(end, offset)
    const portions: [number, number, Journal['meals'][number]['meal']][] = [
      [0, 65, 'breakfast'], [1, 180, 'breakfast'], [2, 110, 'breakfast'],
      [3, 150, 'lunch'], [4, 180, 'lunch'], [5, 120, 'lunch'],
      [11, 10, 'lunch'], [9, 150, 'snack'], [10, 140, 'snack'],
    ]
    if (offset < 0) portions.push([6, 100, 'dinner'], [7, 110, 'dinner'], [8, 60, 'dinner'])
    for (const [index, portion, meal] of portions) {
      meals.push({
        id: crypto.randomUUID(), date, meal, food: demoFoods[index],
        portion: portion + (offset % 3) * 3,
      })
    }
  }
  return journalSchema.parse({
    profile: {
      displayName: 'Alex', calorieGoal: 2200, proteinGoal: 140, carbsGoal: 260,
      fatGoal: 65, waterGoal: 2500, weeklyMinutesGoal: 180, targetWeight: null,
    },
    meals,
    workouts: [-5, -3, 0].map((offset, index) => ({
      id: crypto.randomUUID(), date: shiftDate(end, offset),
      name: ['Spokojny bieg', 'Trening całego ciała', 'Bieg w parku'][index],
      kind: index === 1 ? 'strength' : 'run',
      minutes: [32, 45, 38][index], distanceKm: index === 1 ? null : [5, 0, 6.2][index],
      calories: [310, null, 380][index], effort: [4, 6, 5][index],
      elevationM: index === 1 ? null : 24, importHash: null,
    })),
    water: Array.from({ length: 6 }, () => ({
      id: crypto.randomUUID(), date: end, amountMl: 250,
    })),
    measurements: [-21, -14, -7, 0].map((offset, index) => ({
      id: crypto.randomUUID(), date: shiftDate(end, offset),
      weightKg: [74.8, 74.6, 74.3, 74.2][index],
    })),
    customFoods: [],
  })
}

export function readDemo(): Journal {
  const saved = localStorage.getItem(DEMO_KEY)
  if (saved === null) {
    const journal = createDemo()
    writeDemo(journal)
    return journal
  }
  try {
    const envelope: unknown = JSON.parse(saved)
    return journalSchema.parse(envelope)
  } catch (cause) {
    throw new Error('Zapis demonstracyjny jest uszkodzony. Wyzeruj demo w ustawieniach lub wyeksportuj dane przeglądarki.', { cause })
  }
}

export function writeDemo(journal: Journal): void {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(journalSchema.parse(journal)))
  } catch (cause) {
    throw new Error('Nie udało się zapisać demo na tym urządzeniu. Sprawdź dostęp do pamięci przeglądarki.', { cause })
  }
}
