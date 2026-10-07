import { coreExercises } from './core'
import { conditioningExercises } from './conditioning'
import { hipExercises } from './hips'
import { legExercises } from './legs'
import { pullExercises } from './pull'
import { pushExercises } from './push'
import type { Exercise } from './types'

export type { Exercise, Pattern } from './types'

export const exercises: readonly Exercise[] = [
  ...legExercises, ...hipExercises, ...pushExercises, ...pullExercises, ...coreExercises, ...conditioningExercises,
]

const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]))

export function findExercise(id: string): Exercise | undefined {
  return byId.get(id)
}
