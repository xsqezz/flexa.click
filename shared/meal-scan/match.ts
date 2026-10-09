import { plateItemsById, type PlateItem, type PlateSize } from './catalog.ts'

/** Folds Polish diacritics and case so "Pączek", "paczek" and "PĄCZEK" are the same word. */
export const fold = (text: string) => text.toLocaleLowerCase('pl-PL').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, ' ').trim()

const stopWords = new Set([
  'a', 'an', 'the', 'of', 'in', 'on', 'with', 'without', 'and', 'or', 'for', 'from', 'to', 'as', 'at', 'by', 'its', 'is', 'no', 'not',
  'nfs', 'ns', 'nec', 'fast', 'food', 'restaurant', 'style', 'type', 'kind', 'served', 'plate', 'piece', 'pieces', 'pc', 'pcs', 'portion', 'one', 'some',
  'w', 'z', 'ze', 'i', 'oraz', 'na', 'do', 'od', 'po', 'bez', 'lub', 'szt', 'porcja', 'cos', 'typu',
])

const sizeWords: Record<string, string> = {
  mala: 'small', male: 'small', maly: 'small', mini: 'small', small: 'small',
  srednia: 'medium', srednie: 'medium', sredni: 'medium', medium: 'medium', regular: 'medium',
  duza: 'large', duze: 'large', duzy: 'large', large: 'large', big: 'large', grande: 'large',
  xl: 'xlarge', xxl: 'xlarge', xlarge: 'xlarge',
}

/** Spellings that mean the same thing on a menu. */
const synonyms: Record<string, string> = {
  bbq: 'barbecue', coke: 'cola', filet: 'fillet', omelette: 'omelet', doughnut: 'donut', doughnuts: 'donut', yoghurt: 'yogurt',
  kebap: 'kebab', gyros: 'gyro', burgers: 'burger', hamburgers: 'hamburger', mayo: 'mayonnaise', veggie: 'vegetarian', vege: 'vegetarian', wege: 'vegetarian',
}

const phrases: readonly (readonly [RegExp, string])[] = [
  [/\bmac\s*(?:and|n|&)\s*cheese\b/g, 'macaroni and cheese'], [/\bfrench\s+fries\b/g, 'french fries'], [/\bice\s*tea\b/g, 'iced tea'],
]

/** Light stemming that is enough to make "fries"/"fry", "nuggets"/"nugget" and "tomatoes"/"tomato" meet. */
function stem(token: string): string {
  if (token.length > 4) {
    if (token.endsWith('ies')) return `${token.slice(0, -3)}y`
    if (/(ches|shes|sses|xes|oes)$/.test(token)) return token.slice(0, -2)
    if (token.endsWith('s') && !token.endsWith('ss') && !token.endsWith('us') && !token.endsWith('is')) return token.slice(0, -1)
  }
  return token
}

export function tokenize(text: string, keepNumbers = false): string[] {
  const out: string[] = []
  let folded = fold(text)
  for (const [pattern, replacement] of phrases) folded = folded.replace(pattern, replacement)
  for (const raw of folded.split(' ')) {
    if (!raw) continue
    if (/^\d+$/.test(raw)) { if (keepNumbers && raw.length <= 2) out.push(`#${raw}`); continue }
    if (stopWords.has(raw)) continue
    const word = sizeWords[raw] ?? stem(synonyms[raw] ?? raw)
    if (word.length < 2 || stopWords.has(word)) continue
    out.push(word)
  }
  return out
}

