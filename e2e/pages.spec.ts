import { test, expect } from '@playwright/test'
import { mockEmptyCatalog } from './catalog-fixture'

const origin = `http://127.0.0.1:${process.env.PLAYWRIGHT_PAGES_ONLY === '1' ? 4175 : 4174}`

test('GitHub Pages includes the full local demo with relative assets and reload-safe routes', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const failures: string[] = []
  page.on('response', (response) => { if (response.status() >= 400) failures.push(response.url()) })
  await page.goto(origin)
  await page.getByRole('link', { name: 'Otwórz demo Flexa', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'Dzisiaj, w Twoim rytmie' })).toBeVisible()
  await expect(page).toHaveURL(/\/app\/#\/$/)
  await page.locator('.plan-note a').click()
  await expect(page).toHaveURL(/#\/plan(\/s\d)?$/)
  await page.goto(`${origin}/app/#/plan/s1`)
  await expect(page.getByRole('button', { name: 'Skończone', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Skończone', exact: true }).click()
  await page.reload()
  await expect(page.getByText(/^Wznowiono trening od kroku 2\./)).toBeVisible()
  await page.goto(`${origin}/app/#/`)
  await expect(page.getByRole('heading', { name: 'Dzisiaj, w Twoim rytmie' })).toBeVisible()
  await page.locator('nav:visible a[href="#/journal"]').click()
  await expect(page).toHaveURL(/#\/journal$/)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Dziennik żywienia', exact: true })).toBeVisible()
  const settings = page.locator('nav:visible a[href="#/settings"]')
  if (await settings.count() > 0) await settings.click()
  else await page.getByRole('link', { name: /^Konto:/ }).click()
  await expect(page.getByRole('heading', { name: 'Cele i konto', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Eksportuj dane JSON' })).toBeVisible()
  await page.goto(`${origin}/app/#/kitchen`)
  await expect(page.getByRole('heading', { name: 'Smart Kuchnia', level: 1 })).toBeVisible()
  await page.getByRole('searchbox', { name: 'Szukaj produktu' }).fill('jajka')
  await page.getByRole('button', { name: 'Jajka', exact: true }).click()
  await page.getByRole('button', { name: 'Dalej: preferencje' }).click()
  await page.getByRole('button', { name: 'Pokaż przepis' }).click()
  await expect(page.getByRole('heading', { level: 3 }).first()).toContainText(/jajecznica/i)
  await page.goto(`${origin}/app/#/privacy`)
  await expect(page.getByRole('heading', { name: 'Twój dziennik. Twoja prywatność.' })).toBeVisible()
  const emailPrivacy = page.getByText(/^Wiadomości potwierdzające adres e-mail/)
  await expect(emailPrivacy).toContainText('wysyła Brevo')
  await expect(emailPrivacy).toContainText('w tym link weryfikacyjny')
  await expect(emailPrivacy).toContainText('Nie przekazujemy Brevo Twojego hasła ani treści dziennika')
  await expect(emailPrivacy).toContainText('usługę śledzenia')
  await expect(page.getByText(/Wersja zgody: 6 października 2026/)).toBeVisible()
  await expect(page.getByText(/^Ankieta „Zanim zaczniesz” i plan są opcjonalne/)).toContainText('bez AI')
  await expect(page.getByText(/^Informacje o zdrowiu z ankiety/)).toContainText('osobnej zgody')
  expect(errors).toEqual([])
  expect(failures).toEqual([])
})

test('public Pages barcode lookup uses actual product records and persists the confirmed portion', async ({ page }) => {
  await mockEmptyCatalog(page)
  const calls: string[] = []
  await page.route('https://world.openfoodfacts.org/**', async (route) => {
    calls.push(route.request().url())
    await route.fulfill({
      contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ product: {
        code: '4025500132477', product_name: 'Mullermilch Chocolate', brands: 'Müller',
        nutriments: { 'energy-kcal_100g': 76, proteins_100g: 3.5, carbohydrates_100g: 11.9, fat_100g: 1.7 },
      } }),
    })
  })
  await page.goto(`${origin}/app/#/demo`)
  await page.getByRole('button', { name: 'Dodaj posiłek', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Kod kreskowy', exact: true }).click()
  await dialog.getByLabel('Kod EAN lub UPC', { exact: true }).fill('4025500132477')
  expect(calls).toHaveLength(0)
  await dialog.getByRole('button', { name: 'Szukaj', exact: true }).click()
  await dialog.getByRole('button', { name: /Mullermilch Chocolate.*76 kcal/ }).click()
  await dialog.getByLabel('Wartości na etykiecie dotyczą').selectOption('ml')
  await dialog.getByLabel('Porcja (ml)', { exact: true }).fill('400')
  await dialog.getByRole('button', { name: 'Dodaj do dziennika' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('Mullermilch Chocolate', { exact: true })).toBeVisible()
  expect(calls).toHaveLength(1)
  expect(calls[0]).toContain('/api/v3/product/4025500132477.json')
  const meal = await page.evaluate(() => JSON.parse(localStorage.getItem('flexa:demo:v1') ?? '{}').meals.at(-1))
  expect(meal).toMatchObject({ portion: 400, food: { source: 'open-food-facts', unit: 'ml', barcode: '4025500132477' } })
  await page.reload()
  await expect(page.getByText('Mullermilch Chocolate', { exact: true })).toBeVisible()
})

test('public catalog failure is not mislabeled as a missing barcode', async ({ page }) => {
  await mockEmptyCatalog(page)
  await page.route('https://world.openfoodfacts.org/**', (route) => route.fulfill({
    status: 503, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}',
  }))
  await page.goto(`${origin}/app/#/demo`)
  await page.getByRole('button', { name: 'Dodaj posiłek', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Kod kreskowy', exact: true }).click()
  await dialog.getByLabel('Kod EAN lub UPC', { exact: true }).fill('4025500132477')
  await dialog.getByRole('button', { name: 'Szukaj', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('niedostępna (503)')
  await expect(dialog.getByRole('heading', { name: 'Tego produktu jeszcze nie znaleźliśmy' })).toHaveCount(0)
})

test('all 150 required product positions are available from the built-in licensed catalog', async ({ page }) => {
  let external = 0
  await page.route('https://world.openfoodfacts.org/**', (route) => { external++; return route.abort() })
  await page.goto(`${origin}/app/#/demo`)
  await page.getByRole('button', { name: 'Dodaj posiłek', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const picker = dialog.getByRole('combobox', { name: 'Podstawowe produkty — 150 pozycji', exact: true })
  expect(await picker.locator('option').count()).toBe(151)
  expect(await picker.locator('optgroup').count()).toBe(6)
  for (const id of [1, 26, 56, 84, 101, 126, 150]) {
    await picker.selectOption(String(id))
    await expect(dialog.locator('.food-results li').first()).toBeVisible()
  }
  expect(external).toBe(0)
  await dialog.getByRole('button', { name: 'Kod kreskowy', exact: true }).click()
  await dialog.getByLabel('Kod EAN lub UPC', { exact: true }).fill('5449000054227')
  await dialog.getByRole('button', { name: 'Szukaj', exact: true }).click()
  await expect(dialog.locator('.food-result strong').first()).toContainText(/Coca/i)
  expect(external).toBe(0)
})
