// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  gymEquipment, homeEquipment, needsHealthConsent, targetSchema, trainingAnswersSchema, trainingGoals, trainingLevels,
  trainingPlanSchema, type HomeEquipment, type Limitation, type TrainingAnswers, type TrainingPlan,
} from '../../../../shared/training'
import { alternativesFor, createContext, generatePlan, isEligible, isPlanUsable, strengthDayCap, strengthKinds } from './generator'
import { exercises, findExercise } from './library'
import {
  formatTarget, itemDetails, limitationSummary, planSummary, plannedWorkout, safetyNotes, sessionTitle, setsLabel, weekdayIndex,
} from './format'

const base: TrainingAnswers = {
  age: 30, sex: 'unspecified', goal: 'health', place: 'home', equipment: [], level: 'beginner',
  weekdays: [0, 2, 4], minutes: 45, limitations: [], cautiousStart: false, healthConsent: false,
}
const answers = (patch: Partial<TrainingAnswers> = {}): TrainingAnswers => ({ ...base, ...patch })
const now = new Date('2026-10-07T10:00:00.000Z')
const allIds = (plan: TrainingPlan) => plan.sessions.flatMap((session) => [
  ...session.warmup.map((drill) => drill.exercise), ...session.cooldown.map((drill) => drill.exercise),
  ...session.blocks.flatMap((block) => block.items.map((item) => item.exercise)),
])
const mainItems = (plan: TrainingPlan) => plan.sessions.flatMap((session) => session.blocks.flatMap((block) => block.items))

const setups: { place: 'gym' | 'home'; equipment: HomeEquipment[] }[] = [
  { place: 'gym', equipment: [] },
  { place: 'home', equipment: [] },
  { place: 'home', equipment: [...homeEquipment] },
  { place: 'home', equipment: ['bands', 'mat'] },
  { place: 'home', equipment: ['dumbbells', 'bench'] },
  { place: 'home', equipment: ['chair', 'miniband'] },
]
const limitationSets: Limitation[][] = [[], ['knees', 'lower-back'], ['shoulders', 'wrists'], ['osteoporosis', 'hypertension', 'low-impact'], ['hips', 'ankles', 'neck']]
const ages = [16, 30, 45, 58, 72]

function* matrix(): Generator<TrainingAnswers> {
  let index = 0
  for (const goal of trainingGoals) for (const setup of setups) for (const level of trainingLevels) {
    for (const days of [2, 3, 4, 5, 6]) for (const minutes of [20, 30, 45, 60, 75, 90]) {
      index++
      const limitations = limitationSets[(index * 7) % limitationSets.length]
      const cautiousStart = index % 11 === 0
      yield answers({
        goal, ...setup, level, minutes, limitations, cautiousStart, age: ages[index % ages.length],
        weekdays: [0, 1, 2, 3, 4, 5].slice(0, days), healthConsent: limitations.length > 0 || cautiousStart,
      })
    }
  }
}

describe('exercise library', () => {
  it('has unique, schema-safe identifiers and complete coaching content', () => {
    const ids = exercises.map((exercise) => exercise.id)
    expect(new Set(ids).size).toBe(ids.length)
    const known = new Set<string>([...homeEquipment, ...gymEquipment])
    for (const exercise of exercises) {
      expect(exercise.id).toMatch(/^[a-z0-9-]{2,60}$/)
      expect(exercise.name.trim().length, exercise.id).toBeGreaterThan(2)
      expect(exercise.muscles.trim(), exercise.id).not.toBe('')
      expect(exercise.breathing.trim(), exercise.id).not.toBe('')
      expect(exercise.cues.length, exercise.id).toBeGreaterThan(0)
      expect(exercise.equipment.length, exercise.id).toBeGreaterThan(0)
      for (const set of exercise.equipment) for (const item of set) expect(known.has(item), `${exercise.id}: ${item}`).toBe(true)
      if (exercise.dose) expect(targetSchema.safeParse(exercise.dose).success, exercise.id).toBe(true)
    }
  })
})

