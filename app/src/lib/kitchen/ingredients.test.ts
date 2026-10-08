// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { allergenKinds, ingredientCategories, ingredientRoles, dietLevels } from '../../../../shared/kitchen/types'
import { ingredients } from '../../../../shared/kitchen/ingredients'

export const requiredIds = [
  'salt', 'pepper', 'paprika-sweet', 'garlic-granulated', 'herbs-mixed', 'rapeseed-oil', 'olive-oil', 'butter', 'peanut-butter', 'walnuts', 'almonds', 'sunflower-seeds', 'chia',
  'chicken-breast', 'chicken-thigh', 'turkey-breast', 'minced-beef', 'minced-pork', 'minced-turkey', 'pork-loin', 'ham', 'sausage', 'bacon', 'frankfurters',
  'salmon', 'cod', 'tuna-canned', 'sardines-canned', 'mackerel-smoked', 'shrimp', 'egg',
  'milk', 'yogurt-natural', 'yogurt-greek', 'skyr', 'kefir', 'cottage-cheese', 'quark', 'cream', 'cream-heavy', 'cream-cheese',
  'cheese-yellow', 'mozzarella', 'feta', 'parmesan',
  'onion', 'garlic', 'carrot', 'potato', 'sweet-potato', 'bell-pepper', 'tomato', 'cucumber', 'zucchini', 'eggplant', 'broccoli', 'cauliflower', 'spinach', 'lettuce', 'arugula',
  'mushrooms', 'cabbage', 'sauerkraut', 'leek', 'celeriac', 'beetroot-cooked', 'peas-frozen', 'corn-canned', 'green-beans', 'pumpkin', 'radish', 'avocado', 'olives', 'spring-onion',
  'pickled-cucumber', 'canned-tomatoes', 'passata', 'tomato-paste',
  'banana', 'apple', 'pear', 'strawberries', 'raspberries', 'blueberries', 'orange', 'lemon', 'grapes', 'mixed-berries-frozen',
  'rice-white', 'rice-brown', 'pasta', 'couscous', 'buckwheat', 'millet', 'quinoa', 'oats', 'flour-wheat', 'rice-noodles', 'bread-wheat', 'bread-whole', 'bread-roll', 'tortilla',
  'chickpeas-canned', 'kidney-beans-canned', 'white-beans-canned', 'lentils-red', 'lentils-green', 'tofu', 'hummus',
  'soy-sauce', 'ketchup', 'mustard', 'mayonnaise', 'pesto', 'honey', 'jam', 'coconut-milk', 'broth', 'balsamic-vinegar', 'hot-sauce', 'chili-flakes', 'curry-powder', 'cumin',
  'cinnamon', 'oregano', 'basil-dried', 'thyme', 'parsley', 'dill', 'chives', 'ginger', 'cocoa', 'sugar', 'water', 'halloumi', 'bulgur', 'salmon-smoked',
]

const atwater = (n: { protein: number; carbs: number; fat: number; fiber: number }) => 4 * n.protein + 4 * n.carbs - 2 * n.fiber + 9 * n.fat

