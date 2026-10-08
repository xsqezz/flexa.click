export const ingredientCategories = [
  'meat', 'fish', 'egg', 'dairy', 'cheese', 'veg', 'fruit', 'grain', 'bread', 'legume', 'fat', 'nut', 'sauce', 'spice', 'sweet', 'liquid',
] as const
export type IngredientCategory = typeof ingredientCategories[number]

export const ingredientRoles = ['protein', 'veg', 'carb', 'fruit', 'dairy', 'fat', 'sauce', 'aromatic', 'spice', 'sweet', 'topping', 'liquid'] as const
export type IngredientRole = typeof ingredientRoles[number]

export const allergenKinds = ['gluten', 'milk', 'egg', 'fish', 'crustaceans', 'nuts', 'peanuts', 'soy', 'sesame', 'celery', 'mustard'] as const
export type Allergen = typeof allergenKinds[number]

/** The strictest diet that still allows the ingredient: vegan < vegetarian < pescatarian < omnivore. */
export const dietLevels = ['vegan', 'vegetarian', 'pescatarian', 'omnivore'] as const
export type DietLevel = typeof dietLevels[number]

export type Nutrients = { kcal: number; protein: number; carbs: number; fat: number; fiber: number }

/** Compact constructor used by the ingredient tables: kcal, protein, carbs, fat, fiber per 100 g. */
export const per = (kcal: number, protein: number, carbs: number, fat: number, fiber = 0): Nutrients => ({ kcal, protein, carbs, fat, fiber })

/** Minutes of active cooking for the preparation described by `prep`. */
export type CookTimes = { pan?: number; boil?: number; oven?: number; air?: number; microwave?: number }

export type Ingredient = {
  id: string
  /** Lowercase Polish nominative singular as on a shopping list, e.g. "pierś z kurczaka". */
  nom: string
  /** Accusative: "Dodaj {acc}". */
  acc: string
  /** Instrumental: "z {ins}". */
  ins: string
  /** Genitive: "kawałek {gen}". */
  gen: string
  /** English name used in image prompts. */
  en: string
  emoji: string
  /** Lowercase Polish and English synonyms used to match names recognised on photos. */
  aliases: readonly string[]
  category: IngredientCategory
  roles: readonly IngredientRole[]
  /** Per 100 g (100 ml for liquids) as sold: dry grains, raw meat, drained canned goods. */
  per100: Nutrients
  /** Grams of one natural piece when counting is natural (egg, onion, tomato, garlic clove, tortilla, banana). */
  piece?: number
  allergens?: readonly Allergen[]
  diet: DietLevel
  /** Safe and pleasant to eat without cooking: cooked, canned, cured, dairy, bread, fruit, salad vegetables. */
  ready?: boolean
  cook?: CookTimes
  /** Imperative preparation sentence with {acc}, {gen} or {ins} placeholders. */
  prep?: string
  /** Doneness or food-safety hint appended after cooking, e.g. "aż w środku nie będzie różowy". */
  done?: string
  /** Pantry staple that can be assumed to be at home. */
  staple?: boolean
  spicy?: boolean
}

export const equipmentKinds = ['pan', 'pot', 'oven', 'airfryer', 'microwave', 'blender'] as const
export type Equipment = typeof equipmentKinds[number]
export const equipmentLabels: Record<Equipment, string> = {
  pan: 'Patelnia', pot: 'Garnek', oven: 'Piekarnik', airfryer: 'Air Fryer', microwave: 'Mikrofalówka', blender: 'Blender',
}
