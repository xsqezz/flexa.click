import { readFile } from 'node:fs/promises'
import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { journalSchema } from '../shared/domain'
import { estimateEnergy } from '../app/src/lib/energy'
import { shiftDate } from '../app/src/lib/dates'
import { mockEmptyCatalog } from './catalog-fixture'

test.beforeEach(async ({ page }) => {
  await mockEmptyCatalog(page)
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
  const link = page.locator(`nav:visible a[href="${route}"]`)
  if (route === '/settings' && await link.count() === 0) await page.getByRole('link', { name: /^Konto i ustawienia:/ }).click()
  else if (route === '/workouts' && await link.count() === 0) {
    await page.locator('nav:visible a[href="/plan"]').first().click()
    await page.getByRole('navigation', { name: 'Widok treningu' }).getByRole('link', { name: 'Historia' }).click()
  } else await link.first().click()
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
  const dialog = page.getByRole('dialog')
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
  await navigate(page, '/meals')
  await expect(page.getByText('Jogurt naturalny', { exact: true }).last()).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Posiłki', exact: true })).toBeVisible()
  expect((await journal(page)).meals.at(-1)?.portion).toBe(200)
  const deleteButtons = page.getByRole('button', { name: 'Usuń: Jogurt naturalny', exact: true })
  const visibleBefore = await deleteButtons.count()
  await deleteButtons.last().click()
  await expect(deleteButtons).toHaveCount(visibleBefore - 1)
  await page.getByRole('status').getByRole('button', { name: 'Cofnij', exact: true }).click()
  await expect(deleteButtons).toHaveCount(visibleBefore)
  expect((await journal(page)).meals).toHaveLength(before + 1)
  await deleteButtons.last().click()
  await expect(deleteButtons).toHaveCount(visibleBefore - 1)
  expect((await journal(page)).meals).toHaveLength(before + 1)
  await page.getByRole('button', { name: 'Zamknij komunikat' }).click()
  await expect.poll(async () => (await journal(page)).meals.length).toBe(before)
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
  await navigate(page, '/goals')
  await expect(page.getByText('Brak danych w 1 wpisie')).toHaveCount(3)
})

