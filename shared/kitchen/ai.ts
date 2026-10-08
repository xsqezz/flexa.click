import { z } from 'zod'
import { ingredientsById, isNonIngredientName, matchIngredientName, normalizeName } from './lookup.ts'
import type { Ingredient } from './types.ts'
import { dishFormats, dishImagePrompt, dishStyles, maxPromptIngredients } from './visual.ts'

/** Daily per-account limits keep the free Workers AI allocation fair for everyone. */
export const aiLimits = { vision: 12, image: 30 } as const
export const maxPhotoBytes = 1_800_000
/** One overview plus four zoomed crops: small items on crowded shelves are only found on the crops. */
export const maxVisionImages = 5
export const maxVisionBytes = 5_000_000
export const maxVisionItems = 30

type VisionModel = { id: string; extra?: Record<string, unknown> }
/** Gemma 4 names the contents of a fridge in about two seconds once its reasoning mode is off; Llama 4 Scout is the safety net. */
const visionModels: readonly VisionModel[] = [
  { id: '@cf/google/gemma-4-26b-a4b-it', extra: { chat_template_kwargs: { enable_thinking: false } } },
  { id: '@cf/meta/llama-4-scout-17b-16e-instruct' },
]
const imageModels = ['@cf/black-forest-labs/flux-1-schnell', '@cf/bytedance/stable-diffusion-xl-lightning'] as const
const modelTimeoutMs = 30_000

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
  return [
    'Look carefully at this photo of a fridge, pantry, kitchen counter or groceries and list the food items you can actually see.',
    'Rules:',
    '- List only items that are clearly visible in the photo. Never guess and never add things that are merely typical for a kitchen.',
    '- Real photos usually show between 2 and 20 food items. Stop as soon as everything visible is listed. List each item once.',
    '- Ignore packaging, brands, containers, labels, appliances, people, soft drinks and juices, and anything else that is not food. Milk counts as food.',
    '- Name each item in Polish: short, generic, nominative singular (format examples only, do not list them unless visible: kalafior, pierś z kurczaka, ser żółty).',
    '- Write one item per line as: name | where in the photo you see it',
    '- If you cannot see any food, answer exactly: BRAK',
  ].join('\n')
}

/** Reads "name | where it is" lines (or plain lists) and keeps only the names; the position merely keeps the model honest. */
export function parseVisionText(text: string): string[] {
  const names: string[] = []
  const lines = text.split(/\r?\n|;/).filter((line) => line.trim() && !/:\s*$/.test(line))
  const grounded = lines.some((line) => line.includes('|'))
  for (const line of lines) {
    if (grounded && !line.includes('|')) continue
    const parts = line.includes('|') ? [line.split('|')[0]] : line.split(',')
    for (const part of parts) {
      const cleaned = part.replace(/^[\s\-*•\d.)]+/, '').replace(/[.,:;!]+$/, '').replace(/\s+/g, ' ').trim()
      if (!cleaned || cleaned.length > 60 || /^brak$/i.test(cleaned)) continue
      if (cleaned.split(' ').length > 6) continue
      if (!names.some((name) => name.toLowerCase() === cleaned.toLowerCase())) names.push(cleaned)
      if (names.length >= maxVisionItems) return names
    }
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

async function describePhoto(ai: AiBinding, url: string): Promise<string> {
  for (const model of visionModels) {
    const input = {
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: visionPrompt() },
          { type: 'image_url', image_url: { url } },
        ],
      }],
      max_tokens: 450,
      temperature: 0.1,
      ...model.extra,
    }
    try {
      const text = extractText(await withTimeout(ai.run(model.id, input), model.id)).trim()
      if (text) return text
    } catch { /* The next model gets a chance. */ }
  }
  throw new Error('vision unavailable')
}

const dataUrlPrefix = /^data:image\/(?:jpeg|png);base64,/i

