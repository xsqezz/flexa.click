import { z } from 'zod'
import { bearer, consume, describePhoto, failure, inspectPhoto, json, maxPhotoBytes, readJson, type KitchenDeps } from '../kitchen/ai.ts'
import { chainMenuNames, commonDishNames } from './anchors.ts'
import type { PlateSize } from './catalog.ts'

/** A whole-plate photo plus, optionally, a second angle that fills in what the first one hid. */
export const maxPlateImages = 2
const maxPlateBytes = 3_600_000
export const maxPlateItems = 25

export function platePrompt(): string {
  const menus = Object.entries(chainMenuNames).map(([brand, names]) => `${brand}: ${names.join('; ')}`)
  return [
    'You identify the food and drinks in a photo of a meal, tray or plate (fast food, restaurant, canteen or home cooking) so that a separate program can look each item up and count calories. You never estimate calories or weights yourself.',
    'List every separate dish, side, drink and sauce that is clearly visible. Answer with exactly one line per item in this format:',
    'name | brand | size | count',
    '- name: the short English name a menu would use, main food first. For items of the chains listed below, copy the exact menu name from the list. When the item is one of the common dishes listed below, copy that name. Otherwise give a precise generic name that includes the cooking method and the main ingredient, e.g. "grilled chicken breast", "pan-seared salmon fillet", "pepperoni pizza slice", "fried egg", "orange juice".',
    '- Burgers and sandwiches: say what you see, e.g. "double cheeseburger", "bacon cheeseburger", "chicken burger", "fish burger", "veggie burger", "club sandwich"; never write just "burger" when the patties, chicken or fish are visible.',
    '- brand: the restaurant chain, only when it is clearly shown (logo, wrapper, box, bucket, cup) or the item is an unmistakable signature product of one of the listed chains; otherwise write -.',
    '- size: small, medium or large only when a size is printed or obvious from the container (cup, fries carton); otherwise -.',
    '- count: how many identical items or countable pieces you can actually count (nuggets, wings, pierogi, pizza slices, sushi pieces, donuts, cookies); 1 for a single portion. Put identical or similar small pieces on ONE line with their total count (for example "salmon nigiri" count 4, "donut" count 6) instead of one line per piece.',
    'Rules:',
    '- Only list what you can really see. Never add sauces, drinks or sides that are not visible and never guess hidden ingredients.',
    '- Do NOT list garnishes, herbs, lemon or lime wedges, pickles, onion, lettuce or tomato slices, toppings, decorations or ingredients that belong to a dish or sit inside a burger or sandwich. List a sauce or topping only when it is served separately in its own pot, sachet or bowl, or is a large part of the meal.',
    '- Do not combine a food and its topping in one name ("pancakes with syrup" is just "pancakes").',
    '- Read any visible text: sizes on cups, piece counts on boxes, product names on wrappers.',
    '- A normal tray has between 1 and 8 items; a full table may have more. If there is no food or drink in the photo, answer exactly: NONE',
    'Menus of chains with official data (use these exact names when the item matches):',
    ...menus,
    `Common dishes (use these names when the dish matches): ${commonDishNames.join('; ')}`,
  ].join('\n')
}

export type PlateFinding = { name: string; brand: string | null; size: PlateSize | null; count: number | null }

const sizeNames: Record<string, PlateSize> = { small: 'S', medium: 'M', large: 'L', s: 'S', m: 'M', l: 'L', regular: 'M', big: 'L' }

const clean = (value: string, max: number) => value.replace(/[^\p{L}\p{N} ()+,.'&/%-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, max)
const dash = (value: string | undefined) => !value || /^(-|—|none|n\/a|null|unknown|no)$/i.test(value.trim())

export const findingKey = (finding: Pick<PlateFinding, 'name' | 'brand'>) => `${(finding.brand ?? '').toLowerCase()}|${finding.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}`

/** Reads "name | brand | size | count" lines; anything that does not look like one is ignored. */
export function parsePlateText(text: string): PlateFinding[] {
  const findings: PlateFinding[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^[\s\-*•\d.)]+(?=\S)/, '').replace(/[`*_]/g, '').trim()
    if (!line.includes('|')) continue
    const parts = line.split('|').map((part) => part.trim())
    const name = clean(parts[0] ?? '', 80)
    if (name.length < 2 || /^(name|none|brak)$/i.test(name)) continue
    const brand = dash(parts[1]) ? null : clean(parts[1], 40) || null
    const size = dash(parts[2]) ? null : sizeNames[parts[2].toLowerCase()] ?? null
    const countText = parts[3] ?? ''
    const count = /^\d{1,3}$/.test(countText) ? Number(countText) : null
    const finding: PlateFinding = { name, brand, size, count: count && count >= 1 && count <= 60 ? count : null }
    if (findings.some((entry) => findingKey(entry) === findingKey(finding))) continue
    findings.push(finding)
    if (findings.length >= maxPlateItems) break
  }
  return findings
}

/** The first photo decides the amounts; a later photo can only add items the first one did not show. */
export function mergePlateFindings(lists: readonly (readonly PlateFinding[])[]): PlateFinding[] {
  const items: PlateFinding[] = []
  for (const list of lists) {
    for (const finding of list) {
      if (items.length >= maxPlateItems) break
      if (!items.some((entry) => findingKey(entry) === findingKey(finding))) items.push(finding)
    }
  }
  return items
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
  const settled = await Promise.allSettled(photos.map((photo) => describePhoto(ai, photo.url, prompt, 700)))
  const lists = settled.flatMap((result) => result.status === 'fulfilled' ? [parsePlateText(result.value)] : [])
  if (!lists.length) return failure(503, 'unavailable', 'Nie udało się przeanalizować zdjęcia. Spróbuj ponownie za chwilę.')
  return json(200, { items: mergePlateFindings(lists), photos: photos.length, analysed: lists.length })
}
