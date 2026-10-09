import { getPlateItem, plateItemsById, plateSizes, type PlateItem, type PlateSize, type PlateSpread } from './catalog.ts'

/** What the app knows about one thing on the plate; every field except `id` is optional because the user refines it step by step. */
export type PlateLine = {
  id: string
  size?: PlateSize
  /** Real pieces (nuggets, slices) when the item is countable, otherwise the number of identical portions. */
  count?: number
  /** Weighed or typed amount in g (ml); the most reliable way to size a portion. */
  grams?: number
  /** Values of the whole portion read from a menu, receipt or package; they replace the table entirely. */
  exact?: { kcal: number; protein: number; carbs: number; fat: number }
}

/** How sure the amount is: from a guess by size, a counted number of pieces, a typed or weighed amount, to the menu's own numbers. */
export type Precision = 'estimated' | 'counted' | 'weighed' | 'official' | 'exact'

export type Band = { low: number; typical: number; high: number }

/** Portion factors relative to the typical amount, per precision and how much hidden oil or sauce the dish can hide. */
const factors: Record<Precision, Record<PlateSpread, readonly [number, number]>> = {
  estimated: { tight: [0.9, 1.13], normal: [0.8, 1.28], wide: [0.7, 1.42] },
  counted: { tight: [0.95, 1.07], normal: [0.9, 1.12], wide: [0.82, 1.25] },
  weighed: { tight: [0.97, 1.04], normal: [0.94, 1.08], wide: [0.88, 1.15] },
  official: { tight: [0.95, 1.05], normal: [0.95, 1.05], wide: [0.95, 1.05] },
  exact: { tight: [1, 1], normal: [1, 1], wide: [1, 1] },
}

export const limits = { grams: { min: 1, max: 5000 }, count: { min: 1, max: 60 }, kcal: { max: 5000 } } as const

export type LineEstimate = {
  line: PlateLine
  item: PlateItem
  /** Typical amount in g (ml) of this portion. */
  grams: number
  precision: Precision
  kcal: Band
  protein: Band
  carbs: Band
  fat: Band
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

/** Grams of one line: typed amount, else counted pieces, else the chosen size (medium by default) times the number of portions. */
export function lineGrams(line: PlateLine): { grams: number; precision: Precision } {
  const item = getPlateItem(line.id)
  if (finite(line.grams) && line.grams > 0) return { grams: clamp(line.grams, limits.grams.min, limits.grams.max), precision: line.exact ? 'exact' : 'weighed' }
  const count = finite(line.count) && line.count >= 1 ? clamp(Math.round(line.count), limits.count.min, limits.count.max) : null
  if (item.fixed) return { grams: item.sizes.M * (count ?? 1), precision: line.exact ? 'exact' : 'official' }
  if (count && item.piece) return { grams: count * item.piece.grams, precision: line.exact ? 'exact' : 'counted' }
  const size: PlateSize = line.size && plateSizes.includes(line.size) ? line.size : 'M'
  return { grams: item.sizes[size] * (count ?? 1), precision: line.exact ? 'exact' : 'estimated' }
}

const band = (typical: number, spread: readonly [number, number]): Band => ({ low: typical * spread[0], typical, high: typical * spread[1] })

export function estimateLine(line: PlateLine): LineEstimate {
  const item = getPlateItem(line.id)
  const { grams, precision } = lineGrams(line)
  if (line.exact && precision === 'exact') {
    const own = line.exact
    const exact = (value: number): Band => ({ low: value, typical: value, high: value })
    return { line, item, grams, precision, kcal: exact(own.kcal), protein: exact(own.protein), carbs: exact(own.carbs), fat: exact(own.fat) }
  }
  const spread = factors[precision][item.spread]
  const scale = (per100: number) => band(per100 * grams / 100, spread)
  return { line, item, grams, precision, kcal: scale(item.per100.kcal), protein: scale(item.per100.protein), carbs: scale(item.per100.carbs), fat: scale(item.per100.fat) }
}

export type PlateTotals = { kcal: Band; protein: Band; carbs: Band; fat: Band }
export type Confidence = 'high' | 'medium' | 'rough'

const emptyBand = (): Band => ({ low: 0, typical: 0, high: 0 })
const addBand = (sum: Band, other: Band): Band => ({ low: sum.low + other.low, typical: sum.typical + other.typical, high: sum.high + other.high })

export function estimatePlate(lines: readonly PlateLine[]): { lines: LineEstimate[]; totals: PlateTotals; confidence: Confidence; spreadPercent: number } {
  const estimates = lines.map(estimateLine)
  const totals = estimates.reduce<PlateTotals>((sum, entry) => ({
    kcal: addBand(sum.kcal, entry.kcal), protein: addBand(sum.protein, entry.protein), carbs: addBand(sum.carbs, entry.carbs), fat: addBand(sum.fat, entry.fat),
  }), { kcal: emptyBand(), protein: emptyBand(), carbs: emptyBand(), fat: emptyBand() })
  const width = totals.kcal.typical > 0 ? (totals.kcal.high - totals.kcal.low) / totals.kcal.typical : 0
  const confidence: Confidence = width < 0.15 ? 'high' : width < 0.45 ? 'medium' : 'rough'
  return { lines: estimates, totals, confidence, spreadPercent: Math.round(width / 2 * 100) }
}

export const confidenceLabels: Record<Confidence, string> = {
  high: 'Wysoka pewność — wartości z ważenia, etykiet lub menu',
  medium: 'Średnia pewność — policzone sztuki lub rozmiary',
  rough: 'Orientacyjnie — porcje i dodatki oceniono na oko',
}

/** Checks values typed by the user; returns a problem in Polish or null. */
export function lineProblem(line: PlateLine): string | null {
  if (!plateItemsById.has(line.id)) return 'Nieznany składnik.'
  if (line.grams !== undefined && (!finite(line.grams) || line.grams < limits.grams.min || line.grams > limits.grams.max)) return `Podaj ilość od ${limits.grams.min} do ${limits.grams.max}.`
  if (line.count !== undefined && (!finite(line.count) || line.count < limits.count.min || line.count > limits.count.max || !Number.isInteger(line.count))) return `Liczba sztuk: od ${limits.count.min} do ${limits.count.max}.`
  if (line.exact) {
    const { kcal, protein, carbs, fat } = line.exact
    if (![kcal, protein, carbs, fat].every((value) => finite(value) && value >= 0)) return 'Własne wartości muszą być liczbami nieujemnymi.'
    if (kcal > limits.kcal.max || protein > 500 || carbs > 1000 || fat > 500) return 'Własne wartości są poza rozsądnym zakresem dla jednej porcji.'
  }
  return null
}

const round1 = (value: number) => Math.round(value * 10) / 10

/** Menu values given only as kcal: the macronutrients follow the table's proportions, scaled to that energy. */
export function scaleToKcal(line: PlateLine, kcal: number, given: Partial<{ protein: number; carbs: number; fat: number }> = {}): NonNullable<PlateLine['exact']> {
  const base = estimateLine({ ...line, exact: undefined })
  const factor = base.kcal.typical > 0 ? kcal / base.kcal.typical : 0
  return {
    kcal,
    protein: given.protein ?? round1(base.protein.typical * factor),
    carbs: given.carbs ?? round1(base.carbs.typical * factor),
    fat: given.fat ?? round1(base.fat.typical * factor),
  }
}

/** Short stable text for ids, so the same menu values always give the same product. */
function digest(text: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193) >>> 0
  return hash.toString(36)
}

