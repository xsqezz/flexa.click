import {
  gymEquipment, homeEquipment, trainingPlanSchema,
  type Equipment, type Goal, type Limitation, type PlanBlock, type PlanDrill, type PlanItem,
  type PlanSession, type SessionKind, type Target, type TrainingAnswers, type TrainingPlan,
} from '../../../../shared/training'
import { exercises, findExercise, type Exercise, type Pattern } from './library'

export type AgeBand = 'teen' | 'adult' | 'midlife' | 'older' | 'senior'
type Role = 'main' | 'secondary' | 'accessory' | 'core' | 'carry' | 'balance' | 'posture'
type Slot = { patterns: Pattern[]; role: Role; optional?: number }

export type Context = {
  answers: TrainingAnswers
  available: Set<Equipment>
  limitations: Set<Limitation>
  maxLevel: 1 | 2 | 3
  allowImpact: boolean
  band: AgeBand
  used: Map<string, number>
}

export const strengthKinds: ReadonlySet<SessionKind> = new Set<SessionKind>([
  'full-a', 'full-b', 'full-c', 'upper-a', 'upper-b', 'lower-a', 'lower-b', 'push', 'pull', 'legs', 'posture-a', 'posture-b',
])

export function ageBand(age: number): AgeBand {
  if (age < 18) return 'teen'
  if (age < 40) return 'adult'
  if (age < 50) return 'midlife'
  if (age < 65) return 'older'
  return 'senior'
}

export function createContext(answers: TrainingAnswers): Context {
  const band = ageBand(answers.age)
  const limitations = new Set(answers.limitations)
  let maxLevel: 1 | 2 | 3 = answers.level === 'beginner' ? 1 : answers.level === 'intermediate' ? 2 : 3
  if ((band === 'teen' || band === 'senior') && maxLevel > 2) maxLevel = 2
  if (answers.cautiousStart) maxLevel = 1
  const jointRisk = (['low-impact', 'knees', 'ankles', 'hips', 'osteoporosis'] as const).some((item) => limitations.has(item))
  const allowImpact = !jointRisk && !answers.cautiousStart && band !== 'senior' && !(band === 'older' && answers.level === 'beginner')
  const available = new Set<Equipment>(answers.place === 'gym' ? [...homeEquipment, ...gymEquipment] : answers.equipment)
  return { answers, available, limitations, maxLevel, allowImpact, band, used: new Map() }
}

export function fitsEquipment(exercise: Exercise, available: Set<Equipment>): boolean {
  return exercise.equipment.some((set) => set.every((item) => available.has(item)))
}

export function isEligible(exercise: Exercise, context: Context): boolean {
  return exercise.level <= context.maxLevel
    && fitsEquipment(exercise, context.available)
    && !(exercise.home && context.answers.place === 'gym')
    && !(exercise.impact && !context.allowImpact)
    && !(exercise.avoid ?? []).some((item) => context.limitations.has(item))
}

function loadScore(exercise: Exercise, available: Set<Equipment>): number {
  const set = exercise.equipment.find((items) => items.every((item) => available.has(item))) ?? []
  if (exercise.bodyweight) return 0.5 + exercise.level * 0.4
  if (set.includes('barbell')) return 3
  if (set.includes('machines') || set.includes('cable')) return 2.5
  if (set.includes('dumbbells') || set.includes('kettlebell')) return 2
  if (set.includes('bands')) return 1.2
  if (set.includes('miniband')) return 0.9
  return 0.5 + exercise.level * 0.4
}

const classicLifts = new Set(['back-squat-bb', 'deadlift-bb', 'bench-press-bb', 'ohp-bb', 'pull-up', 'hip-thrust-bb'])

function score(exercise: Exercise, role: Role, context: Context): number {
  const goal = context.answers.goal
  const heavy = goal === 'strength' || goal === 'muscle'
  let value = -(context.used.get(exercise.id) ?? 0) * 10
  const load = loadScore(exercise, context.available)
  if (role === 'main' || role === 'secondary') value += load * (heavy ? 2 : 1.5)
  else value += load * 0.3
  if (exercise.level === context.maxLevel) value += 0.4
  if (role === 'main' && goal === 'strength' && classicLifts.has(exercise.id)) value += 1.5
  if ((context.band === 'senior' || context.answers.cautiousStart) && exercise.level === 1) value += 2
  return value
}

function pick(slot: Slot, context: Context, exclude: Set<string>, allow: (exercise: Exercise) => boolean = () => true): Exercise | null {
  for (const pattern of slot.patterns) {
    const options = exercises.filter((exercise) => exercise.pattern === pattern && !exclude.has(exercise.id) && isEligible(exercise, context) && allow(exercise))
    if (!options.length) continue
    return options.reduce((best, option) => score(option, slot.role, context) > score(best, slot.role, context) ? option : best)
  }
  return null
}