/** Chains the app knows by their official menus; the key is what a photo model or a person may write. */
const brandAliases: readonly (readonly [canonical: string, pattern: RegExp])[] = [
  ["McDonald's", /\b(mc\s?donald'?s?|mcd|macdonald'?s?|maccas|golden arches)\b/i],
  ['Burger King', /\b(burger\s?king|bk)\b/i],
  ['KFC', /\b(kfc|kentucky fried chicken|kentucky)\b/i],
  ["Wendy's", /\bwendy'?s?\b/i], ['Taco Bell', /\btaco\s?bell\b/i], ['Subway', /\bsubway\b/i], ['Pizza Hut', /\bpizza\s?hut\b/i],
  ["Domino's", /\bdomino'?s?\b/i], ['Little Caesars', /\blittle\s?caesars?\b/i], ['Popeyes', /\bpopeyes?\b/i], ['Chick-fil-A', /\bchick[\s-]?fil[\s-]?a\b/i],
  ["Arby's", /\barby'?s?\b/i], ["Papa John's", /\bpapa\s?john'?s?\b/i], ["Denny's", /\bdenny'?s?\b/i], ["Applebee's", /\bapplebee'?s?\b/i], ['Olive Garden', /\bolive\s?garden\b/i],
]

export function detectBrand(text: string): string | null {
  for (const [canonical, pattern] of brandAliases) if (pattern.test(text)) return canonical
  return null
}

const stripBrand = (text: string) => brandAliases.reduce((current, [, pattern]) => current.replace(new RegExp(pattern.source, 'gi'), ' '), text)

type Variant = { tokens: string[]; weights: number[]; total: number; text: string; unique: boolean }
type Entry = { item: PlateItem; variants: Variant[]; nfs: boolean }

type Index = { entries: Entry[]; weight: Map<string, number>; byToken: Map<string, number[]>; byPrefix: Map<string, number[]>; byBrand: Map<string, number[]>; size: number }

let index: Index | null = null

function build(): Index {
  const items = [...plateItemsById.values()]
  const rawVariants = items.map((item) => {
    const names = [item.name, ...(item.aliases ?? []), ...(item.en ?? [])]
    return { item, names: [...new Set(names)], keepNumbers: Boolean(item.brand) }
  })
  const df = new Map<string, number>()
  const tokenLists = rawVariants.map(({ names, keepNumbers }) => names.map((name) => tokenize(name, keepNumbers)))
  for (const lists of tokenLists) for (const token of new Set(lists.flat())) df.set(token, (df.get(token) ?? 0) + 1)
  const weight = new Map<string, number>()
  for (const [token, count] of df) weight.set(token, Math.log(1 + items.length / count))
  const entries: Entry[] = []
  const byToken = new Map<string, number[]>()
  const byPrefix = new Map<string, number[]>()
  const byBrand = new Map<string, number[]>()
  const push = (map: Map<string, number[]>, key: string, value: number) => { const list = map.get(key); if (list) { if (list.at(-1) !== value) list.push(value) } else map.set(key, [value]) }
  const generic = new Set<string>()
  const coreText = (tokens: readonly string[]) => [...new Set(tokens.filter((token) => !token.startsWith('#') && !['small', 'medium', 'large', 'xlarge'].includes(token)))].sort().join(' ')
  rawVariants.forEach(({ item }, at) => {
    if (!item.brand) for (const tokens of tokenLists[at]) generic.add(coreText(tokens))
  })
  rawVariants.forEach(({ item, names }, at) => {
    const variants: Variant[] = names.map((_, position) => {
      const tokens = [...new Set(tokenLists[at][position])]
      const weights = tokens.map((token) => weight.get(token) ?? 1)
      const text = tokens.slice().sort().join(' ')
      return { tokens, weights, total: weights.reduce((sum, value) => sum + value, 0), text, unique: Boolean(item.brand) && !generic.has(coreText(tokens)) }
    }).filter((variant) => variant.tokens.length)
    const nfs = (item.en ?? []).some((name) => /\bNFS\b/.test(name))
    const position = entries.push({ item, variants, nfs }) - 1
    for (const variant of variants) for (const token of variant.tokens) {
      push(byToken, token, position)
      if (token.length >= 5 && !token.startsWith('#')) push(byPrefix, token.slice(0, 4), position)
    }
    if (item.brand) push(byBrand, item.brand, position)
  })
  return { entries, weight, byToken, byPrefix, byBrand, size: items.length }
}

function ensureIndex(): Index {
  if (!index || index.size !== plateItemsById.size) index = build()
  return index
}

/** Call after registering more items; the next search rebuilds the index. */
export function resetPlateIndex(): void {
  index = null
}

export type Candidate = { item: PlateItem; score: number }

type Query = { tokens: string[]; weights: number[]; total: number; text: string; fullText: string; extra: Set<string> }

function makeQuery(idx: Index, tokens: readonly string[], extra: readonly string[] = [], minor: readonly string[] = []): Query {
  const unique = [...new Set([...tokens, ...extra])]
  const weights = unique.map((token) => {
    const base = idx.weight.get(token) ?? Math.log(1 + idx.size)
    if (extra.includes(token) && !tokens.includes(token)) return base * 0.6
    return minor.includes(token) ? base * 0.45 : base
  })
  const sorted = (list: readonly string[]) => [...new Set(list)].sort().join(' ')
  return { tokens: unique, weights, total: weights.reduce((sum, value) => sum + value, 0), text: sorted(tokens), fullText: sorted(unique), extra: new Set(extra) }
}

const weakMatch = (a: string, b: string) => a.length >= 5 && b.length >= 5 && a.slice(0, 4) === b.slice(0, 4) && !a.startsWith('#') && !b.startsWith('#')

function dice(query: Query, variant: Variant, prefixLast: boolean): { score: number; exact: boolean } {
  let matched = 0
  const used = new Set<number>()
  query.tokens.forEach((token, at) => {
    const found = variant.tokens.indexOf(token)
    if (found >= 0 && !used.has(found)) { used.add(found); matched += query.weights[at]; return }
    const near = variant.tokens.findIndex((other, position) => !used.has(position) && (weakMatch(token, other) || (prefixLast && at === query.tokens.length - 1 && token.length >= 2 && other.startsWith(token))))
    if (near >= 0) { used.add(near); matched += 0.65 * Math.min(query.weights[at], variant.weights[near]) }
  })
  if (!matched) return { score: 0, exact: false }
  let score = 2 * matched / (query.total + variant.total)
  const full = query.extra.size > 0 && variant.text === query.fullText
  const core = variant.text === query.text
  if (full) score += 0.25
  else if (core) score += 0.15
  return { score, exact: full || core }
}

function rank(idx: Index, query: Query, options: { brand: string | null; prefixLast: boolean; limit: number }): Candidate[] {
  const pool = new Set<number>()
  query.tokens.forEach((token, at) => {
    for (const position of idx.byToken.get(token) ?? []) pool.add(position)
    if (token.length >= 5 && !token.startsWith('#')) for (const position of idx.byPrefix.get(token.slice(0, 4)) ?? []) pool.add(position)
    if (options.prefixLast && at === query.tokens.length - 1 && token.length >= 2) {
      for (const [key, list] of idx.byToken) if (key.startsWith(token)) for (const position of list) pool.add(position)
    }
  })
  if (options.brand) for (const position of idx.byBrand.get(options.brand) ?? []) pool.add(position)
  const found: Candidate[] = []
  for (const position of pool) {
    const entry = idx.entries[position]
    let best = 0
    let signature = false
    for (const variant of entry.variants) {
      const { score: value, exact } = dice(query, variant, options.prefixLast)
      if (value > best) { best = value; signature = exact && variant.unique }
    }
    if (best < 0.12) continue
    let score = best
    const { item } = entry
    if (options.brand) {
      if (item.brand === options.brand) score *= 1.2
      else if (item.brand) score *= 0.35
      else score *= 0.9
    } else if (item.brand && !signature) score *= 0.88
    if (item.region === 'PL') score *= 1.04
    if (item.curated) score *= 1.06
    if (entry.nfs) score *= 1.04
    found.push({ item, score })
  }
  found.sort((a, b) => b.score - a.score || a.item.name.length - b.item.name.length)
  return found.slice(0, options.limit)
}

/** Hand search by name or alias in Polish or English; the last word may still be half typed. */
export function searchPlateItems(query: string, limit = 12): Candidate[] {
  const tokens = tokenize(query)
  if (!tokens.length) return []
  const idx = ensureIndex()
  const brand = detectBrand(query)
  const cleaned = brand ? tokenize(stripBrand(query)) : tokens
  return rank(idx, makeQuery(idx, cleaned.length ? cleaned : tokens), { brand, prefixLast: true, limit }).filter((entry) => entry.score >= 0.3)
}

/** What a photo model said about one item on the tray. */
export type Descriptor = { name: string; brand?: string | null; size?: PlateSize | null; count?: number | null }

export type Confidence = 'sure' | 'check' | 'unknown'

export type Match = { candidates: Candidate[]; brand: string | null; confidence: Confidence }

const sizeToken: Record<PlateSize, string> = { S: 'small', M: 'medium', L: 'large' }

/** Finds the catalogue items that best fit a described item, with an honest confidence the app turns into "check this". */
export function matchDescriptor(descriptor: Descriptor, limit = 5): Match {
  const idx = ensureIndex()
  const brand = detectBrand(descriptor.brand ?? '') ?? detectBrand(descriptor.name)
  const named = brand ? stripBrand(descriptor.name) : descriptor.name
  // "pancakes with syrup": the words after "with" describe a topping and count for less than the main food.
  const [main, ...toppings] = named.split(/\b(?:with|topped with|served with|covered in|filled with)\b/i)
  const headTokens = tokenize(main)
  const minor = tokenize(toppings.join(' ')).filter((token) => !headTokens.includes(token))
  const tokens = headTokens.length ? [...headTokens, ...minor] : tokenize(named)
  if (!tokens.length) return { candidates: [], brand, confidence: 'unknown' }
  const extra: string[] = []
  if (descriptor.size && !tokens.some((token) => ['small', 'medium', 'large', 'xlarge'].includes(token))) extra.push(sizeToken[descriptor.size])
  if (brand && descriptor.count && descriptor.count >= 2 && descriptor.count <= 30) extra.push(`#${descriptor.count}`)
  const candidates = rank(idx, makeQuery(idx, tokens, extra, minor), { brand, prefixLast: false, limit })
  const top = candidates[0]?.score ?? 0
  return { candidates, brand, confidence: top >= 0.8 ? 'sure' : top >= 0.55 ? 'check' : 'unknown' }
}
