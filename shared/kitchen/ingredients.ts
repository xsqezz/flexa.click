import type { Ingredient } from './types.ts'
import { animalIngredients } from './data/animal.ts'
import { fruitIngredients, vegetableIngredients } from './data/plant.ts'
import { pantryIngredients } from './data/pantry.ts'

/** Over 140 everyday Polish kitchen ingredients with Polish forms, nutrition per 100 g and cooking profiles. */
export const ingredients: readonly Ingredient[] = [...animalIngredients, ...vegetableIngredients, ...fruitIngredients, ...pantryIngredients]
