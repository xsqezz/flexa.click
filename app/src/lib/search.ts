import { searchRequestSchema, searchResponseSchema, sameBarcode, type Food, type SearchRequest, type SearchResponse } from '../../../shared/domain'
import { callFunction } from './functions'
import { searchPublicFoods } from './public-food'
import { findCatalogFoods } from './catalog'

function searchable(value: string) {
  return value.toLocaleLowerCase('pl-PL').normalize('NFKD').replace(/\p{Diacritic}/gu, '').replace(/ł/g, 'l')
}

export async function searchFoods(
  input: SearchRequest, mode: 'demo' | 'cloud', customFoods: Food[],
): Promise<SearchResponse> {
  const request = searchRequestSchema.parse(input)
  const matches = (food: Food) => request.barcode
    ? food.barcode !== null && sameBarcode(food.barcode, request.barcode)
    : searchable(`${food.name} ${food.brand}`).includes(searchable(request.query ?? ''))
  const local = customFoods.filter(matches)
  if (request.barcode && local.length) return { foods: local, warnings: [] }
  const warnings: string[] = []
  try {
    const indexed = await findCatalogFoods(request)
    if (indexed.length) return { foods: [...local, ...indexed], warnings: [
      'Katalog preferuje produkty z Polski; zawiera też wybrane warianty z innych rynków. Sprawdź dokładną markę, wariant i podstawę wartości na etykiecie.',
    ] }
  } catch (cause) {
    warnings.push(cause instanceof Error ? cause.message : 'Nie udało się odczytać polskiego katalogu.')
  }
  let remote: SearchResponse
  try {
    remote = mode === 'demo' ? await searchPublicFoods(request)
      : searchResponseSchema.parse(await callFunction('food-search', request))
  } catch (cause) {
    if (!local.length) throw cause
    return { foods: local, warnings: [
      ...warnings, cause instanceof Error ? cause.message : 'Nie udało się przeszukać zewnętrznej bazy.',
      'Pokazujemy wyłącznie pasujące produkty zapisane przez Ciebie, nie pełne wyniki katalogu.',
    ] }
  }
  return { foods: [...local, ...remote.foods], warnings: [...warnings, ...remote.warnings] }
}