const templates: Partial<Record<SessionKind, Slot[]>> = {
  'full-a': [
    { patterns: ['squat', 'lunge'], role: 'main' }, { patterns: ['push-h', 'push-v'], role: 'secondary' },
    { patterns: ['pull-h', 'pull-v'], role: 'secondary' }, { patterns: ['hinge', 'glute'], role: 'secondary' },
    { patterns: ['core-ae', 'core-ar'], role: 'core' }, { patterns: ['lunge', 'glute'], role: 'accessory', optional: 2 },
    { patterns: ['shoulder', 'posture'], role: 'accessory', optional: 3 }, { patterns: ['carry', 'core-ar'], role: 'carry', optional: 4 },
  ],
  'full-b': [
    { patterns: ['hinge', 'glute'], role: 'main' }, { patterns: ['pull-v', 'pull-h'], role: 'secondary' },
    { patterns: ['lunge', 'squat'], role: 'secondary' }, { patterns: ['push-v', 'push-h'], role: 'secondary' },
    { patterns: ['core-ar', 'core-ae'], role: 'core' }, { patterns: ['glute', 'hamstring'], role: 'accessory', optional: 2 },
    { patterns: ['shoulder', 'posture'], role: 'accessory', optional: 3 }, { patterns: ['biceps', 'triceps'], role: 'accessory', optional: 4 },
  ],
  'full-c': [
    { patterns: ['lunge', 'squat'], role: 'main' }, { patterns: ['push-h', 'push-v'], role: 'secondary' },
    { patterns: ['glute', 'hinge'], role: 'secondary' }, { patterns: ['pull-h', 'pull-v'], role: 'secondary' },
    { patterns: ['core-ae', 'core-ar'], role: 'core' }, { patterns: ['push-v', 'shoulder'], role: 'accessory', optional: 2 },
    { patterns: ['carry', 'core-ar'], role: 'carry', optional: 3 }, { patterns: ['calf', 'hamstring'], role: 'accessory', optional: 4 },
  ],
  'upper-a': [
    { patterns: ['push-h'], role: 'main' }, { patterns: ['pull-h', 'pull-v'], role: 'secondary' },
    { patterns: ['push-v', 'push-h'], role: 'secondary' }, { patterns: ['pull-v', 'pull-h'], role: 'secondary' },
    { patterns: ['shoulder', 'posture'], role: 'accessory' }, { patterns: ['core-ar', 'core-ae'], role: 'core', optional: 1 },
    { patterns: ['biceps'], role: 'accessory', optional: 2 }, { patterns: ['triceps'], role: 'accessory', optional: 2 },
  ],
  'upper-b': [
    { patterns: ['pull-v', 'pull-h'], role: 'main' }, { patterns: ['push-v', 'push-h'], role: 'secondary' },
    { patterns: ['pull-h', 'pull-v'], role: 'secondary' }, { patterns: ['push-h'], role: 'secondary' },
    { patterns: ['shoulder', 'posture'], role: 'accessory' }, { patterns: ['core-ae', 'core-ar'], role: 'core', optional: 1 },
    { patterns: ['triceps'], role: 'accessory', optional: 2 }, { patterns: ['biceps'], role: 'accessory', optional: 2 },
  ],
  'lower-a': [
    { patterns: ['squat', 'lunge'], role: 'main' }, { patterns: ['hinge', 'glute'], role: 'secondary' },
    { patterns: ['lunge', 'squat'], role: 'secondary' }, { patterns: ['hamstring', 'glute'], role: 'accessory' },
    { patterns: ['core-ae', 'core-ar'], role: 'core' }, { patterns: ['calf'], role: 'accessory', optional: 2 },
    { patterns: ['glute'], role: 'accessory', optional: 3 },
  ],
  'lower-b': [
    { patterns: ['hinge', 'glute'], role: 'main' }, { patterns: ['squat', 'lunge'], role: 'secondary' },
    { patterns: ['lunge'], role: 'secondary' }, { patterns: ['glute', 'hamstring'], role: 'accessory' },
    { patterns: ['core-ar', 'core-ae'], role: 'core' }, { patterns: ['calf'], role: 'accessory', optional: 2 },
    { patterns: ['carry'], role: 'carry', optional: 3 },
  ],
  push: [
    { patterns: ['push-h'], role: 'main' }, { patterns: ['push-v', 'push-h'], role: 'secondary' },
    { patterns: ['push-h'], role: 'secondary' }, { patterns: ['shoulder'], role: 'accessory' },
    { patterns: ['triceps'], role: 'accessory' }, { patterns: ['core-ae'], role: 'core', optional: 1 },
    { patterns: ['triceps'], role: 'accessory', optional: 2 },
  ],
  pull: [
    { patterns: ['pull-v', 'pull-h'], role: 'main' }, { patterns: ['pull-h'], role: 'secondary' },
    { patterns: ['pull-h', 'pull-v'], role: 'secondary' }, { patterns: ['shoulder', 'posture'], role: 'accessory' },
    { patterns: ['biceps'], role: 'accessory' }, { patterns: ['carry', 'core-ar'], role: 'carry', optional: 1 },
    { patterns: ['biceps'], role: 'accessory', optional: 2 },
  ],
  legs: [
    { patterns: ['squat'], role: 'main' }, { patterns: ['hinge', 'glute'], role: 'secondary' },
    { patterns: ['lunge'], role: 'secondary' }, { patterns: ['hamstring', 'glute'], role: 'accessory' },
    { patterns: ['calf'], role: 'accessory' }, { patterns: ['core-ae', 'core-ar'], role: 'core', optional: 1 },
    { patterns: ['glute'], role: 'accessory', optional: 2 },
  ],
  'posture-a': [
    { patterns: ['pull-h', 'pull-v'], role: 'main' }, { patterns: ['glute', 'hinge'], role: 'secondary' },
    { patterns: ['hinge', 'squat'], role: 'secondary' }, { patterns: ['posture'], role: 'posture' },
    { patterns: ['core-ae'], role: 'core' }, { patterns: ['shoulder'], role: 'accessory', optional: 1 },
    { patterns: ['push-h'], role: 'accessory', optional: 2 }, { patterns: ['posture'], role: 'posture', optional: 3 },
  ],
  'posture-b': [
    { patterns: ['pull-v', 'pull-h'], role: 'main' }, { patterns: ['squat', 'lunge'], role: 'secondary' },
    { patterns: ['posture'], role: 'posture' }, { patterns: ['core-ar'], role: 'core' },
    { patterns: ['lunge', 'glute'], role: 'accessory' }, { patterns: ['shoulder'], role: 'accessory', optional: 1 },
    { patterns: ['balance'], role: 'balance', optional: 2 }, { patterns: ['glute'], role: 'accessory', optional: 3 },
  ],
}