describe('plan generator', () => {
  it('respects equipment, limitations, level, time and recovery for every answer combination', () => {
    let plans = 0
    for (const input of matrix()) {
      const plan = generatePlan(input, { now })
      plans++
      const label = JSON.stringify(input)
      const context = createContext(plan.answers)
      expect(trainingPlanSchema.safeParse(plan).success, label).toBe(true)
      expect(isPlanUsable(plan), label).toBe(true)
      expect(plan.sessions.map((session) => session.weekday), label).toEqual(plan.answers.weekdays)
      expect(plan.sessions.filter((session) => strengthKinds.has(session.kind)).length, label).toBeLessThanOrEqual(strengthDayCap(context))
      for (const id of allIds(plan)) {
        const exercise = findExercise(id)
        expect(exercise && isEligible(exercise, context), `${id} in ${label}`).toBe(true)
        if (input.cautiousStart) expect(exercise?.level, `${id} in ${label}`).toBe(1)
        if (input.age < 18 || input.age >= 65) expect(exercise?.level, `${id} in ${label}`).toBeLessThan(3)
        if (input.age >= 65) expect(exercise?.impact, `${id} in ${label}`).not.toBe(true)
      }
      for (const session of plan.sessions) {
        const main = session.blocks.flatMap((block) => block.items.map((item) => item.exercise))
        expect(new Set(main).size, label).toBe(main.length)
        expect(session.minutes, `${session.kind} ${label}`).toBeLessThanOrEqual(input.minutes)
        expect(session.minutes, `${session.kind} ${label}`).toBeGreaterThanOrEqual(Math.floor(input.minutes * 0.6))
        if (strengthKinds.has(session.kind)) expect(main.length, `${session.kind} ${label}`).toBeGreaterThanOrEqual(input.minutes >= 45 ? 3 : 2)
        if (strengthKinds.has(session.kind) && input.age >= 65) {
          expect(main.some((id) => findExercise(id)?.pattern === 'balance'), `${session.kind} ${label}`).toBe(true)
        }
      }
      for (const item of mainItems(plan)) {
        if (item.target.type === 'reps') expect(item.target.min, label).toBeLessThanOrEqual(item.target.max)
        if (item.rir === null) continue
        if (input.cautiousStart) expect(item.rir, label).toBeGreaterThanOrEqual(3)
        if (input.age < 18 || input.limitations.includes('hypertension')) expect(item.rir, label).toBeGreaterThanOrEqual(2)
      }
    }
    expect(plans).toBe(3240)
  })

  it('is deterministic and normalizes answers', () => {
    const input = answers({ place: 'gym', equipment: ['mat'], weekdays: [4, 0, 2], limitations: ['wrists', 'knees'], healthConsent: true })
    const plan = generatePlan(input, { now })
    expect(generatePlan(input, { now })).toEqual(plan)
    expect(plan.answers.equipment).toEqual([])
    expect(plan.answers.weekdays).toEqual([0, 2, 4])
    expect(plan.answers.limitations).toEqual(['knees', 'wrists'])
    expect(plan.createdAt).toBe(now.toISOString())
  })

  it('uses gym equipment in gym plans and only body weight without equipment', () => {
    const gym = generatePlan(answers({ goal: 'strength', place: 'gym', level: 'intermediate' }), { now })
    expect(mainItems(gym).some((item) => findExercise(item.exercise)?.equipment.some((set) => set.includes('barbell')))).toBe(true)
    const home = generatePlan(answers({ goal: 'muscle', level: 'intermediate' }), { now })
    for (const id of allIds(home)) expect(findExercise(id)?.equipment.some((set) => set.length === 0), id).toBe(true)
  })

  it('removes jumping and running when joints need protection', () => {
    for (const limitations of [['knees'], ['ankles'], ['low-impact'], ['osteoporosis']] as Limitation[][]) {
      const plan = generatePlan(answers({ goal: 'conditioning', level: 'advanced', limitations, healthConsent: true, weekdays: [0, 1, 3, 5] }), { now })
      for (const id of allIds(plan)) expect(findExercise(id)?.impact, `${id} with ${limitations.join()}`).not.toBe(true)
    }
  })

  it('caps loaded training days for a cautious start and adds balance work after 65', () => {
    const cautious = generatePlan(answers({ goal: 'muscle', weekdays: [0, 1, 2, 3, 4, 5], cautiousStart: true, healthConsent: true }), { now })
    expect(cautious.sessions.filter((session) => strengthKinds.has(session.kind)).length).toBeLessThanOrEqual(3)
    const senior = generatePlan(answers({ age: 70, weekdays: [0, 2, 4, 6] }), { now })
    expect(senior.sessions.some((session) => session.blocks.some((block) => block.items.some((item) => findExercise(item.exercise)?.pattern === 'balance')))).toBe(true)
  })

  it('fills long sessions instead of stopping at a fixed template', () => {
    const plan = generatePlan(answers({ goal: 'muscle', place: 'gym', level: 'advanced', minutes: 90, weekdays: [0, 1, 3, 4] }), { now })
    for (const session of plan.sessions) expect(session.minutes).toBeGreaterThanOrEqual(80)
  })

  it('suggests eligible alternatives only', () => {
    const input = answers({ equipment: ['dumbbells', 'bands', 'mat'], level: 'intermediate', limitations: ['knees'], healthConsent: true })
    const context = createContext(input)
    for (const item of mainItems(generatePlan(input, { now }))) {
      for (const option of Object.values(alternativesFor(item.exercise, input))) {
        if (option) expect(isEligible(option, context), `${item.exercise} → ${option.id}`).toBe(true)
      }
    }
  })
})

