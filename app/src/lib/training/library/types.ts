import type { Equipment, Limitation, Target } from '../../../../../shared/training'

export type Pattern = 'squat' | 'lunge' | 'hinge' | 'glute' | 'hamstring' | 'calf'
  | 'push-h' | 'push-v' | 'pull-h' | 'pull-v' | 'shoulder' | 'biceps' | 'triceps'
  | 'core-ae' | 'core-ar' | 'carry' | 'cardio' | 'balance' | 'posture' | 'mobility'
  | 'warmup' | 'cooldown'

export type Exercise = {
  id: string
  name: string
  pattern: Pattern
  /** Alternative equipment sets; every item of one set must be available. `[]` means no equipment. */
  equipment: Equipment[][]
  level: 1 | 2 | 3
  measure: 'reps' | 'time' | 'cardio'
  perSide?: boolean
  sideLabel?: string
  unit?: 'steps'
  avoid?: Limitation[]
  impact?: boolean
  /** Household variant that is not offered when a gym is available. */
  home?: boolean
  /** Equipment is only an anchor or support; the resistance is body weight. */
  bodyweight?: boolean
  cardioMode?: 'steady' | 'intervals' | 'both'
  conditioning?: boolean
  dose?: Target
  muscles: string
  cues: string[]
  breathing: string
  safety?: string
}

export const BW: Equipment[][] = [[]]
export const reps = (min: number, max = min): Target => ({ type: 'reps', min, max })
export const secs = (seconds: number): Target => ({ type: 'time', seconds })
export const steady = (minutes: number): Target => ({ type: 'steady', minutes })
