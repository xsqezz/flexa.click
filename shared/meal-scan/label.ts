import { z } from 'zod'
import { bearer, consume, describePhoto, failure, inspectPhoto, json, maxPhotoBytes, readJson, type KitchenDeps } from '../kitchen/ai.ts'

export type LabelReading = {
  name: string
  brand: string
  unit: 'g' | 'ml'
  kcal: number
  protein: number | null
  carbs: number | null
  fat: number | null
  fiber: number | null
  /** False when the energy does not match the macros (a likely misread digit), so the user is told to check. */
  consistent: boolean
}

export function labelPrompt(): string {
  return [
    'You read the nutrition facts table on a photo of a food package. You only copy numbers that are printed; you never estimate or calculate them.',
    'Answer with exactly these lines, in this order, using only a number or a dash for each value:',
    'product: the product name printed on the package, or -',
    'brand: the brand, or -',
    'per: 100 g or 100 ml (the unit of the column "per 100"); if the table has no per-100 column write NONE',
    'kcal: energy in kcal per 100 g or 100 ml (not kJ)',
    'protein: grams of protein per 100',
    'carbs: grams of total carbohydrates per 100',
    'fat: grams of total fat per 100',
    'fiber: grams of fibre per 100, or -',
    'Use the per-100 column, never the per-portion column. Use a dot as decimal separator. If the photo shows no nutrition table, or it is unreadable, answer exactly: NONE',
  ].join('\n')
}

const clean = (value: string, max: number) => value.replace(/[^\p{L}\p{N} ()+,.'&/%-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, max)
const isDash = (value: string | undefined) => !value || /^(-|—|none|n\/a|null|unknown)$/i.test(value.trim())

function number(lines: Map<string, string>, key: string, max: number): number | null | undefined {
  const raw = lines.get(key)
  if (isDash(raw)) return null
  const match = /^<?\s*(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:kcal|g)?$/i.exec(raw!.trim())
  if (!match) return undefined
  const value = Number(match[1].replace(',', '.'))
  return value >= 0 && value <= max ? value : undefined
}

/** Strictly reads the "key: value" lines; anything doubtful makes the whole reading invalid, because the values end up in the diary. */
export function parseLabelText(text: string): LabelReading | null {
  const lines = new Map<string, string>()
  for (const raw of text.split(/\r?\n/)) {
    const match = /^\s*[-*•]?\s*(product|brand|per|kcal|protein|carbs|fat|fiber)\s*:\s*(.*?)\s*$/i.exec(raw.replace(/[`*_]/g, ''))
    if (match && !lines.has(match[1].toLowerCase())) lines.set(match[1].toLowerCase(), match[2])
  }
  const per = /^100\s*(g|ml)$/i.exec((lines.get('per') ?? '').trim())
  if (!per) return null
  const kcal = number(lines, 'kcal', 900)
  const protein = number(lines, 'protein', 100)
  const carbs = number(lines, 'carbs', 100)
  const fat = number(lines, 'fat', 100)
  const fiber = number(lines, 'fiber', 100)
  if (kcal === null || kcal === undefined || [protein, carbs, fat, fiber].includes(undefined)) return null
  const known = [protein, carbs, fat].filter((value): value is number => typeof value === 'number')
  if (known.reduce((sum, value) => sum + value, 0) > 100.5) return null
  const derived = 4 * (protein ?? 0) + 4 * (carbs ?? 0) + 9 * (fat ?? 0)
  const complete = protein !== null && carbs !== null && fat !== null
  return {
    name: isDash(lines.get('product')) ? '' : clean(lines.get('product')!, 120),
    brand: isDash(lines.get('brand')) ? '' : clean(lines.get('brand')!, 60),
    unit: per[1].toLowerCase() as 'g' | 'ml',
    kcal, protein: protein ?? null, carbs: carbs ?? null, fat: fat ?? null, fiber: fiber ?? null,
    consistent: !complete || Math.abs(kcal - derived) <= Math.max(30, 0.25 * kcal),
  }
}

const labelBody = z.strictObject({ images: z.array(z.string().min(100).max(Math.ceil(maxPhotoBytes * 1.4))).length(1) })

export async function handleLabelRequest(request: Request, deps: KitchenDeps): Promise<Response> {
  if (request.method !== 'POST') return failure(405, 'method', 'Nieobsługiwana metoda.')
  const token = bearer(request)
  if (!token) return failure(401, 'unauthorized', 'Zaloguj się, aby odczytać etykietę ze zdjęcia.')
  const ai = deps.ai
  if (!ai) return failure(503, 'unavailable', 'Odczyt etykiety jest chwilowo niedostępny.')
  const body = await readJson(request, Math.ceil(maxPhotoBytes * 1.4) + 1000)
  if (!body.ok) return body.response
  const parsed = labelBody.safeParse(body.value)
  if (!parsed.success) return failure(400, 'bad_request', 'Nie udało się odczytać zdjęcia.')
  const photo = inspectPhoto(parsed.data.images[0])
  if (!photo) return failure(400, 'bad_request', 'Obsługujemy zdjęcia JPEG lub PNG.')
  if (photo.bytes > maxPhotoBytes) return failure(413, 'too_large', 'Zdjęcie jest za duże. Zrób mniejsze lub spróbuj ponownie.')
  const blocked = await consume(deps, token, 'vision')
  if (blocked) return blocked
  let text: string
  try { text = await describePhoto(ai, photo.url, labelPrompt(), 300) }
  catch { return failure(503, 'unavailable', 'Nie udało się odczytać zdjęcia. Spróbuj ponownie za chwilę.') }
  const label = parseLabelText(text)
  if (!label) return failure(422, 'unreadable', 'Nie widzę czytelnej tabeli wartości odżywczych na 100 g lub 100 ml. Zrób zdjęcie z bliska, równo i bez odblasków albo wpisz wartości ręcznie.')
  return json(200, { label })
}
