import { z } from 'zod'
import { searchRequestSchema, type SearchRequest, type SearchResponse } from '../../../shared/domain'
import { normalizeOFF } from '../../../shared/food'

const cache = new Map<string, { until: number; response: SearchResponse }>()
const requests = new Map<string, Promise<SearchResponse>>()
const attempts: Record<'barcode' | 'query', number[]> = { barcode: [], query: [] }
const fields = 'code,product_name,product_name_pl,generic_name,generic_name_pl,brands,nutriments,nutrition'
const agent = 'Flexa/0.1 (+https://github.com/xsqezz/flexa.click)'
const productResponse = z.object({ product: z.record(z.string(), z.unknown()) })
const searchResponse = z.object({ products: z.array(z.unknown()) })

function budget(kind: 'barcode' | 'query') {
  const now = Date.now()
  attempts[kind] = attempts[kind].filter((time) => time > now - 60_000)
  if (attempts[kind].length >= (kind === 'barcode' ? 14 : 8)) {
    throw new Error('Osiągnięto limit zapytań do bazy produktów. Odczekaj minutę; zapisane i własne produkty nadal są dostępne.')
  }
  attempts[kind].push(now)
}

async function load(input: SearchRequest): Promise<SearchResponse> {
  const url = input.barcode
    ? new URL(`https://world.openfoodfacts.org/api/v3/product/${input.barcode}.json`)
    : new URL('https://world.openfoodfacts.org/cgi/search.pl')
  url.searchParams.set('fields', fields)
  url.searchParams.set('lc', 'pl')
  if (!input.barcode) {
    url.searchParams.set('search_terms', input.query ?? '')
    url.searchParams.set('search_simple', '1')
    url.searchParams.set('action', 'process')
    url.searchParams.set('json', '1')
    url.searchParams.set('page_size', '24')
  }
  let response: Response
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': agent },
      credentials: 'omit', referrerPolicy: 'origin',
      signal: AbortSignal.timeout(12_000),
    })
  } catch (cause) {
    throw new Error('Nie udało się połączyć z Open Food Facts. Sprawdź internet i spróbuj ponownie. To nie oznacza, że produktu nie ma w bazie.', { cause })
  }
  if (response.status === 404 && input.barcode) return { foods: [], warnings: [] }
  if (response.status === 429) throw new Error('Open Food Facts ograniczyło zapytania. Odczekaj minutę i spróbuj ponownie.')
  if (!response.ok) throw new Error(`Baza produktów jest chwilowo niedostępna (${response.status}). Spróbuj ponownie; nie traktujemy tego jako brak produktu.`)
  let body: unknown
  try { body = await response.json() }
  catch (cause) { throw new Error('Baza produktów zwróciła nieczytelną odpowiedź. Spróbuj ponownie.', { cause }) }
  if (input.barcode) {
    const parsed = productResponse.safeParse(body)
    if (!parsed.success) throw new Error('Nie można odczytać produktu z odpowiedzi Open Food Facts.')
    const food = normalizeOFF(parsed.data.product, input.barcode)
    if (!food) throw new Error('Produkt ma niepełny opis lub odpowiedź nie pasuje do zeskanowanego kodu. Sprawdź etykietę; nie dopasowujemy innego produktu na oko.')
    return { foods: [food], warnings: [] }
  }
  const parsed = searchResponse.safeParse(body)
  if (!parsed.success) throw new Error('Nie można odczytać wyników Open Food Facts.')
  const foods = parsed.data.products.map((product) => normalizeOFF(product)).filter((food) => food !== null)
  return {
    foods,
    warnings: foods.length < parsed.data.products.length ? ['Pominięto rekordy bez nazwy lub z niepoprawnym formatem.'] : [],
  }
}

export async function searchPublicFoods(input: SearchRequest): Promise<SearchResponse> {
  const request = searchRequestSchema.parse(input)
  const key = request.barcode ? `barcode:${request.barcode.padStart(14, '0')}` : `query:${request.query?.toLocaleLowerCase('pl-PL')}`
  const saved = cache.get(key)
  if (saved && saved.until > Date.now()) return saved.response
  const pending = requests.get(key)
  if (pending) return pending
  budget(request.barcode ? 'barcode' : 'query')
  const promise = load(request).then((response) => {
    if (cache.size >= 100) {
      const first = cache.keys().next().value
      if (first) cache.delete(first)
    }
    cache.set(key, { until: Date.now() + 300_000, response })
    return response
  }).finally(() => { requests.delete(key) })
  requests.set(key, promise)
  return promise
}
