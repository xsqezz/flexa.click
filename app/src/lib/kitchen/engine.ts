import type { Food } from '../../../../shared/domain'
import { ingredients } from '../../../../shared/kitchen/ingredients'
import { getIngredient, ingredientsById } from '../../../../shared/kitchen/lookup'
import type { Ingredient, Nutrients } from '../../../../shared/kitchen/types'
import type { DishFormat } from '../../../../shared/kitchen/visual'
import { createContext, isExcluded, parseDislikes, recipeKey, sizeTargets, stapleIds, type Ctx, type Draft, type Picks, type Preferences, type Recipe, type RecipeLine } from './context'
import { formats } from './formats'
import { piecesOf } from './text'

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const round1 = (value: number) => Math.round(value * 10) / 10

function roundGrams(grams: number): number {
  if (grams < 10) return Math.round(grams * 2) / 2
  if (grams < 100) return Math.round(grams / 5) * 5
  return Math.round(grams / 10) * 10
}

function per100(id: string): Nutrients {
  return getIngredient(id).per100
}

function nutrientsOf(lines: readonly { id: string; grams: number }[]): Nutrients {
  const total: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  for (const line of lines) {
    const base = per100(line.id)
    for (const key of ['kcal', 'protein', 'carbs', 'fat', 'fiber'] as const) total[key] += (base[key] * line.grams) / 100
  }
  return total
}

const lineOrder = (item: Ingredient): number => {
  if (item.category === 'meat' || item.category === 'fish' || item.category === 'egg') return 0
  if (item.category === 'grain' || item.category === 'bread' || item.category === 'legume') return 1
  if (item.category === 'veg') return 2
  if (item.category === 'fruit') return 3
  if (item.category === 'dairy' || item.category === 'cheese') return 4
  if (item.category === 'fat' || item.category === 'nut') return 6
  if (item.category === 'liquid') return 7
  if (item.category === 'spice') return 8
  return 5
}

export function finalize(draft: Draft, share: number, ctx: Ctx, ownedIds: ReadonlySet<string>): Recipe {
  const target = sizeTargets[ctx.prefs.size] * share
  const fixed = nutrientsOf(draft.lines.filter((line) => !line.scale)).kcal
  const scalable = nutrientsOf(draft.lines.filter((line) => line.scale)).kcal
  const factor = scalable > 0 ? clamp((target - fixed) / scalable, 0.7, 1.5) : 1
  const perServing = draft.lines.map((line) => {
    const item = getIngredient(line.id)
    let grams = line.scale ? line.grams * factor : line.grams
    if ((item.category === 'egg' || item.category === 'bread') && item.piece) grams = Math.max(1, Math.round(grams / item.piece)) * item.piece
    else if (line.scale) grams = roundGrams(grams)
    return { ...line, grams }
  })
  const servings = ctx.prefs.servings
  const lines: RecipeLine[] = perServing.map((line) => {
    const item = getIngredient(line.id)
    const grams = Math.round(line.grams * servings * 10) / 10
    return { id: line.id, grams, pieces: piecesOf(item, grams), owned: ownedIds.has(line.id), staple: stapleIds.has(line.id) || line.id === 'water', taste: Boolean(line.taste) }
  }).sort((a, b) => Number(a.taste) - Number(b.taste) || lineOrder(getIngredient(a.id)) - lineOrder(getIngredient(b.id)))
  const total = nutrientsOf(perServing)
  const perPortion: Nutrients = { kcal: Math.round(total.kcal), protein: round1(total.protein), carbs: round1(total.carbs), fat: round1(total.fat), fiber: round1(total.fiber) }
  return {
    key: recipeKey(draft.format, draft.picks), format: draft.format, style: draft.style, title: draft.title, subtitle: draft.subtitle, minutes: draft.minutes,
    equipment: draft.equipment, servings, lines, steps: draft.steps, tips: draft.tips, perServing: perPortion,
    servingGrams: Math.round(perServing.reduce((sum, line) => sum + (line.taste ? 0 : line.grams), 0)), picks: draft.picks, imageIds: draft.imageIds,
    usedOwned: lines.filter((line) => line.owned && !line.staple).map((line) => line.id), score: 0,
  }
}

function score(recipe: Recipe, share: number, ctx: Ctx): number {
  const owned = [...ctx.owned].filter((id) => !stapleIds.has(id))
  const coverage = recipe.usedOwned.length / Math.max(1, owned.length)
  const definition = formats.find((item) => item.id === recipe.format)
  const mood = ctx.prefs.mood
  let value = 10 + 12 * coverage + recipe.usedOwned.length * 1.2
  if (definition?.moods.includes(mood)) value += 8
  if (mood === 'sweet') value += definition?.sweet ? 25 : -25
  else if (definition?.sweet) value -= mood === 'any' ? 8 : 12
  if (mood === 'protein') value += Math.min(10, recipe.perServing.protein / 4)
  if (mood === 'light' && recipe.perServing.kcal > 650) value -= 3
  if (recipe.perServing.protein >= 20) value += 2
  value += ((ctx.prefs.minutes - recipe.minutes) / ctx.prefs.minutes) * 2
  const target = sizeTargets[ctx.prefs.size] * share * 0.75
  if (recipe.perServing.kcal < target) value -= ((target - recipe.perServing.kcal) / target) * 25
  return value
}