const schedules: Record<Goal, SessionKind[][]> = {
  strength: [['full-a', 'full-b'], ['full-a', 'full-b', 'full-c'], ['upper-a', 'lower-a', 'upper-b', 'lower-b'], ['upper-a', 'lower-a', 'push', 'pull', 'legs'], ['push', 'pull', 'legs', 'push', 'pull', 'legs']],
  muscle: [['full-a', 'full-b'], ['full-a', 'full-b', 'full-c'], ['upper-a', 'lower-a', 'upper-b', 'lower-b'], ['upper-a', 'lower-a', 'push', 'pull', 'legs'], ['push', 'pull', 'legs', 'push', 'pull', 'legs']],
  'fat-loss': [['full-a', 'full-b'], ['full-a', 'full-b', 'full-c'], ['full-a', 'conditioning', 'full-b', 'full-c'], ['full-a', 'conditioning', 'full-b', 'cardio', 'full-c'], ['upper-a', 'lower-a', 'conditioning', 'upper-b', 'lower-b', 'cardio']],
  conditioning: [['full-a', 'conditioning'], ['full-a', 'conditioning', 'full-b'], ['full-a', 'conditioning', 'full-b', 'cardio'], ['full-a', 'conditioning', 'full-b', 'cardio', 'full-c'], ['full-a', 'conditioning', 'full-b', 'cardio', 'full-c', 'mobility']],
  posture: [['posture-a', 'posture-b'], ['posture-a', 'mobility', 'posture-b'], ['posture-a', 'mobility', 'posture-b', 'cardio'], ['posture-a', 'mobility', 'posture-b', 'cardio', 'full-c'], ['posture-a', 'mobility', 'posture-b', 'cardio', 'full-c', 'mobility']],
  health: [['full-a', 'full-b'], ['full-a', 'cardio', 'full-b'], ['full-a', 'cardio', 'full-b', 'mobility'], ['full-a', 'cardio', 'full-b', 'mobility', 'full-c'], ['full-a', 'cardio', 'full-b', 'mobility', 'full-c', 'cardio']],
}

export function strengthDayCap(context: Context): number {
  if (context.answers.cautiousStart || context.band === 'senior') return 3
  if (context.answers.level === 'beginner' || context.band === 'teen') return 4
  return 6
}

export function scheduleKinds(context: Context): SessionKind[] {
  const count = context.answers.weekdays.length
  let kinds = [...schedules[context.answers.goal][count - 2]]
  const heavy = context.answers.goal === 'strength' || context.answers.goal === 'muscle'
  if (heavy && count >= 5 && strengthDayCap(context) < 6) kinds = ['upper-a', 'lower-a', 'cardio', 'upper-b', 'lower-b', 'mobility'].slice(0, count) as SessionKind[]
  const cap = strengthDayCap(context)
  let strength = kinds.filter((kind) => strengthKinds.has(kind)).length
  for (let index = kinds.length - 1; index >= 0 && strength > cap; index--) {
    if (!strengthKinds.has(kinds[index])) continue
    kinds[index] = index % 2 === 0 ? 'mobility' : 'cardio'
    strength--
  }
  if (cap <= 3 && kinds.some((kind) => kind.startsWith('upper') || kind.startsWith('lower') || ['push', 'pull', 'legs'].includes(kind))) {
    const full: SessionKind[] = ['full-a', 'full-b', 'full-c']
    let next = 0
    kinds = kinds.map((kind) => strengthKinds.has(kind) && !kind.startsWith('posture') ? full[next++ % 3] : kind)
  }
  return kinds
}

const baseTable: Record<Goal, Record<'main' | 'secondary' | 'accessory', [number, number, number, number, number]>> = {
  strength: { main: [4, 4, 6, 150, 2], secondary: [3, 6, 8, 120, 2], accessory: [2, 8, 12, 75, 2] },
  muscle: { main: [3, 6, 10, 120, 2], secondary: [3, 8, 12, 90, 2], accessory: [3, 10, 15, 60, 1] },
  'fat-loss': { main: [3, 8, 12, 90, 2], secondary: [3, 10, 12, 60, 2], accessory: [2, 12, 15, 45, 2] },
  conditioning: { main: [3, 10, 12, 75, 2], secondary: [3, 12, 15, 60, 2], accessory: [2, 12, 15, 45, 2] },
  posture: { main: [3, 10, 12, 75, 3], secondary: [3, 10, 12, 60, 3], accessory: [2, 12, 15, 45, 3] },
  health: { main: [3, 8, 12, 90, 3], secondary: [2, 10, 12, 75, 3], accessory: [2, 12, 15, 60, 3] },
}

const byLevel = <T>(context: Context, beginner: T, intermediate: T, advanced: T) =>
  context.answers.level === 'beginner' ? beginner : context.answers.level === 'intermediate' ? intermediate : advanced

function fittedSet(exercise: Exercise, available: Set<Equipment>): Equipment[] {
  return exercise.equipment.find((set) => set.every((item) => available.has(item))) ?? []
}

function external(exercise: Exercise, available: Set<Equipment>): 'heavy' | 'band' | 'none' {
  const set = fittedSet(exercise, available)
  if (exercise.bodyweight) return 'none'
  if (set.some((item) => item === 'barbell' || item === 'machines' || item === 'cable' || item === 'dumbbells' || item === 'kettlebell')) return 'heavy'
  if (set.some((item) => item === 'bands' || item === 'miniband')) return 'band'
  return 'none'
}

