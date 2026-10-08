import { z } from 'zod'
import { ingredients } from './ingredients.ts'
import { ingredientsById, matchIngredientNames } from './lookup.ts'
import type { Ingredient } from './types.ts'
import { dishFormats, dishImagePrompt, dishStyles, maxPromptIngredients } from './visual.ts'

/** Daily per-account limits keep the free Workers AI allocation fair for everyone. */
export const aiLimits = { vision: 12, image: 30 } as const
export const maxPhotoBytes = 1_800_000
export const maxVisionItems = 30

const visionModels = ['@cf/meta/llama-4-scout-17b-16e-instruct', '@cf/mistralai/mistral-small-3.1-24b-instruct'] as const
const imageModels = ['@cf/black-forest-labs/flux-1-schnell', '@cf/bytedance/stable-diffusion-xl-lightning'] as const
const modelTimeoutMs = 50_000

export type AiBinding = { run(model: string, input: unknown): Promise<unknown> }
export type KitchenDeps = { ai?: AiBinding; supabaseUrl?: string; supabaseKey?: string; fetch?: typeof fetch }

type ErrorCode = 'unauthorized' | 'quota' | 'bad_request' | 'too_large' | 'unavailable' | 'not_found' | 'method'

const baseHeaders = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...baseHeaders, 'content-type': 'application/json; charset=utf-8' } })
}

function failure(status: number, code: ErrorCode, error: string): Response {
  return json(status, { code, error })
}

/** Pantry staples and tap water are assumed to be at home, so photos never add them to the list. */
const isRecognisable = (item: Ingredient) => !item.staple && item.id !== 'water'

export function visionPrompt(): string {
  const names = ingredients.filter(isRecognisable).map((item) => item.nom).join(', ')
  return [
    'You are looking at a photo of a fridge, pantry, kitchen counter or groceries.',
    'List every food item or ingredient that is clearly visible and could be cooked or eaten.',
    'Ignore containers, brands, appliances, labels, people and anything that is not food.',
    'Answer in Polish with short generic names in the nominative singular (for example: pierś z kurczaka, cukinia, jogurt grecki, pomidory, ryż), one item per line, at most 25 lines.',
    `Prefer a name from this list when it fits: ${names}.`,
    'If a product is not on the list, name it plainly in Polish. Do not write quantities, numbering, brands or comments.',
    'If you cannot see any food, answer exactly: BRAK',
  ].join('\n')
}

export function parseVisionText(text: string): string[] {
  const names: string[] = []
  for (const line of text.split(/\r?\n|;/)) {
    const cleaned = line.replace(/^[\s\-*•\d.)]+/, '').replace(/[.,:;!]+$/, '').replace(/\s+/g, ' ').trim()
    if (!cleaned || cleaned.length > 60 || /^brak$/i.test(cleaned)) continue
    if (cleaned.split(' ').length > 6) continue
    if (!names.some((name) => name.toLowerCase() === cleaned.toLowerCase())) names.push(cleaned)
    if (names.length >= maxVisionItems) break
  }
  return names
}

export function extractText(result: unknown): string {
  if (typeof result === 'string') return result
  if (!result || typeof result !== 'object') return ''
  const value = result as Record<string, unknown>
  if (typeof value.response === 'string') return value.response
  if (value.result && typeof value.result === 'object') return extractText(value.result)
  const choice = Array.isArray(value.choices) ? value.choices[0] as { message?: { content?: unknown }; text?: unknown } | undefined : undefined
  const content = choice?.message?.content ?? choice?.text
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map((part) => (part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string' ? (part as { text: string }).text : '')).join('\n')
  return ''
}

function decodeBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value.replace(/\s+/g, ''))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  return btoa(binary)
}