describe('training schemas', () => {
  it('rejects impossible answers', () => {
    for (const patch of [{ age: 15 }, { age: 100 }, { weekdays: [0] }, { weekdays: [0, 1, 2, 3, 4, 5, 6] }, { weekdays: [1, 1] }, { minutes: 50 }, { equipment: ['rope'] }, { limitations: ['knees', 'knees'] }]) {
      expect(trainingAnswersSchema.safeParse({ ...base, ...patch }).success, JSON.stringify(patch)).toBe(false)
    }
    expect(trainingAnswersSchema.safeParse(base).success).toBe(true)
  })
  it('rejects a plan that does not match the selected days', () => {
    const plan = generatePlan(base, { now })
    expect(trainingPlanSchema.safeParse({ ...plan, answers: { ...plan.answers, weekdays: [1, 3, 5] } }).success).toBe(false)
  })
  it('requires consent only for health information', () => {
    expect(needsHealthConsent(base)).toBe(false)
    expect(needsHealthConsent({ limitations: ['neck'], cautiousStart: false })).toBe(true)
    expect(needsHealthConsent({ limitations: [], cautiousStart: true })).toBe(true)
  })
})

describe('plan formatting', () => {
  it('uses Polish plural forms and readable targets', () => {
    expect([1, 2, 5, 12, 22].map(setsLabel)).toEqual(['1 seria', '2 serie', '5 serii', '12 serii', '22 serie'])
    expect(formatTarget({ type: 'time', seconds: 90 })).toBe('1 min 30 s')
    expect(formatTarget({ type: 'intervals', rounds: 6, work: 30, recover: 45 })).toBe('6 × (30 s szybciej + 45 s spokojnie)')
    expect(formatTarget({ type: 'reps', min: 8, max: 12 }, findExercise('split-squat'))).toMatch(/^8–12 powt\. /)
    expect(itemDetails({ exercise: 'goblet-squat-db', sets: 3, target: { type: 'reps', min: 8, max: 12 }, rest: 90, rir: 2, tempo: '3-0-1' }, { kind: 'straight', rounds: null, rest: null, items: [] }))
      .toEqual(['3 serie × 8–12 powt.', 'przerwa 1 min 30 s', 'zostaw 2 powtórzenia w zapasie', 'tempo 3-0-1'])
  })
  it('maps dates to Monday-first weekdays', () => {
    expect(weekdayIndex('2024-01-01')).toBe(0)
    expect(weekdayIndex('2024-01-07')).toBe(6)
  })
  it('titles sessions and turns them into journal workouts', () => {
    const plan = generatePlan(answers({ goal: 'fat-loss' }), { now })
    expect(sessionTitle(plan.sessions[0], 0, 'fat-loss')).toBe('Dzień 1: Całe ciało A — siła i spalanie')
    expect(plannedWorkout(plan.sessions[0], 0, 'fat-loss')).toEqual({ name: 'Dzień 1: Całe ciało A — siła i spalanie', kind: 'strength', minutes: plan.sessions[0].minutes })
    const cardio = generatePlan(answers({ weekdays: [0, 2, 4] }), { now }).sessions.find((session) => session.kind === 'cardio')
    expect(cardio && plannedWorkout(cardio, 1, 'health').kind).toBe('walk')
  })
  it('summarizes answers and safety guidance', () => {
    expect(planSummary(base)).toContain('dom, bez sprzętu')
    expect(limitationSummary(base)).toBe('Brak zgłoszonych ograniczeń')
    expect(limitationSummary(answers({ limitations: ['knees'], cautiousStart: true }))).toBe('Łagodny start po konsultacji z lekarzem, Ból lub uraz kolan')
    const notes = safetyNotes(answers({ age: 16, limitations: ['knees', 'hypertension'] }))
    expect(notes.some((note) => note.startsWith('Kolana'))).toBe(true)
    expect(notes.some((note) => note.startsWith('Nadciśnienie'))).toBe(true)
    expect(notes.some((note) => note.includes('niepełnoletnie'))).toBe(true)
  })
})
