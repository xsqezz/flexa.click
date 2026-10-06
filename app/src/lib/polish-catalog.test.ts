// @vitest-environment node
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { catalogSchema } from '../../../shared/catalog-schema'
import { catalogGroups, requiredProducts } from '../../../shared/polish-catalog'
import { isValidBarcode } from '../../../shared/domain'

describe('required Polish grocery catalog', () => {
  it('contains exactly the 150 required positions, in six groups of 25', () => {
    expect(requiredProducts).toHaveLength(150)
    expect(catalogGroups).toHaveLength(6)
    expect(catalogGroups.every((group) => group.entries.length === 25)).toBe(true)
    expect(requiredProducts.map((entry) => entry.id)).toEqual(Array.from({ length: 150 }, (_, index) => index + 1))
    expect(requiredProducts[0].name).toBe('Serek wiejski')
    expect(requiredProducts[149].name).toBe('Ocet jabłkowy lub winny')
  })
  it('backs all 150 positions with actual barcode records and publishes provenance', async () => {
    const data = catalogSchema.parse(JSON.parse(await readFile(new URL('../../public/data/polish-products.json', import.meta.url), 'utf8')))
    expect(data.products.length).toBeGreaterThan(7000)
    expect(data.coverage).toHaveLength(150)
    expect(data.coverage.every((entry) => entry.count > 0)).toBe(true)
    expect(data.products.every(({ food }) => food.source === 'open-food-facts' && food.barcode && isValidBarcode(food.barcode))).toBe(true)
    expect(new Set(data.products.map(({ food }) => food.barcode)).size).toBe(data.products.length)
    expect(data.products.filter(({ food }) => food.nutrients.kcal !== null).length).toBeGreaterThan(6000)
    expect(data.products.some(({ food }) => food.nutrients.kcal === null)).toBe(true)
    expect(data.products.some(({ food }) => food.estimated)).toBe(true)
    for (const entry of data.coverage) expect(entry.count).toBe(data.products.filter((record) => record.requirements.includes(entry.id)).length)
  })
})
