// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { foodSchema } from '../../../../shared/domain'
import { ingredients } from '../../../../shared/kitchen/ingredients'
import { getIngredient, matchIngredientName } from '../../../../shared/kitchen/lookup'
import { equipmentKinds } from '../../../../shared/kitchen/types'
import { avoidKinds, defaultPreferences, isExcluded, moods, parseDislikes, stapleIds, timeOptions, type Preferences, type Recipe, type TimeLimit } from './context'
import { generateRecipes, rebuild, recipeFood, suggestRecipes, swapOptions } from './engine'

function random(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pickable = ingredients.filter((item) => !stapleIds.has(item.id) && item.id !== 'water')

function sample<T>(rng: () => number, list: readonly T[], count: number): T[] {
  const pool = [...list]
  const result: T[] = []
  while (result.length < count && pool.length) result.push(...pool.splice(Math.floor(rng() * pool.length), 1))
  return result
}

function randomPreferences(rng: () => number): Preferences {
  const equipment = sample(rng, equipmentKinds, 1 + Math.floor(rng() * 4))
  return {
    minutes: timeOptions[Math.floor(rng() * timeOptions.length)] as TimeLimit,
    equipment,
    avoid: rng() < 0.4 ? sample(rng, avoidKinds, 1 + Math.floor(rng() * 2)) : [],
    dislikes: rng() < 0.2 ? 'papryka, grzyby' : '',
    mood: moods[Math.floor(rng() * moods.length)],
    servings: (1 + Math.floor(rng() * 4)) as 1 | 2 | 3 | 4,
    size: (['small', 'medium', 'large'] as const)[Math.floor(rng() * 3)],
    staples: rng() < 0.8,
  }
}

function energyOf(recipe: Recipe) {
  const total = { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  for (const line of recipe.lines) {
    const base = getIngredient(line.id).per100
    for (const key of ['kcal', 'protein', 'carbs', 'fat'] as const) total[key] += (base[key] * line.grams) / 100
  }
  return { kcal: total.kcal / recipe.servings, protein: total.protein / recipe.servings, carbs: total.carbs / recipe.servings, fat: total.fat / recipe.servings }
}

const text = (recipe: Recipe) => [recipe.title, recipe.subtitle, ...recipe.steps, ...recipe.tips]

function check(recipe: Recipe, owned: readonly string[], prefs: Preferences, label: string) {
  const disliked = parseDislikes(prefs.dislikes)
  expect(recipe.title.length, label).toBeGreaterThan(3)
  expect(recipe.steps.length, label).toBeGreaterThanOrEqual(2)
  for (const line of text(recipe)) {
    expect(line, label).not.toMatch(/undefined|NaN|null|\[object|\{|\}/)
    expect(line, label).not.toMatch(/\s{2,}|\s[,.;:!?]|,,|\.\.|,\s*\./)
    expect(line, label).not.toMatch(/(?<!\p{L})(\p{L}+) \1(?!\p{L})/u)
  }
  for (const step of recipe.steps) {
    expect(step[0], `${label}: ${step}`).toBe(step[0].toLocaleUpperCase('pl-PL'))
    expect(step, label).toMatch(/[.!?)]$/)
    expect(step.length, label).toBeLessThan(420)
  }
  expect(recipe.equipment.every((kind) => prefs.equipment.includes(kind)), `${label} equipment ${recipe.equipment.join(',')}`).toBe(true)
  expect(recipe.minutes, label).toBeGreaterThan(0)
  expect(recipe.servings, label).toBe(prefs.servings)
  const ownedSet = new Set(owned)
  for (const line of recipe.lines) {
    const item = getIngredient(line.id)
    expect(isExcluded(item, prefs, disliked), `${label}: ${line.id} must be excluded`).toBe(false)
    expect(ownedSet.has(line.id) || stapleIds.has(line.id) || line.id === 'water', `${label}: ${line.id} is not owned`).toBe(true)
    expect(line.grams, `${label}: ${line.id}`).toBeGreaterThan(0)
    expect(Number.isFinite(line.grams), label).toBe(true)
    if (!prefs.staples) expect(stapleIds.has(line.id), `${label}: staple ${line.id} used without staples`).toBe(false)
    if (item.category === 'egg' && item.piece) expect((line.grams / recipe.servings) % item.piece, `${label}: whole eggs`).toBeCloseTo(0, 0)
  }
  const energy = energyOf(recipe)
  expect(Math.abs(energy.kcal - recipe.perServing.kcal), label).toBeLessThanOrEqual(3)
  expect(Math.abs(energy.protein - recipe.perServing.protein), label).toBeLessThanOrEqual(0.6)
  expect(Math.abs(energy.fat - recipe.perServing.fat), label).toBeLessThanOrEqual(0.6)
  expect(Math.abs(energy.carbs - recipe.perServing.carbs), label).toBeLessThanOrEqual(0.6)
  expect(recipe.perServing.kcal, label).toBeGreaterThan(30)
  expect(recipe.perServing.kcal, label).toBeLessThan(1700)
  expect(recipe.servingGrams, label).toBeGreaterThan(20)
  expect(foodSchema.safeParse(recipeFood(recipe)).success, `${label}: diary food`).toBe(true)
}

describe('recipe engine', () => {
  it('builds sane recipes for hundreds of random fridges and preferences', () => {
    const rng = random(20261008)
    let produced = 0
    const formats = new Set<string>()
    for (let round = 0; round < 400; round++) {
      const owned = sample(rng, pickable, 3 + Math.floor(rng() * 14)).map((item) => item.id)
      const prefs = randomPreferences(rng)
      const recipes = generateRecipes(owned, prefs, 12)
      const keys = new Set<string>()
      for (const recipe of recipes) {
        const label = `round ${round} ${recipe.format} "${recipe.title}" [${owned.join(',')}] ${JSON.stringify(prefs)}`
        expect(keys.has(recipe.key), `${label} duplicate`).toBe(false)
        keys.add(recipe.key)
        expect(recipe.minutes, label).toBeLessThanOrEqual(prefs.minutes)
        check(recipe, owned, prefs, label)
        formats.add(recipe.format)
        produced++
      }
    }
    expect(produced).toBeGreaterThan(400)
    expect([...formats].sort()).toEqual(['bake', 'eggs', 'oats', 'onepot', 'salad', 'skillet', 'smoothie', 'soup', 'wrap'])
  })

  it('makes banana pancakes from eggs, banana and oats', () => {
    const owned = ['egg', 'banana', 'oats', 'honey', 'strawberries']
    const prefs: Preferences = { ...defaultPreferences, mood: 'sweet', minutes: 30 }
    const pancakes = generateRecipes(owned, prefs).find((recipe) => recipe.format === 'pancakes')
    expect(pancakes).toBeDefined()
    if (pancakes) check(pancakes, owned, prefs, 'pancakes')
  })

  it('is deterministic', () => {
    const owned = ['chicken-breast', 'broccoli', 'rice-white', 'soy-sauce', 'garlic', 'onion', 'honey', 'egg', 'milk']
    expect(generateRecipes(owned, defaultPreferences)).toEqual(generateRecipes(owned, defaultPreferences))
  })

  it('never returns more than asked and nothing for an empty fridge', () => {
    expect(generateRecipes([], defaultPreferences)).toEqual([])
    expect(generateRecipes(['salt', 'onion'], defaultPreferences)).toEqual([])
    const many = pickable.map((item) => item.id)
    expect(generateRecipes(many, { ...defaultPreferences, equipment: [...equipmentKinds], minutes: 90 }, 5).length).toBeLessThanOrEqual(5)
  })

  it('builds a stir-fry that cooks slow and fast ingredients in the right order', () => {
    const owned = ['shrimp', 'bell-pepper', 'rice-white', 'garlic']
    const recipe = generateRecipes(owned, { ...defaultPreferences, minutes: 45 }).find((item) => item.format === 'skillet')
    expect(recipe).toBeDefined()
    const steps = recipe?.steps ?? []
    const pepper = steps.findIndex((step) => step.startsWith('Dodaj paprykę'))
    const shrimp = steps.findIndex((step) => step.includes('krewetki') && step.startsWith('Następnie'))
    expect(pepper).toBeGreaterThan(-1)
    expect(shrimp).toBeGreaterThan(pepper)
  })

  it('respects allergies and dislikes', () => {
    const owned = ['chicken-breast', 'egg', 'milk', 'cheese-yellow', 'pasta', 'tomato', 'bell-pepper', 'mushrooms', 'tofu', 'soy-sauce', 'rice-white', 'zucchini']
    const prefs: Preferences = { ...defaultPreferences, minutes: 90, avoid: ['milk', 'egg', 'gluten', 'meat'], dislikes: 'papryka, grzyby' }
    const recipes = generateRecipes(owned, prefs)
    expect(recipes.length).toBeGreaterThan(0)
    for (const recipe of recipes) {
      for (const line of recipe.lines) expect(['chicken-breast', 'egg', 'milk', 'cheese-yellow', 'pasta', 'bell-pepper', 'mushrooms']).not.toContain(line.id)
    }
  })

  it('swaps an ingredient and recomputes the recipe', () => {
    const owned = ['chicken-breast', 'turkey-breast', 'salmon', 'broccoli', 'rice-white', 'garlic', 'onion']
    const prefs: Preferences = { ...defaultPreferences, minutes: 45 }
    const recipe = generateRecipes(owned, prefs).find((item) => item.format === 'skillet' && item.picks.protein?.[0] === 'chicken-breast')
    expect(recipe).toBeDefined()
    if (!recipe) return
    const options = swapOptions(recipe, 'chicken-breast', owned, prefs)
    expect(options.length).toBeGreaterThan(1)
    expect(options[0].owned).toBe(true)
    for (const option of options) {
      expect(option.id).not.toBe('chicken-breast')
      expect(['meat', 'fish', 'egg', 'legume', 'cheese']).toContain(getIngredient(option.id).category)
      expect(option.recipe.lines.some((line) => line.id === 'chicken-breast')).toBe(false)
      expect(option.recipe.lines.some((line) => line.id === option.id)).toBe(true)
      check(option.recipe, [...owned, option.id], prefs, `swap to ${option.id}`)
    }
  })

  it('rebuilds the same recipe from its picks', () => {
    const owned = ['minced-beef', 'pasta', 'canned-tomatoes', 'onion', 'carrot', 'garlic', 'parmesan']
    for (const recipe of generateRecipes(owned, { ...defaultPreferences, minutes: 90 })) {
      const again = rebuild(recipe.format, recipe.picks, owned, { ...defaultPreferences, minutes: 90 })
      expect(again?.key, recipe.title).toBe(recipe.key)
      expect(again?.steps, recipe.title).toEqual(recipe.steps)
      expect(again?.lines, recipe.title).toEqual(recipe.lines)
    }
  })

  it('falls back to the quickest recipes when nothing fits the time', () => {
    const owned = ['chicken-breast', 'broccoli', 'rice-brown', 'garlic', 'onion']
    const prefs = { ...defaultPreferences, minutes: 15 as const }
    expect(generateRecipes(owned, prefs)).toEqual([])
    const result = suggestRecipes(owned, prefs)
    expect(result.relaxed).toBe(true)
    expect(result.recipes.length).toBeGreaterThan(0)
    expect(result.recipes[0].minutes).toBeGreaterThan(15)
    expect(result.recipes.map((recipe) => recipe.minutes)).toEqual([...result.recipes.map((recipe) => recipe.minutes)].sort((a, b) => a - b))
    expect(suggestRecipes(owned, { ...defaultPreferences, minutes: 90 }).relaxed).toBe(false)
  })

  it('prefers sweet dishes when in the mood for something sweet', () => {
    const owned = ['oats', 'banana', 'milk', 'egg', 'honey', 'chicken-breast', 'broccoli', 'rice-white']
    const top = generateRecipes(owned, { ...defaultPreferences, mood: 'sweet', equipment: ['pan', 'pot', 'microwave'] })[0]
    expect(['oats', 'pancakes', 'smoothie']).toContain(top.format)
  })

  it('turns a recipe into a diary food per 100 g that adds up to one serving', () => {
    const [recipe] = generateRecipes(['egg', 'tomato', 'cheese-yellow', 'milk'], { ...defaultPreferences, servings: 2 })
    const food = recipeFood(recipe)
    expect(foodSchema.parse(food).nutrients.kcal ?? 0).toBeGreaterThan(30)
    const kcal = ((food.nutrients.kcal ?? 0) * recipe.servingGrams) / 100
    expect(Math.abs(kcal - recipe.perServing.kcal)).toBeLessThanOrEqual(recipe.perServing.kcal * 0.03 + 2)
  })
})

describe('ingredient names', () => {
  const cases: [string, string | null][] = [
    ['pierś z kurczaka', 'chicken-breast'], ['Filet z piersi kurczaka', 'chicken-breast'], ['kurczak', 'chicken-breast'], ['udko z kurczaka', 'chicken-thigh'],
    ['Pomidory', 'tomato'], ['pomidory z puszki', 'canned-tomatoes'], ['koncentrat pomidorowy', 'tomato-paste'], ['jogurt grecki', 'yogurt-greek'], ['jogurt', 'yogurt-natural'],
    ['ser żółty', 'cheese-yellow'], ['ser feta', 'feta'], ['mleko', 'milk'], ['mleko kokosowe', 'coconut-milk'], ['jajka', 'egg'], ['Jaja', 'egg'], ['egg', 'egg'],
    ['ogórek', 'cucumber'], ['ogórki kiszone', 'pickled-cucumber'], ['kapusta', 'cabbage'], ['kapusta kiszona', 'sauerkraut'], ['masło', 'butter'], ['masło orzechowe', 'peanut-butter'],
    ['ryż', 'rice-white'], ['ryż brązowy', 'rice-brown'], ['makaron ryżowy', 'rice-noodles'], ['makaron', 'pasta'], ['makrela wędzona', 'mackerel-smoked'], ['łosoś wędzony', 'salmon-smoked'],
    ['łosoś', 'salmon'], ['banany', 'banana'], ['jabłka', 'apple'], ['papryka czerwona', 'bell-pepper'], ['papryka słodka', 'paprika-sweet'], ['fasolka szparagowa', 'green-beans'],
    ['czerwona fasola z puszki', 'kidney-beans-canned'], ['twaróg', 'quark'], ['serek wiejski', 'cottage-cheese'], ['zielona cebulka', 'spring-onion'], ['cebula', 'onion'],
    ['czosnek', 'garlic'], ['sos sojowy', 'soy-sauce'], ['chicken breast', 'chicken-breast'], ['cucumber', 'cucumber'], ['mielone mięso z indyka', 'minced-turkey'],
    ['mięso mielone', 'minced-pork'], ['wołowina mielona', 'minced-beef'], ['szynka', 'ham'], ['kiełbasa', 'sausage'], ['tuńczyk w puszce', 'tuna-canned'], ['płatki owsiane', 'oats'],
    ['quinoa', 'quinoa'], ['soczewica zielona', 'lentils-green'], ['dynia', 'pumpkin'], ['natka pietruszki', 'parsley'], ['szpinak', 'spinach'], ['sałata', 'lettuce'],
    ['ananas', 'pineapple'], ['Ananas z puszki', 'pineapple'], ['mango', 'mango'], ['melon', 'melon'], ['arbuz', 'watermelon'], ['kiwi', 'kiwi'], ['śliwka', 'plum'],
    ['brzoskwinia', 'peach'], ['nektarynki', 'peach'], ['mandarynki', 'orange'],
    ['sok pomarańczowy', null], ['sok jabłkowy', null], ['sok z cytryny', null], ['pasta czekoladowa', null], ['czekolada', null], ['nutella', null], ['kawa', null], ['herbata', null],
    ['pasta', null], ['winogrona', 'grapes'],
    ['coś zupełnie nieznanego xyz', null], ['', null],
  ]
  it.each(cases)('matches "%s"', (name, id) => {
    expect(matchIngredientName(name)).toBe(id)
  })

  it('parses dislikes into ingredient ids', () => {
    const found = parseDislikes('Nie lubię papryki, grzybów; ryby\nbez kolendry')
    expect(found.has('bell-pepper')).toBe(true)
    expect(found.has('mushrooms')).toBe(true)
    expect(found.has('salmon')).toBe(true)
    expect(found.has('cod')).toBe(true)
    expect(found.has('chicken-breast')).toBe(false)
    expect(parseDislikes('').size).toBe(0)
  })
})
