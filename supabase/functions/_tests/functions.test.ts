// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Handler = (request: Request) => Promise<Response>
const userId = '44444444-4444-4444-8444-444444444444'
const user = { id: userId, email: 'test@example.invalid', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-06T10:00:00Z' }
let handlers: Handler[]
let calls: Request[]
let foodBody: unknown
let foodStatus: number
let validSession: boolean
let validPassword: boolean
let reauthenticatedId: string
let budgetAllowed: boolean
let usda: string | undefined

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const payload = () => ({ query: 'test product' })
function request(body: unknown = payload(), options: { token?: boolean; origin?: string; method?: string } = {}) {
  const method = options.method ?? 'POST'
  return new Request('https://backend.example.invalid/functions/v1/test', {
    method, headers: {
      origin: options.origin ?? 'https://app.example.invalid', 'content-type': 'application/json',
      ...(options.token === false ? {} : { authorization: 'Bearer fixture-token' }),
    }, ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  })
}

beforeEach(async () => {
  vi.resetModules()
  handlers = []; calls = []
  foodBody = { products: [{ code: '5901234123457', product_name: 'Produkt testowy', nutriments: { 'energy-kcal_100g': 100 } }] }
  foodStatus = 200; validSession = true; validPassword = true; reauthenticatedId = userId; budgetAllowed = true; usda = undefined
  const environment: Record<string, string> = {
    SUPABASE_URL: 'https://backend.example.invalid', SUPABASE_ANON_KEY: 'fixture-public-key',
    SUPABASE_SERVICE_ROLE_KEY: 'fixture-admin-key-not-a-secret', ALLOWED_ORIGINS: 'https://app.example.invalid',
    OFF_CONTACT: 'contact@example.invalid',
  }
  vi.stubGlobal('Deno', {
    env: { get: (key: string) => key === 'USDA_API_KEY' ? usda : environment[key] },
    serve: (handler: Handler) => { handlers.push(handler) },
  })
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const call = new Request(input, options)
    calls.push(call)
    const url = new URL(call.url)
    if (url.pathname === '/auth/v1/user') return validSession ? response(user) : response({ msg: 'Fixture expired session' }, 401)
    if (url.pathname === '/auth/v1/token') return validPassword
      ? response({ access_token: 'fixture-token', refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 3600, user: { ...user, id: reauthenticatedId } })
      : response({ msg: 'Fixture invalid password' }, 400)
    if (url.pathname === `/auth/v1/admin/users/${userId}` && call.method === 'DELETE') return response({ user })
    if (url.pathname === '/rest/v1/rpc/consume_api_budget') return response(budgetAllowed)
    if (url.hostname === 'world.openfoodfacts.org') return response(foodBody, foodStatus)
    if (url.hostname === 'api.nal.usda.gov') return response({ foods: [{
      fdcId: 123, description: 'USDA fixture', gtinUpc: '5901234123457', foodNutrients: [{ nutrientId: 1008, value: 250 }],
    }] })
    throw new Error(`Unexpected fixture destination: ${url.hostname}${url.pathname}`)
  }))
  vi.spyOn(console, 'error').mockImplementation(() => {})
  await import('../food-search/index')
  await import('../account-delete/index')
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('authenticated food proxy boundary', () => {
  it('handles CORS preflight but denies other origins and methods', async () => {
    const preflight = await handlers[0](request(null, { method: 'OPTIONS', token: false }))
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('access-control-allow-origin')).toBe('https://app.example.invalid')
    expect((await handlers[0](request(null, { origin: 'https://untrusted.example.invalid' }))).status).toBe(403)
    expect((await handlers[0](request(null, { method: 'GET' }))).status).toBe(405)
    expect(calls).toHaveLength(0)
  })
  it('verifies the session instead of treating a bearer header as authorization', async () => {
    expect((await handlers[0](request(null, { token: false }))).status).toBe(401)
    validSession = false
    expect((await handlers[0](request())).status).toBe(401)
    expect(calls.some((call) => call.url.includes('openfoodfacts'))).toBe(false)
  })
  it('rejects oversized input and an incorrect GTIN before spending provider budget', async () => {
    expect((await handlers[0](request({ query: 'x'.repeat(20_000) }))).status).toBe(413)
    expect((await handlers[0](request({ barcode: '5901234123458' }))).status).toBe(400)
    expect(calls.some((call) => call.url.includes('consume_api_budget'))).toBe(false)
  })
  it('uses actual OFF full-text search, unconfirmed units, cache and attributable snapshots', async () => {
    const first = await handlers[0](request())
    expect(first.status).toBe(200)
    const result = await first.json()
    expect(result.foods[0]).toMatchObject({ source: 'open-food-facts', unit: null, nutrients: { kcal: 100, protein: null } })
    await handlers[0](request())
    const upstream = calls.filter((call) => call.url.includes('openfoodfacts'))
    expect(upstream).toHaveLength(1)
    expect(new URL(upstream[0].url).pathname).toBe('/cgi/search.pl')
    expect(upstream[0].headers.get('user-agent')).toContain('contact@example.invalid')
  })
  it('uses v3 product lookup and exact GTIN USDA fallback without leaking its key', async () => {
    foodBody = { product: { code: '4006381333931', product_name: 'Wrong GTIN' } }
    usda = 'fixture-usda-key-not-real'
    const result = await handlers[0](request({ barcode: '5901234123457' }))
    const body = await result.json()
    expect(body.foods).toHaveLength(1)
    expect(body.foods[0].source).toBe('usda')
    expect(calls.some((call) => new URL(call.url).pathname === '/api/v3/product/5901234123457.json')).toBe(true)
    expect(JSON.stringify(body)).not.toContain(usda)
  })
  it('surfaces provider/rate-limit failure instead of returning a successful empty response', async () => {
    budgetAllowed = false
    const limited = await handlers[0](request())
    expect(limited.status).toBe(429)
    expect(limited.headers.get('retry-after')).toBe('60')
    budgetAllowed = true; foodStatus = 500
    expect((await handlers[0](request())).status).toBe(502)
  })
})

describe('account deletion boundary', () => {
  it('requires exact confirmation, reauthentication and the same user before deletion', async () => {
    expect((await handlers[1](request({ confirmation: 'DELETE', password: 'fixture-password' }))).status).toBe(400)
    validPassword = false
    expect((await handlers[1](request({ confirmation: 'USUŃ KONTO', password: 'fixture-password' }))).status).toBe(401)
    validPassword = true; reauthenticatedId = '55555555-5555-4555-8555-555555555555'
    expect((await handlers[1](request({ confirmation: 'USUŃ KONTO', password: 'fixture-password' }))).status).toBe(401)
    expect(calls.some((call) => call.method === 'DELETE')).toBe(false)
    reauthenticatedId = userId
    const deleted = await handlers[1](request({ confirmation: 'USUŃ KONTO', password: 'fixture-password' }))
    expect(deleted.status).toBe(200)
    expect(await deleted.json()).toEqual({ deleted: true })
    expect(calls.filter((call) => call.method === 'DELETE')).toHaveLength(1)
  })
})
