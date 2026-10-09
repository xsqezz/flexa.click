import { beforeEach, describe, expect, it } from 'vitest'
import { clearHabits, lineWithHabit, readHabits, rememberLines, saveHabits } from './habits'

describe('scan habits', () => {
  beforeEach(() => localStorage.clear())

  it('starts with a medium portion for unknown items', () => {
    expect(lineWithHabit({}, 'x')).toEqual({ id: 'x', size: 'M' })
  })

  it('remembers size, pieces or grams but never menu values', () => {
    const habits = rememberLines({}, [
      { id: 'fries', size: 'L' }, { id: 'nuggets', count: 9 }, { id: 'rice', grams: 180 },
      { id: 'burger', size: 'M', exact: { kcal: 500, protein: 25, carbs: 40, fat: 20 } },
    ], 1000)
    expect(Object.keys(habits).sort()).toEqual(['fries', 'nuggets', 'rice'])
    expect(lineWithHabit(habits, 'fries')).toEqual({ id: 'fries', size: 'L' })
    expect(lineWithHabit(habits, 'nuggets')).toEqual({ id: 'nuggets', count: 9 })
    expect(lineWithHabit(habits, 'rice')).toEqual({ id: 'rice', grams: 180 })
    expect(lineWithHabit(habits, 'burger')).toEqual({ id: 'burger', size: 'M' })
  })

  it('keeps only the most recent 200 items', () => {
    let habits = {}
    for (let index = 0; index < 205; index++) habits = rememberLines(habits, [{ id: `item-${index}`, size: 'S' }], index)
    expect(Object.keys(habits)).toHaveLength(200)
    expect(habits).not.toHaveProperty('item-0')
    expect(habits).toHaveProperty('item-204')
  })

  it('persists per scope, survives corrupt data and can be cleared', () => {
    saveHabits('demo', rememberLines({}, [{ id: 'fries', size: 'S' }]))
    expect(readHabits('demo')).toHaveProperty('fries')
    expect(readHabits('other')).toEqual({})
    clearHabits('demo')
    expect(readHabits('demo')).toEqual({})
    localStorage.setItem('flexa:scan-habits:v1:demo', '[1]')
    expect(readHabits('demo')).toEqual({})
  })
})
