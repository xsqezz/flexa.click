import { catalogSchema } from '../../../shared/catalog-schema'
import { catalogText, requiredProducts } from '../../../shared/polish-catalog'
import { sameBarcode, type Food, type SearchRequest } from '../../../shared/domain'

let catalog: Promise<ReturnType<typeof catalogSchema.parse>> | null = null

async function loadCatalog() {
  if (!catalog) {
    catalog = (async () => {
      const url = new URL(`${import.meta.env.BASE_URL}data/polish-products.json`, window.location.href)
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
      if (!response.ok) throw new Error(`Nie udało się odczytać polskiego katalogu (${response.status}).`)
      return catalogSchema.parse(await response.json())
    })()
    catalog.catch(() => { catalog = null })
  }
  return catalog
}

export async function findCatalogFoods(input: SearchRequest): Promise<Food[]> {
  const data = await loadCatalog()
  if (input.barcode) return data.products.filter(({ food }) => food.barcode && sameBarcode(food.barcode, input.barcode ?? '')).map(({ food }) => food)
  const query = catalogText(input.query ?? '')
  const requirements = new Set(requiredProducts.filter((entry) => catalogText(entry.name) === query
    || entry.aliases.some((alias) => catalogText(alias) === query)).map((entry) => entry.id))
  return data.products.filter(({ food, requirements: matched }) => catalogText(`${food.name} ${food.brand}`).includes(query)
    || matched.some((id) => requirements.has(id)))
    .sort((a, b) => Number(b.polishMarket) - Number(a.polishMarket)
      || Number(a.food.nutrients.kcal === null) - Number(b.food.nutrients.kcal === null)
      || Number(a.food.estimated === true) - Number(b.food.estimated === true))
    .slice(0, 40).map(({ food }) => food)
}
