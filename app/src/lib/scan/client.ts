import { z } from 'zod'
import { getPlateItem, plateItemsById, plateSizes } from '../../../../shared/meal-scan/catalog'
import type { PlateLine } from '../../../../shared/meal-scan/estimate'
import { KitchenAiError, failure } from '../kitchen/ai-client'

const CONSENT_KEY = 'flexa:meal-photo'

export function scanConsentGiven(): boolean {
  try { return localStorage.getItem(CONSENT_KEY) === 'on' } catch { return false }
}

export function rememberScanConsent(value: boolean): void {
  try { if (value) localStorage.setItem(CONSENT_KEY, 'on'); else localStorage.removeItem(CONSENT_KEY) } catch { /* The choice then applies to this view only. */ }
}

const resultSchema = z.object({
  items: z.array(z.object({
    id: z.string().refine((id) => plateItemsById.has(id)),
    size: z.enum(plateSizes).nullable(),
    count: z.number().int().min(1).max(60).nullable(),
  })).max(25),
  unknown: z.array(z.string().max(60)).max(10),
  photos: z.number().int().min(1).max(2),
  analysed: z.number().int().min(0).max(2),
})
export type PlateAnalysis = z.infer<typeof resultSchema>

export async function analysePlate(images: readonly string[], token: string, signal?: AbortSignal): Promise<PlateAnalysis> {
  const response = await fetch('/api/meal/plate', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ images }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(90_000)]) : AbortSignal.timeout(90_000),
  })
  if (!response.ok) throw await failure(response)
  const parsed = resultSchema.safeParse(await response.json().catch(() => null))
  if (!parsed.success) throw new KitchenAiError('Usługa AI zwróciła nieczytelną odpowiedź. Spróbuj ponownie.', 'bad_response')
  return parsed.data
}

/** Pieces the model counted become a count; otherwise its size guess (medium when it gave none) is kept for the user to confirm. */
export function lineFromFinding(finding: PlateAnalysis['items'][number]): PlateLine {
  const item = getPlateItem(finding.id)
  if (finding.count && item.piece) return { id: item.id, count: finding.count }
  if (finding.count && finding.count > 1) return { id: item.id, size: finding.size ?? 'M', count: Math.min(finding.count, 6) }
  return { id: item.id, size: finding.size ?? 'M' }
}
