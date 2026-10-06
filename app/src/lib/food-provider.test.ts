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
  it('uses a recorded generic product name if the branded name is missing', () => {
    expect(normalizeOFF({ code: '4025500132477', generic_name_pl: 'Napój mleczny', nutriments: {} })?.name).toBe('Napój mleczny')
  })
  it('reads canonical nutrition without mixing serving values or prepared-food bases', () => {
    const raw = { code: '4025500132477', product_name: 'Test',
      nutrition: { aggregated_set: { per: '100ml', preparation: 'as_sold', nutrients: {
        'energy-kcal': { value: 76, unit: 'kcal', source: 'packaging' },
        proteins: { value: 3.5, unit: 'g', source: 'packaging' },
      } } },
    }
    const food = normalizeOFF(raw)
    expect(food?.unit).toBe('ml')
    expect(food?.nutrients.kcal).toBe(76)
    expect(food?.nutrients.protein).toBe(3.5)
    expect(food?.nutrients.fat).toBeNull()
    expect(food?.estimated).toBe(false)
    expect(normalizeOFF({ ...raw, nutrition: { aggregated_set: { ...raw.nutrition.aggregated_set, per: 'serving' } } })?.nutrients.kcal).toBeNull()
    expect(normalizeOFF({ ...raw, nutrition: { aggregated_set: { ...raw.nutrition.aggregated_set, preparation: 'prepared' } } })?.nutrients.kcal).toBeNull()
  })
  it('marks source estimates instead of presenting them as a verified label', () => {
    const food = normalizeOFF({ code: '4025500132477', product_name: 'Test',
      nutrition: { aggregated_set: { per: '100g', preparation: 'as_sold',
        nutrients: { 'energy-kcal': { value: 22, unit: 'kcal', source: 'estimate' } } } } })
    expect(food?.estimated).toBe(true)
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