export function prescribe(exercise: Exercise, role: Role, context: Context): PlanItem {
  const { answers, band } = context
  const hold = (seconds: number, sets: number, rest: number): PlanItem => ({ exercise: exercise.id, sets, target: { type: 'time', seconds }, rest, rir: null, tempo: null })
  if (exercise.measure === 'time') {
    let seconds = role === 'carry' ? byLevel(context, 30, 40, 45) : role === 'balance' ? byLevel(context, 20, 30, 40) : byLevel(context, 20, 30, 40)
    if (exercise.id === 'wall-sit') seconds = byLevel(context, 30, 40, 50)
    if (answers.cautiousStart || band === 'senior') seconds = Math.min(seconds, role === 'balance' ? 30 : 20)
    if (context.limitations.has('hypertension')) seconds = Math.min(seconds, 30)
    const sets = role === 'balance' ? 2 : answers.level === 'beginner' ? 2 : 3
    return hold(seconds, sets, role === 'carry' ? 60 : role === 'balance' ? 30 : 45)
  }
  if (role === 'core' || role === 'balance' || role === 'posture') {
    const [min, max] = exercise.unit === 'steps' ? [10, 10] : role === 'posture' ? [10, 12] : byLevel<[number, number]>(context, [6, 8], [8, 10], [10, 12])
    const sets = role === 'balance' ? 2 : answers.goal === 'posture' || answers.level !== 'beginner' ? 3 : 2
    return { exercise: exercise.id, sets, target: { type: 'reps', min, max }, rest: role === 'balance' ? 30 : 45, rir: null, tempo: role === 'posture' ? 'pauza 2 s' : null }
  }
  const tier = role === 'main' ? 'main' : role === 'secondary' ? 'secondary' : 'accessory'
  let [sets, min, max, rest, rir] = baseTable[answers.goal][tier]
  if (answers.level === 'beginner') {
    sets = Math.min(sets, tier === 'accessory' ? 2 : 3)
    rir = Math.max(rir, 2)
    if (answers.goal === 'strength' && tier === 'main') { [min, max, rir] = [6, 8, 3] }
  }
  if (answers.level === 'advanced' && tier === 'main') {
    if (answers.goal === 'strength') { [sets, min, max] = [5, 3, 5] }
    if (answers.goal === 'muscle') sets = 4
  }
  const load = external(exercise, context.available)
  if (load === 'none' && (tier !== 'accessory' || min < 10)) {
    const heavyGoal = answers.goal === 'strength' || answers.goal === 'muscle'
    ;[min, max] = exercise.level >= 3 ? [5, 10] : exercise.level === 2 && heavyGoal ? [6, 12] : [10, 15]
  }
  if (load === 'band') { [min, max] = tier === 'accessory' ? [15, 20] : [12, 15] }
  if (band === 'teen') { rir = Math.max(rir, 2); if (min < 6) [min, max] = [6, 8] }
  if (band === 'older') rir = Math.max(rir, 2)
  if (band === 'senior') { rir = Math.max(rir, 3); sets = Math.min(sets, 3); rest += 15; if (min < 8) [min, max] = [8, 12] }
  if (answers.cautiousStart) { rir = Math.max(rir, 3); sets = Math.max(2, sets - 1); if (min < 10) [min, max] = [10, 15] }
  if (context.limitations.has('hypertension')) rir = Math.max(rir, 2)
  const tempo = answers.goal === 'muscle' && tier !== 'accessory' ? '3-0-1' : answers.goal === 'posture' && tier !== 'accessory' ? '2-1-2' : null
  return { exercise: exercise.id, sets, target: { type: 'reps', min, max }, rest: Math.min(rest, 180), rir, tempo }
}

const gentleCardio = (context: Context) => context.answers.cautiousStart || context.band === 'senior' || context.limitations.has('hypertension')

export function conditioningTarget(exercise: Exercise, context: Context, seconds: number): Target {
  const minutes = Math.max(5, Math.min(45, Math.round(seconds / 60)))
  if (exercise.cardioMode === 'steady' || (gentleCardio(context) && exercise.cardioMode !== 'intervals')) return { type: 'steady', minutes }
  const table: Record<Goal, [number, number, number][]> = {
    'fat-loss': [[6, 30, 60], [8, 30, 45], [10, 30, 30]],
    conditioning: [[6, 40, 50], [8, 45, 45], [10, 40, 20]],
    health: [[5, 30, 60], [6, 30, 45], [8, 30, 30]],
    strength: [[6, 30, 60], [6, 30, 60], [8, 30, 45]],
    muscle: [[6, 30, 60], [6, 30, 60], [8, 30, 45]],
    posture: [[5, 30, 60], [6, 30, 45], [6, 30, 45]],
  }
  const row = table[context.answers.goal]
  let [rounds, work, recover] = byLevel(context, row[0], row[1], row[2])
  if (gentleCardio(context)) [rounds, work, recover] = [6, 30, 60]
  rounds = Math.max(4, Math.min(rounds, Math.floor(seconds / (work + recover))))
  return { type: 'intervals', rounds, work, recover }
}

function workSeconds(item: PlanItem): number {
  const exercise = findExercise(item.exercise)
  const sides = exercise?.perSide ? 2 : 1
  const target = item.target
  if (target.type === 'reps') return (target.min + target.max) / 2 * (exercise?.unit === 'steps' ? 1.5 : 3.5) * sides
  if (target.type === 'time') return target.seconds * (exercise?.perSide && exercise.measure !== 'cardio' ? 2 : 1)
  if (target.type === 'intervals') return target.rounds * (target.work + target.recover)
  return target.minutes * 60
}

export function blockSeconds(block: PlanBlock): number {
  if (block.kind === 'straight' || block.kind === 'finisher') {
    const item = block.items[0]
    if (item.target.type === 'intervals' || item.target.type === 'steady') return workSeconds(item) + 30
    return item.sets * workSeconds(item) + (item.sets - 1) * item.rest + 45
  }
  const rounds = block.rounds ?? Math.min(...block.items.map((item) => item.sets))
  const perRound = block.items.reduce((sum, item) => sum + workSeconds(item) + item.rest, 0)
  return rounds * perRound + (rounds - 1) * (block.rest ?? 60) + 30 * block.items.length
}

export function drillSeconds(drill: PlanDrill): number {
  const exercise = findExercise(drill.exercise)
  const sides = exercise?.perSide ? 2 : 1
  const target = drill.target
  if (target.type === 'reps') return target.max * 3 * sides + 15
  if (target.type === 'time') return target.seconds * sides + 15
  if (target.type === 'steady') return target.minutes * 60
  return target.rounds * (target.work + target.recover)
}

function superset(items: PlanItem[], transition = 15): PlanBlock {
  const rounds = Math.min(...items.map((item) => item.sets))
  const rest = Math.max(...items.map((item) => item.rest))
  return { kind: 'superset', rounds, rest, items: items.map((item) => ({ ...item, sets: rounds, rest: transition })) }
}

