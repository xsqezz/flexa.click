import { z } from 'zod'
import type { Recipe } from './context'

const CONSENT_KEY = 'flexa:kitchen-photo'
const maxBytes = 1_600_000
const maxCropBytes = 700_000

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

export async function failure(response: Response): Promise<KitchenAiError> {
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

type Area = { x: number; y: number; width: number; height: number }

async function renderJpeg(bitmap: ImageBitmap, area: Area, side: number, quality: number): Promise<Blob | null> {
  const scale = Math.min(1, side / Math.max(area.width, area.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(area.width * scale))
  canvas.height = Math.max(1, Math.round(area.height * scale))
  const context = canvas.getContext('2d')
  if (!context) return null
  context.drawImage(bitmap, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height)
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}

/** Four overlapping crops that together cover the photo: small items on crowded shelves are far easier to name when zoomed in. */
function cropAreas(width: number, height: number): Area[] {
  if (Math.min(width, height) < 600 || Math.max(width, height) < 900) return []
  const cropWidth = Math.round(width * 0.58)
  const cropHeight = Math.round(height * 0.58)
  return [0, height - cropHeight].flatMap((y) => [0, width - cropWidth].map((x) => ({ x, y, width: cropWidth, height: cropHeight })))
}

export type PreparedPhoto = { images: string[]; preview: string }

/** Shrinks the photo and re-encodes it as JPEG, which also drops EXIF data such as the location. The first image is the whole photo, the rest are zoomed crops (unless `crops` is off). */
export async function preparePhoto(file: File, options: { crops?: boolean } = {}): Promise<PreparedPhoto> {
  let bitmap: ImageBitmap
  try { bitmap = await createImageBitmap(file) }
  catch { throw new KitchenAiError('Nie udało się odczytać zdjęcia. Spróbuj zrobić je ponownie lub wybierz plik JPEG albo PNG.', 'unreadable') }
  try {
    const whole: Area = { x: 0, y: 0, width: bitmap.width, height: bitmap.height }
    for (const [side, quality] of [[1024, 0.82], [900, 0.7], [720, 0.6]] as const) {
      const blob = await renderJpeg(bitmap, whole, side, quality)
      if (!blob || blob.size > maxBytes) continue
      const images = [await toBase64(blob)]
      for (const area of options.crops === false ? [] : cropAreas(bitmap.width, bitmap.height)) {
        const crop = await renderJpeg(bitmap, area, 896, 0.8)
        if (crop && crop.size <= maxCropBytes) images.push(await toBase64(crop))
      }
      return { images, preview: URL.createObjectURL(blob) }
    }
  } finally { bitmap.close() }
  throw new KitchenAiError('Zdjęcie jest za duże. Zrób mniejsze lub oddal telefon od lodówki.', 'too_large')
}

const visionSchema = z.object({ items: z.array(z.string()), unknown: z.array(z.string()), seen: z.array(z.string()) })

export async function recognizePhoto(images: readonly string[], token: string, signal?: AbortSignal): Promise<z.infer<typeof visionSchema>> {
  const response = await fetch('/api/kitchen/vision', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ images }),
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
