import { journalSchema, type Food, type Journal, type WorkoutSet } from '../../../shared/domain'
import type { TrainingAnswers } from '../../../shared/training'
import { shiftDate, today } from './dates'
import { generatePlan } from './training/generator'
import { takesLoad } from './training/sets'

export const DEMO_KEY = 'flexa:demo:v1'

export const demoAnswers: TrainingAnswers = {
  age: 32, sex: 'unspecified', goal: 'fat-loss', place: 'home', equipment: ['bands', 'chair', 'dumbbells', 'mat'],
  level: 'intermediate', weekdays: [0, 2, 4], minutes: 45, limitations: [], cautiousStart: false, healthConsent: false,
}

function demoTraining(): Journal['training'] {
  return { onboardingDone: true, plan: generatePlan(demoAnswers), unreadable: false }
}

/** Synthetic sets for the sample strength workouts, built from the first day of the sample plan. */
function demoSets(extraKg: number): WorkoutSet[] {
  const items = generatePlan(demoAnswers).sessions[0].blocks.flatMap((block) => block.items)
    .filter((item) => item.target.type === 'reps').slice(0, 3)
  return items.flatMap((item, index) => Array.from({ length: Math.min(3, item.sets) }, () => ({
    exercise: item.exercise, reps: item.target.type === 'reps' ? item.target.max : null,
    weightKg: takesLoad(item.exercise) ? [12, 10, 8][index] + extraKg : null, seconds: null,
  })))
}

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
    workouts: [-10, -5, -3, 0].map((offset, index) => ({
      id: crypto.randomUUID(), date: shiftDate(end, offset),
      name: ['Trening całego ciała', 'Spokojny bieg', 'Trening całego ciała', 'Bieg w parku'][index],
      kind: index % 2 === 0 ? 'strength' : 'run',
      minutes: [42, 32, 45, 38][index], distanceKm: index % 2 === 0 ? null : [0, 5, 0, 6.2][index],
      calories: [null, 310, null, 380][index], effort: [6, 4, 6, 5][index],
      elevationM: index % 2 === 0 ? null : 24, importHash: null,
      ...(index % 2 === 0 ? { sets: demoSets(index === 0 ? -2 : 0) } : {}),
    })),
    water: Array.from({ length: 6 }, () => ({
      id: crypto.randomUUID(), date: end, amountMl: 250,
    })),
    measurements: [-21, -14, -10, -7, -4, -2, 0].map((offset, index) => ({
      id: crypto.randomUUID(), date: shiftDate(end, offset),
      weightKg: [74.8, 74.6, 74.9, 74.3, 74.5, 74.1, 74.2][index],
      waistCm: [84, null, null, 83.5, null, null, 83][index],
    })),
    customFoods: [],
    training: demoTraining(),
  })
}

export function readDemo(): Journal {
  const saved = localStorage.getItem(DEMO_KEY)
  if (saved === null) {
    const journal = createDemo()
    writeDemo(journal)
    return journal
  }
  let journal: Journal
  let upgraded = false
  try {
    const envelope: unknown = JSON.parse(saved)
    upgraded = typeof envelope === 'object' && envelope !== null && !('training' in envelope)
    journal = journalSchema.parse(envelope)
  } catch (cause) {
    throw new Error('Zapis demonstracyjny jest uszkodzony. Wyzeruj demo w ustawieniach lub wyeksportuj dane przeglądarki.', { cause })
  }
  if (upgraded) {
    journal.training = demoTraining()
    writeDemo(journal)
  }
  return journal
}

export function writeDemo(journal: Journal): void {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(journalSchema.parse(journal)))
  } catch (cause) {
    throw new Error('Nie udało się zapisać demo na tym urządzeniu. Sprawdź dostęp do pamięci przeglądarki.', { cause })
  }
}
