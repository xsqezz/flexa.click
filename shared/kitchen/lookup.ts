import { ingredients } from './ingredients.ts'
import type { Ingredient } from './types.ts'

export const ingredientsById: ReadonlyMap<string, Ingredient> = new Map(ingredients.map((item) => [item.id, item]))

export function getIngredient(id: string): Ingredient {
  const item = ingredientsById.get(id)
  if (!item) throw new Error(`Nieznany składnik: ${id}`)
  return item
}

export function normalizeName(text: string): string {
  return text.toLowerCase().replaceAll('ł', 'l').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim()
}

const noise = new Set([
  'swiezy', 'swieza', 'swieze', 'swiezych', 'mrozony', 'mrozona', 'mrozone', 'mrozonych', 'surowy', 'surowa', 'surowe', 'organiczny', 'bio', 'maly', 'mala', 'male',
  'duzy', 'duza', 'duze', 'kilka', 'pol', 'opakowanie', 'puszka', 'puszki', 'sztuki', 'sztuka', 'szt', 'kg', 'g', 'ml', 'l', 'pokrojony', 'pokrojona', 'pokrojone', 'caly', 'cala', 'cale',
])

function tokens(text: string): string[] {
  return normalizeName(text).split(' ').filter((token) => token && !noise.has(token) && !/^\d+$/.test(token))
}

const nonIngredients = new Set([
  'sok', 'napoj', 'syrop', 'lody', 'baton', 'batony', 'chipsy', 'cukierki', 'cukierek', 'nutella', 'ciastko', 'ciastka', 'biszkopt', 'biszkopty', 'paluszki',
  'herbata', 'kawa', 'cola', 'piwo', 'wino', 'wodka', 'whisky',
])

/** Drinks, sweets and snacks are not something the recipe engine cooks with, and "orange juice" must never become an orange. */
export function isNonIngredientName(name: string): boolean {
  return tokens(name).some((token) => nonIngredients.has(token) || token.startsWith('czekolad'))
}

function sameStem(a: string, b: string): boolean {
  if (a === b) return true
  const shortest = Math.min(a.length, b.length)
  const longest = Math.max(a.length, b.length)
  if (shortest < 4) return false
  let common = 0
  while (common < shortest && a[common] === b[common]) common++
  return common >= 4 && common >= shortest - 2 && common >= Math.ceil(longest * 0.7)
}

type AliasEntry = { id: string; tokens: string[]; weight: number }
const aliasEntries: AliasEntry[] = ingredients.flatMap((item) => [...new Set([item.nom, ...item.aliases])].map((alias) => {
  const parts = tokens(alias)
  return { id: item.id, tokens: parts, weight: parts.reduce((sum, part) => sum + part.length, 0) }
})).filter((entry) => entry.tokens.length > 0)

function alignment(entry: AliasEntry, words: string[]): number {
  let from = 0
  for (const token of entry.tokens) {
    const index = words.findIndex((word, position) => position >= from && sameStem(token, word))
    if (index < 0) return 0
    from = index + 1
  }
  return entry.weight
}

/** Maps a free-form (Polish or English) product name to an ingredient id, or null when nothing fits. */
export function matchIngredientName(name: string): string | null {
  const words = tokens(name)
  if (!words.length || isNonIngredientName(name)) return null
  let best: { id: string; score: number; extra: number } | null = null
  for (const entry of aliasEntries) {
    const score = alignment(entry, words)
    if (!score) continue
    const extra = words.length - entry.tokens.length
    if (!best || score > best.score || (score === best.score && extra < best.extra)) best = { id: entry.id, score, extra }
  }
  return best?.id ?? null
}

export function matchIngredientNames(names: readonly string[]): { ids: string[]; unknown: string[] } {
  const ids: string[] = []
  const unknown: string[] = []
  for (const name of names) {
    if (isNonIngredientName(name)) continue
    const id = matchIngredientName(name)
    if (id) { if (!ids.includes(id)) ids.push(id) }
    else if (name.trim() && !unknown.includes(name.trim())) unknown.push(name.trim())
  }
  return { ids, unknown }
}
