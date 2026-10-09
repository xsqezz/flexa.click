import { z } from 'zod'
import { plateSizes } from '../../../../shared/meal-scan/catalog'
import type { PlateLine } from '../../../../shared/meal-scan/estimate'

/**
 * What the user usually eats of an item (size, pieces, grams) stays in this browser only and pre-fills the next
 * time they add the same item by hand. Nothing is sent anywhere and values typed from a menu are never remembered.
 */
const habitSchema = z.object({
  size: z.enum(plateSizes).optional(),
  count: z.number().int().min(1).max(60).optional(),
  grams: z.number().min(1).max(5000).optional(),
  at: z.number().int().nonnegative(),
})
const storeSchema = z.record(z.string().min(1).max(80), habitSchema)
export type ScanHabits = z.infer<typeof storeSchema>

const MAX_ITEMS = 200
const key = (scope: string) => `flexa:scan-habits:v1:${scope}`

export function readHabits(scope: string): ScanHabits {
  try {
    const parsed = storeSchema.safeParse(JSON.parse(localStorage.getItem(key(scope)) ?? '{}'))
    return parsed.success ? parsed.data : {}
  } catch { return {} }
}

export function rememberLines(habits: ScanHabits, lines: readonly PlateLine[], now = Date.now()): ScanHabits {
  const next: ScanHabits = { ...habits }
  for (const line of lines) {
    if (line.exact) continue
    next[line.id] = {
      ...(line.size ? { size: line.size } : {}),
      ...(line.count ? { count: line.count } : {}),
      ...(line.grams ? { grams: line.grams } : {}),
      at: now,
    }
  }
  const newest = Object.entries(next).sort((a, b) => b[1].at - a[1].at).slice(0, MAX_ITEMS)
  return Object.fromEntries(newest)
}

export function saveHabits(scope: string, habits: ScanHabits): void {
  try { localStorage.setItem(key(scope), JSON.stringify(habits)) } catch { /* Remembering is optional. */ }
}

/** A fresh line for an item, using the remembered amounts when there are any. */
export function lineWithHabit(habits: ScanHabits, id: string): PlateLine {
  const habit = habits[id]
  if (!habit) return { id, size: 'M' }
  return {
    id,
    ...(habit.grams ? { grams: habit.grams } : habit.count ? { count: habit.count } : {}),
    ...(habit.size ? { size: habit.size } : habit.grams || habit.count ? {} : { size: 'M' as const }),
  }
}

export function clearHabits(scope: string): void {
  try { localStorage.removeItem(key(scope)) } catch { /* Nothing to clear. */ }
}
