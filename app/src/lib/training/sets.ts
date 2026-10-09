import type { Workout, WorkoutSet } from '../../../../shared/domain'
import { numberFormat } from '../nutrition'
import { exercises, findExercise } from './library'

/** Text typed into the quick set inputs; kept as text so half-typed values survive a reload. */
export type SetDraft = { reps: string; weight: string }

export function parseReps(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'))
  return text.trim() !== '' && Number.isInteger(value) && value >= 1 && value <= 100 ? value : null
}

export function parseWeight(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'))
  return text.trim() !== '' && Number.isFinite(value) && value >= 0 && value <= 500 ? Math.round(value * 100) / 100 : null
}

export function exerciseName(id: string): string {
  return findExercise(id)?.name ?? id
}

const byName = new Map(exercises.map((exercise) => [exercise.name.toLocaleLowerCase('pl-PL'), exercise.id]))

/** Maps a typed name back to the library id when it matches exactly, otherwise keeps the free name. */
export function exerciseIdFor(name: string): string {
  const clean = name.trim().replace(/\s+/g, ' ')
  return byName.get(clean.toLocaleLowerCase('pl-PL')) ?? clean.slice(0, 80)
}

const loadEquipment = new Set<string>(['dumbbells', 'kettlebell', 'barbell', 'cable', 'machines'])

/** Exercises where an external load (dumbbell, barbell, machine…) can be noted in kilograms. */
export function takesLoad(id: string): boolean {
  const exercise = findExercise(id)
  if (!exercise) return true
  return !exercise.bodyweight && exercise.equipment.some((set) => set.some((item) => loadEquipment.has(item)))
}

/** The most recently logged set of every exercise (later dates, then later entries, win). */
export function lastSets(workouts: Workout[]): Map<string, WorkoutSet> {
  const sorted = workouts.map((workout, index) => ({ workout, index }))
    .sort((a, b) => a.workout.date.localeCompare(b.workout.date) || a.index - b.index)
  const result = new Map<string, WorkoutSet>()
  for (const { workout } of sorted) for (const set of workout.sets ?? []) result.set(set.exercise, set)
  return result
}

export function setDraftFrom(set: WorkoutSet | undefined): SetDraft {
  return { reps: set?.reps != null ? String(set.reps) : '', weight: set?.weightKg != null ? String(set.weightKg) : '' }
}

/** Turns the drafts of completed steps into sets for the diary, in the order they were done. */
export function draftsToSets(steps: { id: string; exercise: string }[], done: string[], drafts: Record<string, SetDraft>): WorkoutSet[] {
  const finished = new Set(done)
  return steps.flatMap((step) => {
    const draft = drafts[step.id]
    if (!draft || !finished.has(step.id)) return []
    const reps = parseReps(draft.reps)
    const weightKg = parseWeight(draft.weight)
    return reps === null && weightKg === null ? [] : [{ exercise: step.exercise, reps, weightKg, seconds: null }]
  }).slice(0, 200)
}

/** Epley estimate of a one-repetition maximum. Only for 1–15 repetitions with a known load. */
export function estimatedMax(set: WorkoutSet): number | null {
  if (set.weightKg === null || set.weightKg <= 0 || set.reps === null || set.reps > 15) return null
  return set.reps === 1 ? set.weightKg : set.weightKg * (1 + set.reps / 30)
}

/** Heaviest load; equal loads are decided by more repetitions. */
export function heaviestSet(sets: WorkoutSet[]): WorkoutSet | null {
  let best: WorkoutSet | null = null
  for (const set of sets) {
    if (set.weightKg === null) continue
    if (!best || set.weightKg > (best.weightKg ?? 0) || (set.weightKg === best.weightKg && (set.reps ?? 0) > (best.reps ?? 0))) best = set
  }
  return best
}

/** Converts the rows of the "Serie" editor into sets, or returns a message for the first row that cannot be saved. */
export function rowsToSets(rows: { exercise: string; reps: string; weight: string }[]): WorkoutSet[] | string {
  const sets: WorkoutSet[] = []
  for (const [index, row] of rows.entries()) {
    if (!row.exercise.trim() && !row.reps.trim() && !row.weight.trim()) continue
    if (!row.exercise.trim()) return `Seria ${index + 1}: wpisz nazwę ćwiczenia albo usuń serię.`
    const reps = parseReps(row.reps)
    const weightKg = parseWeight(row.weight)
    if (row.reps.trim() && reps === null) return `Seria ${index + 1}: powtórzenia to liczba całkowita od 1 do 100.`
    if (row.weight.trim() && weightKg === null) return `Seria ${index + 1}: ciężar podaj w kilogramach (0–500).`
    sets.push({ exercise: exerciseIdFor(row.exercise), reps, weightKg, seconds: null })
  }
  return sets.slice(0, 200)
}

export function formatSet(set: WorkoutSet): string {
  const parts: string[] = []
  if (set.reps !== null) parts.push(set.weightKg !== null ? `${set.reps} ×` : `${set.reps} powt.`)
  if (set.weightKg !== null) parts.push(`${numberFormat.format(set.weightKg)} kg`)
  if (set.seconds !== null) parts.push(`${set.seconds} s`)
  return parts.join(' ') || 'wykonana'
}

export type ExerciseSession = {
  workoutId: string
  date: string
  sets: WorkoutSet[]
  /** Sum of repetitions × kilograms over sets with both values. */
  volume: number
  reps: number
  heaviest: WorkoutSet | null
  estimate: number | null
}

