import type { PlanDrill, PlanItem, PlanSession, Target } from '../../../../shared/training'
import { blockHint, effortNotes, formatTarget } from './format'
import { findExercise, type Exercise } from './library'

export type WorkoutPart = 'warmup' | 'main' | 'cooldown'
export type TimerPhase = { label: string; seconds: number; tone: 'work' | 'easy' | 'switch' }
export type WorkoutStep = {
  id: string
  part: WorkoutPart
  exercise: string
  tag: string | null
  progress: string | null
  target: string
  notes: string[]
  hint: string | null
  phases: TimerPhase[] | null
  rest: number
}

export const partLabels: Record<WorkoutPart, string> = { warmup: 'Rozgrzewka', main: 'Część główna', cooldown: 'Schłodzenie' }

export function timerPhases(target: Target, exercise: Exercise | undefined): TimerPhase[] | null {
  switch (target.type) {
    case 'reps': return null
    case 'steady': return [{ label: 'Utrzymuj spokojne tempo', seconds: target.minutes * 60, tone: 'work' }]
    case 'intervals': return Array.from({ length: target.rounds }, (_, index): TimerPhase[] => [
      { label: `Szybciej · runda ${index + 1} z ${target.rounds}`, seconds: target.work, tone: 'work' },
      ...(index < target.rounds - 1 && target.recover > 0 ? [{ label: 'Spokojnie', seconds: target.recover, tone: 'easy' as const }] : []),
    ]).flat()
    case 'time':
      if (exercise?.perSide && exercise.measure !== 'cardio') return [
        { label: 'Pierwsza strona', seconds: target.seconds, tone: 'work' },
        { label: 'Zmień stronę', seconds: 5, tone: 'switch' },
        { label: 'Druga strona', seconds: target.seconds, tone: 'work' },
      ]
      return [{ label: 'Praca', seconds: target.seconds, tone: 'work' }]
  }
}

/** Turns a planned session into the exact order of things to do, one set or drill at a time. */
export function workoutSteps(session: PlanSession): WorkoutStep[] {
  const steps: WorkoutStep[] = []
  const drill = (part: WorkoutPart, prefix: string) => (item: PlanDrill, index: number) => {
    const exercise = findExercise(item.exercise)
    steps.push({
      id: `${prefix}${index}`, part, exercise: item.exercise, tag: null, progress: null,
      target: formatTarget(item.target, exercise), notes: [], hint: null, phases: timerPhases(item.target, exercise), rest: 0,
    })
  }
  session.warmup.forEach(drill('warmup', 'w'))
  session.blocks.forEach((block, blockIndex) => {
    const letter = String.fromCharCode(65 + blockIndex)
    const hint = blockHint(block)
    const add = (item: PlanItem, index: number, id: string, progress: string | null, rest: number, extra: string[] = []) => {
      const exercise = findExercise(item.exercise)
      steps.push({
        id, part: 'main', exercise: item.exercise, tag: block.items.length > 1 ? `${letter}${index + 1}` : letter, progress,
        target: formatTarget(item.target, exercise), notes: [...extra, ...effortNotes(item)], hint,
        phases: timerPhases(item.target, exercise), rest,
      })
    }
    if (block.kind === 'straight' || block.kind === 'finisher') {
      block.items.forEach((item, index) => {
        const sets = item.target.type === 'intervals' || item.target.type === 'steady' ? 1 : item.sets
        for (let set = 1; set <= sets; set++) {
          const ramp = blockIndex === 0 && index === 0 && set === 1 && block.kind === 'straight' && item.target.type === 'reps'
          add(item, index, `b${blockIndex}-i${index}-s${set}`, sets > 1 ? `Seria ${set} z ${sets}` : null,
            block.kind === 'finisher' ? 60 : item.rest,
            ramp ? ['najpierw 1–2 lżejsze serie wstępne (ok. 50% i 75% ciężaru roboczego)'] : [])
        }
      })
      return
    }
    const rounds = block.rounds ?? Math.min(...block.items.map((item) => item.sets))
    for (let round = 1; round <= rounds; round++) {
      block.items.forEach((item, index) => {
        const last = index === block.items.length - 1
        add(item, index, `b${blockIndex}-r${round}-i${index}`, `Runda ${round} z ${rounds}`, last ? block.rest ?? 60 : item.rest)
      })
    }
  })
  if (steps.length && steps[steps.length - 1].part === 'main') steps[steps.length - 1].rest = 0
  session.cooldown.forEach(drill('cooldown', 'c'))
  return steps
}

export function blockOf(step: WorkoutStep): string {
  return step.id.split('-')[0]
}
