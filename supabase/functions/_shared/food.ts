import { z } from 'zod'
import { foodSchema, isValidBarcode, sameBarcode, type Food } from '../../../shared/domain.ts'

const offProductSchema = z.object({
  code: z.string().max(64),
  product_name: z.string().optional(),
  product_name_pl: z.string().optional(),
  brands: z.string().optional(),
  nutriments: z.record(z.string(), z.unknown()).optional(),
})

function nutrient(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 2000
    ? value : null
}

export function normalizeOFF(raw: unknown, barcode?: string): Food | null {
  const parsed = offProductSchema.safeParse(raw)
  if (!parsed.success) return null
  const product = parsed.data
  if (barcode && !sameBarcode(barcode, product.code)) return null
  const name = product.product_name_pl?.trim() || product.product_name?.trim()
  if (!name) return null
  const values = product.nutriments ?? {}
  const rawEnergy = values['energy_100g']
  const kj = typeof rawEnergy === 'number' && Number.isFinite(rawEnergy) && rawEnergy >= 0 && rawEnergy <= 8368 ? rawEnergy : null
  return foodSchema.parse({
    id: `off:${product.code}`,
    name: name.slice(0, 200),
    brand: (product.brands ?? '').slice(0, 100),
    barcode: isValidBarcode(product.code) ? product.code : null,
    source: 'open-food-facts',
    unit: null,
    nutrients: {
      kcal: nutrient(values['energy-kcal_100g']) ?? (kj === null ? null : kj / 4.184),
      protein: nutrient(values['proteins_100g']),
      carbs: nutrient(values['carbohydrates_100g']),
      fat: nutrient(values['fat_100g']),
      fiber: nutrient(values['fiber_100g']),
    },
  })
}

const usdaFoodSchema = z.object({
  fdcId: z.number().int().positive(),
  description: z.string(),
  brandOwner: z.string().optional(),
  brandName: z.string().optional(),
  gtinUpc: z.string().optional(),
  foodNutrients: z.array(z.object({
    nutrientId: z.number(),
    value: z.number().optional(),
    unitName: z.string().optional(),
  })).optional(),
})

export function normalizeUSDA(raw: unknown, barcode?: string): Food | null {
  const parsed = usdaFoodSchema.safeParse(raw)
  if (!parsed.success) return null
  const product = parsed.data
  if (!product.description.trim()) return null
  if (barcode && (!product.gtinUpc || !sameBarcode(barcode, product.gtinUpc))) return null
  const values = product.foodNutrients ?? []
  const get = (id: number) => nutrient(values.find((value) => value.nutrientId === id)?.value)
  return foodSchema.parse({
    id: `usda:${product.fdcId}`,
    name: product.description.trim().slice(0, 200),
    brand: (product.brandName ?? product.brandOwner ?? '').slice(0, 100),
    barcode: product.gtinUpc && isValidBarcode(product.gtinUpc) ? product.gtinUpc : null,
    source: 'usda',
    unit: 'g',
    nutrients: {
      kcal: get(1008),
      protein: get(1003), carbs: get(1005), fat: get(1004), fiber: get(1079),
    },
  })
}
