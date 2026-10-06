import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { normalizeOFF } from '../shared/food.ts'
import { matchingRequirements, requiredProducts } from '../shared/polish-catalog.ts'

const input = process.argv[2]
if (!input) throw new Error('Provide an official country-filtered export JSON path.')
const raw = JSON.parse(readFileSync(input, 'utf8'))
if (!Array.isArray(raw.products) || !raw.fetchedAt || !raw.source) throw new Error('Export provenance is missing.')
const records = new Map()
for (const product of raw.products) {
  const food = normalizeOFF(product)
  if (!food?.barcode) continue
  const names = [food.name, product.product_name, product.product_name_pl, product.generic_name, product.generic_name_pl].filter(Boolean).join(' ')
  const requirements = matchingRequirements(names, food.brand, product.categories_tags ?? [])
  records.set(food.barcode, {
    food, requirements, polishMarket: (product.countries_tags ?? []).includes('en:poland'),
  })
}
const products = [...records.values()]
const coverage = requiredProducts.map((entry) => ({
  id: entry.id, name: entry.name,
  count: products.filter((record) => record.requirements.includes(entry.id)).length,
}))
const result = {
  version: 1, updatedAt: raw.fetchedAt,
  license: 'ODbL-1.0', attribution: 'Open Food Facts contributors',
  source: raw.source, country: 'en:poland',
  supplements: raw.supplements ?? [],
  products, coverage,
}
const output = join('app', 'public', 'data', 'polish-products.json')
mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, JSON.stringify(result))
console.log(JSON.stringify({
  output, products: products.length, covered: coverage.filter((entry) => entry.count > 0).length,
  withEnergy: products.filter((record) => record.food.nutrients.kcal !== null).length,
  required: coverage.length, missing: coverage.filter((entry) => entry.count === 0),
}, null, 2))