function assemble(picks: { item: PlanItem; role: Role }[], context: Context, circuitRounds: number | null): PlanBlock[] {
  if (!picks.length) return []
  const goal = context.answers.goal
  if (circuitRounds !== null) {
    return [{ kind: 'circuit', rounds: circuitRounds, rest: goal === 'conditioning' ? 60 : 90, items: picks.map(({ item }) => ({ ...item, sets: circuitRounds, rest: 15 })) }]
  }
  const blocks: PlanBlock[] = [{ kind: 'straight', rounds: null, rest: null, items: [picks[0].item] }]
  const pairAll = (goal !== 'strength' && goal !== 'muscle') || context.answers.minutes <= 45
  const rest = picks.slice(1)
  const pairable = pairAll ? rest : rest.filter(({ role }) => role !== 'secondary')
  if (!pairAll) for (const { item } of rest.filter(({ role }) => role === 'secondary')) blocks.push({ kind: 'straight', rounds: null, rest: null, items: [item] })
  for (let index = 0; index < pairable.length; index += 2) {
    const pair = pairable.slice(index, index + 2).map(({ item }) => item)
    blocks.push(pair.length === 2 ? superset(pair) : { kind: 'straight', rounds: null, rest: null, items: pair })
  }
  return blocks
}

function pickConditioning(context: Context, exclude: Set<string>, needsIntervals: boolean, steadyOnly = false): Exercise | null {
  const options = exercises.filter((exercise) => (exercise.pattern === 'cardio' || exercise.conditioning) && !exclude.has(exercise.id) && isEligible(exercise, context)
    && (!needsIntervals || exercise.cardioMode !== 'steady') && (!steadyOnly || (exercise.pattern === 'cardio' && exercise.cardioMode !== 'intervals')))
  if (!options.length) return null
  const gentle = gentleCardio(context)
  const value = (exercise: Exercise) => -(context.used.get(exercise.id) ?? 0) * 10
    + (context.answers.place === 'gym' && exercise.equipment.some((set) => set.includes('cardio')) ? 3 : 0)
    + (gentle && exercise.cardioMode !== 'intervals' ? 4 : 0)
    + (exercise.impact ? 0.5 : 0) + exercise.level * 0.2
  return options.reduce((best, option) => value(option) > value(best) ? option : best)
}

function commit(context: Context, ids: string[]) {
  for (const id of ids) context.used.set(id, (context.used.get(id) ?? 0) + 1)
}

const fillers: Partial<Record<Focus, Slot[]>> = {
  upper: [
    { patterns: ['core-ar', 'core-ae'], role: 'core' }, { patterns: ['biceps', 'triceps'], role: 'accessory' },
    { patterns: ['posture', 'shoulder'], role: 'posture' }, { patterns: ['carry'], role: 'carry' },
    { patterns: ['triceps', 'biceps'], role: 'accessory' }, { patterns: ['core-ae', 'core-ar'], role: 'core' },
  ],
  lower: [
    { patterns: ['glute', 'hamstring'], role: 'accessory' }, { patterns: ['calf'], role: 'accessory' },
    { patterns: ['core-ae', 'core-ar'], role: 'core' }, { patterns: ['balance'], role: 'balance' },
    { patterns: ['hamstring', 'glute'], role: 'accessory' }, { patterns: ['carry'], role: 'carry' },
  ],
  full: [
    { patterns: ['posture', 'shoulder'], role: 'posture' }, { patterns: ['glute', 'hamstring'], role: 'accessory' },
    { patterns: ['core-ar', 'core-ae'], role: 'core' }, { patterns: ['calf'], role: 'accessory' },
    { patterns: ['biceps', 'triceps'], role: 'accessory' }, { patterns: ['balance'], role: 'balance' },
  ],
  posture: [
    { patterns: ['posture'], role: 'posture' }, { patterns: ['glute', 'hamstring'], role: 'accessory' },
    { patterns: ['core-ae', 'core-ar'], role: 'core' }, { patterns: ['shoulder'], role: 'accessory' },
    { patterns: ['balance'], role: 'balance' }, { patterns: ['carry'], role: 'carry' },
  ],
}

const singlePatterns: ReadonlySet<Pattern> = new Set<Pattern>(['calf', 'carry', 'balance'])

function setCap(role: Role, context: Context): number {
  if (context.answers.cautiousStart || context.band === 'senior' || role === 'balance') return 3
  if (role === 'main') return context.answers.level === 'beginner' ? 4 : 5
  return context.answers.level === 'beginner' ? 3 : 4
}

function steadyFinisher(context: Context, exclude: Set<string>, seconds: number): PlanBlock | null {
  const exercise = pickConditioning(context, exclude, false, true)
  if (!exercise) return null
  exclude.add(exercise.id)
  commit(context, [exercise.id])
  const minutes = Math.max(5, Math.min(30, Math.floor(seconds / 60)))
  return { kind: 'finisher', rounds: null, rest: null, items: [{ exercise: exercise.id, sets: 1, target: { type: 'steady', minutes }, rest: 0, rir: null, tempo: null }] }
}

