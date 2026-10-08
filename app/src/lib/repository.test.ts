import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEMO_KEY, createDemo, demoAnswers, readDemo, writeDemo } from './demo'
import { DemoRepository, SupabaseRepository, readPages, setsFromRow, trainingFromRow } from './repository'
import { today } from './dates'
import { generatePlan } from './training/generator'
import { planImport, type ImportPayload } from './backup'

describe('persistent demo repository', () => {
  beforeEach(() => localStorage.clear())
  it('persists a meal and removes only the selected entry', async () => {
    const repository = new DemoRepository()
    const original = await repository.load()
    await repository.execute({ type: 'meal.add', value: { date: today(), meal: 'snack', food: original.meals[0].food, portion: 80 } })
    const saved = readDemo()
    expect(saved.meals).toHaveLength(original.meals.length + 1)
    const added = saved.meals.at(-1)
    expect(added?.portion).toBe(80)
    if (!added) throw new Error('Missing fixture')
    await repository.execute({ type: 'meal.delete', id: added.id })
    expect(readDemo().meals).toHaveLength(original.meals.length)
  })
  it('stores one measurement per day and prevents duplicate file imports', async () => {
    writeDemo(createDemo())
    const repository = new DemoRepository()
    await repository.execute({ type: 'measurement.add', value: { date: today(), weightKg: 76 } })
    await repository.execute({ type: 'measurement.add', value: { date: today(), weightKg: 77 } })
    expect(readDemo().measurements.filter((item) => item.date === today())).toHaveLength(1)
    const workout = { ...readDemo().workouts[0], importHash: 'a'.repeat(64) }
    await repository.execute({ type: 'workout.add', value: workout })
    await expect(repository.execute({ type: 'workout.add', value: workout })).rejects.toThrow('już zaimportowany')
  })
  it('surfaces corrupted storage instead of replacing user changes', () => {
    localStorage.setItem(DEMO_KEY, '{bad')
    expect(() => readDemo()).toThrow('uszkodzony')
    expect(localStorage.getItem(DEMO_KEY)).toBe('{bad')
  })
  it('does not claim success when local persistence fails', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError') })
    expect(() => writeDemo(createDemo())).toThrow('Nie udało się zapisać')
    spy.mockRestore()
  })
})

describe('training plan persistence', () => {
  beforeEach(() => localStorage.clear())
  it('saves, skips and deletes the demo plan without touching the diary', async () => {
    const repository = new DemoRepository()
    const original = await repository.load()
    expect(original.training.plan?.answers.goal).toBe(demoAnswers.goal)
    const plan = generatePlan({ ...demoAnswers, goal: 'strength', weekdays: [1, 3] })
    await repository.execute({ type: 'plan.save', value: plan })
    expect(readDemo().training).toEqual({ onboardingDone: true, plan, unreadable: false })
    await repository.execute({ type: 'plan.delete' })
    await repository.execute({ type: 'onboarding.skip' })
    expect(readDemo().training).toEqual({ onboardingDone: true, plan: null, unreadable: false })
    expect(readDemo().meals).toEqual(original.meals)
  })
  it('adds a sample plan to a demo saved before training plans existed', () => {
    const legacy: Record<string, unknown> = { ...createDemo() }
    delete legacy.training
    localStorage.setItem(DEMO_KEY, JSON.stringify(legacy))
    expect(readDemo().training.plan?.sessions).toHaveLength(demoAnswers.weekdays.length)
    expect(JSON.parse(localStorage.getItem(DEMO_KEY) ?? '{}')).toHaveProperty('training')
  })
  it('reads stored cloud plans defensively', () => {
    const plan = generatePlan(demoAnswers)
    const { answers, ...stored } = plan
    expect(trainingFromRow(null, null)).toEqual({ onboardingDone: false, plan: null, unreadable: false })
    expect(trainingFromRow(null, '2026-10-07T10:00:00Z').onboardingDone).toBe(true)
    expect(trainingFromRow({ answers, plan: stored }, null)).toEqual({ onboardingDone: true, plan, unreadable: false })
    const sessions = stored.sessions.map((session, index) => index ? session : { ...session, warmup: [{ ...session.warmup[0], exercise: 'removed-drill' }, ...session.warmup.slice(1)] })
    expect(trainingFromRow({ answers, plan: { ...stored, sessions } }, null)).toEqual({ onboardingDone: true, plan: null, unreadable: true })
    expect(trainingFromRow({ answers, plan: 'broken' }, null).unreadable).toBe(true)
  })
})

