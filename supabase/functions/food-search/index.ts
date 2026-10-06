import { z } from 'zod'
import { isValidBarcode, searchRequestSchema, searchResponseSchema, type SearchResponse } from '../../../shared/domain.ts'
import { normalizeOFF, normalizeUSDA } from '../_shared/food.ts'
import { adminClient, endpoint, env, HttpError, readJson, requireUser } from '../_shared/http.ts'

const cache = new Map<string, { until: number; response: SearchResponse }>()
const responseSchema = z.object({ products: z.array(z.unknown()).optional(), product: z.unknown().optional() })

async function budget(key: string, limit: number, seconds: number) {
  const { data, error } = await adminClient().rpc('consume_api_budget', {
    budget_key: key, request_limit: limit, window_seconds: seconds,
  })
  if (error) throw new HttpError(503, 'Nie można sprawdzić limitu API. Sprawdź migrację serwera.')
  if (!data) throw new HttpError(429, 'Osiągnięto limit dostawcy produktów. Odczekaj minutę lub dodaj produkt ręcznie.')
}

async function fetchJSON(url: URL, headers: HeadersInit): Promise<unknown> {
  let response: Response
  try { response = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) }) }
  catch { throw new HttpError(502, 'Baza produktów nie odpowiada. Spróbuj ponownie lub przepisz dane z etykiety.') }
  if (response.status === 404) return {}
  if (response.status === 429) throw new HttpError(429, 'Baza produktów ograniczyła żądania. Spróbuj za minutę.')
  if (!response.ok) throw new HttpError(502, `Baza produktów zwróciła błąd (${response.status}).`)
  try { return await response.json() }
  catch { throw new HttpError(502, 'Baza produktów zwróciła niepoprawną odpowiedź.') }
}

Deno.serve(endpoint(async (request) => {
  await requireUser(request)
  const parsed = searchRequestSchema.safeParse(await readJson(request))
  if (!parsed.success) throw new HttpError(400, 'Podaj nazwę (2–80 znaków) albo poprawny kod kreskowy.')
  const { query, barcode } = parsed.data
  if (barcode && !isValidBarcode(barcode)) throw new HttpError(400, 'Kod kreskowy ma niepoprawną długość lub cyfrę kontrolną.')
  const key = barcode ? `barcode:${barcode}` : `query:${query?.toLocaleLowerCase('pl-PL')}`
  const saved = cache.get(key)
  if (saved && saved.until > Date.now()) return saved.response
  const base = Deno.env.get('OFF_BASE_URL') ?? 'https://world.openfoodfacts.org'
  if (!['https://world.openfoodfacts.org', 'https://world.openfoodfacts.net'].includes(base)) {
    throw new HttpError(503, 'Niepoprawny adres Open Food Facts w konfiguracji.')
  }
  const headers = new Headers({ 'User-Agent': `Flexa/0.1 (${env('OFF_CONTACT')})` })
  if (base.endsWith('.net')) headers.set('Authorization', `Basic ${btoa('off:off')}`)
  const url = barcode
    ? new URL(`/api/v3/product/${barcode}.json`, base)
    : new URL('/cgi/search.pl', base)
  url.searchParams.set('fields', 'code,product_name,product_name_pl,brands,nutriments')
  if (!barcode) {
    url.searchParams.set('search_terms', query ?? '')
    url.searchParams.set('search_simple', '1')
    url.searchParams.set('action', 'process')
    url.searchParams.set('json', '1')
    url.searchParams.set('page_size', '12')
    url.searchParams.set('lc', 'pl')
  }
  await budget(barcode ? 'off-product' : 'off-search', barcode ? 14 : 8, 60)
  const raw = responseSchema.safeParse(await fetchJSON(url, headers))
  if (!raw.success) throw new HttpError(502, 'Nie można odczytać formatu Open Food Facts.')
  const products = barcode ? (raw.data.product ? [raw.data.product] : []) : (raw.data.products ?? [])
  const foods = products.map((product) => normalizeOFF(product, barcode)).filter((food) => food !== null)
  const warnings: string[] = []
  if (products.length > foods.length) warnings.push('Pominięto produkty bez nazwy lub z uszkodzonym formatem.')
  const usdaKey = Deno.env.get('USDA_API_KEY')
  if (foods.length === 0 && usdaKey) {
    await budget('usda', 900, 3600)
    const fallback = new URL('https://api.nal.usda.gov/fdc/v1/foods/search')
    fallback.searchParams.set('api_key', usdaKey)
    fallback.searchParams.set('query', barcode ?? query ?? '')
    fallback.searchParams.set('pageSize', '12')
    if (barcode) fallback.searchParams.set('dataType', 'Branded')
    const usda = z.object({ foods: z.array(z.unknown()) }).safeParse(await fetchJSON(fallback, {}))
    if (!usda.success) throw new HttpError(502, 'Nie można odczytać formatu USDA.')
    foods.push(...usda.data.foods.map((food) => normalizeUSDA(food, barcode)).filter((food) => food !== null))
    warnings.push('Open Food Facts nie znalazło produktu; sprawdzono USDA FoodData Central.')
  }
  const response = searchResponseSchema.parse({ foods, warnings })
  if (cache.size >= 100) {
    const first = cache.keys().next().value
    if (first) cache.delete(first)
  }
  cache.set(key, { until: Date.now() + 300_000, response })
  return response
}))
