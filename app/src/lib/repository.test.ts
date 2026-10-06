import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEMO_KEY, createDemo, readDemo, writeDemo } from './demo'
import { DemoRepository, readPages } from './repository'
import { today } from './dates'

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

it('paginates all records rather than silently exporting only the first server page', async () => {
  const result = await readPages<number>(async (start, end) => ({
    data: Array.from({ length: Math.max(0, Math.min(end + 1, 1201) - start) }, (_, index) => start + index),
    error: null,
  }))
  expect(result).toHaveLength(1201)
  expect(result.at(-1)).toBe(1200)
})
