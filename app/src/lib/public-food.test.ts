import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Food } from '../../../shared/domain'

vi.mock('./functions', () => ({ callFunction: vi.fn() }))
const barcode = '4025500132477'
const product = {
  code: barcode, product_name: 'Mullermilch Chocolate', brands: 'Müller',
  nutriments: { 'energy-kcal_100g': 76, proteins_100g: 3.5, carbohydrates_100g: 11.9, fat_100g: 1.7 },
}
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json' },
})

beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ product })))
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('real public food catalog', () => {
  it('looks up the real barcode in demo mode instead of searching example foods', async () => {
    const { searchFoods } = await import('./search')
    const result = await searchFoods({ barcode }, 'demo', [])
    expect(result.foods[0]).toMatchObject({
      name: product.product_name, barcode, source: 'open-food-facts', unit: null,
      nutrients: { kcal: 76, protein: 3.5, fiber: null },
    })
    const [url, options] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toContain(`/api/v3/product/${barcode}.json`)
    expect(options?.credentials).toBe('omit')
  })
  it('does not assign the synthetic oat product to a real GTIN', async () => {
    vi.mocked(fetch).mockResolvedValue(response({}, 404))
    const { searchFoods } = await import('./search')
    expect((await searchFoods({ barcode: '5901234123457' }, 'demo', [])).foods).toEqual([])
    expect(fetch).toHaveBeenCalledOnce()
  })
  it('searches full-text product names and brands in the actual catalog', async () => {
    vi.mocked(fetch).mockResolvedValue(response({ products: [product] }))
    const { searchFoods } = await import('./search')
    const result = await searchFoods({ query: 'mullermilch' }, 'demo', [])
    expect(result.foods[0].source).toBe('open-food-facts')
    const url = new URL(String(vi.mocked(fetch).mock.calls[0][0]))
    expect(url.pathname).toBe('/cgi/search.pl')
    expect(url.searchParams.get('search_terms')).toBe('mullermilch')
  })
  it('deduplicates concurrent requests and caches equivalent GTINs', async () => {
    const { searchPublicFoods } = await import('./public-food')
    await Promise.all([
      searchPublicFoods({ barcode }), searchPublicFoods({ barcode: `0${barcode}` }),
    ])
    await searchPublicFoods({ barcode })
    expect(fetch).toHaveBeenCalledOnce()
  })
  it('keeps private barcode products available without a network request', async () => {
    const own: Food = {
      id: 'private', name: 'Własny napój', brand: '', barcode, source: 'custom',
      unit: 'ml', nutrients: { kcal: 70, protein: null, carbs: null, fat: null, fiber: null },
    }
    const { searchFoods } = await import('./search')
    expect((await searchFoods({ barcode: `0${barcode}` }, 'demo', [own])).foods).toEqual([own])
    expect(fetch).not.toHaveBeenCalled()
  })
  it.each([429, 503])('reports HTTP %s as a provider failure, not an absent product', async (status) => {
    vi.mocked(fetch).mockResolvedValue(response({}, status))
    const { searchPublicFoods } = await import('./public-food')
    await expect(searchPublicFoods({ barcode })).rejects.toThrow(status === 429 ? 'ograniczyło' : 'niedostępna')
  })
  it('rejects malformed data and wrong barcodes instead of returning misleading matches', async () => {
    const { searchPublicFoods } = await import('./public-food')
    vi.mocked(fetch).mockResolvedValue(response({}))
    await expect(searchPublicFoods({ barcode })).rejects.toThrow('odczytać produktu')
    vi.mocked(fetch).mockResolvedValue(response({ product: { ...product, code: '4006381333931' } }))
    await expect(searchPublicFoods({ barcode })).rejects.toThrow('nie pasuje')
  })
  it('rejects invalid codes before contacting a provider', async () => {
    const { searchPublicFoods } = await import('./public-food')
    await expect(searchPublicFoods({ barcode: '4025500132478' })).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
  })
  it('respects the per-minute search budget and allows requests after the window expires', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(100_000)
    vi.mocked(fetch).mockImplementation(async () => response({ products: [] }))
    const { searchPublicFoods } = await import('./public-food')
    for (let index = 0; index < 8; index++) await searchPublicFoods({ query: `produkt ${index}` })
    await expect(searchPublicFoods({ query: 'produkt 9' })).rejects.toThrow('limit zapytań')
    expect(fetch).toHaveBeenCalledTimes(8)
    clock.mockReturnValue(160_001)
    await searchPublicFoods({ query: 'produkt 9' })
    expect(fetch).toHaveBeenCalledTimes(9)
  })
  it('preserves local name matches with an explicit warning when the provider is unavailable', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Fixture offline'))
    const own: Food = {
      id: 'private', name: 'Napój', brand: 'Müller', barcode: null, source: 'custom',
      unit: 'ml', nutrients: { kcal: 70, protein: null, carbs: null, fat: null, fiber: null },
    }
    const { searchFoods } = await import('./search')
    const result = await searchFoods({ query: 'muller' }, 'demo', [own])
    expect(result.foods).toEqual([own])
    expect(result.warnings.join(' ')).toContain('wyłącznie')
  })
})