function buildStrength(kind: SessionKind, context: Context, budget: number): PlanBlock[] {
  const slots = [...(templates[kind] ?? [])]
  const { band, answers } = context
  if (band === 'senior') slots.push({ patterns: ['balance'], role: 'balance' })
  else if (band === 'older' || answers.goal === 'health') slots.push({ patterns: ['balance'], role: 'balance', optional: 1 })
  const exclude = new Set<string>()
  const chosen: { item: PlanItem; role: Role }[] = []
  for (const slot of slots.filter((item) => !item.optional)) {
    const exercise = pick(slot, context, exclude)
    if (!exercise) continue
    exclude.add(exercise.id)
    chosen.push({ item: prescribe(exercise, slot.role, context), role: slot.role })
  }
  const defaultRounds = answers.level === 'beginner' || answers.cautiousStart ? 2 : 3
  let rounds: number | null = answers.minutes <= 20 ? defaultRounds : null
  const wantsFinisher = answers.goal === 'fat-loss' || answers.goal === 'conditioning'
  const reserve = wantsFinisher ? (answers.minutes >= 45 ? 480 : answers.minutes >= 30 ? 360 : 0) : 0
  const strengthBudget = budget - reserve
  const total = (picks: typeof chosen) => assemble(picks, context, rounds).reduce((sum, block) => sum + blockSeconds(block), 0)
  const shrinkRounds = () => { while (rounds !== null && rounds > 2 && total(chosen) > strengthBudget) rounds-- }
  const keep: Record<Role, number> = {
    main: 0, secondary: 2, core: 3, accessory: 5, carry: 5,
    balance: band === 'senior' ? 1 : 4, posture: answers.goal === 'posture' ? 1 : 4,
  }
  shrinkRounds()
  while (total(chosen) > strengthBudget && chosen.length > 3) {
    let index = chosen.length - 1
    for (let candidate = chosen.length - 1; candidate > 0; candidate--) {
      if (keep[chosen[candidate].role] > keep[chosen[index].role]) index = candidate
    }
    if (index === 0) break
    chosen.splice(index, 1)
  }
  if (total(chosen) > strengthBudget) for (const entry of chosen) entry.item = { ...entry.item, sets: Math.max(2, entry.item.sets - 1) }
  if (total(chosen) > strengthBudget && rounds === null) { rounds = defaultRounds; shrinkRounds() }
  for (const slot of slots.filter((item) => item.optional).sort((a, b) => (a.optional ?? 0) - (b.optional ?? 0))) {
    const exercise = pick(slot, context, exclude)
    if (!exercise) continue
    const candidate = [...chosen, { item: prescribe(exercise, slot.role, context), role: slot.role }]
    if (total(candidate) > strengthBudget) continue
    exclude.add(exercise.id)
    chosen.splice(0, chosen.length, ...candidate)
  }
  const maxCount = rounds !== null ? 8 : 9
  const minCount = answers.minutes >= 30 ? 4 : 3
  const addExtras = (limit: number) => {
    for (const slot of fillers[sessionFocus(kind)] ?? []) {
      if (chosen.length >= limit) break
      const taken = new Set(chosen.map(({ item }) => findExercise(item.exercise)?.pattern))
      const exercise = pick(slot, context, exclude, (option) => !(singlePatterns.has(option.pattern) && taken.has(option.pattern)))
      if (!exercise) continue
      const candidate = [...chosen, { item: prescribe(exercise, slot.role, context), role: slot.role }]
      if (total(candidate) > strengthBudget) continue
      exclude.add(exercise.id)
      chosen.splice(0, chosen.length, ...candidate)
    }
  }
  const growSets = () => {
    for (let grew = rounds === null; grew;) {
      grew = false
      for (let index = 0; index < chosen.length; index++) {
        if (chosen[index].item.sets >= setCap(chosen[index].role, context)) continue
        const candidate = chosen.map((entry, position) => position === index ? { ...entry, item: { ...entry.item, sets: entry.item.sets + 1 } } : entry)
        if (total(candidate) > strengthBudget) continue
        chosen.splice(0, chosen.length, ...candidate)
        grew = true
      }
    }
  }
  addExtras(minCount)
  if (answers.goal === 'strength' || answers.goal === 'muscle') { growSets(); addExtras(maxCount) }
  else { addExtras(maxCount); growSets() }
  const blocks = assemble(chosen, context, rounds)
  commit(context, chosen.map(({ item }) => item.exercise))
  let remaining = budget - blocks.reduce((sum, block) => sum + blockSeconds(block), 0)
  if (wantsFinisher && remaining >= 300) {
    const exercise = pickConditioning(context, exclude, false)
    if (exercise) {
      const target = conditioningTarget(exercise, context, Math.min(remaining - 60, 720))
      const finisher: PlanBlock = { kind: 'finisher', rounds: null, rest: null, items: [{ exercise: exercise.id, sets: 1, target, rest: 0, rir: null, tempo: null }] }
      blocks.push(finisher)
      exclude.add(exercise.id)
      commit(context, [exercise.id])
      remaining -= blockSeconds(finisher)
    }
  }
  if (remaining >= 480) {
    const finisher = steadyFinisher(context, exclude, remaining - 60)
    if (finisher) blocks.push(finisher)
  }
  return blocks
}

function buildConditioning(context: Context, budget: number): PlanBlock[] {
  const exclude = new Set<string>()
  const sequence: Pattern[][] = [['squat', 'lunge'], ['push-h', 'push-v'], ['pull-h', 'pull-v'], ['core-ae', 'core-ar'], ['hinge', 'glute'], ['lunge', 'squat']]
  const size = context.answers.minutes <= 30 ? 4 : context.answers.minutes <= 45 ? 5 : 6
  const work = byLevel(context, 30, 40, 45)
  const items: PlanItem[] = []
  const circuitFriendly = (exercise: Exercise) => !fittedSet(exercise, context.available).some((item) => item === 'barbell' || item === 'rack' || item === 'machines')
  for (const patterns of sequence) {
    if (items.length === size - 1) break
    const exercise = pick({ patterns, role: 'secondary' }, context, exclude, circuitFriendly)
    if (!exercise) continue
    exclude.add(exercise.id)
    items.push({ exercise: exercise.id, sets: 1, target: { type: 'time', seconds: work }, rest: byLevel(context, 30, 20, 15), rir: null, tempo: null })
  }
  const burst = pickConditioning(context, exclude, true)
  if (burst) { exclude.add(burst.id); items.splice(2, 0, { exercise: burst.id, sets: 1, target: { type: 'time', seconds: work }, rest: byLevel(context, 30, 20, 15), rir: null, tempo: null }) }
  let rounds = byLevel(context, 2, 3, 4)
  const maxRounds = context.answers.cautiousStart ? 3 : byLevel(context, 3, 4, 5)
  const circuit = (count: number): PlanBlock => ({ kind: 'circuit', rounds: count, rest: byLevel(context, 90, 75, 60), items: items.map((item) => ({ ...item, sets: count })) })
  while (rounds > 2 && blockSeconds(circuit(rounds)) > budget * 0.7) rounds--
  while (rounds < maxRounds && blockSeconds(circuit(rounds + 1)) <= budget * 0.55) rounds++
  const blocks = [circuit(rounds)]
  commit(context, items.map((item) => item.exercise))
  let remaining = budget - blockSeconds(blocks[0])
  const finisher = pickConditioning(context, exclude, false)
  if (finisher && remaining >= 300) {
    const block: PlanBlock = { kind: 'finisher', rounds: null, rest: null, items: [{ exercise: finisher.id, sets: 1, target: conditioningTarget(finisher, context, Math.min(remaining - 60, 900)), rest: 0, rir: null, tempo: null }] }
    blocks.push(block)
    exclude.add(finisher.id)
    commit(context, [finisher.id])
    remaining -= blockSeconds(block)
  }
  if (remaining >= 480) {
    const steadyBlock = steadyFinisher(context, exclude, remaining - 60)
    if (steadyBlock) blocks.push(steadyBlock)
  }
  return blocks
}

