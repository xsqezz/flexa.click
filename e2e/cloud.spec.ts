import { randomUUID } from 'node:crypto'
import { test, expect, type Page } from '@playwright/test'
import { mockEmptyCatalog } from './catalog-fixture'

test.beforeEach(async ({ page }) => { await mockEmptyCatalog(page) })

const userId = '33333333-3333-4333-8333-333333333333'
const user = {
  id: userId, email: 'test@example.invalid', aud: 'authenticated', role: 'authenticated',
  created_at: '2026-10-06T10:00:00Z', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {},
}
const origin = 'http://127.0.0.1:5174'
type Row = Record<string, unknown>

async function fixture(page: Page, failJournal = false, onboarded = true) {
  const now = Math.floor(Date.now() / 1000)
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: userId, role: 'authenticated', exp: now + 3600 })}.dGVzdC1vbmx5`
  const session = { access_token: token, refresh_token: 'fake-test-refresh-token', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user }
  const calls: { path: string; body: Row }[] = []
  const rows: Record<string, Row[]> = {
    profiles: [{
      user_id: userId, display_name: 'Cloud test', calorie_goal: 2200, protein_goal: 140, carbs_goal: 260,
      fat_goal: 65, water_goal: 2500, weekly_minutes_goal: 180, target_weight: null,
      consent_version: '2026-10-06', consented_at: '2026-10-06T10:00:00Z',
      onboarding_completed_at: onboarded ? '2026-10-06T10:00:00Z' : null,
    }],
    meal_entries: [], workouts: [], water_entries: [], measurements: [], custom_foods: [], training_plans: [],
  }
  await page.routeWebSocket('ws://127.0.0.1:54321/**', (socket) => socket.close())
  await page.route('http://127.0.0.1:54321/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
      'access-control-allow-headers': 'authorization,apikey,content-type,x-client-info,prefer,range,accept,x-supabase-api-version',
    }
    const respond = (value: unknown, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(value) })
    if (method === 'OPTIONS') { await respond({}, 200); return }
    const body: Row = request.postDataJSON() ?? {}
    if (method !== 'GET') calls.push({ path: url.pathname, body })
    if (url.pathname === '/auth/v1/signup') { await respond({ user, session: null }); return }
    if (url.pathname === '/auth/v1/token') { await respond(session); return }
    if (url.pathname === '/auth/v1/user') { await respond({ user }); return }
    if (url.pathname === '/auth/v1/logout' || url.pathname === '/auth/v1/recover') { await respond({}); return }
    if (url.pathname === '/functions/v1/food-search') {
      if (body.query === 'limit') { await respond({ error: 'Limit testowy. Spróbuj ponownie za minutę.' }, 429); return }
      await respond({
        foods: [{ id: 'off:5901234123457', name: 'Produkt chmurowy', brand: 'Test',
          barcode: '5901234123457', source: 'open-food-facts', unit: null,
          nutrients: { kcal: 250, protein: null, carbs: 50, fat: 4, fiber: null } }],
        warnings: [],
      })
      return
    }
    if (url.pathname === '/functions/v1/account-delete') {
      await respond(body.password === 'wrong-password' ? { error: 'Hasło jest niepoprawne. Konto nie zostało usunięte.' } : { deleted: true }, body.password === 'wrong-password' ? 401 : 200)
      return
    }
    const table = url.pathname.split('/').at(-1) ?? ''
    if (table in rows) {
      if (method === 'GET') {
        if (failJournal) { await respond({ code: 'TEST503', message: 'Fixture database unavailable' }, 503); return }
        await respond(table === 'profiles' ? rows[table][0] : rows[table])
      } else if (method === 'POST') {
        expect(body.user_id).toBe(userId)
        const row = { ...body, id: randomUUID(), created_at: new Date().toISOString() }
        if (table === 'measurements') rows[table] = rows[table].filter((existing) => existing.date !== body.date)
        if (table === 'training_plans') rows[table] = rows[table].filter((existing) => existing.user_id !== body.user_id)
        rows[table].push(row)
        await respond(table === 'training_plans' ? { user_id: userId } : { id: row.id })
      } else if (method === 'PATCH') {
        Object.assign(rows[table][0], body)
        await respond({ user_id: userId })
      } else if (method === 'DELETE') {
        const id = url.searchParams.get('id')?.replace(/^eq\./, '')
        const owner = url.searchParams.get('user_id')?.replace(/^eq\./, '')
        rows[table] = rows[table].filter((row) => id ? row.id !== id : row.user_id !== owner)
        await respond(id ? { id } : [{ user_id: owner }])
      } else throw new Error(`Unhandled fixture operation ${method} ${table}`)
      return
    }
    throw new Error(`Unexpected fixture request ${method} ${url.pathname}`)
  })
  return { calls, rows }
}

async function login(page: Page) {
  await page.goto(`${origin}/login`)
  await page.getByLabel('Adres e-mail', { exact: true }).fill('test@example.invalid')
  await page.getByLabel('Hasło', { exact: true }).fill('test-only-password')
  await page.getByRole('button', { name: 'Zaloguj się', exact: true }).click()
}

async function openSettings(page: Page) {
  const link = page.locator('nav:visible a[href="/settings"]')
  if (await link.count() > 0) await link.click()
  else await page.getByRole('link', { name: 'Otwórz ustawienia konta' }).click()
}

test('registration sends consent metadata and waits for actual email confirmation', async ({ page }) => {
  const mocked = await fixture(page)
  await page.goto(`${origin}/signup`)
  await page.getByLabel('Jak mamy się do Ciebie zwracać?', { exact: true }).fill('Nowy test')
  await page.getByLabel('Adres e-mail', { exact: true }).fill('test@example.invalid')
  await page.getByLabel('Hasło', { exact: true }).fill('test-only-password')
  await page.getByRole('checkbox', { name: 'Mam ukończone 18 lat.' }).check()
  await page.getByRole('checkbox', { name: /Zgadzam się/ }).check()
  await page.getByRole('button', { name: 'Utwórz darmowe konto' }).click()
  await expect(page.getByRole('status')).toContainText('potwierdź adres')
  const call = mocked.calls.find((item) => item.path.endsWith('/signup'))
  expect(call?.body.data).toMatchObject({ display_name: 'Nowy test', adult_confirmed: true, privacy_consent: true, consent_version: '2026-10-06' })
  await expect(page.getByRole('heading', { name: 'Dzisiaj, w Twoim rytmie' })).toHaveCount(0)
})

test('real SDK login, cloud write/reload, required unit and function error', async ({ page }) => {
  const mocked = await fixture(page)
  await login(page)
  await expect(page.getByRole('heading', { name: 'Dzisiaj, w Twoim rytmie' })).toBeVisible()
  await expect(page.getByText('Cloud test', { exact: false })).toBeVisible()
  await expect(page.getByText(/Przykładowe dane/)).toHaveCount(0)
  await page.getByRole('button', { name: 'Dodaj posiłek', exact: true }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nazwa produktu', { exact: true }).fill('Produkt chmurowy')
  await dialog.getByRole('button', { name: 'Szukaj', exact: true }).click()
  await dialog.getByRole('button', { name: /Produkt chmurowy.*250 kcal/ }).click()
  await dialog.getByRole('button', { name: 'Dodaj do dziennika' }).click()
  expect(mocked.rows.meal_entries).toHaveLength(0)
  await dialog.getByLabel('Wartości na etykiecie dotyczą').selectOption('g')
  await dialog.getByLabel('Porcja (g)', { exact: true }).fill('50')
  await dialog.getByRole('button', { name: 'Dodaj do dziennika' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(mocked.rows.meal_entries[0]).toMatchObject({ user_id: userId, portion: 50 })
  await page.reload()
  await expect(page.getByText('Produkt chmurowy', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Dodaj posiłek', exact: true }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nazwa produktu', { exact: true }).fill('limit')
  await dialog.getByRole('button', { name: 'Szukaj', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('za minutę')
})

test('password recovery/update and account deletion have real error and confirmation paths', async ({ page }) => {
  const mocked = await fixture(page)
  await page.goto(`${origin}/login`)
  await page.getByRole('button', { name: 'Nie pamiętam hasła' }).click()
  await page.getByLabel('Adres e-mail', { exact: true }).fill('test@example.invalid')
  await page.getByRole('button', { name: 'Wyślij link', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Jeśli taki adres')
  expect(mocked.calls.some((call) => call.path.endsWith('/recover'))).toBe(true)
  await page.getByRole('button', { name: 'Wróć do logowania' }).click()
  await page.getByLabel('Hasło', { exact: true }).fill('test-only-password')
  await page.getByRole('button', { name: 'Zaloguj się', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dzisiaj, w Twoim rytmie' })).toBeVisible()
  await page.goto(`${origin}/reset-password`)
  await page.getByLabel('Nowe hasło').fill('test-new-password')
  await page.getByRole('button', { name: 'Zapisz hasło' }).click()
  await expect(page.getByRole('heading', { name: 'Dzisiaj, w Twoim rytmie' })).toBeVisible()
  expect(mocked.calls.find((call) => call.path.endsWith('/user'))?.body.password).toBe('test-new-password')
  await openSettings(page)
  await page.getByRole('button', { name: 'Usuń konto i dane' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Aktualne hasło', { exact: true }).fill('wrong-password')
  await dialog.getByLabel('Potwierdzenie: USUŃ KONTO', { exact: true }).fill('USUŃ KONTO')
  await dialog.getByRole('button', { name: 'Nieodwracalnie usuń konto' }).click()
  await expect(dialog.getByRole('alert')).toContainText('nie zostało usunięte')
  await dialog.getByLabel('Aktualne hasło', { exact: true }).fill('test-new-password')
  await dialog.getByRole('button', { name: 'Nieodwracalnie usuń konto' }).click()
  await expect(page.getByRole('heading', { name: 'Dobrze Cię widzieć' })).toBeVisible()
  expect(mocked.calls.filter((call) => call.path.endsWith('/account-delete'))).toHaveLength(2)
})

test('failed cloud reads never substitute demo records', async ({ page }) => {
  await fixture(page, true)
  await login(page)
  await expect(page.getByRole('alert')).toContainText('Nie udało się odczytać dziennika')
  await expect(page.getByText('Płatki owsiane', { exact: true })).toHaveCount(0)
  await expect(page.getByText(/Przykładowe dane/)).toHaveCount(0)
})

test('a new account answers the questionnaire step by step and gets a saved plan', async ({ page }) => {
  const mocked = await fixture(page, false, false)
  await login(page)
  await expect(page.getByRole('heading', { name: 'Zanim zaczniesz', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Zaczynamy' }).click()
  const next = page.getByRole('button', { name: 'Dalej', exact: true })
  await page.getByRole('textbox', { name: 'Ile masz lat?' }).fill('17')
  await page.getByText('Kobieta', { exact: true }).click()
  await next.click()
  await expect(page.getByRole('alert')).toContainText('od 18 do 99 lat')
  await page.getByRole('textbox', { name: 'Ile masz lat?' }).fill('54')
  await next.click()
  await page.getByRole('radio', { name: /^Zdrowy kręgosłup i postawa/ }).check()
  await next.click()
  await page.getByRole('radio', { name: /^Dom lub plener/ }).check()
  await next.click()
  await page.getByRole('checkbox', { name: 'Gumy oporowe z uchwytami lub długie taśmy' }).check()
  await page.getByRole('checkbox', { name: 'Mata' }).check()
  await next.click()
  await page.getByRole('radio', { name: /^Początkujący/ }).check()
  await next.click()
  await page.getByRole('button', { name: 'środa', exact: true }).click()
  await expect(page.getByRole('button', { name: 'środa', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await page.getByText('30 min', { exact: true }).click()
  await next.click()
  await page.getByText('Nie', { exact: true }).click()
  await page.getByRole('checkbox', { name: 'Ból dolnego odcinka pleców' }).check()
  await next.click()
  await expect(page.getByRole('alert')).toContainText('zaznacz zgodę')
  await page.getByRole('checkbox', { name: /Zgadzam się na zapisanie tych informacji o zdrowiu/ }).check()
  await next.click()
  await expect(page.getByRole('heading', { name: 'Sprawdź odpowiedzi', exact: true })).toBeVisible()
  await expect(page.getByText('poniedziałek, piątek · 30 min')).toBeVisible()
  await page.getByRole('button', { name: 'Utwórz mój plan' }).click()
  await expect(page.getByRole('heading', { name: 'Twój plan treningowy', exact: true })).toBeVisible()
  const saved = mocked.rows.training_plans[0]
  expect(saved.answers).toMatchObject({ age: 54, goal: 'posture', weekdays: [0, 4], minutes: 30, limitations: ['lower-back'], healthConsent: true })
  expect(saved.plan).not.toHaveProperty('answers')
  expect(saved.plan).toMatchObject({ version: 1, sessions: [{ weekday: 0 }, { weekday: 4 }] })
  expect(mocked.calls.some((call) => call.path.endsWith('/profiles') && typeof call.body.onboarding_completed_at === 'string')).toBe(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Twój plan treningowy', exact: true })).toBeVisible()
  await expect(page.locator('.plan-day')).toHaveCount(2)
  await page.getByRole('button', { name: 'Usuń plan' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Usuń plan', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Ułóż swój plan treningowy' })).toBeVisible()
  expect(mocked.rows.training_plans).toHaveLength(0)
})

test('the questionnaire can be skipped and opened later from the Plan tab', async ({ page }) => {
  const mocked = await fixture(page, false, false)
  await login(page)
  await page.getByRole('button', { name: 'Pomiń na razie' }).click()
  await expect(page.getByRole('heading', { name: 'Dzisiaj, w Twoim rytmie' })).toBeVisible()
  expect(mocked.rows.profiles[0].onboarding_completed_at).toEqual(expect.any(String))
  await expect(page.getByText(/Nie masz jeszcze planu treningowego/)).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Dzisiaj, w Twoim rytmie' })).toBeVisible()
  await page.locator('nav:visible a[href="/plan"]').click()
  await page.getByRole('link', { name: 'Stwórz plan' }).click()
  await expect(page.getByRole('heading', { name: 'Kilka słów o Tobie', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Anuluj' }).first().click()
  await expect(page.getByRole('heading', { name: 'Plan treningowy', exact: true })).toBeVisible()
})

const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

/** A phone-sized photo, so that the app also prepares the zoomed crops. */
async function bigPhoto(page: Page): Promise<Buffer> {
  const encoded = await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 1600
    canvas.height = 1200
    const context = canvas.getContext('2d')
    if (!context) throw new Error('no canvas')
    const gradient = context.createLinearGradient(0, 0, 1600, 1200)
    gradient.addColorStop(0, '#d8e8d0')
    gradient.addColorStop(1, '#f4d9b0')
    context.fillStyle = gradient
    context.fillRect(0, 0, 1600, 1200)
    context.fillStyle = '#c0392b'
    context.beginPath()
    context.arc(500, 600, 160, 0, Math.PI * 2)
    context.fill()
    context.fillStyle = '#f1c40f'
    context.fillRect(900, 300, 400, 500)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
    if (!blob) throw new Error('no jpeg')
    let binary = ''
    for (const byte of new Uint8Array(await blob.arrayBuffer())) binary += String.fromCharCode(byte)
    return btoa(binary)
  })
  return Buffer.from(encoded, 'base64')
}

test('Smart Kuchnia recognises products from a photo after consent and shows an AI picture of the dish', async ({ page }) => {
  await fixture(page)
  const authorizations: string[] = []
  const sent: unknown[] = []
  const images: unknown[] = []
  await page.route('**/api/kitchen/status', (route) => route.fulfill({ json: { available: true, limits: { vision: 12, image: 30 } } }))
  await page.route('**/api/kitchen/vision', async (route) => {
    authorizations.push(route.request().headers().authorization ?? '')
    sent.push(route.request().postDataJSON())
    await route.fulfill({ json: { items: ['chicken-breast', 'broccoli', 'rice-white'], unknown: ['kolendra'], seen: ['pierś z kurczaka', 'brokuł', 'ryż biały', 'kolendra'] } })
  })
  await page.route('**/api/kitchen/image', async (route) => {
    images.push(route.request().postDataJSON())
    await route.fulfill({ contentType: 'image/png', body: tinyPng })
  })
  await login(page)
  await expect(page.getByRole('heading', { name: 'Dzisiaj, w Twoim rytmie' })).toBeVisible()
  await page.locator('nav:visible a[href="/kitchen"]').click()
  await expect(page.getByRole('heading', { name: 'Zdjęcie lodówki lub produktów' })).toBeVisible()
  await page.locator('input[type=file]').nth(1).setInputFiles({ name: 'lodowka.jpg', mimeType: 'image/jpeg', buffer: await bigPhoto(page) })
  await expect(page.getByAltText('Podgląd wybranego zdjęcia produktów')).toBeVisible()
  await page.getByRole('button', { name: 'Rozpoznaj produkty' }).click()
  await expect(page.getByRole('alert')).toContainText('zgodę')
  expect(sent).toHaveLength(0)
  await page.getByRole('checkbox', { name: /zostanie pomniejszone, pozbawione danych EXIF/ }).check()
  await page.getByRole('button', { name: 'Rozpoznaj produkty' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Widzę na zdjęciu' })).toContainText('pierś z kurczaka, brokuł, ryż biały')
  await expect(page.getByText(/Nie mam w bazie: kolendra/)).toBeVisible()
  expect(authorizations).toHaveLength(1)
  expect(authorizations[0]).toMatch(/^Bearer \S+\.\S+\.\S+$/)
  const request = sent[0] as { images: string[] }
  expect(request.images).toHaveLength(5)
  for (const image of request.images) expect(image).toMatch(/^\/9j\//)
  await expect(page.getByRole('group', { name: 'Wybrane produkty' }).getByRole('button')).toHaveCount(3)
  await page.getByRole('button', { name: 'Dalej: preferencje' }).click()
  await page.getByRole('button', { name: 'Pokaż przepis' }).click()
  await expect(page.getByRole('heading', { level: 3 }).first()).toContainText(/kurczaka/i)
  await expect(page.getByRole('img', { name: /^Poglądowe zdjęcie potrawy wygenerowane przez AI: / })).toBeVisible()
  await expect(page.getByText(/Poglądowe zdjęcie wygenerowane przez AI/)).toBeVisible()
  expect(images[0]).toMatchObject({ format: expect.any(String), ingredients: expect.arrayContaining(['chicken-breast']) })
  expect(JSON.stringify(images[0])).not.toMatch(/lodowka|base64/)
})

test('Smart Kuchnia falls back to manual selection and an ingredient picture when AI is unavailable or fails', async ({ page }) => {
  await fixture(page)
  await page.route('**/api/kitchen/status', (route) => route.fulfill({ json: { available: true, limits: { vision: 12, image: 30 } } }))
  await page.route('**/api/kitchen/vision', (route) => route.fulfill({ status: 429, json: { code: 'quota', error: 'Dzienny limit zdjęć i obrazów AI został wykorzystany. Wróć jutro albo wybierz produkty ręcznie.' } }))
  await page.route('**/api/kitchen/image', (route) => route.fulfill({ status: 503, json: { code: 'unavailable', error: 'Nie udało się wygenerować zdjęcia. Spróbuj ponownie za chwilę.' } }))
  await login(page)
  await page.locator('nav:visible a[href="/kitchen"]').click()
  await page.locator('input[type=file]').nth(1).setInputFiles({ name: 'lodowka.png', mimeType: 'image/png', buffer: tinyPng })
  await page.getByRole('checkbox', { name: /zostanie pomniejszone/ }).check()
  await page.getByRole('button', { name: 'Rozpoznaj produkty' }).click()
  await expect(page.getByRole('alert')).toContainText('Dzienny limit')
  const search = page.getByRole('searchbox', { name: 'Szukaj produktu' })
  for (const [query, name] of [['jajka', 'Jajka'], ['pomidor', 'Pomidor'], ['ser żółty', 'Ser żółty']] as const) {
    await search.fill(query)
    await page.getByRole('button', { name, exact: true }).click()
  }
  await page.getByRole('button', { name: 'Dalej: preferencje' }).click()
  await page.getByRole('button', { name: 'Pokaż przepis' }).click()
  await expect(page.getByRole('heading', { level: 3 }).first()).toBeVisible()
  await expect(page.getByText(/Nie udało się wygenerować zdjęcia\. Spróbuj ponownie za chwilę\. Pokazuję ilustrację składników\./)).toBeVisible()
  await expect(page.getByRole('img', { name: /^Ilustracja składników/ })).toBeVisible()
})

test('Smart Kuchnia hides photo recognition when the AI service is not configured', async ({ page }) => {
  await fixture(page)
  await page.route('**/api/kitchen/status', (route) => route.fulfill({ json: { available: false, limits: { vision: 12, image: 30 } } }))
  await login(page)
  await page.locator('nav:visible a[href="/kitchen"]').click()
  await expect(page.getByText(/Rozpoznawanie ze zdjęcia jest chwilowo niedostępne/)).toBeVisible()
  await expect(page.locator('input[type=file]')).toHaveCount(0)
  await expect(page.getByRole('searchbox', { name: 'Szukaj produktu' })).toBeVisible()
})
