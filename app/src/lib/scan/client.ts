import { z } from 'zod'
import { getPlateItem, plateSizes, type PlateItem } from '../../../../shared/meal-scan/catalog'
import type { PlateLine } from '../../../../shared/meal-scan/estimate'
import { matchDescriptor, type Confidence } from '../../../../shared/meal-scan/match'
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
    name: z.string().min(1).max(80),
    brand: z.string().max(40).nullable(),
    size: z.enum(plateSizes).nullable(),
    count: z.number().int().min(1).max(60).nullable(),
  })).max(25),
  photos: z.number().int().min(1).max(2),
  analysed: z.number().int().min(0).max(2),
})
export type PlateAnalysis = z.infer<typeof resultSchema>
export type PlateFinding = PlateAnalysis['items'][number]

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

/** Pieces the model counted become a count; a fixed menu portion only takes a number of portions; otherwise its size guess is kept for the user to confirm. */
export function lineForItem(item: PlateItem, finding: Pick<PlateFinding, 'size' | 'count'>): PlateLine {
  const count = finding.count && finding.count > 1 ? finding.count : null
  if (item.fixed) return count && !/\d/.test(item.name) ? { id: item.id, count: Math.min(count, 12) } : { id: item.id }
  if (finding.count && item.piece) return { id: item.id, count: finding.count }
  if (count) return { id: item.id, size: finding.size ?? 'M', count: Math.min(count, 6) }
  return { id: item.id, size: finding.size ?? 'M' }
}

export type ResolvedFinding = {
  line: PlateLine
  /** What the model said, shown so the user can see why this item was chosen. */
  heard: string
  /** Other catalogue items that fit, best first, for a one-tap correction. */
  alternatives: string[]
  confidence: Confidence
}

/** Looks every finding up in the catalogue; findings with no plausible item come back as plain names. */
export function resolveFindings(findings: readonly PlateFinding[]): { resolved: ResolvedFinding[]; unknown: string[] } {
  const resolved: ResolvedFinding[] = []
  const unknown: string[] = []
  for (const finding of findings) {
    const match = matchDescriptor(finding, 5)
    const best = match.candidates[0]
    if (!best || match.candidates[0].score < 0.3) { unknown.push(finding.name); continue }
    resolved.push({
      line: lineForItem(best.item, finding),
      heard: finding.brand ? `${finding.name} (${finding.brand})` : finding.name,
      alternatives: match.candidates.slice(1).map((candidate) => candidate.item.id).filter((id) => getPlateItem(id)),
      confidence: match.confidence,
    })
  }
  return { resolved, unknown }
}