/** Checks type and size from the Base64 text alone, so photos cost no decoding time on the server. */
function inspectPhoto(value: string): { url: string; bytes: number } | null {
  const body = value.replace(dataUrlPrefix, '').replace(/\s+/g, '')
  if (body.length < 100 || body.length % 4 === 1 || !/^[A-Za-z0-9+/]+={0,2}$/.test(body)) return null
  const head = atob(body.slice(0, 16))
  const png = head.startsWith('\x89PNG')
  if (!png && !(head.charCodeAt(0) === 0xff && head.charCodeAt(1) === 0xd8 && head.charCodeAt(2) === 0xff)) return null
  const padding = body.endsWith('==') ? 2 : body.endsWith('=') ? 1 : 0
  return { url: `data:${png ? 'image/png' : 'image/jpeg'};base64,${body}`, bytes: Math.floor(body.length * 3 / 4) - padding }
}

type Finding = { id: string | null; label: string; hits: number; first: number }

/** Combines what the separate images showed; items seen on several of them rank first. */
function mergeFindings(lists: readonly (readonly string[])[]): { items: string[]; unknown: string[]; seen: string[] } {
  const found = new Map<string, Finding>()
  for (const names of lists) {
    const counted = new Set<string>()
    for (const name of names) {
      if (isNonIngredientName(name)) continue
      const id = matchIngredientName(name)
      const key = id ?? `?${normalizeName(name)}`
      if (counted.has(key)) continue
      counted.add(key)
      const entry = found.get(key)
      if (entry) entry.hits++
      else found.set(key, { id, label: name, hits: 1, first: found.size })
    }
  }
  const ranked = [...found.values()].sort((a, b) => b.hits - a.hits || a.first - b.first)
  const items = ranked.flatMap((entry) => {
    const item = entry.id ? ingredientsById.get(entry.id) : undefined
    return item && isRecognisable(item) ? [item.id] : []
  })
  return {
    items: items.slice(0, maxVisionItems),
    unknown: ranked.filter((entry) => !entry.id).map((entry) => entry.label).slice(0, 10),
    seen: ranked.map((entry) => entry.label).slice(0, maxVisionItems),
  }
}

const visionBody = z.strictObject({
  images: z.array(z.string().min(100).max(Math.ceil(maxPhotoBytes * 1.4))).min(1).max(maxVisionImages),
})

async function vision(request: Request, deps: KitchenDeps): Promise<Response> {
  const token = bearer(request)
  if (!token) return failure(401, 'unauthorized', 'Zaloguj się, aby rozpoznawać produkty ze zdjęcia.')
  const ai = deps.ai
  if (!ai) return failure(503, 'unavailable', 'Rozpoznawanie zdjęć jest chwilowo niedostępne.')
  const body = await readJson(request, Math.ceil(maxVisionBytes * 1.4) + 1000)
  if (!body.ok) return body.response
  const parsed = visionBody.safeParse(body.value)
  if (!parsed.success) return failure(400, 'bad_request', 'Nie udało się odczytać zdjęcia.')
  const photos: { url: string; bytes: number }[] = []
  for (const value of parsed.data.images) {
    const photo = inspectPhoto(value)
    if (!photo) return failure(400, 'bad_request', 'Obsługujemy zdjęcia JPEG lub PNG.')
    if (photo.bytes > maxPhotoBytes) return failure(413, 'too_large', 'Zdjęcie jest za duże. Zrób mniejsze lub spróbuj ponownie.')
    photos.push(photo)
  }
  if (photos.reduce((sum, photo) => sum + photo.bytes, 0) > maxVisionBytes) return failure(413, 'too_large', 'Zdjęcie jest za duże. Zrób mniejsze lub spróbuj ponownie.')
  const blocked = await consume(deps, token, 'vision')
  if (blocked) return blocked
  const settled = await Promise.allSettled(photos.map((photo) => describePhoto(ai, photo.url)))
  const texts = settled.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])
  if (!texts.length) return failure(503, 'unavailable', 'Nie udało się przeanalizować zdjęcia. Spróbuj ponownie za chwilę.')
  return json(200, mergeFindings(texts.map(parseVisionText)))
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
