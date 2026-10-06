import type { Page } from '@playwright/test'

export async function mockEmptyCatalog(page: Page) {
  await page.route('**/data/polish-products.json', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      version: 1, updatedAt: '2026-10-06T00:00:00Z', license: 'ODbL-1.0',
      attribution: 'Fixture', source: 'https://query.openfoodfacts.org/find', country: 'en:poland',
      products: [{ food: {
        id: 'off:036000291452', name: 'Unrelated fixture', brand: '', barcode: '036000291452',
        source: 'open-food-facts', unit: 'g', nutrients: { kcal: 10, protein: null, carbs: null, fat: null, fiber: null },
      }, requirements: [], polishMarket: false }],
      coverage: Array.from({ length: 150 }, (_, index) => ({ id: index + 1, name: `Fixture ${index}`, count: 0 })),
    }),
  }))
}
