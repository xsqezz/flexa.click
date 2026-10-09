import { registerPlateItems, type PlateGroup, type PlateItem, type PlateSpread } from './catalog.ts'
import { resetPlateIndex } from './match.ts'

/** One catalogue record as stored in data/catalog.json (short keys keep the download small). */
export type CatalogRow = {
  i: string
  n: string
  e?: string
  g: PlateGroup
  u: 'g' | 'ml'
  p: [kcal: number, protein: number, carbs: number, fat: number, fiber: number]
  s: [number, number, number]
  pc?: [grams: number, label: string]
  sp: PlateSpread
  b?: string
  r?: 'PL' | 'US'
  f?: 1
}

export function rowToItem(row: CatalogRow): PlateItem {
  return {
    id: row.i, name: row.n, group: row.g, unit: row.u,
    per100: { kcal: row.p[0], protein: row.p[1], carbs: row.p[2], fat: row.p[3], fiber: row.p[4] },
    sizes: { S: row.s[0], M: row.s[1], L: row.s[2] }, spread: row.sp,
    ...(row.pc ? { piece: { grams: row.pc[0], label: row.pc[1] } } : {}),
    ...(row.e ? { en: row.e.split('|') } : {}),
    ...(row.b ? { brand: row.b, region: row.r } : {}),
    ...(row.f ? { fixed: true } : {}),
  }
}

export function registerCatalogRows(rows: readonly CatalogRow[]): number {
  registerPlateItems(rows.map(rowToItem))
  resetPlateIndex()
  return rows.length
}

let loading: Promise<number> | null = null

/** Loads the full catalogue (several thousand items) once; the file is a separate chunk so it is fetched only when scanning. */
export function loadPlateLibrary(): Promise<number> {
  loading ??= import('./data/catalog.json').then((module) => registerCatalogRows((module.default as { rows: CatalogRow[] }).rows)).catch((error) => { loading = null; throw error })
  return loading
}
