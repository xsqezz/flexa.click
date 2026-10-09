import { z } from 'zod'

/** Shopping list lives only in this browser (per account or demo), so it works offline and sends nothing anywhere. */
const itemSchema = z.object({
  id: z.string().min(1).max(60),
  name: z.string().trim().min(1).max(80),
  ingredientId: z.string().regex(/^[a-z0-9-]{2,40}$/).nullable(),
  grams: z.number().finite().min(0).max(100_000).nullable(),
  taste: z.boolean(),
  done: z.boolean(),
  note: z.string().max(80),
})
const listSchema = z.array(itemSchema).max(300)

export type ShoppingItem = z.infer<typeof itemSchema>
export type ShoppingLine = { id: string; name: string; grams: number; taste: boolean }

const key = (scope: string) => `flexa:shopping:v1:${scope}`
const EVENT = 'flexa:shopping-changed'

export function readShopping(scope: string): ShoppingItem[] {
  try {
    const parsed = listSchema.safeParse(JSON.parse(localStorage.getItem(key(scope)) ?? '[]'))
    return parsed.success ? parsed.data : []
  } catch { return [] }
}

export function writeShopping(scope: string, items: ShoppingItem[]): void {
  try { localStorage.setItem(key(scope), JSON.stringify(items)) } catch { /* A full or blocked storage only loses the list. */ }
  window.dispatchEvent(new Event(EVENT))
}

export function subscribeShopping(listener: () => void): () => void {
  window.addEventListener(EVENT, listener)
  window.addEventListener('storage', listener)
  return () => { window.removeEventListener(EVENT, listener); window.removeEventListener('storage', listener) }
}

/** Adds recipe lines, summing grams for ingredients already on the list (a checked item is reopened). */
export function addRecipeLines(items: ShoppingItem[], lines: ShoppingLine[], note: string): ShoppingItem[] {
  const next = items.map((item) => ({ ...item }))
  for (const line of lines) {
    const existing = next.find((item) => item.ingredientId === line.id)
    if (existing) {
      existing.grams = existing.taste || line.taste ? null : (existing.grams ?? 0) + line.grams
      existing.done = false
      if (note && !existing.note.includes(note)) existing.note = `${existing.note ? `${existing.note}, ` : ''}${note}`.slice(0, 80)
    } else {
      next.push({
        id: `i-${line.id}`, name: line.name, ingredientId: line.id, grams: line.taste ? null : Math.round(line.grams),
        taste: line.taste, done: false, note: note.slice(0, 80),
      })
    }
  }
  return next.slice(0, 300)
}

export function addManualItem(items: ShoppingItem[], name: string, id: string): ShoppingItem[] {
  const clean = name.trim().replace(/\s+/g, ' ').slice(0, 80)
  if (!clean) return items
  const existing = items.find((item) => item.ingredientId === null && item.name.toLocaleLowerCase('pl') === clean.toLocaleLowerCase('pl'))
  if (existing) return items.map((item) => item === existing ? { ...item, done: false } : item)
  return [...items, { id, name: clean, ingredientId: null, grams: null, taste: false, done: false, note: '' }].slice(0, 300)
}

export const toggleItem = (items: ShoppingItem[], id: string): ShoppingItem[] =>
  items.map((item) => item.id === id ? { ...item, done: !item.done } : item)
export const removeItem = (items: ShoppingItem[], id: string): ShoppingItem[] => items.filter((item) => item.id !== id)
export const clearDone = (items: ShoppingItem[]): ShoppingItem[] => items.filter((item) => !item.done)

/** Plain text for sharing: open items first, then checked ones. */
export function shoppingText(items: ShoppingItem[], describe: (item: ShoppingItem) => string): string {
  const open = items.filter((item) => !item.done)
  return ['Lista zakupów — Flexa', ...open.map((item) => `☐ ${describe(item)}`)].join('\n')
}
