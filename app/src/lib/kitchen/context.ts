import { ingredients } from '../../../../shared/kitchen/ingredients'
import { ingredientsById, matchIngredientName, normalizeName } from '../../../../shared/kitchen/lookup'
import type { Equipment, Ingredient, Nutrients } from '../../../../shared/kitchen/types'
import type { DishFormat, DishStyle } from '../../../../shared/kitchen/visual'

export const moods = ['any', 'warm', 'light', 'protein', 'sweet'] as const
export type Mood = typeof moods[number]
export const moodLabels: Record<Mood, { title: string; description: string }> = {
  any: { title: 'Obojętnie', description: 'Wybierz coś dobrego z tego, co mam.' },
  warm: { title: 'Ciepłe i sycące', description: 'Danie na gorąco, które naprawdę naje.' },
  light: { title: 'Lekkie i świeże', description: 'Mniej ciężko, więcej warzyw.' },
  protein: { title: 'Dużo białka', description: 'Po treningu albo na redukcji.' },
  sweet: { title: 'Na słodko', description: 'Owsianka, koktajl lub placuszki.' },
}

export const avoidKinds = ['spicy', 'milk', 'gluten', 'egg', 'fish', 'meat', 'nuts', 'soy'] as const
export type Avoid = typeof avoidKinds[number]
export const avoidLabels: Record<Avoid, string> = {
  spicy: 'Pikantne', milk: 'Nabiał i laktoza', gluten: 'Gluten', egg: 'Jajka', fish: 'Ryby i owoce morza', meat: 'Mięso', nuts: 'Orzechy i orzeszki', soy: 'Soja',
}

export const timeOptions = [15, 30, 45, 90] as const
export type TimeLimit = typeof timeOptions[number]
export const sizeOptions = ['small', 'medium', 'large'] as const
export type PortionSize = typeof sizeOptions[number]
export const sizeTargets: Record<PortionSize, number> = { small: 400, medium: 600, large: 800 }
export const sizeLabels: Record<PortionSize, string> = { small: 'Lekka (ok. 400 kcal)', medium: 'Standard (ok. 600 kcal)', large: 'Duża (ok. 800 kcal)' }

export type Preferences = {
  minutes: TimeLimit
  equipment: Equipment[]
  avoid: Avoid[]
  dislikes: string
  mood: Mood
  servings: 1 | 2 | 3 | 4
  size: PortionSize
  staples: boolean
}

export const defaultPreferences: Preferences = {
  minutes: 30, equipment: ['pan', 'pot'], avoid: [], dislikes: '', mood: 'any', servings: 2, size: 'medium', staples: true,
}

export type Picks = Record<string, string[]>
export type DraftLine = { id: string; grams: number; scale: boolean; taste?: boolean }
export type Draft = {
  format: DishFormat
  style: DishStyle
  title: string
  subtitle: string
  minutes: number
  equipment: Equipment[]
  lines: DraftLine[]
  steps: string[]
  tips: string[]
  picks: Picks
  imageIds: string[]
}

export type RecipeLine = { id: string; grams: number; pieces: number | null; owned: boolean; staple: boolean; taste: boolean }
export type Recipe = {
  key: string
  format: DishFormat
  style: DishStyle
  title: string
  subtitle: string
  minutes: number
  equipment: Equipment[]
  servings: number
  lines: RecipeLine[]
  steps: string[]
  tips: string[]
  perServing: Nutrients
  servingGrams: number
  picks: Picks
  imageIds: string[]
  usedOwned: string[]
  score: number
}

export const stapleIds: ReadonlySet<string> = new Set(ingredients.filter((item) => item.staple).map((item) => item.id))

const categoryWords: Record<string, (item: Ingredient) => boolean> = {
  ryba: (item) => item.category === 'fish' || item.id === 'shrimp', ryby: (item) => item.category === 'fish' || item.id === 'shrimp',
  mieso: (item) => item.category === 'meat', miesa: (item) => item.category === 'meat', wedliny: (item) => item.category === 'meat',
  nabial: (item) => item.category === 'dairy' || item.category === 'cheese', sery: (item) => item.category === 'cheese', ser: (item) => item.category === 'cheese',
  owoce: (item) => item.category === 'fruit', warzywa: (item) => item.category === 'veg', orzechy: (item) => item.category === 'nut',
  grzyby: (item) => item.id === 'mushrooms', 'owoce morza': (item) => item.id === 'shrimp',
}