test('water, goals, measurements, complete JSON export and demo reset', async ({ page }, testInfo) => {
  await openDemo(page)
  await navigate(page, '/goals')
  const amount = (await journal(page)).water.length
  await page.getByRole('button', { name: '250 ml', exact: true }).click()
  await expect.poll(async () => (await journal(page)).water.length).toBe(amount + 1)
  await page.getByRole('button', { name: 'Cofnij ostatni wpis wody' }).click()
  await expect.poll(async () => (await journal(page)).water.length).toBe(amount)
  await page.locator('.page-toolbar').getByRole('link', { name: 'Rozpocznij nowy cykl' }).click()
  await page.getByLabel('Koniec', { exact: true }).fill('2099-12-31')
  await page.getByLabel('Energia (kcal / dzień)', { exact: true }).fill('2400')
  await page.getByRole('checkbox', { name: /Sprawdziłem/ }).check()
  await page.getByRole('button', { name: 'Zatwierdź cele i rozpocznij cykl' }).click()
  await expect.poll(async () => (await journal(page)).profile.calorieGoal).toBe(2400)
  await expect(page.getByRole('heading', { name: 'Archiwum cykli' })).toBeVisible()
  await navigate(page, '/progress')
  await page.getByRole('button', { name: 'Dodaj pomiar', exact: true }).click()
  await page.getByRole('dialog').getByLabel('Masa ciała (kg)', { exact: true }).fill('75.5')
  await page.getByRole('dialog').getByRole('button', { name: 'Zapisz pomiar' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('cell', { name: '75,5 kg', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '90 dni', exact: true }).click()
  await expect(page.getByRole('button', { name: '90 dni', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await navigate(page, '/settings')
  await page.getByLabel('Imię lub pseudonim', { exact: true }).fill('Demo test')
  await page.getByRole('button', { name: 'Zapisz ustawienia' }).click()
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Eksportuj dane JSON' }).click()
  const download = await downloadEvent
  const output = testInfo.outputPath(download.suggestedFilename())
  await download.saveAs(output)
  const exported = JSON.parse(await readFile(output, 'utf8'))
  expect(exported.mode).toBe('demo')
  expect(exported.data.meals.length).toBe((await journal(page)).meals.length)
  expect(exported.data.profile.calorieGoal).toBe(2400)
  expect(exported.data.goals.cycles).toHaveLength(2)
  await page.getByRole('button', { name: 'Wyzeruj demo', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Wyzeruj demo', exact: true }).click()
  await expect.poll(async () => (await journal(page)).profile.calorieGoal).toBe(2200)
  await page.getByRole('button', { name: 'Wyjdź z demo', exact: true }).last().click()
  await expect(page.getByRole('heading', { name: 'Dobrze Cię widzieć' })).toBeVisible()
})

test('seven destinations have one owner each, and old journal links still open Meals', async ({ page }) => {
  await openDemo(page)
  expect((await page.locator('.mobile-nav a, .mobile-nav button').allTextContents()).map((label) => label.trim()))
    .toEqual(['Dzisiaj', 'Cele', 'Posiłki', 'Dodaj', 'Treningi', 'Kuchnia', 'Postępy'])
  expect((await page.locator('.main-nav a').allTextContents()).slice(0, 6).map((label) => label.trim()))
    .toEqual(['Dzisiaj', 'Cele', 'Posiłki', 'Treningi', 'Kuchnia', 'Postępy'])
  await expect(page.locator('.nutrition-panel, .meal-group, .water-panel')).toHaveCount(0)
  await navigate(page, '/goals')
  await expect(page.locator('.nutrition-panel, .water-panel')).toHaveCount(2)
  await expect(page.locator('.meal-group')).toHaveCount(0)
  await navigate(page, '/meals')
  await expect(page.locator('.meal-group')).toHaveCount(4)
  await expect(page.locator('.nutrition-panel, .water-panel')).toHaveCount(0)
  await page.goto('/journal')
  await expect(page).toHaveURL(/\/meals$/)
  await navigate(page, '/progress')
  await expect(page.getByRole('heading', { name: 'Energia w dzienniku' })).toHaveCount(0)
  await accessible(page)
})

test('cycle approval keeps the earlier calorie history, target weight and expired-cycle prompt', async ({ page }) => {
  await openDemo(page)
  const currentDay = await browserToday(page)
  await navigate(page, '/goals')
  await page.locator('.page-toolbar').getByRole('link', { name: 'Rozpocznij nowy cykl' }).click()
  await page.getByRole('radio', { name: /^Budowa mięśni/ }).check()
  await page.getByLabel('Koniec', { exact: true }).fill('2099-12-31')
  await page.getByLabel('Masa docelowa (kg)').fill('77')
  await page.getByLabel('Energia (kcal / dzień)').fill('2600')
  await page.getByRole('checkbox', { name: /Sprawdziłem/ }).check()
  expect((await journal(page)).profile.calorieGoal).toBe(2200)
  await page.getByRole('button', { name: 'Zatwierdź cele i rozpocznij cykl' }).click()
  await expect(page.getByRole('heading', { name: 'Cele', exact: true })).toBeVisible()
  expect((await journal(page)).goals.cycles).toMatchObject([{ kind: 'reduction', status: 'completed' }, { kind: 'muscle_gain', status: 'active' }])
  await expect(page.locator('.goals-cycles')).toContainText('Redukcja')
  const day = page.getByLabel('Dzień dziennika', { exact: true })
  await day.fill(shiftDate(currentDay, -1))
  expect((await page.locator('.energy-value').innerText()).replace(/\s/g, '')).toContain('/2200kcal')
  await day.fill(currentDay)
  expect((await page.locator('.energy-value').innerText()).replace(/\s/g, '')).toContain('/2600kcal')
  await page.getByText('Zmień masę docelową', { exact: true }).click()
  await page.getByLabel('Masa docelowa (kg)').fill('76.5')
  await page.getByRole('button', { name: 'Zapisz wagę docelową' }).click()
  await expect.poll(async () => (await journal(page)).profile.targetWeight).toBe(76.5)
  expect((await journal(page)).goals.cycles[0].targetWeightKg).toBe(72)

  await page.evaluate((expired) => {
    const key = 'flexa:demo:v1'
    const data = JSON.parse(localStorage.getItem(key) ?? '{}')
    const active = data.goals.cycles.find((cycle: { status: string }) => cycle.status === 'active')
    active.startDate = expired
    active.endDate = expired
    localStorage.setItem(key, JSON.stringify(data))
  }, shiftDate(currentDay, -1))
  await page.reload()
  await expect(page.getByText(/Cykl zakończył się/)).toBeVisible()
  expect((await journal(page)).profile.calorieGoal).toBe(2600)
  expect((await page.locator('.energy-value').innerText()).replace(/\s/g, '')).toContain('/2600kcal')
  await expect(page.locator('.goals-cycles')).toContainText('okres minął, cele pozostały bez zmian')
})

test('settings offer the Android app in a browser', async ({ page }) => {
  await openDemo(page)
  await navigate(page, '/settings')
  await expect(page.getByRole('heading', { name: 'Aplikacja na Androida' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Pobierz Flexa (APK)' }))
    .toHaveAttribute('href', 'https://github.com/xsqezz/flexa.click/releases/latest/download/flexa.apk')
  await expect(page.getByRole('button', { name: 'Sprawdź aktualizacje' })).toHaveCount(0)
})

test.describe('inside the Android app', () => {
  test.use({ userAgent: 'Mozilla/5.0 (Linux; Android 16; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36 FlexaAndroid/1.2.3' })

  test('shows the version, checks for updates and hands exports to the native save dialog', async ({ page }) => {
    await page.addInitScript(() => {
      const messages: string[] = []
      Object.assign(window, { nativeMessages: messages, flexaNative: { postMessage: (message: string) => messages.push(message) } })
    })
    await openDemo(page)
    await navigate(page, '/settings')
    await expect(page.getByText('Korzystasz z aplikacji Flexa na Androida, wersja 1.2.3.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Pobierz Flexa (APK)' })).toHaveCount(0)
    await accessible(page)
    await page.getByRole('button', { name: 'Sprawdź aktualizacje' }).click()
    await page.getByRole('button', { name: 'Eksportuj dane JSON' }).click()
    const messages = await page.evaluate(() => (window as unknown as { nativeMessages: string[] }).nativeMessages
      .map((message) => JSON.parse(message) as Record<string, string>).filter((message) => !message.type.startsWith('reminders.')))
    expect(messages).toHaveLength(2)
    expect(messages[0]).toEqual({ type: 'check-update' })
    expect(messages[1]).toMatchObject({ type: 'save-file', mime: 'application/json' })
    expect(messages[1].name).toMatch(/^flexa-demo-\d{4}-\d{2}-\d{2}\.json$/)
    expect((JSON.parse(messages[1].text) as { mode: string }).mode).toBe('demo')
  })

  test.describe('version 1.0.1', () => {
    test.use({ userAgent: 'Mozilla/5.0 (Linux; Android 16; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36 FlexaAndroid/1.0.1' })

    test('asks to update the app before reminders can be turned on', async ({ page }) => {
      await page.addInitScript(() => {
        const messages: string[] = []
        Object.assign(window, { nativeMessages: messages, flexaNative: { postMessage: (message: string) => messages.push(message) } })
      })
      await openDemo(page)
      await navigate(page, '/settings')
      await expect(page.getByText('Zaktualizuj aplikację, aby włączyć przypomnienia')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Sprawdź aktualizacje' })).toBeVisible()
      await expect(page.getByRole('region', { name: 'Przypomnienia' })).toHaveCount(0)
      expect(await page.evaluate(() => (window as unknown as { nativeMessages: string[] }).nativeMessages)).toEqual([])
    })
  })

  test.describe('version 1.1.0', () => {
    test.use({ userAgent: 'Mozilla/5.0 (Linux; Android 16; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36 FlexaAndroid/1.1.0' })

    test('sets up training and water reminders through the app', async ({ page }) => {
      await page.addInitScript(() => {
        type Message = Record<string, unknown> & { type: string; id?: string }
        const sent: Message[] = []
        let state: Record<string, unknown> = {
          training: { enabled: false, time: '18:00', weekdays: [] }, water: { enabled: false, from: '09:00', to: '21:00', everyHours: 2 },
        }
        const native: { postMessage: (raw: string) => void; onmessage: ((event: { data: string }) => void) | null } = {
          onmessage: null,
          postMessage: (raw) => {
            const message = JSON.parse(raw) as Message
            sent.push(message)
            if (message.type === 'reminders.set') state = { training: message.training, water: message.water }
            if (message.type !== 'reminders.get' && message.type !== 'reminders.set') return
            const permission = (window as unknown as { mockPermission: string }).mockPermission
            setTimeout(() => native.onmessage?.({ data: JSON.stringify({ type: 'reminders.state', id: message.id, ...state, permission, supported: true }) }), 20)
          },
        }
        Object.assign(window, { nativeMessages: sent, mockPermission: 'default', flexaNative: native })
      })
      await openDemo(page)
      const plan = (await journal(page)).training.plan
      expect(plan).not.toBeNull()
      const planDays = (plan?.sessions ?? []).map((session) => session.weekday).sort((a, b) => a - b)
      await navigate(page, '/settings')
      const panel = page.getByRole('region', { name: 'Przypomnienia' })
      await expect(panel.getByRole('checkbox', { name: /Przypomnienie o treningu/ })).not.toBeChecked()
      await panel.getByRole('checkbox', { name: /Przypomnienie o treningu/ }).check()
      await expect(panel.getByText('Dni z Twojego planu:')).toBeVisible()
      await panel.getByLabel('Godzina przypomnienia').fill('07:30')
      await panel.getByRole('checkbox', { name: /Przypomnienie o wodzie/ }).check()
      await panel.getByLabel('Jak często').selectOption('3')
      await page.evaluate(() => Object.assign(window, { mockPermission: 'granted' }))
      await panel.getByRole('button', { name: 'Zapisz przypomnienia' }).click()
      await expect(page.getByRole('status').filter({ hasText: 'Przypomnienia zapisane.' })).toBeVisible()
      await accessible(page)

      const sent = await page.evaluate(() => (window as unknown as { nativeMessages: Record<string, unknown>[] }).nativeMessages)
      const saved = sent.find((message) => message.type === 'reminders.set') as {
        training: { enabled: boolean; time: string; weekdays: number[]; sessions: { weekday: number; name: string; minutes: number }[] }
        water: { enabled: boolean; from: string; to: string; everyHours: number }
      }
      expect(saved.training).toMatchObject({ enabled: true, time: '07:30', weekdays: planDays })
      expect(saved.training.sessions.map((session) => session.weekday).sort((a, b) => a - b)).toEqual(planDays)
      expect(saved.training.sessions[0].name).toMatch(/^Dzień 1: /)
      expect(saved.water).toEqual({ enabled: true, from: '09:00', to: '21:00', everyHours: 3 })

      await page.evaluate(() => Object.assign(window, { mockPermission: 'denied' }))
      await panel.getByRole('button', { name: 'Zapisz przypomnienia' }).click()
      await expect(panel.getByRole('alert')).toContainText('Android blokuje powiadomienia Flexa')
      await panel.getByRole('button', { name: 'Otwórz ustawienia powiadomień' }).click()
      const last = await page.evaluate(() => (window as unknown as { nativeMessages: Record<string, unknown>[] }).nativeMessages.at(-1))
      expect(last).toEqual({ type: 'reminders.open-settings' })
    })
  })
})

test('quick add, search and day navigation work from any screen', async ({ page }, testInfo) => {
  await openDemo(page)
  const water = (await journal(page)).water.length
  await navigate(page, '/progress')
  await page.getByRole('button', { name: 'Dodaj', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'Dodaj' })
  await sheet.getByRole('button', { name: /Woda \+250 ml/ }).click()
  await expect(sheet).toHaveCount(0)
  await expect(page.getByRole('status')).toContainText('Dodano 250 ml wody')
  expect((await journal(page)).water).toHaveLength(water + 1)
  await page.getByRole('button', { name: 'Dodaj', exact: true }).click()
  await page.getByRole('dialog', { name: 'Dodaj' }).getByRole('button', { name: /Skanuj kod kreskowy/ }).click()
  await expect(page.getByRole('dialog', { name: 'Dodaj posiłek' }).getByRole('button', { name: 'Kod kreskowy', pressed: true })).toBeVisible()
  await page.keyboard.press('Escape')

  await page.keyboard.press('Control+k')
  const search = page.getByRole('combobox', { name: 'Szukaj stron, akcji i wpisów' })
  await search.fill('jogurt')
  await expect(page.getByRole('option', { name: /Jogurt naturalny/ }).first()).toBeVisible()
  await search.fill('postepy')
  await expect(page.getByRole('option').first()).toContainText('Postępy')
  await search.fill('plan treningowy')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/plan$/)
  await expect(page.getByRole('navigation', { name: 'Widok treningu' }).getByRole('link', { name: 'Plan' })).toHaveAttribute('aria-current', 'page')

  await navigate(page, '/meals')
  const day = page.getByLabel('Dzień dziennika', { exact: true })
  const start = await day.inputValue()
  await page.locator('main h1').click()
  await page.keyboard.press('ArrowLeft')
  await expect(day).not.toHaveValue(start)
  await page.keyboard.press('t')
  await expect(day).toHaveValue(start)
  const strip = page.getByRole('navigation', { name: /^Tydzień od/ })
  await strip.getByRole('button', { name: 'Poprzedni tydzień' }).click()
  await expect(day).not.toHaveValue(start)
  await strip.getByRole('button', { name: 'Następny tydzień' }).click()
  await expect(day).toHaveValue(start)
  if (testInfo.project.name === 'mobile') {
    const box = await page.locator('main h1').boundingBox()
    if (!box) throw new Error('missing heading')
    const y = box.y + box.height / 2
    await page.touchscreen.tap(box.x + 5, y)
    await page.evaluate(({ y }) => {
      const main = document.querySelector('main') as HTMLElement
      const touch = (x: number) => new Touch({ identifier: 1, target: main, clientX: x, clientY: y })
      main.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [touch(300)], changedTouches: [touch(300)] }))
      main.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [touch(120)] }))
    }, { y })
    await expect(day).not.toHaveValue(start)
  }
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
  await expect(page.getByRole('heading', { name: 'Import testowy' })).toHaveCount(0)
  await expect(page.getByRole('status')).toContainText('Usunięto trening „Import testowy”')
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

test('guided workout shows one step at a time, rests with a stopwatch, resumes and logs the session', async ({ page }) => {
  await page.clock.install()
  const youtube: string[] = []
  await page.route('https://www.youtube-nocookie.com/**', (route) => { youtube.push(route.request().url()); return route.abort() })
  await openDemo(page)
  await navigate(page, '/plan')
  await expect(page.getByRole('heading', { name: 'Twój plan treningowy', exact: true })).toBeVisible()
  await expect(page.locator('.plan-day')).toHaveCount(3)
  await page.getByRole('link', { name: /^piątek.*rozpocznij/ }).click()
  const done = page.getByRole('button', { name: 'Skończone', exact: true })
  await expect(done).toBeVisible()
  await expect(page.locator('main h1')).toHaveCount(1)
  await expect(page.getByText(/^Rozgrzewka · krok 1 z \d+$/)).toBeVisible()
  await expect(page.locator('iframe')).toHaveCount(0)
  await page.getByRole('button', { name: /^Odtwórz film/ }).click()
  await expect(page.locator('iframe')).toHaveAttribute('src', /^https:\/\/www\.youtube-nocookie\.com\/embed\/[\w-]{11}\?rel=0&playsinline=1&autoplay=1$/)
  await done.click()
  await expect(page.getByText(/^Rozgrzewka · krok 2 z \d+$/)).toBeVisible()
  await page.reload()
  await expect(page.getByText('Wznowiono trening od kroku 2.')).toBeVisible()
  await page.getByRole('button', { name: 'Lista kroków treningu' }).click()
  await page.getByRole('dialog').getByRole('button', { name: /^A · / }).first().click()
  await expect(page.getByText('Seria 1 z 3', { exact: true })).toBeVisible()
  const exercise = await page.locator('main h1').innerText()
  await done.click()
  await expect(page.getByRole('heading', { name: 'Chwila przerwy', exact: true })).toBeVisible()
  const timer = page.getByRole('timer', { name: /^Pozostało/ })
  await expect(timer).toHaveText(/^1:[23]\d$/)
  await page.getByRole('button', { name: '+15 s', exact: true }).click()
  await expect(timer).toHaveText(/^1:4\d$/)
  await page.clock.fastForward('01:50')
  await expect(page.getByRole('heading', { name: exercise, exact: true })).toBeVisible()
  await expect(page.getByText('Seria 2 z 3', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Pomiń to ćwiczenie' }).click()
  await expect(page.locator('main h1')).not.toHaveText(exercise)
  await page.getByRole('link', { name: /Wyjdź z treningu/ }).click()
  await page.getByRole('link', { name: /^Wznów · krok \d+ z \d+$/ }).click()
  await page.getByRole('button', { name: 'Lista kroków treningu' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Zakończ trening teraz' }).click()
  await expect(page.getByRole('heading', { name: 'Trening zakończony', exact: true })).toBeVisible()
  const before = (await journal(page)).workouts.length
  await page.getByRole('button', { name: 'Zapisz w dzienniku' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Zapisz trening z planu' })).toBeVisible()
  await expect(dialog.getByLabel('Nazwa treningu', { exact: true })).toHaveValue(/^Dzień 3: Całe ciało C/)
  await dialog.getByRole('button', { name: 'Zapisz trening' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const workouts = (await journal(page)).workouts
  expect(workouts).toHaveLength(before + 1)
  expect(workouts.at(-1)).toMatchObject({ kind: 'strength', name: expect.stringMatching(/^Dzień 3/) })
  expect(youtube.every((url) => url.startsWith('https://www.youtube-nocookie.com/embed/'))).toBe(true)
  await page.getByRole('link', { name: 'Wróć do planu' }).click()
  await expect(page.getByRole('link', { name: /^Wznów/ })).toHaveCount(0)
})

test('demo plan rebuilds from new answers', async ({ page }) => {
  await openDemo(page)
  await navigate(page, '/plan')
  await page.getByRole('link', { name: 'Zmień odpowiedzi' }).click()
  await expect(page.getByRole('heading', { name: 'Kilka słów o Tobie', exact: true })).toBeVisible()
  const age = page.getByRole('textbox', { name: 'Ile masz lat?' })
  await expect(age).toHaveValue('32')
  const next = page.getByRole('button', { name: 'Dalej', exact: true })
  await age.fill('')
  await next.click()
  await expect(page.getByRole('alert')).toContainText('od 16 do 99 lat')
  await age.fill('16')
  await next.click()
  await page.getByRole('radio', { name: /^Siła/ }).check()
  await next.click()
  await page.getByRole('radio', { name: /^Siłownia/ }).check()
  await next.click()
  await expect(page.getByRole('heading', { name: 'Jakie masz doświadczenie?', exact: true })).toBeVisible()
  await page.getByRole('radio', { name: /^Średniozaawansowany/ }).check()
  await next.click()
  await page.getByRole('button', { name: 'sobota', exact: true }).click()
  await page.getByText('60 min', { exact: true }).click()
  await next.click()
  await page.getByText('Nie', { exact: true }).click()
  await next.click()
  await page.getByRole('button', { name: 'Utwórz mój plan' }).click()
  await expect(page.getByRole('heading', { name: 'Twój plan treningowy', exact: true })).toBeVisible()
  await expect(page.locator('.plan-day')).toHaveCount(4)
  await expect(page.getByText(/Osoby niepełnoletnie/)).toBeVisible()
  expect((await journal(page)).training.plan?.answers).toMatchObject({ age: 16, goal: 'strength', place: 'gym', equipment: [], weekdays: [0, 2, 4, 5], minutes: 60 })
  await page.goto('/goals/new')
  await expect(page.getByRole('radio', { name: /^Własny cel/ })).toBeVisible()
  await expect(page.getByRole('radio', { name: /^Redukcja|^Budowa mięśni/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Oblicz propozycję' })).toHaveCount(0)
  await expect(page.getByText(/Osoby w wieku 16–17 lat/)).toBeVisible()
  await page.getByLabel('Koniec', { exact: true }).fill('2099-12-31')
  await page.getByRole('checkbox', { name: /Sprawdziłem/ }).check()
  await page.getByRole('button', { name: 'Zatwierdź cele i rozpocznij cykl' }).click()
  await expect(page.getByRole('heading', { name: 'Cele', exact: true })).toBeVisible()
  expect((await journal(page)).goals.cycles.at(-1)?.kind).toBe('manual')
})

test('all main pages, dialog, privacy and landing are accessible without overflow', async ({ page }, testInfo) => {
  await page.goto('/login')
  await accessible(page)
  await openDemo(page)
  await accessible(page)
  if (testInfo.project.name === 'mobile') {
    await navigate(page, '/goals')
    const width = await page.locator('.nutrition-panel').evaluate((node) => node.getBoundingClientRect().width)
    const widths = await page.locator('.dashboard-aside .panel').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().width))
    expect(widths.every((value) => Math.abs(value - width) < 1)).toBe(true)
    await navigate(page, '/')
  }
  await page.getByRole('button', { name: 'Dodaj posiłek', exact: true }).click()
  await accessible(page)
  await page.keyboard.press('Escape')
  for (const route of ['/goals', '/meals', '/kitchen', '/plan', '/workouts', '/progress', '/settings']) {
    await navigate(page, route)
    await expect(page.locator('main h1')).toBeVisible()
    await accessible(page)
  }
  await page.getByRole('button', { name: 'Dodaj', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Dodaj' })).toBeVisible()
  await accessible(page)
  await page.keyboard.press('Escape')
  await page.keyboard.press('Control+k')
  await expect(page.getByRole('combobox', { name: 'Szukaj stron, akcji i wpisów' })).toBeFocused()
  await accessible(page)
  await page.keyboard.press('Escape')
  await page.goto('/about')
  await expect(page.getByRole('heading', { name: 'O Flexa', level: 1 })).toBeVisible()
  await accessible(page)
  await page.getByRole('link', { name: 'Wróć do aplikacji' }).click()
  await navigate(page, '/plan')
  await page.getByRole('link', { name: 'Rozpocznij trening' }).first().click()
  await expect(page.getByRole('button', { name: 'Skończone', exact: true })).toBeVisible()
  await accessible(page)
  await page.getByRole('button', { name: 'Lista kroków treningu' }).click()
  await accessible(page)
  await page.getByRole('dialog').getByRole('button', { name: /^A · / }).first().click()
  await page.getByRole('button', { name: 'Skończone', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Chwila przerwy', exact: true })).toBeVisible()
  await accessible(page)
  await page.getByRole('button', { name: 'Pomiń przerwę' }).click()
  await page.getByRole('link', { name: /Wyjdź z treningu/ }).click()
  await navigate(page, '/plan')
  await page.getByRole('link', { name: 'Zmień odpowiedzi' }).click()
  for (const heading of ['Kilka słów o Tobie', 'Jaki jest Twój główny cel?', 'Gdzie będziesz trenować?', 'Jaki sprzęt masz pod ręką?', 'Jakie masz doświadczenie?', 'Kiedy i jak długo chcesz trenować?', 'Zdrowie i ograniczenia', 'Sprawdź odpowiedzi']) {
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    if (['Kilka słów o Tobie', 'Jaki sprzęt masz pod ręką?', 'Kiedy i jak długo chcesz trenować?', 'Sprawdź odpowiedzi'].includes(heading)) await accessible(page)
    if (heading === 'Zdrowie i ograniczenia') {
      await page.getByText('Tak', { exact: true }).click()
      await expect(page.getByRole('checkbox', { name: /Lekarz zgodził się/ })).toBeVisible()
      await accessible(page)
      await page.getByText('Nie', { exact: true }).click()
    }
    if (heading !== 'Sprawdź odpowiedzi') await page.getByRole('button', { name: 'Dalej', exact: true }).click()
  }
  await page.goto('/privacy')
  await accessible(page)
  await page.goto('http://127.0.0.1:4174')
  await expect(page.getByRole('heading', { name: /Jedzenie.*Ruch.*Twój rytm/ })).toBeVisible()
  await expect(page.locator('#android').getByRole('link', { name: /Pobierz Flexa \(\.apk\)/ }))
    .toHaveAttribute('href', 'https://github.com/xsqezz/flexa.click/releases/latest/download/flexa.apk')
  await accessible(page)
  await page.getByRole('link', { name: /Zobacz źródła, koszty i granice/ }).click()
  await expect(page.getByRole('heading', { name: /Co jest potrzebne/ })).toBeVisible()
  await accessible(page)
})

test('chart labels retain their physical size and fit at every supported viewport', async ({ page }) => {
  await openDemo(page)
  await navigate(page, '/progress')
  await expect(page.locator('.chart-svg')).toHaveCount(2)
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

async function chooseProducts(page: Page, products: readonly (readonly [string, string])[]) {
  const search = page.getByRole('searchbox', { name: 'Szukaj produktu' })
  for (const [query, name] of products) {
    await search.fill(query)
    await page.getByRole('button', { name, exact: true }).click()
  }
  await search.fill('')
}

test('Smart Kuchnia builds a recipe from chosen products, swaps an ingredient and logs the dish', async ({ page }) => {
  await openDemo(page)
  await navigate(page, '/kitchen')
  await expect(page.getByRole('heading', { name: 'Smart Kuchnia', level: 1 })).toBeVisible()
  await expect(page.getByText(/Rozpoznawanie produktów ze zdjęcia działa po zalogowaniu/)).toBeVisible()
  const next = page.getByRole('button', { name: 'Dalej: preferencje' })
  await expect(next).toBeDisabled()
  await chooseProducts(page, [['kurczak', 'Pierś z kurczaka'], ['brokuł', 'Brokuł'], ['ryż', 'Ryż biały'], ['cebul', 'Cebula'], ['czosnek', 'Czosnek']])
  const owned = page.getByRole('group', { name: 'Wybrane produkty' }).getByRole('button')
  await expect(owned).toHaveCount(5)
  await accessible(page)
  await next.click()
  await expect(page.getByRole('heading', { name: 'Kilka szybkich pytań', level: 2 })).toBeVisible()
  await page.getByRole('button', { name: '45 min', exact: true }).click()
  await page.getByRole('radio', { name: /^Dużo białka/ }).check()
  await accessible(page)
  await page.getByRole('button', { name: 'Pokaż przepis' }).click()
  const title = page.getByRole('heading', { level: 3 }).first()
  await expect(title).toContainText(/kurczaka/i)
  await expect(page.locator('.kitchen-macros dd').first()).toHaveText(/^\d[\d\s\u00a0]*kcal$/)
  await expect(page.locator('.kitchen-steps li')).not.toHaveCount(0)
  await expect(page.getByText(/szacunkowe — liczone z surowych składników/)).toBeVisible()
  await expect(page.getByText(/Ilustracja składników/)).toBeVisible()
  await accessible(page)
  await page.getByRole('button', { name: 'Zamień składnik: pierś z kurczaka' }).click()
  const swap = page.getByRole('dialog')
  await expect(swap.getByRole('heading', { name: 'Zamień: pierś z kurczaka' })).toBeVisible()
  await accessible(page)
  await swap.locator('.kitchen-swaps button').first().click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Zamień składnik: pierś z kurczaka' })).toHaveCount(0)
  await expect(title).not.toContainText(/pierś z kurczaka/i)
  const recipeTitle = (await title.innerText()).trim()
  const before = (await journal(page)).meals.length
  await page.getByRole('button', { name: 'Dodaj do dziennika', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Dodaj do dziennika' })).toBeVisible()
  await accessible(page)
  await dialog.getByLabel('Posiłek', { exact: true }).selectOption('dinner')
  await dialog.getByLabel('Ile porcji zjadłeś?').fill('0')
  await dialog.getByRole('button', { name: 'Dodaj do dziennika' }).click()
  await expect(dialog.getByRole('alert')).toContainText('od 0,5 do 4')
  await dialog.getByLabel('Ile porcji zjadłeś?').fill('1,5')
  await dialog.getByRole('button', { name: 'Dodaj do dziennika' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const meals = (await journal(page)).meals
  expect(meals).toHaveLength(before + 1)
  expect(meals.at(-1)).toMatchObject({ meal: 'dinner', food: { name: recipeTitle, brand: 'Flexa Smart Kuchnia', source: 'custom' } })
  await page.getByRole('button', { name: 'Inny przepis', exact: false }).click()
  await expect(title).not.toHaveText(recipeTitle)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Co masz w domu?', level: 2 })).toBeVisible()
  await expect(owned).toHaveCount(5)
})

test('Smart Kuchnia respects what the user does not eat and explains when nothing fits', async ({ page }) => {
  await openDemo(page)
  await navigate(page, '/kitchen')
  await chooseProducts(page, [['kurczak', 'Pierś z kurczaka'], ['brokuł', 'Brokuł'], ['ryż brąz', 'Ryż brązowy']])
  await page.getByRole('button', { name: 'Dalej: preferencje' }).click()
  await page.getByRole('button', { name: '15 min', exact: true }).click()
  await page.getByRole('button', { name: 'Mięso', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Mięso', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Garnek', exact: true }).click()
  await page.getByRole('button', { name: 'Patelnia', exact: true }).click()
  await expect(page.getByText('Wybierz przynajmniej jedno urządzenie')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pokaż przepis' })).toBeDisabled()
  await page.getByRole('button', { name: 'Patelnia', exact: true }).click()
  await page.getByRole('button', { name: 'Pokaż przepis' }).click()
  await expect(page.getByRole('status').filter({ hasText: /^W 15 minut nie zmieszczę żadnego dania/ })).toBeVisible()
  await expect(page.getByRole('heading', { level: 3 }).first()).not.toContainText(/kurczaka/i)
  await expect(page.locator('.kitchen-ingredient', { hasText: /Pierś z kurczaka/ })).toHaveCount(0)
  await accessible(page)
  await page.getByRole('button', { name: 'Zmień preferencje' }).click()
  await page.getByRole('button', { name: 'Wstecz' }).click()
  await page.getByRole('button', { name: 'Wyczyść listę' }).click()
  await chooseProducts(page, [['brokuł', 'Brokuł']])
  await page.getByRole('button', { name: 'Dalej: preferencje' }).click()
  await page.getByRole('button', { name: 'Pokaż przepis' }).click()
  await expect(page.getByText(/nie umiem jeszcze ułożyć pełnego dania/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Zmień produkty' })).toBeVisible()
  await accessible(page)
})

const browserToday = (page: Page) => page.evaluate(() => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
})

test('guided workout records optional reps and load, keeps them on resume and logs them with the session', async ({ page }) => {
  await openDemo(page)
  await navigate(page, '/plan')
  await page.getByRole('link', { name: /^poniedziałek.*rozpocznij/ }).click()
  await page.getByRole('button', { name: 'Lista kroków treningu' }).click()
  await page.getByRole('dialog').getByRole('button', { name: /^A · / }).first().click()
  const reps = page.getByRole('spinbutton', { name: 'Powtórzenia', exact: true })
  await expect(reps).toBeVisible()
  await expect(page.getByText(/Wpisano wartości z ostatniego zapisu/)).toBeVisible()
  await expect(reps).not.toHaveValue('')
  await accessible(page)
  await reps.fill('7')
  await page.reload()
  await expect(page.getByText(/^Wznowiono trening/)).toBeVisible()
  await expect(page.getByRole('spinbutton', { name: 'Powtórzenia', exact: true })).toHaveValue('7')
  await page.getByRole('button', { name: 'Skończone', exact: true }).click()
  await page.getByRole('button', { name: 'Lista kroków treningu' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Zakończ trening teraz' }).click()
  await expect(page.getByText('Serie z wynikiem', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Zapisz w dzienniku' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Seria 1: powtórzenia', { exact: true })).toHaveValue('7')
  await dialog.getByRole('button', { name: 'Zapisz trening' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const logged = (await journal(page)).workouts.at(-1)
  expect(logged?.sets).toHaveLength(1)
  expect(logged?.sets?.[0]).toMatchObject({ reps: 7, seconds: null })
})

test('a logged workout repeats today, strength sets can be added by hand and exercise history summarises them', async ({ page }) => {
  await openDemo(page)
  await navigate(page, '/workouts')
  const before = (await journal(page)).workouts.length
  await page.getByRole('button', { name: 'Powtórz dziś: Trening całego ciała' }).first().click()
  let dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Powtórz trening' })).toBeVisible()
  await expect(dialog.getByLabel('Nazwa treningu', { exact: true })).toHaveValue('Trening całego ciała')
  await expect(dialog.getByLabel('Rodzaj', { exact: true })).toHaveValue('strength')
  await expect(dialog.getByLabel('Seria 1: ćwiczenie', { exact: true })).not.toHaveValue('')
  await dialog.getByLabel('Seria 1: powtórzenia', { exact: true }).fill('11')
  await accessible(page)
  await dialog.getByRole('button', { name: 'Zapisz trening' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  let workouts = (await journal(page)).workouts
  expect(workouts).toHaveLength(before + 1)
  expect(workouts.at(-1)).toMatchObject({ kind: 'strength', name: 'Trening całego ciała', date: await browserToday(page) })
  expect(workouts.at(-1)?.sets?.[0].reps).toBe(11)

  await page.getByRole('button', { name: 'Dodaj trening', exact: true }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nazwa treningu', { exact: true }).fill('Siłownia wieczorem')
  await dialog.getByLabel('Rodzaj', { exact: true }).selectOption('strength')
  await dialog.getByLabel('Czas (min)', { exact: true }).fill('35')
  await dialog.getByRole('button', { name: 'Dodaj serię' }).click()
  await dialog.getByLabel('Seria 1: ćwiczenie', { exact: true }).fill('Wyciskanie na wyciągu')
  await dialog.getByLabel('Seria 1: powtórzenia', { exact: true }).fill('10')
  await dialog.getByLabel('Seria 1: ciężar w kg', { exact: true }).fill('30')
  await dialog.getByRole('button', { name: 'Dodaj serię' }).click()
  await expect(dialog.getByLabel('Seria 2: ciężar w kg', { exact: true })).toHaveValue('30')
  await dialog.getByLabel('Seria 2: powtórzenia', { exact: true }).fill('8')
  await dialog.getByRole('button', { name: 'Zapisz trening' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  workouts = (await journal(page)).workouts
  expect(workouts.at(-1)?.sets).toEqual([
    { exercise: 'Wyciskanie na wyciągu', reps: 10, weightKg: 30, seconds: null },
    { exercise: 'Wyciskanie na wyciągu', reps: 8, weightKg: 30, seconds: null },
  ])

  await page.getByRole('link', { name: /^Historia ćwiczeń/ }).click()
  await expect(page.getByRole('heading', { name: 'Historia ćwiczeń', level: 1 })).toBeVisible()
  await expect(page.getByText(/szacunek/).first()).toBeVisible()
  await accessible(page)
  await page.getByRole('link', { name: 'Wyciskanie na wyciągu' }).click()
  await expect(page.getByRole('heading', { name: 'Wyciskanie na wyciągu', level: 1 })).toBeVisible()
  await expect(page.getByText('Najcięższa seria', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('cell', { name: '10 × 30 kg, 8 × 30 kg' })).toBeVisible()
  await accessible(page)
})

test('progress shows a 7-day weight trend and optional body measurements without calorie summaries', async ({ page }) => {
  await openDemo(page)
  await navigate(page, '/progress')
  await expect(page.getByRole('region', { name: 'Twój tydzień' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Energia w dzienniku' })).toHaveCount(0)
  await expect(page.getByText('Średnia z 7 dni', { exact: true })).toBeVisible()
  await page.getByText('Dane wykresu — masa ciała').click()
  await expect(page.getByRole('columnheader', { name: 'Średnia z 7 dni (kg)' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Talia', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Dodaj pomiar', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Obwód talii (cm)', { exact: true })).toHaveValue('83')
  await dialog.getByLabel('Obwód talii (cm)', { exact: true }).fill('81.5')
  await dialog.getByLabel('Obwód bioder (cm)', { exact: true }).fill('97')
  await accessible(page)
  await dialog.getByRole('button', { name: 'Zapisz pomiar' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('cell', { name: '81,5 cm', exact: true })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Biodra', exact: true })).toBeVisible()
  const today = await browserToday(page)
  expect((await journal(page)).measurements.find((item) => item.date === today)).toMatchObject({ waistCm: 81.5, hipsCm: 97 })
  await accessible(page)
})

test('meals copy from yesterday, reuse the last portion and become one-tap templates', async ({ page }) => {
  await openDemo(page)
  await navigate(page, '/meals')
  const today = await browserToday(page)
  const dinnerToday = async () => (await journal(page)).meals.filter((meal) => meal.date === today && meal.meal === 'dinner')
  expect(await dinnerToday()).toHaveLength(0)
  await page.getByRole('button', { name: 'Kopiuj z wczoraj: Kolacja (3 pozycje)' }).click()
  await expect.poll(async () => (await dinnerToday()).length).toBe(3)
  await expect(page.getByRole('button', { name: /^Kopiuj z wczoraj: Kolacja/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Kopiuj z wczoraj: Śniadanie/ })).toHaveCount(0)

  await page.getByRole('button', { name: 'Dodaj do: Kolacja' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Ostatnio dodane i Twoje produkty' })).toBeVisible()
  const portion = (await dinnerToday()).find((meal) => meal.food.name === 'Awokado')?.portion
  await dialog.getByRole('button', { name: new RegExp(`^Awokado.*ostatnio ${portion} g`) }).click()
  await expect(dialog.getByLabel('Porcja (g)', { exact: true })).toHaveValue(String(portion))
  await dialog.getByRole('button', { name: 'Wybierz inny produkt' }).click()

  await dialog.getByRole('button', { name: 'Zapisz kolację jako zestaw' }).click()
  await expect(dialog.getByLabel('Nazwa zestawu', { exact: true })).toHaveValue('Moja kolacja')
  await accessible(page)
  await dialog.getByRole('button', { name: 'Zapisz zestaw' }).click()
  await expect(dialog.getByRole('button', { name: /^Moja kolacja/ })).toBeVisible()
  expect((await journal(page)).mealTemplates).toMatchObject([{ name: 'Moja kolacja', items: [{}, {}, {}] }])
  await dialog.getByRole('button', { name: 'Zapisz kolację jako zestaw' }).click()
  await dialog.getByRole('button', { name: 'Zapisz zestaw' }).click()
  await expect(dialog.getByRole('alert')).toContainText('o tej nazwie')
  await dialog.getByRole('button', { name: 'Anuluj', exact: true }).click()

  await dialog.getByLabel('Posiłek dla zestawu', { exact: true }).selectOption('snack')
  const snacks = (await journal(page)).meals.filter((meal) => meal.date === today && meal.meal === 'snack').length
  await dialog.getByRole('button', { name: /^Moja kolacja.*Przekąski/ }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect((await journal(page)).meals.filter((meal) => meal.date === today && meal.meal === 'snack')).toHaveLength(snacks + 3)

  await page.getByRole('button', { name: 'Dodaj do: Kolacja' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Usuń zestaw: Moja kolacja' }).click()
  await page.getByRole('dialog', { name: 'Usunąć zestaw?' }).getByRole('button', { name: 'Usuń zestaw', exact: true }).click()
  await expect.poll(async () => (await journal(page)).mealTemplates).toEqual([])
  expect((await dinnerToday())).toHaveLength(3)
})

test('Skan posiłku: a plate built by hand shows a range, accepts menu values and saves to Posiłki', async ({ page }) => {
  await openDemo(page)
  await navigate(page, '/meals')
  await page.getByRole('link', { name: 'Skanuj posiłek ze zdjęcia' }).click()
  await expect(page.getByRole('heading', { name: 'Skan posiłku', level: 1 })).toBeVisible()
  await expect(page.getByText(/Rozpoznawanie ze zdjęcia działa po zalogowaniu/)).toBeVisible()
  await expect(page.getByText('To szacunek, nie pomiar.', { exact: false })).toBeVisible()
  await page.getByRole('group', { name: 'Najczęstsze pozycje' }).getByRole('button', { name: /Burger duży/ }).click()
  const search = page.getByRole('searchbox', { name: 'Szukaj dania, dodatku lub napoju' })
  await search.fill('frytki')
  await page.getByRole('group', { name: 'Wyniki wyszukiwania' }).getByRole('button', { name: 'Frytki', exact: true }).first().click()
  await search.fill('cola')
  await page.getByRole('group', { name: 'Wyniki wyszukiwania' }).getByRole('button', { name: 'Cola lub inny napój gazowany', exact: true }).click()
  const total = page.locator('.scan-total')
  await expect(total).toContainText('1066')
  await expect(total).toContainText('Zakres:')
  await expect(page.locator('.scan-confidence')).toContainText('Orientacyjnie')
  await accessible(page)

  await page.getByRole('group', { name: 'Rozmiar porcji: Frytki' }).getByText('Duża', { exact: true }).click()
  await expect(total).toContainText('1222')
  const cola = page.locator('.scan-row').filter({ hasText: 'Cola lub inny napój gazowany' })
  await cola.getByText('Dokładniej: waga lub wartości z menu').click()
  await cola.getByLabel('Energia (kcal)', { exact: true }).fill('150')
  await expect(cola).toContainText('wartości z menu')
  await expect(total).toContainText('1204')
  await cola.getByLabel('Energia (kcal)', { exact: true }).fill('-5')
  await expect(page.getByRole('alert').first()).toContainText('nieujemnymi')
  await expect(page.getByRole('button', { name: 'Zapisz w Posiłkach' })).toBeDisabled()
  await cola.getByLabel('Energia (kcal)', { exact: true }).fill('150')
  await page.getByLabel(/^Zapisz do posiłku/).selectOption('lunch')
  const before = (await journal(page)).meals.length
  await page.getByRole('button', { name: 'Zapisz w Posiłkach' }).click()
  await expect(page).toHaveURL(/\/meals$/)
  const saved = (await journal(page)).meals.slice(before)
  expect(saved.map((meal) => meal.food.id)).toEqual(['scan-burger-double', 'scan-fries', expect.stringMatching(/^scan-cola-own-/)])
  expect(saved.every((meal) => meal.meal === 'lunch' && meal.food.source === 'custom')).toBe(true)
  expect(saved.map((meal) => meal.food.estimated)).toEqual([true, true, false])
  const kcal = saved.reduce((sum, meal) => sum + meal.portion * (meal.food.nutrients.kcal ?? 0) / 100, 0)
  expect(kcal).toBeGreaterThan(1203)
  expect(kcal).toBeLessThan(1206)
  await expect(page.getByText('Frytki (skan)', { exact: true })).toBeVisible()
})

test('Skan posiłku counts pieces and refuses impossible amounts', async ({ page }) => {
  await openDemo(page)
  await page.goto('/meals/scan')
  await page.getByRole('group', { name: 'Najczęstsze pozycje' }).getByRole('button', { name: /Nuggetsy/ }).click()
  const row = page.locator('.scan-row').filter({ hasText: 'Nuggetsy z kurczaka' })
  await expect(row).toContainText('ok. 150 g')
  await row.getByLabel('Liczba sztuk (szt.)').fill('9')
  await expect(row).toContainText('9 szt. (ok. 153 g)')
  await expect(row).toContainText('policzone sztuki')
  await row.getByText('Dokładniej: waga lub wartości z menu').click()
  await row.getByLabel('Dokładna ilość (g)').fill('0')
  await expect(row.getByRole('alert')).toContainText('Podaj ilość')
  await row.getByLabel('Dokładna ilość (g)').fill('140')
  await expect(row).toContainText('podana ilość')
  await expect(page.getByRole('button', { name: 'Zapisz w Posiłkach' })).toBeEnabled()
  await row.getByRole('button', { name: 'Usuń: Nuggetsy z kurczaka' }).click()
  await expect(page.getByText('Na razie pusto.')).toBeVisible()
})

test('a Smart Kuchnia recipe is saved once to the product library', async ({ page }) => {
  await openDemo(page)
  await navigate(page, '/kitchen')
  await chooseProducts(page, [['kurczak', 'Pierś z kurczaka'], ['brokuł', 'Brokuł'], ['ryż', 'Ryż biały']])
  await page.getByRole('button', { name: 'Dalej: preferencje' }).click()
  await page.getByRole('button', { name: 'Pokaż przepis' }).click()
  const title = (await page.getByRole('heading', { level: 3 }).first().innerText()).trim()
  await page.getByRole('button', { name: 'Zapisz w bibliotece' }).click()
  await expect(page.getByRole('button', { name: 'Zapisano w bibliotece' })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'w bibliotece' })).toBeVisible()
  const foods = (await journal(page)).customFoods
  expect(foods).toHaveLength(1)
  expect(foods[0]).toMatchObject({ name: title, source: 'custom', estimated: true, unit: 'g', brand: 'Flexa Smart Kuchnia' })
  expect(foods[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  await page.getByRole('button', { name: 'Zapisano w bibliotece' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'już w Twojej bibliotece' })).toBeVisible()
  expect((await journal(page)).customFoods).toHaveLength(1)
  await navigate(page, '/meals')
  await page.getByRole('button', { name: 'Dodaj do: Śniadanie' }).click()
  await expect(page.getByRole('dialog').getByRole('button', { name: new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*wartości szacunkowe`) })).toBeVisible()
})

test('approved goal estimate, CSV export and backup restore without deleting anything', async ({ page }, testInfo) => {
  await openDemo(page)
  await navigate(page, '/goals')
  await page.locator('.page-toolbar').getByRole('link', { name: 'Rozpocznij nowy cykl' }).click()
  await page.getByLabel('Koniec', { exact: true }).fill('2099-12-31')
  await page.getByRole('button', { name: 'Oblicz propozycję' }).click()
  await expect(page.getByText('32 lat z ankiety treningowej')).toBeVisible()
  await page.getByText('Kobieta', { exact: true }).click()
  await page.getByLabel('Wzrost (cm)', { exact: true }).fill('165')
  await page.getByRole('radio', { name: /^Umiarkowana/ }).check()
  await page.getByRole('button', { name: 'Policz orientacyjnie' }).click()
  const proposed = estimateEnergy({ age: 32, sex: 'female', heightCm: 165, weightKg: 74.2, activity: 'moderate', goal: 'lose' })
  await expect(page.locator('.goals-proposal')).toContainText(new RegExp(`${proposed.calories}`))
  expect((await journal(page)).profile.calorieGoal).toBe(2200)
  await accessible(page)
  await page.getByRole('button', { name: 'Przenieś propozycję do pól' }).click()
  await expect(page.getByLabel('Energia (kcal / dzień)', { exact: true })).toHaveValue(String(proposed.calories))
  await page.getByRole('checkbox', { name: /Sprawdziłem/ }).check()
  await page.getByRole('button', { name: 'Zatwierdź cele i rozpocznij cykl' }).click()
  await expect(page.getByRole('heading', { name: 'Cele', exact: true })).toBeVisible()
  await expect.poll(async () => (await journal(page)).profile).toMatchObject({
    calorieGoal: proposed.calories, proteinGoal: proposed.protein, fatGoal: proposed.fat,
    carbsGoal: proposed.carbs, waterGoal: proposed.water,
  })
  await navigate(page, '/settings')

  const csvEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Eksportuj CSV: Posiłki' }).click()
  const csv = await csvEvent
  expect(csv.suggestedFilename()).toMatch(/^flexa-posilki-\d{4}-\d{2}-\d{2}\.csv$/)
  const csvPath = testInfo.outputPath(csv.suggestedFilename())
  await csv.saveAs(csvPath)
  const csvText = await readFile(csvPath, 'utf8')
  expect(csvText.startsWith('\uFEFFData;Posiłek;Produkt;')).toBe(true)
  expect(csvText.trim().split('\r\n')).toHaveLength((await journal(page)).meals.length + 1)

  const jsonEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Eksportuj dane JSON' }).click()
  const jsonPath = testInfo.outputPath('backup.json')
  await (await jsonEvent).saveAs(jsonPath)
  const backup = JSON.parse(await readFile(jsonPath, 'utf8')) as { version: number; data: ReturnType<typeof journalSchema.parse> }
  expect(backup.version).toBe(2)
  const before = await journal(page)
  backup.data.meals.push({ ...backup.data.meals[0], id: crypto.randomUUID(), date: '2001-02-03' })
  backup.data.measurements.push({ id: crypto.randomUUID(), date: '2001-02-03', weightKg: 80 })
  backup.data.measurements[0] = { ...backup.data.measurements[0], weightKg: 99 }
  backup.data.profile = { ...backup.data.profile, calorieGoal: 1999 }
  await page.locator('input[type="file"][accept*="json"]').setInputFiles({ name: 'kopia.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) })
  let dialog = page.getByRole('dialog', { name: 'Przywróć z kopii' })
  await expect(dialog.getByRole('row', { name: /^Posiłki/ }).getByRole('cell')).toHaveText([String(before.meals.length + 1), '1', String(before.meals.length)])
  await expect(dialog).toContainText('Zostawimy Twoje obecne wartości')
  await accessible(page)
  await dialog.getByRole('checkbox', { name: /Zastąp cele i profil/ }).check()
  await dialog.getByRole('button', { name: 'Dodaj brakujące wpisy' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const after = await journal(page)
  expect(after.meals).toHaveLength(before.meals.length + 1)
  expect(after.measurements).toHaveLength(before.measurements.length + 1)
  expect(after.measurements.find((item) => item.date === before.measurements[0].date)?.weightKg).toBe(before.measurements[0].weightKg)
  expect(after.profile.calorieGoal).toBe(1999)
  await page.locator('input[type="file"][accept*="json"]').setInputFiles({ name: 'kopia.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) })
  await expect(page.getByRole('dialog', { name: 'Przywróć z kopii' })).toContainText('Nie ma wybranych wpisów do dodania')
  await page.getByRole('dialog').getByRole('button', { name: 'Zamknij', exact: true }).click()
  await page.locator('input[type="file"][accept*="json"]').setInputFiles({ name: 'zly.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') })
  await expect(page.getByRole('alert')).toContainText('To nie jest kopia dziennika Flexa')
})
