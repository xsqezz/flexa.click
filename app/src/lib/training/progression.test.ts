import { describe, expect, it } from 'vitest'
import type { Workout } from '../../../../shared/domain'
import { exerciseHistory, newRecords, personalRecords, progressionHint } from './sets'

const workout = (date: string, sets: Workout['sets']): Workout => ({
  id: crypto.randomUUID(), date, name: 'Siłownia', kind: 'strength', minutes: 45, distanceKm: null, calories: null, effort: null,
  elevationM: null, importHash: null, sets,
})
const set = (reps: number | null, weightKg: number | null) => ({ exercise: 'goblet-squat-db', reps, weightKg, seconds: null })
const history = (...sessions: [string, ReturnType<typeof set>[]][]) =>
  exerciseHistory(sessions.map(([date, sets]) => workout(date, sets)))[0]!

describe('personal records', () => {
  it('finds the best weight, estimated max and volume with their dates', () => {
    const item = history(['2026-09-01', [set(10, 20), set(10, 20)]], ['2026-09-08', [set(8, 24)]], ['2026-09-15', [set(10, 20)]])
    const records = Object.fromEntries(personalRecords(item).map((record) => [record.kind, record]))
    expect(records.weight).toMatchObject({ value: 24, date: '2026-09-08' })
    expect(records.volume).toMatchObject({ value: 400, date: '2026-09-01' })
    expect(records.estimate?.date).toBe('2026-09-08')
  })

  it('reports repetition records for bodyweight exercises only', () => {
    const item = history(['2026-09-01', [set(10, null)]], ['2026-09-08', [set(12, null)]])
    expect(personalRecords(item).map((record) => record.kind)).toEqual(['reps'])
    expect(newRecords(item)).toEqual(['reps'])
  })

  it('flags only records set in the latest session and needs two sessions', () => {
    expect(newRecords(history(['2026-09-01', [set(10, 20)]]))).toEqual([])
    const improved = history(['2026-09-01', [set(10, 20)]], ['2026-09-08', [set(10, 22.5)]])
    expect(newRecords(improved)).toEqual(expect.arrayContaining(['weight', 'estimate', 'volume']))
    const worse = history(['2026-09-01', [set(10, 22.5)]], ['2026-09-08', [set(10, 20)]])
    expect(newRecords(worse)).toEqual([])
  })
})

describe('progression hint', () => {
  it('suggests more load after two strong sessions at the same weight', () => {
    expect(progressionHint(history(['2026-09-01', [set(12, 20)]], ['2026-09-08', [set(12, 20)]]))).toContain('+2,5 kg')
  })

  it('suggests one more repetition while repetitions are still building', () => {
    expect(progressionHint(history(['2026-09-01', [set(8, 20)]], ['2026-09-08', [set(9, 20)]]))).toContain('jedno powtórzenie')
  })

  it('stays silent without comparable sessions or after a lower load', () => {
    expect(progressionHint(history(['2026-09-01', [set(12, 20)]]))).toBeNull()
    expect(progressionHint(history(['2026-09-01', [set(10, 20)]], ['2026-09-08', [set(10, 15)]]))).toBeNull()
  })

  it('keeps bodyweight suggestions about variants, not load', () => {
    expect(progressionHint(history(['2026-09-01', [set(15, null)]], ['2026-09-08', [set(16, null)]]))).toContain('wariantu')
  })
})