describe('ingredient database', () => {
  it('contains every ingredient the recipe engine relies on', () => {
    const ids = new Set(ingredients.map((item) => item.id))
    expect(requiredIds.filter((id) => !ids.has(id))).toEqual([])
    expect(ingredients.length).toBeGreaterThanOrEqual(requiredIds.length)
  })

  it('has unique ids, names and aliases', () => {
    expect(new Set(ingredients.map((item) => item.id)).size).toBe(ingredients.length)
    expect(new Set(ingredients.map((item) => item.nom)).size).toBe(ingredients.length)
    const owner = new Map<string, string>()
    for (const item of ingredients) {
      for (const alias of item.aliases) {
        const key = alias.trim().toLowerCase()
        expect(key, `${item.id} alias`).toBe(alias)
        expect(owner.get(key) ?? item.id, `alias "${alias}" of ${item.id} also used by ${owner.get(key)}`).toBe(item.id)
        owner.set(key, item.id)
      }
    }
  })

  it('is complete and well formed', () => {
    for (const item of ingredients) {
      const label = item.id
      expect(item.id, label).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      for (const form of [item.nom, item.acc, item.ins, item.gen, item.en]) expect(form.trim(), label).toBe(form)
      for (const form of [item.nom, item.acc, item.ins, item.gen]) {
        expect(form, label).toMatch(/^[a-ząćęłńóśźż0-9 ,.%()'/-]+$/)
        expect(form.length, label).toBeGreaterThan(2)
      }
      expect(item.emoji.length, label).toBeGreaterThan(0)
      expect(item.aliases.length, label).toBeGreaterThan(0)
      expect(ingredientCategories).toContain(item.category)
      expect(item.roles.length, label).toBeGreaterThan(0)
      for (const role of item.roles) expect(ingredientRoles).toContain(role)
      for (const allergen of item.allergens ?? []) expect(allergenKinds).toContain(allergen)
      expect(dietLevels).toContain(item.diet)
      if (item.piece !== undefined) expect(item.piece, label).toBeGreaterThan(0)
      if (item.prep) expect(item.prep, label).toMatch(/\{(acc|gen|ins)\}/)
    }
  })

  it('has plausible nutrition per 100 g', () => {
    for (const item of ingredients) {
      const { kcal, protein, carbs, fat, fiber } = item.per100
      const label = `${item.id} ${JSON.stringify(item.per100)}`
      for (const value of [kcal, protein, carbs, fat, fiber]) expect(value, label).toBeGreaterThanOrEqual(0)
      expect(kcal, label).toBeLessThanOrEqual(900)
      expect(protein + carbs + fat, label).toBeLessThanOrEqual(101)
      expect(fiber, label).toBeLessThanOrEqual(carbs + 0.5)
      const estimate = atwater(item.per100)
      expect(Math.abs(kcal - estimate), `${label} estimate ${estimate}`).toBeLessThanOrEqual(Math.max(18, estimate * 0.22))
    }
  })

  it('gives each category believable macros', () => {
    const byId = new Map(ingredients.map((item) => [item.id, item]))
    expect(byId.get('chicken-breast')?.per100.protein).toBeGreaterThan(20)
    expect(byId.get('chicken-breast')?.per100.kcal).toBeLessThan(140)
    expect(byId.get('rapeseed-oil')?.per100.kcal).toBeGreaterThan(850)
    expect(byId.get('rice-white')?.per100.carbs).toBeGreaterThan(70)
    expect(byId.get('egg')?.piece).toBeGreaterThan(45)
    expect(byId.get('salt')?.per100.kcal).toBe(0)
    for (const item of ingredients) {
      if (item.category === 'veg') expect(item.per100.kcal, item.id).toBeLessThanOrEqual(160)
      if (item.category === 'fruit') expect(item.per100.kcal, item.id).toBeLessThanOrEqual(120)
      if (item.category === 'fat') expect(item.per100.fat, item.id).toBeGreaterThan(60)
      if (item.category === 'meat' || item.category === 'fish') expect(item.per100.protein, item.id).toBeGreaterThan(10)
    }
  })

  it('describes how to prepare everything that is not eaten as it comes', () => {
    for (const item of ingredients) {
      if (item.ready || item.category === 'spice' || item.category === 'sauce' || item.category === 'liquid' || item.category === 'fat' || item.category === 'sweet') continue
      expect(item.prep, `${item.id} needs prep`).toBeTruthy()
      expect(Object.keys(item.cook ?? {}).length, `${item.id} needs cook times`).toBeGreaterThan(0)
      for (const minutes of Object.values(item.cook ?? {})) expect(minutes, item.id).toBeGreaterThan(0)
    }
    for (const item of ingredients) {
      if (item.category === 'meat' && !item.ready) expect(item.done, `${item.id} needs a doneness hint`).toBeTruthy()
    }
  })

  it('keeps diet levels and allergens consistent with the food', () => {
    for (const item of ingredients) {
      if (item.category === 'meat') expect(item.diet, item.id).toBe('omnivore')
      if (item.category === 'fish') expect(['pescatarian', 'omnivore']).toContain(item.diet)
      if (['dairy', 'cheese', 'egg'].includes(item.category)) expect(item.diet, item.id).toBe('vegetarian')
      if (item.category === 'dairy' || item.category === 'cheese') expect(item.allergens, item.id).toContain('milk')
      if (item.category === 'egg') expect(item.allergens, item.id).toContain('egg')
      if (item.category === 'fish') expect(item.allergens?.some((allergen) => allergen === 'fish' || allergen === 'crustaceans'), item.id).toBe(true)
    }
    const byId = new Map(ingredients.map((item) => [item.id, item]))
    expect(byId.get('pasta')?.allergens).toContain('gluten')
    expect(byId.get('bread-wheat')?.allergens).toContain('gluten')
    expect(byId.get('soy-sauce')?.allergens).toContain('soy')
    expect(byId.get('tofu')?.allergens).toContain('soy')
    expect(byId.get('peanut-butter')?.allergens).toContain('peanuts')
    expect(byId.get('shrimp')?.allergens).toContain('crustaceans')
    expect(byId.get('tuna-canned')?.diet).toBe('pescatarian')
    expect(byId.get('honey')?.diet).toBe('vegetarian')
  })

  it('marks staples and spicy items', () => {
    const staples = ingredients.filter((item) => item.staple).map((item) => item.id).sort()
    expect(staples).toEqual(['garlic-granulated', 'herbs-mixed', 'pepper', 'paprika-sweet', 'rapeseed-oil', 'salt'].sort())
    for (const id of ['hot-sauce', 'chili-flakes']) expect(ingredients.find((item) => item.id === id)?.spicy).toBe(true)
  })
})
