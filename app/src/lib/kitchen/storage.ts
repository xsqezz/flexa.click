import { z } from 'zod'
import { equipmentKinds } from '../../../../shared/kitchen/types'
import { avoidKinds, defaultPreferences, moods, sizeOptions, timeOptions, type Preferences } from './context'

const KEY = 'flexa:kitchen:v1'

const preferencesSchema = z.object({
  minutes: z.number().refine((value): value is Preferences['minutes'] => (timeOptions as readonly number[]).includes(value)),
  equipment: z.array(z.enum(equipmentKinds)).max(equipmentKinds.length),
  avoid: z.array(z.enum(avoidKinds)).max(avoidKinds.length),
  dislikes: z.string().max(200),
  mood: z.enum(moods),
  servings: z.number().int().min(1).max(4),
  size: z.enum(sizeOptions),
  staples: z.boolean(),
})
const storedSchema = z.object({ owned: z.array(z.string().regex(/^[a-z0-9-]{2,40}$/)).max(80), preferences: preferencesSchema })

export type KitchenState = { owned: string[]; preferences: Preferences }

/** Ingredients, allergies and dislikes stay in this browser only. */
export function readKitchen(): KitchenState {
  try {
    const parsed = storedSchema.safeParse(JSON.parse(localStorage.getItem(KEY) ?? 'null'))
    if (parsed.success) return { owned: parsed.data.owned, preferences: parsed.data.preferences as Preferences }
  } catch { /* Fall back to defaults. */ }
  return { owned: [], preferences: defaultPreferences }
}

export function writeKitchen(state: KitchenState): void {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* Not saving only means asking again next time. */ }
}

export function clearKitchen(): void {
  try { localStorage.removeItem(KEY) } catch { /* Nothing to clear. */ }
}
