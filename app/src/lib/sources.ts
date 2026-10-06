import type { Food } from '../../../shared/domain'

export const sourceNames: Record<Food['source'], string> = {
  'open-food-facts': 'Open Food Facts',
  usda: 'USDA FoodData Central',
  custom: 'Twój produkt',
  demo: 'Dane demonstracyjne',
}

export function sourceURL(food: Food): string | null {
  if (food.source === 'open-food-facts') {
    return food.barcode ? `https://world.openfoodfacts.org/product/${encodeURIComponent(food.barcode)}` : 'https://world.openfoodfacts.org'
  }
  if (food.source === 'usda') return `https://fdc.nal.usda.gov/food-details/${encodeURIComponent(food.id.replace('usda:', ''))}/nutrients`
  return null
}
