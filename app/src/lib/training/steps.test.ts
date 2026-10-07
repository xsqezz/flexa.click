// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { PlanSession, TrainingAnswers } from '../../../../shared/training'
import { generatePlan } from './generator'
import { findExercise } from './library'
import { workoutSteps } from './steps'

const session: PlanSession = {
  key: 's1', kind: 'full-a', weekday: 0, minutes: 40,
  warmup: [{ exercise: 'wu-march', target: { type: 'steady', minutes: 1 } }, { exercise: 'wu-hip-circles', target: { type: 'reps', min: 8, max: 8 } }],
  blocks: [
    { kind: 'straight', rounds: null, rest: null, items: [{ exercise: 'goblet-squat-db', sets: 3, target: { type: 'reps', min: 8, max: 12 }, rest: 90, rir: 2, tempo: null }] },
    { kind: 'superset', rounds: 2, rest: 60, items: [
      { exercise: 'push-up', sets: 2, target: { type: 'reps', min: 8, max: 10 }, rest: 15, rir: 2, tempo: '3-0-1' },
      { exercise: 'side-plank', sets: 2, target: { type: 'time', seconds: 30 }, rest: 15, rir: null, tempo: null },
    ] },
    { kind: 'finisher', rounds: null, rest: null, items: [{ exercise: 'burpee', sets: 1, target: { type: 'intervals', rounds: 3, work: 30, recover: 45 }, rest: 0, rir: null, tempo: null }] },
  ],
  cooldown: [{ exercise: 'cd-hamstring', target: { type: 'time', seconds: 40 } }, { exercise: 'cd-breathing', target: { type: 'time', seconds: 60 } }],
}

describe('guided workout steps', () => {
  it('orders one drill, set or round at a time with the planned rests', () => {
    const steps = workoutSteps(session)
    expect(steps.map((step) => step.id)).toEqual(['w0', 'w1', 'b0-i0-s1', 'b0-i0-s2', 'b0-i0-s3', 'b1-r1-i0', 'b1-r1-i1', 'b1-r2-i0', 'b1-r2-i1', 'b2-i0-s1', 'c0', 'c1'])
    expect(steps.map((step) => step.rest)).toEqual([0, 0, 90, 90, 90, 15, 60, 15, 60, 0, 0, 0])
    expect(steps.map((step) => step.tag)).toEqual([null, null, 'A', 'A', 'A', 'B1', 'B2', 'B1', 'B2', 'C', null, null])
    expect(steps.map((step) => step.progress)).toEqual([null, null, 'Seria 1 z 3', 'Seria 2 z 3', 'Seria 3 z 3', 'Runda 1 z 2', 'Runda 1 z 2', 'Runda 2 z 2', 'Runda 2 z 2', null, null, null])
    expect(steps.map((step) => step.part)).toEqual(['warmup', 'warmup', 'main', 'main', 'main', 'main', 'main', 'main', 'main', 'main', 'cooldown', 'cooldown'])
    expect(steps[2].notes[0]).toMatch(/^najpierw 1–2 lżejsze serie wstępne/)
    expect(steps[3].notes).toEqual(['zostaw 2 powtórzenia w zapasie'])
    expect(steps[5].notes).toEqual(['zostaw 2 powtórzenia w zapasie', 'tempo 3-0-1'])
    expect(steps[2].target).toBe('8–12 powt.')
  })
  it('adds timers only to timed work, with side switches and interval phases', () => {
    const steps = workoutSteps(session)
    expect(steps[0].phases).toEqual([{ label: 'Utrzymuj spokojne tempo', seconds: 60, tone: 'work' }])
    expect(steps[1].phases).toBeNull()
    expect(steps[2].phases).toBeNull()
    expect(steps[6].phases?.map((phase) => phase.seconds)).toEqual(findExercise('side-plank')?.perSide ? [30, 5, 30] : [30])
    expect(steps[9].phases?.map((phase) => [phase.tone, phase.seconds])).toEqual([['work', 30], ['easy', 45], ['work', 30], ['easy', 45], ['work', 30]])
    expect(steps[11].phases).toEqual([{ label: 'Praca', seconds: 60, tone: 'work' }])
  })
  it('covers every generated session without gaps', () => {
    const base: TrainingAnswers = {
      age: 35, sex: 'unspecified', goal: 'fat-loss', place: 'gym', equipment: [], level: 'intermediate',
      weekdays: [0, 1, 2, 3, 4], minutes: 60, limitations: [], cautiousStart: false, healthConsent: false,
    }
    for (const goal of ['fat-loss', 'muscle', 'strength', 'conditioning', 'posture', 'health'] as const) {
      const plan = generatePlan({ ...base, goal }, { now: new Date('2026-10-07T10:00:00Z') })
      for (const item of plan.sessions) {
        const steps = workoutSteps(item)
        const expected = item.warmup.length + item.cooldown.length + item.blocks.reduce((sum, block) => sum
          + (block.kind === 'superset' || block.kind === 'circuit' ? (block.rounds ?? 1) * block.items.length
            : block.items.reduce((count, entry) => count + (entry.target.type === 'reps' || entry.target.type === 'time' ? entry.sets : 1), 0)), 0)
        expect(steps).toHaveLength(expected)
        expect(new Set(steps.map((step) => step.id)).size).toBe(steps.length)
        expect(steps.every((step) => findExercise(step.exercise))).toBe(true)
        expect(steps.filter((step) => step.part === 'main').at(-1)?.rest).toBe(0)
        expect(steps.filter((step) => step.part !== 'main').every((step) => step.rest === 0)).toBe(true)
      }
    }
  })
})