const isJpeg = (bytes: Uint8Array) => bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
const isPng = (bytes: Uint8Array) => bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out`)), modelTimeoutMs) })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

async function readJson(request: Request, maxBytes: number): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  const length = Number(request.headers.get('content-length') ?? '0')
  if (length > maxBytes) return { ok: false, response: failure(413, 'too_large', 'Zdjęcie jest za duże. Zrób mniejsze lub spróbuj ponownie.') }
  const text = await request.text()
  if (text.length > maxBytes) return { ok: false, response: failure(413, 'too_large', 'Zdjęcie jest za duże. Zrób mniejsze lub spróbuj ponownie.') }
  try { return { ok: true, value: JSON.parse(text) } }
  catch { return { ok: false, response: failure(400, 'bad_request', 'Nieprawidłowe dane żądania.') } }
}

function bearer(request: Request): string | null {
  const match = /^Bearer ([\w-]+\.[\w-]+\.[\w-]+)$/.exec(request.headers.get('authorization') ?? '')
  return match && match[1].length <= 4096 ? match[1] : null
}

/** Consumes one use of the daily budget as the signed-in user; the database enforces identity and counting. */
async function consume(deps: KitchenDeps, token: string, kind: keyof typeof aiLimits): Promise<Response | null> {
  if (!deps.supabaseUrl || !deps.supabaseKey) return failure(503, 'unavailable', 'Usługa chwilowo niedostępna.')
  const doFetch = deps.fetch ?? fetch
  let response: Response
  try {
    response = await doFetch(`${deps.supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/consume_kitchen_ai`, {
      method: 'POST',
      headers: { apikey: deps.supabaseKey, authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ p_kind: kind, p_limit: aiLimits[kind] }),
    })
  } catch {
    return failure(503, 'unavailable', 'Usługa chwilowo niedostępna.')
  }
  if (response.status === 401 || response.status === 403) return failure(401, 'unauthorized', 'Zaloguj się ponownie, aby korzystać z rozpoznawania zdjęć.')
  if (!response.ok) return failure(503, 'unavailable', 'Usługa chwilowo niedostępna.')
  const allowed: unknown = await response.json().catch(() => null)
  if (allowed !== true) return failure(429, 'quota', 'Dzienny limit zdjęć i obrazów AI został wykorzystany. Wróć jutro albo wybierz produkty ręcznie.')
  return null
}

async function describePhoto(ai: AiBinding, bytes: Uint8Array): Promise<string> {
  const mime = isPng(bytes) ? 'image/png' : 'image/jpeg'
  const input = {
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: visionPrompt() },
        { type: 'image_url', image_url: { url: `data:${mime};base64,${encodeBase64(bytes)}` } },
      ],
    }],
    max_tokens: 400,
    temperature: 0.1,
  }
  for (const model of visionModels) {
    try {
      const text = extractText(await withTimeout(ai.run(model, input), model)).trim()
      if (text) return text
    } catch { /* The next model gets a chance. */ }
  }
  throw new Error('vision unavailable')
}

const visionBody = z.strictObject({ image: z.string().min(100).max(Math.ceil(maxPhotoBytes * 1.4)) })

async function vision(request: Request, deps: KitchenDeps): Promise<Response> {
  const token = bearer(request)
  if (!token) return failure(401, 'unauthorized', 'Zaloguj się, aby rozpoznawać produkty ze zdjęcia.')
  if (!deps.ai) return failure(503, 'unavailable', 'Rozpoznawanie zdjęć jest chwilowo niedostępne.')
  const body = await readJson(request, Math.ceil(maxPhotoBytes * 1.4) + 200)
  if (!body.ok) return body.response
  const parsed = visionBody.safeParse(body.value)
  if (!parsed.success) return failure(400, 'bad_request', 'Nie udało się odczytać zdjęcia.')
  let bytes: Uint8Array
  try { bytes = decodeBase64(parsed.data.image.replace(/^data:image\/[a-z]+;base64,/, '')) }
  catch { return failure(400, 'bad_request', 'Nie udało się odczytać zdjęcia.') }
  if (bytes.length > maxPhotoBytes) return failure(413, 'too_large', 'Zdjęcie jest za duże. Zrób mniejsze lub spróbuj ponownie.')
  if (!isJpeg(bytes) && !isPng(bytes)) return failure(400, 'bad_request', 'Obsługujemy zdjęcia JPEG lub PNG.')
  const blocked = await consume(deps, token, 'vision')
  if (blocked) return blocked
  let text: string
  try { text = await describePhoto(deps.ai, bytes) }
  catch { return failure(503, 'unavailable', 'Nie udało się przeanalizować zdjęcia. Spróbuj ponownie za chwilę.') }
  const seen = parseVisionText(text)
  const { ids, unknown } = matchIngredientNames(seen)
  const items = ids.filter((id) => { const item = ingredientsById.get(id); return item !== undefined && isRecognisable(item) })
  return json(200, { items, unknown: unknown.slice(0, 10), seen })
}

const imageBody = z.strictObject({
  format: z.enum(dishFormats),
  ingredients: z.array(z.string().regex(/^[a-z0-9-]{2,40}$/)).min(1).max(maxPromptIngredients),
  style: z.enum(dishStyles).optional(),
})

async function toBytes(result: unknown): Promise<Uint8Array<ArrayBuffer> | null> {
  if (result && typeof result === 'object' && 'image' in result && typeof (result as { image: unknown }).image === 'string') return decodeBase64((result as { image: string }).image)
  if (result instanceof Uint8Array) return new Uint8Array(result)
  if (result instanceof ArrayBuffer) return new Uint8Array(result)
  if (result instanceof ReadableStream) return new Uint8Array(await new Response(result).arrayBuffer())
  return null
}

async function image(request: Request, deps: KitchenDeps): Promise<Response> {
  const token = bearer(request)
  if (!token) return failure(401, 'unauthorized', 'Zaloguj się, aby generować zdjęcia potraw.')
  if (!deps.ai) return failure(503, 'unavailable', 'Generowanie zdjęć jest chwilowo niedostępne.')
  const body = await readJson(request, 4000)
  if (!body.ok) return body.response
  const parsed = imageBody.safeParse(body.value)
  if (!parsed.success || parsed.data.ingredients.some((id) => !ingredientsById.has(id))) return failure(400, 'bad_request', 'Nieprawidłowe dane potrawy.')
  const blocked = await consume(deps, token, 'image')
  if (blocked) return blocked
  const prompt = dishImagePrompt(parsed.data.format, parsed.data.ingredients, parsed.data.style)
  for (const model of imageModels) {
    try {
      const bytes = await toBytes(await withTimeout(deps.ai.run(model, model.includes('flux') ? { prompt, steps: 4 } : { prompt }), model))
      if (bytes && bytes.length > 1000 && (isJpeg(bytes) || isPng(bytes))) {
        return new Response(bytes, { headers: { ...baseHeaders, 'cache-control': 'private, max-age=3600', 'content-type': isPng(bytes) ? 'image/png' : 'image/jpeg' } })
      }
    } catch { /* Try the fallback model. */ }
  }
  return failure(503, 'unavailable', 'Nie udało się wygenerować zdjęcia. Spróbuj ponownie za chwilę.')
}

export async function handleKitchenRequest(action: string, request: Request, deps: KitchenDeps): Promise<Response> {
  if (action === 'status') {
    if (request.method !== 'GET') return failure(405, 'method', 'Nieobsługiwana metoda.')
    return json(200, { available: Boolean(deps.ai && deps.supabaseUrl && deps.supabaseKey), limits: aiLimits })
  }
  if (action !== 'vision' && action !== 'image') return failure(404, 'not_found', 'Nie znaleziono.')
  if (request.method !== 'POST') return failure(405, 'method', 'Nieobsługiwana metoda.')
  return action === 'vision' ? vision(request, deps) : image(request, deps)
}
