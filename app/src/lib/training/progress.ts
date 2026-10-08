import { z } from 'zod'

const KEY = 'flexa:workout:v1'
const MAX_AGE = 12 * 60 * 60 * 1000
const stepId = z.string().max(40)

const progressSchema = z.object({
  scope: z.string().max(120),
  plan: z.string().max(40),
  session: z.string().regex(/^s[1-6]$/),
  index: z.number().int().min(0).max(500),
  startedAt: z.number(),
  updatedAt: z.number(),
  finishedAt: z.number().nullable(),
  done: z.array(stepId).max(500),
  skipped: z.array(stepId).max(500),
  rest: z.object({ endsAt: z.number(), total: z.number().int().min(1).max(900), from: z.number().int().min(0).max(500) }).nullable(),
  /** Optional reps and load typed for strength sets, by step id. Older saved progress has none. */
  sets: z.record(stepId, z.object({ reps: z.string().max(8), weight: z.string().max(8) })).default({}),
})

export type WorkoutProgress = z.infer<typeof progressSchema>

export function progressScope(mode: string, userId: string | undefined): string {
  return `${mode}:${userId ?? 'local'}`
}

export function newProgress(scope: string, plan: string, session: string, now = Date.now()): WorkoutProgress {
  return { scope, plan, session, index: 0, startedAt: now, updatedAt: now, finishedAt: null, done: [], skipped: [], rest: null, sets: {} }
}

/** Reads the unfinished workout of this account and plan. Stale or foreign progress is ignored. */
export function readProgress(scope: string, plan: string, now = Date.now()): WorkoutProgress | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = progressSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return null
    const progress = parsed.data
    if (progress.scope !== scope || progress.plan !== plan || progress.finishedAt !== null || now - progress.updatedAt > MAX_AGE) return null
    return progress
  } catch {
    return null
  }
}

export function writeProgress(progress: WorkoutProgress): void {
  try { localStorage.setItem(KEY, JSON.stringify(progressSchema.parse(progress))) } catch { /* Resuming is a convenience; the workout itself keeps running. */ }
}

export function clearProgress(): void {
  try { localStorage.removeItem(KEY) } catch { /* Nothing to clear when storage is unavailable. */ }
}
