import { readFile } from 'node:fs/promises'
import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { journalSchema } from '../shared/domain'

test.beforeEach(async ({ page }) => {
  await page.route('https://world.openfoodfacts.org/**', async (route) => {
    const barcode = new URL(route.request().url()).pathname.includes('/product/')
    const product = {
      code: barcode ? '4025500132477' : '5901234123457',
      product_name: barcode ? 'Mullermilch Chocolate' : 'Jogurt naturalny',
      brands: 'Fixture', nutriments: { 'energy-kcal_100g': barcode ? 76 : 61 },
    }
    await route.fulfill({
      contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(barcode ? { product } : { products: [product] }),
    })
  })
})

async function openDemo(page: Page) {
  await page.goto('/demo')
  await expect(page.getByRole('heading', { name: 'Dzisiaj, w Twoim rytmie' })).toBeVisible()
}

async function journal(page: Page) {
  const data: unknown = await page.evaluate(() => JSON.parse(localStorage.getItem('flexa:demo:v1') ?? 'null'))
  return journalSchema.parse(data)
}

async function navigate(page: Page, route: string) {
  await page.locator(`nav:visible a[href="${route}"]`).click()
}

async function accessible(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(result.violations.map((violation) => ({
    id: violation.id, impact: violation.impact, nodes: violation.nodes.map((node) => node.target),
  }))).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
}