describe('sets and extended measurements', () => {
  beforeEach(() => localStorage.clear())
  it('stores sets with a workout and extra measurements in the demo, and reads older saves without them', async () => {
    const repository = new DemoRepository()
    await repository.load()
    const sets = [{ exercise: 'goblet-squat-db', reps: 10, weightKg: 16, seconds: null }, { exercise: 'Moje ćwiczenie', reps: null, weightKg: 30, seconds: null }]
    await repository.execute({ type: 'workout.add', value: {
      date: today(), name: 'Siła', kind: 'strength', minutes: 40, distanceKm: null, calories: null, effort: 6,
      elevationM: null, importHash: null, sets,
    } })
    await repository.execute({ type: 'measurement.add', value: { date: today(), weightKg: 74, waistCm: 82.5, hipsCm: null, bodyFatPct: 21 } })
    const saved = readDemo()
    expect(saved.workouts.at(-1)?.sets).toEqual(sets)
    expect(saved.measurements.find((item) => item.date === today())).toMatchObject({ weightKg: 74, waistCm: 82.5, hipsCm: null, bodyFatPct: 21 })
    const legacy = JSON.parse(localStorage.getItem(DEMO_KEY) ?? '{}') as { workouts: Record<string, unknown>[]; measurements: Record<string, unknown>[] }
    for (const workout of legacy.workouts) delete workout.sets
    for (const measurement of legacy.measurements) { delete measurement.waistCm; delete measurement.hipsCm; delete measurement.bodyFatPct }
    localStorage.setItem(DEMO_KEY, JSON.stringify(legacy))
    expect(readDemo().workouts.every((workout) => workout.sets === undefined)).toBe(true)
  })
  it('includes sample sets and waist values in a new demo', () => {
    const demo = createDemo()
    expect(demo.workouts.filter((workout) => workout.sets?.length)).toHaveLength(2)
    expect(demo.measurements.some((measurement) => measurement.waistCm != null)).toBe(true)
  })
  it('reads stored cloud sets defensively', () => {
    const valid = { exercise: 'push-up', reps: 12, weightKg: null, seconds: null }
    expect(setsFromRow([valid, { exercise: '', reps: 5 }, 'broken', { ...valid, reps: 1000 }])).toEqual([valid])
    expect(setsFromRow(null)).toEqual([])
    expect(setsFromRow(undefined)).toEqual([])
    expect(setsFromRow({ exercise: 'push-up' })).toEqual([])
  })
})

it('paginates all records rather than silently exporting only the first server page', async () => {
  const result = await readPages<number>(async (start, end) => ({
    data: Array.from({ length: Math.max(0, Math.min(end + 1, 1201) - start) }, (_, index) => start + index),
    error: null,
  }))
  expect(result).toHaveLength(1201)
  expect(result.at(-1)).toBe(1200)
})