export type ExerciseHistory = {
  exercise: string
  name: string
  sessions: ExerciseSession[]
  lastDate: string
  heaviest: WorkoutSet | null
  estimate: number | null
}

export function exerciseHistory(workouts: Workout[]): ExerciseHistory[] {
  const groups = new Map<string, ExerciseSession[]>()
  for (const workout of workouts) {
    const byExercise = new Map<string, WorkoutSet[]>()
    for (const set of workout.sets ?? []) byExercise.set(set.exercise, [...byExercise.get(set.exercise) ?? [], set])
    for (const [exercise, sets] of byExercise) {
      const estimates = sets.map(estimatedMax).filter((value): value is number => value !== null)
      groups.set(exercise, [...groups.get(exercise) ?? [], {
        workoutId: workout.id, date: workout.date, sets,
        volume: sets.reduce((sum, set) => sum + (set.reps ?? 0) * (set.weightKg ?? 0), 0),
        reps: sets.reduce((sum, set) => sum + (set.reps ?? 0), 0),
        heaviest: heaviestSet(sets),
        estimate: estimates.length ? Math.max(...estimates) : null,
      }])
    }
  }
  return [...groups].map(([exercise, unsorted]) => {
    const sessions = unsorted.sort((a, b) => a.date.localeCompare(b.date))
    const estimates = sessions.map((session) => session.estimate).filter((value): value is number => value !== null)
    return {
      exercise, name: exerciseName(exercise), sessions,
      lastDate: sessions[sessions.length - 1].date,
      heaviest: heaviestSet(sessions.flatMap((session) => session.sets)),
      estimate: estimates.length ? Math.max(...estimates) : null,
    }
  }).sort((a, b) => b.lastDate.localeCompare(a.lastDate) || a.name.localeCompare(b.name, 'pl'))
}

export type RecordKind = 'weight' | 'estimate' | 'volume' | 'reps'
export type PersonalRecord = { kind: RecordKind; label: string; value: number; unit: string; date: string }

/** Best session values for an exercise, with the date they were reached. Ties keep the earlier date. */
export function personalRecords(item: ExerciseHistory): PersonalRecord[] {
  const best = (read: (session: ExerciseSession) => number | null) => {
    let found: { value: number; date: string } | null = null
    for (const session of item.sessions) {
      const value = read(session)
      if (value !== null && value > 0 && (!found || value > found.value)) found = { value, date: session.date }
    }
    return found
  }
  const result: PersonalRecord[] = []
  const weight = best((session) => session.heaviest?.weightKg ?? null)
  const estimate = best((session) => session.estimate)
  const volume = best((session) => session.volume || null)
  const reps = weight || volume ? null : best((session) => session.reps || null)
  if (weight) result.push({ kind: 'weight', label: 'Największy ciężar', unit: 'kg', ...weight })
  if (estimate) result.push({ kind: 'estimate', label: 'Szacowane 1RM', unit: 'kg', ...estimate })
  if (volume) result.push({ kind: 'volume', label: 'Objętość treningu', unit: 'kg × powt.', ...volume })
  if (reps) result.push({ kind: 'reps', label: 'Powtórzenia w treningu', unit: 'powt.', ...reps })
  return result
}

/** Records that the latest session set: it beat everything logged before it (needs at least two sessions). */
export function newRecords(item: ExerciseHistory): RecordKind[] {
  if (item.sessions.length < 2) return []
  const last = item.sessions[item.sessions.length - 1]!
  const earlier = { ...item, sessions: item.sessions.slice(0, -1) }
  const before = new Map(personalRecords(earlier).map((record) => [record.kind, record.value]))
  const now = personalRecords(item).filter((record) => record.date === last.date)
  return now.filter((record) => record.value > (before.get(record.kind) ?? 0)).map((record) => record.kind)
}

/**
 * A gentle double-progression suggestion from the last two sessions: add repetitions first, then load.
 * It is only a suggestion and returns null when there is not enough comparable data.
 */
export function progressionHint(item: ExerciseHistory): string | null {
  const [previous, last] = item.sessions.slice(-2)
  if (!previous || !last) return null
  const top = (session: ExerciseSession) => session.heaviest ?? session.sets.reduce<WorkoutSet | null>((best, item) => (item.reps ?? 0) > (best?.reps ?? 0) ? item : best, null)
  const a = top(previous)
  const b = top(last)
  if (!a || !b || a.reps === null || b.reps === null) return null
  if (a.weightKg !== null && b.weightKg !== null) {
    if (a.weightKg === b.weightKg && a.reps >= 12 && b.reps >= 12) return `Dwa treningi z rzędu ${b.reps} powt. przy ${numberFormat.format(b.weightKg)} kg. Możesz spróbować +2,5 kg i wrócić do 8–10 powtórzeń.`
    if (a.weightKg === b.weightKg && b.reps >= 8 && b.reps >= a.reps) return `Przy ${numberFormat.format(b.weightKg)} kg spróbuj dołożyć jedno powtórzenie w serii.`
    if (b.weightKg > a.weightKg) return `Ciężar wzrósł do ${numberFormat.format(b.weightKg)} kg. Zostań przy nim, aż powtórzenia będą pewne.`
    return null
  }
  if (a.weightKg === null && b.weightKg === null && b.reps >= 15 && a.reps >= 15) return 'Seria 15+ powtórzeń dwa razy z rzędu. Spróbuj trudniejszego wariantu albo wolniejszego tempa.'
  return null
}