function buildCardio(context: Context, budget: number): PlanBlock[] {
  const exclude = new Set<string>()
  const options = exercises.filter((exercise) => exercise.pattern === 'cardio' && exercise.cardioMode !== 'intervals' && isEligible(exercise, context))
  const value = (exercise: Exercise) => -(context.used.get(exercise.id) ?? 0) * 10 + (context.answers.place === 'gym' && exercise.equipment.some((set) => set.includes('cardio')) ? 3 : 0) + (exercise.id === 'brisk-walk' ? 1 : 0)
  const main = options.reduce<Exercise | null>((best, option) => !best || value(option) > value(best) ? option : best, null)
  const extras: PlanItem[] = []
  if (budget >= 25 * 60) {
    for (const patterns of [['balance'], ['core-ar', 'core-ae']] as Pattern[][]) {
      const exercise = pick({ patterns, role: patterns[0] === 'balance' ? 'balance' : 'core' }, context, exclude)
      if (!exercise) continue
      exclude.add(exercise.id)
      extras.push(prescribe(exercise, patterns[0] === 'balance' ? 'balance' : 'core', context))
    }
  }
  const extraBlock = extras.length === 2 ? superset(extras) : extras.length ? { kind: 'straight' as const, rounds: null, rest: null, items: extras } : null
  const cardioSeconds = budget - (extraBlock ? blockSeconds(extraBlock) : 0)
  const blocks: PlanBlock[] = []
  if (main) {
    const minutes = Math.max(10, Math.min(60, Math.floor(cardioSeconds / 60) - 1))
    blocks.push({ kind: 'finisher', rounds: null, rest: null, items: [{ exercise: main.id, sets: 1, target: { type: 'steady', minutes }, rest: 0, rir: null, tempo: null }] })
    commit(context, [main.id])
  }
  if (extraBlock) { blocks.push(extraBlock); commit(context, extras.map((item) => item.exercise)) }
  return blocks
}

function buildMobility(context: Context, budget: number): PlanBlock[] {
  const ids = ['cat-cow', 'open-book', 'thread-the-needle', 'ankle-rock', 'hip-90-90', 'worlds-greatest-stretch', 'wall-slide', 'chin-tuck', 'bird-dog', 'dead-bug', 'glute-bridge']
  const size = context.answers.minutes <= 30 ? 5 : context.answers.minutes <= 45 ? 7 : 8
  const drills = ids.map(findExercise).filter((exercise): exercise is Exercise => Boolean(exercise && isEligible(exercise, context))).slice(0, size)
  const items: PlanItem[] = drills.map((exercise) => ({ exercise: exercise.id, sets: 2, target: exercise.dose ?? { type: 'reps', min: 8, max: 10 }, rest: 15, rir: null, tempo: null }))
  let rounds = context.answers.minutes <= 30 ? 2 : 3
  const circuit = (count: number): PlanBlock => ({ kind: 'circuit', rounds: count, rest: 45, items: items.map((item) => ({ ...item, sets: count })) })
  while (rounds > 1 && blockSeconds(circuit(rounds)) > budget * (context.answers.minutes <= 30 ? 1 : 0.75)) rounds--
  const blocks = [circuit(rounds)]
  commit(context, items.map((item) => item.exercise))
  const remaining = budget - blockSeconds(blocks[0])
  const walk = findExercise(context.answers.place === 'gym' ? 'bike' : 'brisk-walk')
  if (walk && remaining >= 420 && isEligible(walk, context)) blocks.push({ kind: 'finisher', rounds: null, rest: null, items: [{ exercise: walk.id, sets: 1, target: { type: 'steady', minutes: Math.max(5, Math.min(45, Math.floor(remaining / 60) - 1)) }, rest: 0, rir: null, tempo: null }] })
  return blocks
}

type Focus = 'lower' | 'upper' | 'full' | 'posture' | 'cardio' | 'mobility'
export function sessionFocus(kind: SessionKind): Focus {
  if (kind.startsWith('upper') || kind === 'push' || kind === 'pull') return 'upper'
  if (kind.startsWith('lower') || kind === 'legs') return 'lower'
  if (kind.startsWith('posture')) return 'posture'
  if (kind === 'cardio') return 'cardio'
  if (kind === 'mobility') return 'mobility'
  return 'full'
}

