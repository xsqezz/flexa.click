import type { Ingredient } from '../../../../shared/kitchen/types'

export const cap = (text: string): string => text.charAt(0).toLocaleUpperCase('pl-PL') + text.slice(1)

export function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} i ${items.at(-1)}`
}

export function fill(template: string, item: Ingredient): string {
  return template.replaceAll('{acc}', item.acc).replaceAll('{gen}', item.gen).replaceAll('{ins}', item.ins).replaceAll('{nom}', item.nom)
}

const liquidIds = new Set(['milk', 'kefir', 'broth', 'coconut-milk', 'water', 'cream', 'cream-heavy', 'soy-sauce', 'balsamic-vinegar'])

export function isLiquid(item: Ingredient): boolean {
  return item.category === 'liquid' || liquidIds.has(item.id)
}

function pieceText(count: number): string {
  const whole = Math.floor(count)
  return count % 1 === 0.5 ? (whole ? `${whole} ½` : '½') : String(whole)
}

export function piecesOf(item: Ingredient, grams: number): number | null {
  if (!item.piece) return null
  const count = Math.round((grams / item.piece) * 2) / 2
  return count >= 0.5 ? count : null
}

export function quantityLabel(item: Ingredient, grams: number, taste = false): string {
  if (taste) return 'do smaku'
  const amount = `${Math.round(grams)} ${isLiquid(item) ? 'ml' : 'g'}`
  const pieces = piecesOf(item, grams)
  return pieces !== null ? `${pieceText(pieces)} szt. (${amount})` : amount
}

export function minutesLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} godz. ${rest} min` : `${hours} godz.`
}

export const roundUp = (minutes: number, step = 5): number => Math.ceil(minutes / step) * step
