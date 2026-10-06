import { searchRequestSchema, searchResponseSchema, isValidBarcode, type Food, type SearchRequest, type SearchResponse } from '../../../shared/domain'
import { demoFoods } from './demo'
import { callFunction } from './functions'

export async function searchFoods(
  input: SearchRequest, mode: 'demo' | 'cloud', customFoods: Food[],
): Promise<SearchResponse> {
  const request = searchRequestSchema.parse(input)
  if (request.barcode && !isValidBarcode(request.barcode)) throw new Error('Sprawdź cyfrę kontrolną i długość kodu EAN/UPC.')
  const matches = (food: Food) => request.barcode
    ? food.barcode === request.barcode
    : food.name.toLocaleLowerCase('pl-PL').includes(request.query?.toLocaleLowerCase('pl-PL') ?? '')
  const local = customFoods.filter(matches)
  if (mode === 'demo') {
    return {
      foods: [...local, ...demoFoods.filter(matches)],
      warnings: ['Demo przeszukuje tylko przykładowe produkty, nie zewnętrzne bazy. Przykładowy kod: 5901234123457.'],
    }
  }
  const remote = searchResponseSchema.parse(await callFunction('food-search', request))
  return { foods: [...local, ...remote.foods], warnings: remote.warnings }
}