const warmupOrder: Record<Focus, string[]> = {
  lower: ['wu-hip-circles', 'wu-leg-swings', 'wu-ankle', 'wu-bridge', 'wu-squat', 'wu-hinge'],
  upper: ['wu-arm-circles', 'wu-pull-apart', 'wu-wall-push-up', 'wu-thoracic', 'wu-wall-slide', 'wu-kb-halo'],
  full: ['wu-cat-cow', 'wu-hip-circles', 'wu-arm-circles', 'wu-squat', 'wu-pull-apart', 'wu-hinge', 'wu-inchworm'],
  posture: ['wu-cat-cow', 'wu-chin-tuck', 'wu-wall-slide', 'wu-thoracic', 'wu-bridge', 'wu-dead-bug'],
  cardio: ['wu-ankle', 'wu-leg-swings', 'wu-hip-circles', 'wu-arm-circles'],
  mobility: ['wu-cat-cow', 'wu-arm-circles', 'wu-hip-circles'],
}
const cooldownOrder: Record<Focus, string[]> = {
  lower: ['cd-hamstring', 'cd-hip-flexor', 'cd-quad', 'cd-glute', 'cd-calf', 'cd-butterfly'],
  upper: ['cd-chest', 'cd-lat', 'cd-triceps', 'cd-open-book', 'cd-neck'],
  full: ['cd-hamstring', 'cd-hip-flexor', 'cd-chest', 'cd-lat', 'cd-glute'],
  posture: ['cd-chest', 'cd-open-book', 'cd-hip-flexor', 'cd-child', 'cd-lat'],
  cardio: ['cd-walk', 'cd-calf', 'cd-hamstring', 'cd-quad', 'cd-hip-flexor'],
  mobility: ['cd-child', 'cd-open-book', 'cd-glute'],
}

function warmup(kind: SessionKind, context: Context): PlanDrill[] {
  const focus = sessionFocus(kind)
  const count = (context.answers.minutes <= 30 ? 3 : context.answers.minutes <= 60 ? 4 : 5)
    + ((context.band === 'older' || context.band === 'senior') && context.answers.minutes > 20 ? 1 : 0)
  const pulse = context.answers.place === 'gym' && focus !== 'mobility' ? 'wu-bike'
    : context.allowImpact && context.answers.level !== 'beginner' && context.band === 'adult' ? 'wu-jumping-jack'
      : context.band === 'senior' || context.answers.cautiousStart ? 'wu-march' : 'wu-step-jack'
  const ids = [pulse, ...warmupOrder[focus]]
  const drills = ids.map(findExercise).filter((exercise): exercise is Exercise => Boolean(exercise && isEligible(exercise, context)))
  const unique = [...new Map(drills.map((exercise) => [exercise.id, exercise])).values()].slice(0, Math.min(count, 6))
  return unique.map((exercise) => {
    const target: Target = exercise.dose ?? { type: 'reps', min: 10, max: 10 }
    return { exercise: exercise.id, target: target.type === 'steady' && context.answers.minutes <= 30 ? { type: 'steady', minutes: 3 } : target }
  })
}

function cooldown(kind: SessionKind, context: Context): PlanDrill[] {
  const focus = sessionFocus(kind)
  const count = context.answers.minutes <= 20 ? 1 : context.answers.minutes <= 30 ? 2 : context.answers.minutes <= 60 ? 3 : 4
  const drills = cooldownOrder[focus].map(findExercise).filter((exercise): exercise is Exercise => Boolean(exercise && isEligible(exercise, context))).slice(0, count)
  const breathing = findExercise('cd-breathing')
  const all = breathing ? [...drills, breathing] : drills
  return all.map((exercise) => ({ exercise: exercise.id, target: exercise.dose ?? { type: 'time', seconds: 30 } }))
}

export function isPlanUsable(plan: TrainingPlan): boolean {
  return plan.sessions.every((session) => [...session.warmup, ...session.cooldown, ...session.blocks.flatMap((block) => block.items)]
    .every((item) => findExercise(item.exercise) !== undefined))
}

export function alternativesFor(exerciseId: string, answers: TrainingAnswers): { easier?: Exercise; similar?: Exercise; harder?: Exercise } {
  const exercise = findExercise(exerciseId)
  if (!exercise || exercise.pattern === 'warmup' || exercise.pattern === 'cooldown' || exercise.pattern === 'mobility' || exercise.pattern === 'cardio') return {}
  const context = createContext(answers)
  const options = exercises.filter((option) => option.pattern === exercise.pattern && option.id !== exercise.id && isEligible(option, context))
  return {
    easier: options.find((option) => option.level < exercise.level),
    similar: options.find((option) => option.level === exercise.level),
    harder: options.find((option) => option.level > exercise.level),
  }
}

export function generatePlan(input: TrainingAnswers, options: { now?: Date } = {}): TrainingPlan {
  const answers: TrainingAnswers = {
    ...input,
    equipment: input.place === 'gym' ? [] : [...new Set(input.equipment)].sort(),
    weekdays: [...new Set(input.weekdays)].sort((a, b) => a - b),
    limitations: [...new Set(input.limitations)].sort(),
  }
  const context = createContext(answers)
  const kinds = scheduleKinds(context)
  const sessions: PlanSession[] = answers.weekdays.map((weekday, index) => {
    const kind = kinds[index]
    const warm = warmup(kind, context)
    const cool = cooldown(kind, context)
    const budget = answers.minutes * 60 - warm.reduce((sum, drill) => sum + drillSeconds(drill), 0) - cool.reduce((sum, drill) => sum + drillSeconds(drill), 0)
    const blocks = kind === 'conditioning' ? buildConditioning(context, budget)
      : kind === 'cardio' ? buildCardio(context, budget)
        : kind === 'mobility' ? buildMobility(context, budget)
          : buildStrength(kind, context, budget)
    const seconds = [...warm, ...cool].reduce((sum, drill) => sum + drillSeconds(drill), 0) + blocks.reduce((sum, block) => sum + blockSeconds(block), 0)
    return {
      key: `s${index + 1}`, kind, weekday,
      minutes: Math.max(5, Math.min(150, Math.round(seconds / 60))),
      warmup: warm, blocks, cooldown: cool,
    }
  })
  return trainingPlanSchema.parse({
    version: 1, createdAt: (options.now ?? new Date()).toISOString(), answers, sessions,
  })
}