/** Turns "nie lubię papryki, ryb" into the set of ingredient ids that must never be used. */
export function parseDislikes(text: string): Set<string> {
  const found = new Set<string>()
  for (const part of text.split(/[,;\n]/)) {
    const cleaned = normalizeName(part).replace(/^(nie lubie|nie jem|nie chce|unikam|bez|nie)\s+/, '').trim()
    if (!cleaned) continue
    const group = categoryWords[cleaned]
    if (group) { for (const item of ingredients) if (group(item)) found.add(item.id); continue }
    const id = matchIngredientName(cleaned)
    if (id) found.add(id)
  }
  return found
}

export function isExcluded(item: Ingredient, prefs: Preferences, disliked: ReadonlySet<string>): boolean {
  if (disliked.has(item.id)) return true
  const allergens = item.allergens ?? []
  for (const kind of prefs.avoid) {
    if (kind === 'spicy' && item.spicy) return true
    if (kind === 'milk' && allergens.includes('milk')) return true
    if (kind === 'gluten' && allergens.includes('gluten')) return true
    if (kind === 'egg' && allergens.includes('egg')) return true
    if (kind === 'fish' && (item.category === 'fish' || allergens.includes('fish') || allergens.includes('crustaceans'))) return true
    if (kind === 'meat' && item.category === 'meat') return true
    if (kind === 'nuts' && (allergens.includes('nuts') || allergens.includes('peanuts'))) return true
    if (kind === 'soy' && allergens.includes('soy')) return true
  }
  return false
}

const priority: Record<string, number> = { fish: 0, meat: 1, veg: 2, egg: 3, legume: 3, fruit: 4, dairy: 5, cheese: 5 }

export type Ctx = {
  prefs: Preferences
  equipment: ReadonlySet<Equipment>
  owned: ReadonlySet<string>
  variant: number
  picks: Picks | undefined
  has(id: string): boolean
  usable(id: string): boolean
  /** The user's usable ingredients that satisfy the filter, most perishable first. */
  pool(filter: (item: Ingredient) => boolean): Ingredient[]
  /** Reuses fixed picks (swaps) or chooses `count` items, rotating the start with the variant when asked. */
  choose(slot: string, pool: readonly Ingredient[], count: number, rotate?: boolean): Ingredient[]
}

export function createContext(ownedIds: Iterable<string>, prefs: Preferences, variant = 0, picks?: Picks): Ctx {
  const disliked = parseDislikes(prefs.dislikes)
  const usableIds = (id: string) => { const item = ingredientsById.get(id); return item !== undefined && !isExcluded(item, prefs, disliked) }
  const owned = new Set([...ownedIds].filter(usableIds))
  const equipment = new Set(prefs.equipment)
  const has = (id: string) => owned.has(id) || (prefs.staples && stapleIds.has(id) && usableIds(id)) || id === 'water'
  const rank = (item: Ingredient) => priority[item.category] ?? 6
  return {
    prefs, equipment, owned, variant, picks, has, usable: usableIds,
    pool: (filter) => [...owned].map((id) => ingredientsById.get(id)).filter((item): item is Ingredient => item !== undefined && filter(item))
      .sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id)),
    choose(slot, pool, count, rotate = false) {
      const fixed = picks?.[slot]
      if (fixed) return fixed.map((id) => ingredientsById.get(id)).filter((item): item is Ingredient => item !== undefined)
      if (!pool.length) return []
      const offset = rotate ? variant % pool.length : 0
      return [...pool.slice(offset), ...pool.slice(0, offset)].slice(0, count)
    },
  }
}

export function recipeKey(format: DishFormat, picks: Picks): string {
  return `${format}:${Object.keys(picks).sort().map((slot) => `${slot}=${[...picks[slot]].sort().join('+')}`).join(';')}`
}