test('demo, food search, portions, persistent meals and deletion', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await openDemo(page)
  const before = (await journal(page)).meals.length
  const addButton = page.getByRole('button', { name: 'Dodaj posiłek', exact: true })
  await addButton.focus()
  await addButton.click()
  let dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: 'Nazwa produktu', exact: true }).fill('Jogurt')
  await dialog.getByRole('button', { name: 'Szukaj', exact: true }).click()
  await dialog.getByRole('button', { name: /Jogurt naturalny.*61 kcal/ }).click()
  await dialog.getByLabel('Wartości na etykiecie dotyczą').selectOption('g')
  await dialog.getByLabel('Porcja (g)', { exact: true }).fill('200')
  await dialog.getByLabel('Posiłek', { exact: true }).selectOption('dinner')
  await dialog.getByRole('button', { name: 'Dodaj do dziennika' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(addButton).toBeFocused()
  expect((await journal(page)).meals).toHaveLength(before + 1)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Dzisiaj, w Twoim rytmie' })).toBeVisible()
  expect((await journal(page)).meals.at(-1)?.portion).toBe(200)
  await page.getByRole('button', { name: 'Usuń: Jogurt naturalny', exact: true }).last().click()
  dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Zachowaj wpis' }).click()
  expect((await journal(page)).meals).toHaveLength(before + 1)
  await page.getByRole('button', { name: 'Usuń: Jogurt naturalny', exact: true }).last().click()
  await page.getByRole('dialog').getByRole('button', { name: 'Usuń wpis', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect((await journal(page)).meals).toHaveLength(before)
  expect(pageErrors).toEqual([])
})

test('custom fluid product, unknown macro and validated barcode', async ({ page }) => {
  await openDemo(page)
  await page.getByRole('button', { name: 'Dodaj posiłek', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Własny produkt' }).click()
  await dialog.getByLabel('Nazwa produktu', { exact: true }).fill('Napój testowy')
  await dialog.getByLabel('Wartości odżywcze na', { exact: true }).selectOption('ml')
  await dialog.getByLabel('Energia (kcal)', { exact: true }).fill('42')
  await dialog.getByLabel(/Kod kreskowy \(opcjonalnie\)/).fill('5901234123458')
  await dialog.getByRole('button', { name: 'Zapisz produkt' }).click()
  await expect(dialog.getByRole('alert')).toContainText('cyfrę kontrolną')
  await dialog.getByLabel(/Kod kreskowy \(opcjonalnie\)/).fill('5901234123457')
  await dialog.getByRole('button', { name: 'Zapisz produkt' }).click()
  await expect(dialog.getByRole('heading', { name: 'Twoja porcja' })).toBeVisible()
  await expect(dialog.getByLabel('Wartości na etykiecie dotyczą')).toHaveValue('ml')
  await dialog.getByLabel('Porcja (ml)', { exact: true }).fill('250')
  await dialog.getByRole('button', { name: 'Dodaj do dziennika' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const meal = (await journal(page)).meals.at(-1)
  expect(meal?.food.unit).toBe('ml')
  expect(meal?.food.nutrients.kcal).toBe(42)
  expect(meal?.food.nutrients.protein).toBeNull()
  expect(meal?.portion).toBe(250)
  await expect(page.getByText('Brak danych w 1 wpisie')).toHaveCount(3)
})

test('water, goals, measurements, complete JSON export and demo reset', async ({ page }, testInfo) => {
  await openDemo(page)
  const amount = (await journal(page)).water.length
  await page.getByRole('button', { name: '250 ml', exact: true }).click()
  await expect.poll(async () => (await journal(page)).water.length).toBe(amount + 1)
  await page.getByRole('button', { name: 'Cofnij ostatni wpis wody' }).click()
  await expect.poll(async () => (await journal(page)).water.length).toBe(amount)
  await navigate(page, '/settings')
  await page.getByLabel('Imię lub pseudonim', { exact: true }).fill('Demo test')
  await page.getByLabel('Energia (kcal / dzień)', { exact: true }).fill('2400')
  await page.getByRole('button', { name: 'Zapisz cele' }).click()
  await expect.poll(async () => (await journal(page)).profile.calorieGoal).toBe(2400)
  await navigate(page, '/progress')
  await page.getByRole('button', { name: 'Dodaj pomiar', exact: true }).click()
  await page.getByRole('dialog').getByLabel('Masa ciała (kg)', { exact: true }).fill('75.5')
  await page.getByRole('dialog').getByRole('button', { name: 'Zapisz pomiar' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('75,5 kg', { exact: true })).toHaveCount(2)
  await page.getByRole('button', { name: '90 dni', exact: true }).click()
  await expect(page.getByRole('button', { name: '90 dni', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await navigate(page, '/settings')
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Eksportuj dane JSON' }).click()
  const download = await downloadEvent
  const output = testInfo.outputPath(download.suggestedFilename())
  await download.saveAs(output)
  const exported = JSON.parse(await readFile(output, 'utf8'))
  expect(exported.mode).toBe('demo')
  expect(exported.data.meals.length).toBe((await journal(page)).meals.length)
  expect(exported.data.profile.calorieGoal).toBe(2400)
  await page.getByRole('button', { name: 'Wyzeruj demo', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Wyzeruj demo', exact: true }).click()
  await expect.poll(async () => (await journal(page)).profile.calorieGoal).toBe(2200)
  await page.getByRole('button', { name: 'Wyjdź z demo', exact: true }).last().click()
  await expect(page.getByRole('heading', { name: 'Dobrze Cię widzieć' })).toBeVisible()
})

test('workout and GPX import, duplicate prevention and deleted import recovery', async ({ page }) => {
  await openDemo(page)
  await navigate(page, '/workouts')
  await page.getByRole('button', { name: 'Dodaj trening', exact: true }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nazwa treningu', { exact: true }).fill('Spacer testowy')
  await dialog.getByLabel('Rodzaj', { exact: true }).selectOption('walk')
  await dialog.getByLabel('Czas (min)', { exact: true }).fill('30')
  await dialog.getByLabel('Dystans (km)').fill('2.5')
  await dialog.getByLabel('Odczuwalny wysiłek (RPE)').fill('3')
  await dialog.getByRole('button', { name: 'Zapisz trening' }).click()
  await expect(page.getByRole('heading', { name: 'Spacer testowy' })).toBeVisible()
  const date = await page.getByLabel('Dzień dziennika', { exact: true }).inputValue()
  const buffer = Buffer.from(`<gpx><trk><name>Import testowy</name><type>running</type><trkseg>
    <trkpt lat="52" lon="21"><time>${date}T10:00:00Z</time></trkpt>
    <trkpt lat="52.01" lon="21"><time>${date}T10:10:00Z</time></trkpt>
  </trkseg></trk></gpx>`)
  async function importFile() {
    await page.getByRole('button', { name: 'Dodaj trening', exact: true }).click()
    const drawer = page.getByRole('dialog')
    await drawer.getByRole('button', { name: 'Import GPX / TCX', exact: true }).click()
    await drawer.getByLabel('Plik aktywności', { exact: true }).setInputFiles({ name: 'test.gpx', mimeType: 'application/gpx+xml', buffer })
    await expect(drawer.getByLabel('Nazwa treningu', { exact: true })).toHaveValue('Import testowy')
    await drawer.getByRole('button', { name: 'Zapisz trening' }).click()
  }
  await importFile()
  await expect(page.getByRole('heading', { name: 'Import testowy' })).toBeVisible()
  await importFile()
  dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('alert')).toContainText('już zaimportowany')
  await dialog.getByRole('button', { name: 'Zamknij panel' }).click()
  await page.getByRole('button', { name: 'Usuń trening: Import testowy' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Usuń wpis', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Import testowy' })).toHaveCount(0)
  await importFile()
  await expect(page.getByRole('heading', { name: 'Import testowy' })).toBeVisible()
})

test('manual barcode remains usable after camera permission denial', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: () => Promise.reject(new DOMException('Test permission denial', 'NotAllowedError')),
    })
  })
  await openDemo(page)
  await page.getByRole('button', { name: 'Dodaj posiłek', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Kod kreskowy', exact: true }).click()
  await dialog.getByRole('button', { name: 'Skanuj aparatem' }).click()
  await expect(dialog.getByRole('alert')).toContainText('Brak zgody')
  await dialog.getByLabel('Kod EAN lub UPC', { exact: true }).fill('4025500132477')
  await dialog.getByRole('button', { name: 'Szukaj', exact: true }).click()
  await expect(dialog.getByRole('button', { name: /Mullermilch Chocolate.*76 kcal/ })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('native barcode result stops and releases the camera stream', async ({ page }) => {
  await page.addInitScript(() => {
    let stopped = 0
    Object.defineProperty(window, 'cameraStops', { get: () => stopped })
    Object.defineProperty(window, 'BarcodeDetector', { value: class {
      static async getSupportedFormats() { return ['ean_13'] }
      async detect() { return [{ rawValue: '4025500132477' }] }
    } })
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => {
      const canvas = document.createElement('canvas')
      canvas.width = 160; canvas.height = 100
      canvas.getContext('2d')?.fillRect(0, 0, 160, 100)
      const stream = canvas.captureStream(10)
      for (const track of stream.getTracks()) {
        const original = track.stop.bind(track)
        track.stop = () => { stopped++; original() }
      }
      return stream
    } })
  })
  await openDemo(page)
  await page.getByRole('button', { name: 'Dodaj posiłek', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Kod kreskowy', exact: true }).click()
  await dialog.getByRole('button', { name: 'Skanuj aparatem' }).click()
  await expect(dialog.getByLabel('Kod EAN lub UPC', { exact: true })).toHaveValue('4025500132477')
  expect(await page.evaluate(() => Reflect.get(window, 'cameraStops'))).toBeGreaterThan(0)
  await expect(dialog.locator('video')).toHaveCount(0)
})

test('corrupted demo is preserved, downloadable, and recoverable without settings', async ({ page }, testInfo) => {
  await page.goto('/login')
  await page.evaluate(() => localStorage.setItem('flexa:demo:v1', '{damaged'))
  await page.goto('/demo')
  await expect(page.getByRole('heading', { name: 'Odzyskaj dostęp do demo' })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('flexa:demo:v1'))).toBe('{damaged')
  const event = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Pobierz surowy zapis demo' }).click()
  const download = await event
  const output = testInfo.outputPath('raw-demo.txt')
  await download.saveAs(output)
  expect(await readFile(output, 'utf8')).toBe('{damaged')
  await page.getByRole('button', { name: 'Wyzeruj demo', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Wyzeruj demo', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dzisiaj, w Twoim rytmie' })).toBeVisible()
})

test('all main pages, dialog, privacy and landing are accessible without overflow', async ({ page }, testInfo) => {
  await page.goto('/login')
  await accessible(page)
  await openDemo(page)
  await accessible(page)
  if (testInfo.project.name === 'mobile') {
    const width = await page.locator('.nutrition-panel').evaluate((node) => node.getBoundingClientRect().width)
    const widths = await page.locator('.dashboard-aside .panel').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().width))
    expect(widths.every((value) => Math.abs(value - width) < 1)).toBe(true)
  }
  await page.getByRole('button', { name: 'Dodaj posiłek', exact: true }).click()
  await accessible(page)
  await page.keyboard.press('Escape')
  for (const route of ['/journal', '/workouts', '/progress', '/settings']) {
    await navigate(page, route)
    await expect(page.locator('main h1')).toBeVisible()
    await accessible(page)
  }
  await page.goto('/privacy')
  await accessible(page)
  await page.goto('http://127.0.0.1:4174')
  await expect(page.getByRole('heading', { name: /Jedzenie.*Ruch.*Twój rytm/ })).toBeVisible()
  await accessible(page)
  await page.getByRole('link', { name: /Zobacz źródła, koszty i granice/ }).click()
  await expect(page.getByRole('heading', { name: /Co jest potrzebne/ })).toBeVisible()
  await accessible(page)
})

test('chart labels retain their physical size and fit at every supported viewport', async ({ page }) => {
  await openDemo(page)
  await navigate(page, '/progress')
  await expect(page.locator('.chart-svg')).toHaveCount(3)
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1050 })
    await expect.poll(async () => page.locator('.chart-svg').evaluateAll((charts) => charts.every((chart) => {
      if (!(chart instanceof SVGSVGElement)) return false
      const bounds = chart.getBoundingClientRect()
      const scale = bounds.width / chart.viewBox.baseVal.width
      return [...chart.querySelectorAll('text')].every((label) => {
        const text = label.getBoundingClientRect()
        return Number.parseFloat(getComputedStyle(label).fontSize) * scale >= 11.9
          && text.left >= bounds.left - 1 && text.right <= bounds.right + 1
      })
    }))).toBe(true)
  }
})
