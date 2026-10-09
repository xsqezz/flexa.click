import { z } from 'zod'
import { bearer, consume, describePhoto, failure, inspectPhoto, json, maxPhotoBytes, readJson, type KitchenDeps } from '../kitchen/ai.ts'
import { matchPlateName, plateItems, type PlateSize } from './catalog.ts'

/** A whole-plate photo plus, optionally, a second angle that fills in what the first one hid. */
export const maxPlateImages = 2
const maxPlateBytes = 3_600_000
export const maxPlateItems = 25

export function platePrompt(): string {
  const catalogue = plateItems.map((entry) => {
    const sizes = `S ${entry.sizes.S}, M ${entry.sizes.M}, L ${entry.sizes.L} ${entry.unit}`
    return `${entry.id}: ${entry.name}; ${sizes}${entry.piece ? `; 1 piece = ${entry.piece.grams} ${entry.unit}` : ''}`
  })
  return [
    'You identify the food and drinks in a photo of a meal, tray or plate (fast food, restaurant or home cooking) so that a separate program can count calories. You never estimate calories yourself.',
    'List every separate food, drink and sauce that is clearly visible. Use ONLY ids from the catalogue below. If something visible is not in the catalogue, use the id INNE and name it in Polish.',
    'Answer with exactly one line per item in this format: id | size | count | where in the photo',
    '- size: S, M or L = how big this portion looks compared with the sizes listed for it (M is the usual one). Write - when you count pieces.',
    '- count: for items sold in pieces (nuggets, slices, wings, pierogi, sushi...) the number of pieces you can actually count. For everything else the number of identical portions, usually 1.',
    '- For INNE write: INNE | name in Polish | size | count.',
    'Rules:',
    '- Only list what you can really see. Never add sauces, drinks or sides that are not visible, and never guess hidden ingredients.',
    '- Use packaging text such as "Large", "Medium" or "6 szt." when it is readable. A cup tells you a drink; a small paper cup or sachet tells you a sauce.',
    '- List each item once. A normal tray has between 1 and 8 items.',
    '- If there is no food or drink in the photo, answer exactly: BRAK',
    'Catalogue (id: Polish name; typical sizes):',
    ...catalogue,
  ].join('\n')
}

export type PlateFinding = { id: string; size: PlateSize | null; count: number | null }

const sanitizeName = (value: string) => value.replace(/[^\p{L}\p{N} ()+,.'-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 50)

/** Reads "id | size | count | where" lines. Unknown ids are dropped, "INNE" lines are returned by name only. */
export function parsePlateText(text: string): { findings: PlateFinding[]; unknown: string[] } {
  const findings: PlateFinding[] = []
  const unknown: string[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^[\s\-*•\d.)]+/, '').trim()
    if (!line.includes('|')) continue
    const parts = line.split('|').map((part) => part.trim())
    const head = parts[0].replace(/[`*_]/g, '').trim()
    const other = head.toLowerCase() === 'inne'
    const sizeText = (other ? parts[2] : parts[1]) ?? ''
    const countText = (other ? parts[3] : parts[2]) ?? ''
    const size = /^[SML]$/i.test(sizeText) ? sizeText.toUpperCase() as PlateSize : null
    const count = /^\d{1,3}$/.test(countText) ? Number(countText) : null
    if (other) {
      const name = sanitizeName(parts[1] ?? '')
      if (name && !unknown.some((entry) => entry.toLowerCase() === name.toLowerCase()) && unknown.length < 10) unknown.push(name)
      continue
    }
    const id = matchPlateName(head)
    if (!id || findings.some((entry) => entry.id === id)) continue
    findings.push({ id, size, count: count && count >= 1 && count <= 60 ? count : null })
    if (findings.length >= maxPlateItems) break
  }
  return { findings, unknown }
}

/** The first photo decides the amounts; a later photo can only add items the first one did not show. */
export function mergePlateFindings(lists: readonly { findings: PlateFinding[]; unknown: string[] }[]): { items: PlateFinding[]; unknown: string[] } {
  const items: PlateFinding[] = []
  const unknown: string[] = []
  for (const list of lists) {
    for (const finding of list.findings) if (!items.some((entry) => entry.id === finding.id) && items.length < maxPlateItems) items.push(finding)
    for (const name of list.unknown) if (!unknown.some((entry) => entry.toLowerCase() === name.toLowerCase()) && unknown.length < 10) unknown.push(name)
  }
  return { items, unknown }
}

const plateBody = z.strictObject({
  images: z.array(z.string().min(100).max(Math.ceil(maxPhotoBytes * 1.4))).min(1).max(maxPlateImages),
})

export async function handlePlateRequest(request: Request, deps: KitchenDeps): Promise<Response> {
  const action = new URL(request.url).pathname.split('/').filter(Boolean).at(-1)
  if (action !== 'plate') return failure(404, 'not_found', 'Nie znaleziono.')
  if (request.method !== 'POST') return failure(405, 'method', 'Nieobsługiwana metoda.')
  const token = bearer(request)
  if (!token) return failure(401, 'unauthorized', 'Zaloguj się, aby analizować posiłek ze zdjęcia.')
  const ai = deps.ai
  if (!ai) return failure(503, 'unavailable', 'Analiza zdjęć jest chwilowo niedostępna.')
  const body = await readJson(request, Math.ceil(maxPlateBytes * 1.4) + 1000)
  if (!body.ok) return body.response
  const parsed = plateBody.safeParse(body.value)
  if (!parsed.success) return failure(400, 'bad_request', 'Nie udało się odczytać zdjęcia.')
  const photos: { url: string; bytes: number }[] = []
  for (const value of parsed.data.images) {
    const photo = inspectPhoto(value)
    if (!photo) return failure(400, 'bad_request', 'Obsługujemy zdjęcia JPEG lub PNG.')
    if (photo.bytes > maxPhotoBytes) return failure(413, 'too_large', 'Zdjęcie jest za duże. Zrób mniejsze lub spróbuj ponownie.')
    photos.push(photo)
  }
  if (photos.reduce((sum, photo) => sum + photo.bytes, 0) > maxPlateBytes) return failure(413, 'too_large', 'Zdjęcia są za duże. Zrób mniejsze lub spróbuj ponownie.')
  const blocked = await consume(deps, token, 'vision')
  if (blocked) return blocked
  const prompt = platePrompt()
  const settled = await Promise.allSettled(photos.map((photo) => describePhoto(ai, photo.url, prompt, 600)))
  const lists = settled.flatMap((result) => result.status === 'fulfilled' ? [parsePlateText(result.value)] : [])
  if (!lists.length) return failure(503, 'unavailable', 'Nie udało się przeanalizować zdjęcia. Spróbuj ponownie za chwilę.')
  const merged = mergePlateFindings(lists)
  return json(200, { items: merged.items, unknown: merged.unknown, photos: photos.length, analysed: lists.length })
}
