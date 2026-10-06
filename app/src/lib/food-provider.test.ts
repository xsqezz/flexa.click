import { describe, expect, it } from 'vitest'
import { normalizeOFF, normalizeUSDA } from '../../../supabase/functions/_shared/food'

describe('Open Food Facts normalization', () => {
  it('keeps missing values unknown, including the unconfirmed g/ml basis', () => {
    const food = normalizeOFF({
      code: '5901234123457', product_name: 'Oats', product_name_pl: 'Płatki',
      nutriments: { 'energy-kcal_100g': 370, proteins_100g: 13, fat_100g: 0 },
    })
    expect(food?.name).toBe('Płatki')
    expect(food?.nutrients.fat).toBe(0)
    expect(food?.nutrients.carbs).toBeNull()
    expect(food?.unit).toBeNull()
  })
  it('converts kJ without rejecting a legitimate oil energy value', () => {
    const food = normalizeOFF({ code: '5901234123457', product_name: 'Olej', nutriments: { energy_100g: 3700 } })
    expect(food?.nutrients.kcal).toBeCloseTo(3700 / 4.184)
  })
  it('rejects malformed records and barcode mismatches', () => {
    expect(normalizeOFF({ code: '1' })).toBeNull()
    expect(normalizeOFF({ code: '4006381333931', product_name: 'Wrong' }, '5901234123457')).toBeNull()
  })
})

describe('USDA normalization', () => {
  const product = {
    fdcId: 123, description: 'Test food', gtinUpc: '00036000291452',
    foodNutrients: [{ nutrientId: 1008, value: 100, unitName: 'KCAL' }, { nutrientId: 1003, value: 4 }],
  }
  it('requires exact GTIN equivalence, not a fuzzy search match', () => {
    expect(normalizeUSDA(product, '036000291452')?.nutrients.kcal).toBe(100)
    expect(normalizeUSDA(product, '5901234123457')).toBeNull()
  })
  it('keeps nutrient identities distinct and does not invent absent values', () => {
    expect(normalizeUSDA(product)?.nutrients.protein).toBe(4)
    expect(normalizeUSDA(product)?.nutrients.fat).toBeNull()
    expect(normalizeUSDA(product)?.unit).toBe('g')
    expect(normalizeUSDA({ ...product, description: '' })).toBeNull()
  })
})