/** Builds distinct, feasible recipes from the products the user has, best matches first. */
export function generateRecipes(owned: readonly string[], prefs: Preferences, limit = 12): Recipe[] {
  const ownedSet = new Set(owned)
  const found = new Map<string, Recipe>()
  for (let variant = 0; variant < 4; variant++) {
    const ctx = createContext(owned, prefs, variant)
    for (const definition of formats) {
      const draft = definition.compose(ctx)
      if (!draft || draft.minutes > prefs.minutes) continue
      const recipe = finalize(draft, definition.share, ctx, ownedSet)
      recipe.score = score(recipe, definition.share, ctx)
      if (!found.has(recipe.key)) found.set(recipe.key, recipe)
    }
  }
  const sorted = [...found.values()].sort((a, b) => b.score - a.score || a.key.localeCompare(b.key))
  const seen = new Set<string>()
  const diverse: Recipe[] = []
  const rest: Recipe[] = []
  for (const recipe of sorted) {
    const lead = recipe.picks.protein?.[0] ?? recipe.picks.base?.[0] ?? [...(recipe.picks.veg ?? [])].sort().join('+')
    const signature = `${recipe.format}:${lead}`
    if (seen.has(signature)) rest.push(recipe)
    else { seen.add(signature); diverse.push(recipe) }
  }
  return [...diverse, ...rest].slice(0, limit)
}

export type Suggestions = { recipes: Recipe[]; relaxed: boolean }

/** Recipes within the time limit; when nothing fits, the quickest possible ones so the user always gets an answer. */
export function suggestRecipes(owned: readonly string[], prefs: Preferences, limit = 12): Suggestions {
  const within = generateRecipes(owned, prefs, limit)
  if (within.length > 0 || prefs.minutes >= 90) return { recipes: within, relaxed: false }
  const any = generateRecipes(owned, { ...prefs, minutes: 90 }, limit * 2)
  return { recipes: any.sort((a, b) => a.minutes - b.minutes || b.score - a.score).slice(0, limit), relaxed: any.length > 0 }
}

export function rebuild(format: DishFormat, picks: Picks, owned: readonly string[], prefs: Preferences): Recipe | null {
  const definition = formats.find((item) => item.id === format)
  if (!definition) return null
  const picked = Object.values(picks).flat().filter((id) => ingredientsById.has(id))
  const ctx = createContext([...owned, ...picked], prefs, 0, picks)
  const draft = definition.compose(ctx)
  if (!draft) return null
  const recipe = finalize(draft, definition.share, ctx, new Set(owned))
  recipe.score = score(recipe, definition.share, ctx)
  return recipe
}

const swappable = (item: Ingredient) => !item.staple && item.category !== 'spice'

function compatible(current: Ingredient, candidate: Ingredient): boolean {
  if (!swappable(candidate)) return false
  const sameKind = current.category === candidate.category
    || (current.roles.includes('protein') && candidate.roles.includes('protein') && ['meat', 'fish', 'egg', 'legume', 'cheese'].includes(candidate.category) && ['meat', 'fish', 'egg', 'legume', 'cheese'].includes(current.category))
    || (current.roles.includes('carb') && candidate.roles.includes('carb') && ['grain', 'bread', 'veg', 'legume'].includes(candidate.category) && ['grain', 'bread', 'veg', 'legume'].includes(current.category))
  if (!sameKind) return false
  for (const method of ['pan', 'air', 'oven', 'boil'] as const) {
    if (((current.cook?.[method] ?? 0) > 0) !== ((candidate.cook?.[method] ?? 0) > 0)) return false
  }
  return Boolean(current.ready) === Boolean(candidate.ready) || current.category === 'fruit'
}

export type SwapOption = { id: string; owned: boolean; recipe: Recipe }

/** Alternatives for one ingredient: the user's own products first, then anything else that fits the dish. */
export function swapOptions(recipe: Recipe, lineId: string, owned: readonly string[], prefs: Preferences, limit = 10): SwapOption[] {
  const slot = Object.keys(recipe.picks).find((name) => recipe.picks[name].includes(lineId))
  if (!slot || ['style', 'method', 'kind'].includes(slot)) return []
  const current = getIngredient(lineId)
  const disliked = parseDislikes(prefs.dislikes)
  const used = new Set(Object.values(recipe.picks).flat())
  const results: SwapOption[] = []
  for (const candidate of ingredients) {
    if (used.has(candidate.id) || isExcluded(candidate, prefs, disliked) || !compatible(current, candidate)) continue
    const picks: Picks = { ...recipe.picks, [slot]: recipe.picks[slot].map((id) => (id === lineId ? candidate.id : id)) }
    const next = rebuild(recipe.format, picks, owned, prefs)
    if (next) results.push({ id: candidate.id, owned: owned.includes(candidate.id), recipe: next })
  }
  const distance = (next: Recipe) => Math.abs(next.perServing.protein - recipe.perServing.protein) + Math.abs(next.perServing.kcal - recipe.perServing.kcal) / 10
  return results.sort((a, b) => Number(b.owned) - Number(a.owned) || distance(a.recipe) - distance(b.recipe) || a.id.localeCompare(b.id)).slice(0, limit)
}

function hash(text: string): string {
  let value = 2166136261
  for (let index = 0; index < text.length; index++) value = Math.imul(value ^ text.charCodeAt(index), 16777619) >>> 0
  return value.toString(16).padStart(8, '0')
}

/** The dish as a diary food with values per 100 g, so one serving can be logged as a normal meal. */
export function recipeFood(recipe: Recipe): Food {
  const grams = Math.max(1, recipe.servingGrams)
  const scale = (value: number) => Math.round((value / grams) * 1000) / 10
  return {
    id: `kitchen-${hash(recipe.key)}`, name: recipe.title.slice(0, 200), brand: 'Flexa Smart Kuchnia', barcode: null, unit: 'g', source: 'custom', estimated: true,
    nutrients: { kcal: scale(recipe.perServing.kcal), protein: scale(recipe.perServing.protein), carbs: scale(recipe.perServing.carbs), fat: scale(recipe.perServing.fat), fiber: scale(recipe.perServing.fiber) },
  }
}
