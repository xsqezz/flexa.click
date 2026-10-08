import { describe, expect, it } from 'vitest'
import { workoutSchema, type Workout } from '../../../../shared/domain'
import {
  draftsToSets, estimatedMax, exerciseHistory, exerciseIdFor, formatSet, heaviestSet, lastSets, parseReps, parseWeight, rowsToSets, takesLoad,
} from './sets'

const workout = (date: string, sets: Workout['sets'], id = crypto.randomUUID()): Workout => ({
  id, date, name: 'Siłownia', kind: 'strength', minutes: 45, distanceKm: null, calories: null, effort: null,
  elevationM: null, importHash: null, sets,
})
const set = (exercise: string, reps: number | null, weightKg: number | null) => ({ exercise, reps, weightKg, seconds: null })

describe('logged sets', () => {
  it('keeps old workouts without sets valid and rejects malformed sets', () => {
    const legacy = { ...workout('2026-10-01', undefined) }
    delete legacy.sets
    expect(workoutSchema.parse(legacy).sets).toBeUndefined()
    expect(workoutSchema.safeParse(workout('2026-10-01', [set('goblet-squat-db', 0, 10)])).success).toBe(false)
    expect(workoutSchema.safeParse(workout('2026-10-01', [set('goblet-squat-db', 10, 501)])).success).toBe(false)
    expect(workoutSchema.safeParse(workout('2026-10-01', [set('', 10, 20)])).success).toBe(false)
    expect(workoutSchema.safeParse(workout('2026-10-01', Array.from({ length: 201 }, () => set('push-up', 10, null)))).success).toBe(false)
  })
  it('parses quick inputs leniently but never invents values', () => {
    expect(parseReps('10')).toBe(10)
    expect(parseReps('')).toBeNull()
    expect(parseReps('2.5')).toBeNull()
    expect(parseReps('101')).toBeNull()
    expect(parseWeight('22,5')).toBe(22.5)
    expect(parseWeight('-1')).toBeNull()
    expect(parseWeight('abc')).toBeNull()
  })
  it('maps typed library names to ids and keeps free names', () => {
    expect(exerciseIdFor('przysiad goblet z hantlem')).toBe('goblet-squat-db')
    expect(exerciseIdFor('  Wyciskanie na  wyciągu ')).toBe('Wyciskanie na wyciągu')
    expect(takesLoad('goblet-squat-db')).toBe(true)
    expect(takesLoad('push-up')).toBe(false)
    expect(takesLoad('Moje ćwiczenie')).toBe(true)
  })
  it('converts editor rows and reports rows that cannot be saved', () => {
    expect(rowsToSets([{ exercise: 'Pompka klasyczna', reps: '12', weight: '' }, { exercise: '', reps: '', weight: '' }]))
      .toEqual([set('push-up', 12, null)])
    expect(rowsToSets([{ exercise: '', reps: '10', weight: '' }])).toContain('Seria 1')
    expect(rowsToSets([{ exercise: 'Przysiad', reps: '0', weight: '' }])).toContain('od 1 do 100')
  })
  it('takes only completed player steps with a value, in order', () => {
    const steps = [{ id: 'a', exercise: 'x' }, { id: 'b', exercise: 'x' }, { id: 'c', exercise: 'y' }]
    const drafts = { a: { reps: '8', weight: '20' }, b: { reps: '', weight: '' }, c: { reps: '10', weight: '' } }
    expect(draftsToSets(steps, ['a', 'b'], drafts)).toEqual([set('x', 8, 20)])
    expect(draftsToSets(steps, ['c', 'a'], drafts)).toEqual([set('x', 8, 20), set('y', 10, null)])
  })
  it('remembers the latest set of every exercise for prefilling', () => {
    const history = lastSets([
      workout('2026-10-05', [set('row', 10, 22)]),
      workout('2026-10-01', [set('row', 10, 18), set('squat', 8, 30)]),
      workout('2026-10-05', [set('row', 8, 24)]),
    ])
    expect(history.get('row')).toEqual(set('row', 8, 24))
    expect(history.get('squat')).toEqual(set('squat', 8, 30))
  })
  it('estimates 1RM with the Epley formula only where it is meaningful', () => {
    expect(estimatedMax(set('x', 1, 100))).toBe(100)
    expect(estimatedMax(set('x', 10, 60))).toBeCloseTo(80)
    expect(estimatedMax(set('x', 20, 60))).toBeNull()
    expect(estimatedMax(set('x', 10, null))).toBeNull()
    expect(heaviestSet([set('x', 10, 20), set('x', 6, 25), set('x', 8, 25)])).toEqual(set('x', 8, 25))
    expect(formatSet(set('x', 8, 22.5))).toBe('8 × 22,5 kg')
    expect(formatSet(set('x', 12, null))).toBe('12 powt.')
  })
  it('summarises every exercise across workouts', () => {
    const history = exerciseHistory([
      workout('2026-10-01', [set('squat', 10, 20), set('squat', 10, 20), set('push-up', 12, null)]),
      workout('2026-10-08', [set('squat', 8, 25), set('squat', 8, 25)]),
      workout('2026-10-03', undefined),
    ])
    expect(history.map((item) => item.exercise)).toEqual(['squat', 'push-up'])
    const squat = history[0]
    expect(squat.sessions.map((session) => [session.date, session.volume])).toEqual([['2026-10-01', 400], ['2026-10-08', 400]])
    expect(squat.heaviest).toEqual(set('squat', 8, 25))
    expect(squat.estimate).toBeCloseTo(25 * (1 + 8 / 30))
    expect(squat.lastDate).toBe('2026-10-08')
    expect(history[1]).toMatchObject({ name: 'Pompka klasyczna', heaviest: null, estimate: null })
    expect(history[1].sessions[0].reps).toBe(12)
  })
})
