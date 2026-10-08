import { z } from 'zod'
import type { Recipe } from './context'

const CONSENT_KEY = 'flexa:kitchen-photo'
const maxBytes = 1_600_000

export class KitchenAiError extends Error {
  readonly code: string
  constructor(message: string, code: string) {
    super(message)
    this.name = 'KitchenAiError'
    this.code = code
  }
}

export function photoConsentGiven(): boolean {
  try { return localStorage.getItem(CONSENT_KEY) === 'on' } catch { return false }
}

export function rememberPhotoConsent(value: boolean): void {
  try { if (value) localStorage.setItem(CONSENT_KEY, 'on'); else localStorage.removeItem(CONSENT_KEY) } catch { /* The choice then applies to this view only. */ }
}

let availability: Promise<boolean> | null = null

/** Asks the server whether Workers AI is configured; development and the static demo simply answer "no". */
export function kitchenAiAvailable(): Promise<boolean> {
  availability ??= fetch('/api/kitchen/status', { signal: AbortSignal.timeout(8000) })
    .then(async (response) => response.ok && (await response.json() as { available?: unknown }).available === true)
    .catch(() => false)
  return availability
}

async function failure(response: Response): Promise<KitchenAiError> {
  const body = await response.json().catch(() => null) as { error?: unknown; code?: unknown } | null
  const message = typeof body?.error === 'string' ? body.error : 'Nie udało się połączyć z usługą AI. Spróbuj ponownie za chwilę.'
  return new KitchenAiError(message, typeof body?.code === 'string' ? body.code : `http-${response.status}`)
}

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  return btoa(binary)
}

/** Shrinks the photo and re-encodes it as JPEG, which also drops EXIF data such as the location. */
export async function preparePhoto(file: File): Promise<{ base64: string; preview: string }> {
  let bitmap: ImageBitmap
  try { bitmap = await createImageBitmap(file) }
  catch { throw new KitchenAiError('Nie udało się odczytać zdjęcia. Spróbuj zrobić je ponownie lub wybierz plik JPEG albo PNG.', 'unreadable') }
  try {
    for (const [side, quality] of [[1024, 0.82], [900, 0.7], [720, 0.6]] as const) {
      const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const context = canvas.getContext('2d')
      if (!context) break
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
      if (blob && blob.size <= maxBytes) return { base64: await toBase64(blob), preview: URL.createObjectURL(blob) }
    }
  } finally { bitmap.close() }
  throw new KitchenAiError('Zdjęcie jest za duże. Zrób mniejsze lub oddal telefon od lodówki.', 'too_large')
}

const visionSchema = z.object({ items: z.array(z.string()), unknown: z.array(z.string()), seen: z.array(z.string()) })

export async function recognizePhoto(base64: string, token: string, signal?: AbortSignal): Promise<z.infer<typeof visionSchema>> {
  const response = await fetch('/api/kitchen/vision', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ image: base64 }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(90_000)]) : AbortSignal.timeout(90_000),
  })
  if (!response.ok) throw await failure(response)
  const parsed = visionSchema.safeParse(await response.json().catch(() => null))
  if (!parsed.success) throw new KitchenAiError('Usługa AI zwróciła nieczytelną odpowiedź. Spróbuj ponownie.', 'bad_response')
  return parsed.data
}

export async function generateDishImage(recipe: Pick<Recipe, 'format' | 'style' | 'imageIds'>, token: string, signal?: AbortSignal): Promise<Blob> {
  const response = await fetch('/api/kitchen/image', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ format: recipe.format, ingredients: recipe.imageIds.slice(0, 8), ...(recipe.style !== 'herb' ? { style: recipe.style } : {}) }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(90_000)]) : AbortSignal.timeout(90_000),
  })
  if (!response.ok) throw await failure(response)
  const blob = await response.blob()
  if (!blob.type.startsWith('image/')) throw new KitchenAiError('Usługa AI zwróciła nieczytelną odpowiedź. Spróbuj ponownie.', 'bad_response')
  return blob
}