describe('meal copies, templates and backup import in the demo', () => {
  beforeEach(() => localStorage.clear())
  it('adds several meals in one write and keeps templates with unique names', async () => {
    const repository = new DemoRepository()
    const original = await repository.load()
    expect(original.mealTemplates).toEqual([])
    const food = original.meals[0].food
    const spy = vi.spyOn(Storage.prototype, 'setItem')
    await repository.execute({ type: 'meal.addMany', value: [
      { date: '2026-01-02', meal: 'lunch', food, portion: 10 }, { date: '2026-01-02', meal: 'lunch', food, portion: 20 },
    ] })
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
    expect(readDemo().meals.filter((meal) => meal.date === '2026-01-02').map((meal) => meal.portion)).toEqual([10, 20])
    await expect(repository.execute({ type: 'meal.addMany', value: [{ date: '2026-01-02', meal: 'lunch', food: { ...food, unit: null }, portion: 5 }] })).rejects.toThrow()
    await repository.execute({ type: 'template.save', value: { name: 'Moje śniadanie', items: [{ food, portion: 60 }] } })
    await expect(repository.execute({ type: 'template.save', value: { name: ' moje ŚNIADANIE ', items: [{ food, portion: 60 }] } })).rejects.toThrow('o tej nazwie')
    const [template] = readDemo().mealTemplates
    expect(template).toMatchObject({ name: 'Moje śniadanie', items: [{ portion: 60 }] })
    await repository.execute({ type: 'template.delete', id: template.id })
    expect(readDemo().mealTemplates).toEqual([])
  })

  it('upgrades a demo saved before templates existed', () => {
    const legacy: Record<string, unknown> = { ...createDemo() }
    delete legacy.mealTemplates
    localStorage.setItem(DEMO_KEY, JSON.stringify(legacy))
    expect(readDemo().mealTemplates).toEqual([])
  })

  it('imports a backup in one write without deleting or overwriting existing records', async () => {
    const repository = new DemoRepository()
    const original = await repository.load()
    const backup = createDemo()
    backup.measurements.push({ id: crypto.randomUUID(), date: '2001-01-01', weightKg: 70 })
    backup.measurements[0] = { ...backup.measurements[0], date: original.measurements[0].date, weightKg: 99 }
    backup.mealTemplates.push({ id: crypto.randomUUID(), name: 'Zestaw', items: [{ food: backup.meals[0].food, portion: 40 }] })
    backup.profile = { ...backup.profile, calorieGoal: 1900 }
    const preview = planImport(original, backup, { replaceProfile: true, restorePlan: false })
    const progress: [number, number][] = []
    await repository.execute({ type: 'journal.import', value: preview.payload, onProgress: (saved, total) => progress.push([saved, total]) })
    const saved = readDemo()
    expect(saved.meals).toHaveLength(original.meals.length + preview.counts.meals.added)
    expect(saved.measurements.find((item) => item.date === original.measurements[0].date)?.weightKg).toBe(original.measurements[0].weightKg)
    expect(saved.measurements.some((item) => item.date === '2001-01-01')).toBe(true)
    expect(saved.mealTemplates.map((template) => template.name)).toEqual(['Zestaw'])
    expect(saved.profile.calorieGoal).toBe(1900)
    expect(saved.training).toEqual(original.training)
    expect(progress).toEqual([[preview.total, preview.total]])
    expect(planImport(saved, backup, { replaceProfile: false, restorePlan: false }).total).toBe(0)
  })
})

describe('cloud backup import', () => {
  function fakeClient(failOn?: { table: string; call: number }) {
    const calls: { table: string; size: number }[] = []
    const client = {
      from: (table: string) => ({
        insert: (rows: { id?: string }[]) => ({
          select: async () => {
            const call = calls.filter((item) => item.table === table).length
            calls.push({ table, size: rows.length })
            if (failOn?.table === table && failOn.call === call) return { data: null, error: { code: '57014', message: 'timeout' } }
            return { data: rows.map(() => ({ id: crypto.randomUUID() })), error: null }
          },
        }),
      }),
    }
    return { calls, repository: new SupabaseRepository(client as never, '33333333-3333-4333-8333-333333333333') }
  }
  const payload = (count: number): ImportPayload => {
    const food = createDemo().meals[0].food
    return {
      meals: Array.from({ length: count }, (_, index) => ({ date: '2026-01-01', meal: 'lunch' as const, food, portion: index + 1 })),
      workouts: [], water: [], measurements: [], customFoods: [], mealTemplates: [], profile: null, plan: null,
    }
  }

  it('writes in chunks of 200 and reports progress', async () => {
    const { calls, repository } = fakeClient()
    const progress: number[] = []
    await repository.execute({ type: 'journal.import', value: payload(450), onProgress: (saved) => progress.push(saved) })
    expect(calls.map((call) => call.size)).toEqual([200, 200, 50])
    expect(progress).toHaveLength(450)
    expect(progress.at(-1)).toBe(450)
  })

  it('names how many entries were saved when a chunk fails', async () => {
    const { repository } = fakeClient({ table: 'meal_entries', call: 1 })
    await expect(repository.execute({ type: 'journal.import', value: payload(450) })).rejects.toThrow('Zapisano 200 z 450 pozycji')
  })
})
