import { getPlateItem, type PlateItem } from '../../../../shared/meal-scan/catalog'
import type { PlateLine } from '../../../../shared/meal-scan/estimate'
import { searchPlateItems, type Candidate, type Confidence } from '../../../../shared/meal-scan/match'
import { parseMealPhrase, queryVariants, splitAtWith, type PhrasePart } from '../../../../shared/meal-scan/phrase'
import { lineForItem, type ResolvedFinding } from './client'

export type QuickResult = {
  resolved: ResolvedFinding[]
  /** Words the catalogue had no plausible item for; the user can search for them by hand. */
  unknown: string[]
}

const confidenceOf = (score: number): Confidence => score >= 0.8 ? 'sure' : score >= 0.55 ? 'check' : 'unknown'

/** The best reading of the words: each inflected form is tried and the highest score wins. */
function best(query: string): Candidate[] {
  let top: Candidate[] = []
  for (const variant of queryVariants(query)) {
    const found = searchPlateItems(variant, 5)
    if ((found[0]?.score ?? 0) > (top[0]?.score ?? 0)) top = found
  }
  return top
}

function lineFor(item: PlateItem, part: PhrasePart, habit?: (id: string) => PlateLine): PlateLine {
  if (part.grams !== null && !item.fixed) return { id: item.id, grams: Math.round(part.grams) }
  if (part.count !== null && !Number.isInteger(part.count)) {
    // "pół banana": half of one piece or of a medium portion.
    const base = item.piece ? item.piece.grams : item.sizes.M
    return { id: item.id, grams: Math.max(1, Math.round(base * part.count)) }
  }
  if (part.count === null && part.size === null && habit) return habit(item.id)
  return lineForItem(item, { size: part.size, count: part.count })
}

function resolvePart(part: PhrasePart, habit?: (id: string) => PlateLine): { items: ResolvedFinding[]; unknown: string[] } {
  const whole = best(part.query)
  const split = (whole[0]?.score ?? 0) < 0.8 ? splitAtWith(part.query) : null
  if (split) {
    const head = best(split[0])
    const tail = best(split[1])
    const headScore = head[0]?.score ?? 0
    const tailScore = tail[0]?.score ?? 0
    // "owsianka z bananem": two foods when both halves are found; if only the first is, the tail is reported, never dropped silently.
    if (headScore >= 0.5 && tailScore >= 0.5) {
      const first = resolvePart({ ...part, query: split[0] }, habit)
      const second = resolvePart({ ...part, query: split[1], count: null, grams: null, size: null }, habit)
      return { items: [...first.items, ...second.items], unknown: [...first.unknown, ...second.unknown] }
    }
    if (headScore >= 0.5 && headScore > (whole[0]?.score ?? 0)) {
      const first = resolvePart({ ...part, query: split[0] }, habit)
      return { items: first.items, unknown: [...first.unknown, `z ${split[1]}`] }
    }
  }
  const top = whole[0]
  if (!top || top.score < 0.3) return { items: [], unknown: [part.raw] }
  return {
    items: [{
      line: lineFor(top.item, part, habit),
      heard: part.raw,
      alternatives: whole.slice(1).map((candidate) => candidate.item.id).filter((id) => getPlateItem(id)),
      confidence: confidenceOf(top.score),
    }],
    unknown: [],
  }
}

/** Reads a typed or dictated sentence and looks every item up in the catalogue (the library must be loaded). */
export function resolveQuick(text: string, habit?: (id: string) => PlateLine): QuickResult {
  const resolved: ResolvedFinding[] = []
  const unknown: string[] = []
  for (const part of parseMealPhrase(text)) {
    const result = resolvePart(part, habit)
    resolved.push(...result.items)
    unknown.push(...result.unknown)
  }
  return { resolved, unknown }
}