/** Diary product for one line: nutrients per 100 g (ml), so the portion in grams reproduces the estimated totals exactly. */
export function lineFood(estimate: LineEstimate) {
  const { item, grams, precision } = estimate
  const per = (value: number) => (grams > 0 ? round1(value * 100 / grams) : 0)
  const exact = precision === 'exact'
  return {
    food: {
      id: exact ? `scan-${item.id}-own-${digest(JSON.stringify(estimate.line.exact))}` : `scan-${item.id}`,
      name: exact ? `${item.name} (z menu lub etykiety)` : `${item.name} (skan)`,
      brand: item.brand ?? 'Skan posiłku', barcode: null, unit: item.unit, source: 'custom' as const, estimated: !exact && precision !== 'official',
      nutrients: exact
        ? { kcal: per(estimate.kcal.typical), protein: per(estimate.protein.typical), carbs: per(estimate.carbs.typical), fat: per(estimate.fat.typical), fiber: null }
        : { kcal: item.per100.kcal, protein: item.per100.protein, carbs: item.per100.carbs, fat: item.per100.fat, fiber: item.per100.fiber },
    },
    portion: round1(grams),
  }
}

/** Short Polish phrase for a portion: "ok. 115 g", "6 szt. (ok. 100 g)". */
export function portionText(estimate: LineEstimate): string {
  const grams = `${Math.round(estimate.grams)} ${estimate.item.unit}`
  if (estimate.precision === 'counted' && estimate.line.count && estimate.item.piece) return `${estimate.line.count} ${estimate.item.piece.label} (ok. ${grams})`
  if (estimate.precision === 'official') return estimate.line.count && estimate.line.count > 1 ? `${estimate.line.count} × porcja, razem ${grams}` : `porcja z menu, ${grams}`
  return estimate.precision === 'weighed' || estimate.precision === 'exact' ? grams : `ok. ${grams}`
}
