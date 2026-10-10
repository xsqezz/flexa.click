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
      goals_setup_done_at: onboarded ? '2026-10-06T10:00:00Z' : null,
    }],
    goal_cycles: [], meal_entries: [], workouts: [], water_entries: [], measurements: [], custom_foods: [], training_plans: [], meal_templates: [], workout_templates: [],
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
    if (url.pathname === '/rest/v1/rpc/start_goal_cycle') {
      if (rows.goal_cycles.some((cycle) => cycle.id === body.p_id)) { await respond(body.p_id); return }
      const day = String(body.p_start_date)
      const measurement = rows.measurements.find((row) => row.date === day)
      if (measurement && measurement.weight_kg !== body.p_start_weight_kg) {
        await respond({ code: 'P0001', message: 'Dla daty początku jest już inny pomiar.' }, 400)
        return
      }
      if (!measurement) rows.measurements.push({ id: randomUUID(), user_id: userId, date: day, weight_kg: body.p_start_weight_kg })
      for (const cycle of rows.goal_cycles.filter((row) => row.status === 'active')) {
        cycle.status = 'completed'; cycle.completed_at = new Date().toISOString()
        cycle.end_date = day
      }
      rows.goal_cycles.push({
        id: body.p_id, user_id: userId, kind: body.p_kind, start_date: day, end_date: body.p_end_date,
        start_weight_kg: body.p_start_weight_kg, target_weight_kg: body.p_target_weight_kg,
        calorie_goal: body.p_calorie_goal, protein_goal: body.p_protein_goal, carbs_goal: body.p_carbs_goal,
        fat_goal: body.p_fat_goal, water_goal: body.p_water_goal, status: 'active', completed_at: null, created_at: new Date().toISOString(),
      })
      Object.assign(rows.profiles[0], {
        calorie_goal: body.p_calorie_goal, protein_goal: body.p_protein_goal, carbs_goal: body.p_carbs_goal,
        fat_goal: body.p_fat_goal, water_goal: body.p_water_goal, target_weight: body.p_target_weight_kg,
        goals_setup_done_at: new Date().toISOString(),
      })
      await respond(body.p_id)
      return
    }
    if (url.pathname === '/rest/v1/rpc/save_flexa_profile') {
      Object.assign(rows.profiles[0], {
        display_name: body.p_display_name, calorie_goal: body.p_calorie_goal,
        protein_goal: body.p_protein_goal, carbs_goal: body.p_carbs_goal, fat_goal: body.p_fat_goal,
        water_goal: body.p_water_goal, weekly_minutes_goal: body.p_weekly_minutes_goal, target_weight: body.p_target_weight,
      })
      for (const cycle of rows.goal_cycles.filter((row) => row.status === 'active')) Object.assign(cycle, {
        calorie_goal: body.p_calorie_goal, protein_goal: body.p_protein_goal, carbs_goal: body.p_carbs_goal,
        fat_goal: body.p_fat_goal, water_goal: body.p_water_goal, target_weight_kg: body.p_target_weight,
      })
      await respond(true)
      return
    }
    if (url.pathname === '/rest/v1/rpc/restore_goal_cycle_history') {
      const cycles = body.p_cycles
      if (!Array.isArray(cycles) || rows.goal_cycles.length) {
        await respond({ code: 'P0001', message: 'Historia cykli już istnieje.' }, 400)
        return
      }
      rows.goal_cycles = cycles.map((cycle: Row) => ({
        id: cycle.id, user_id: userId, kind: cycle.kind, status: 'completed',
        start_date: cycle.startDate, end_date: cycle.endDate,
        start_weight_kg: cycle.startWeightKg, target_weight_kg: cycle.targetWeightKg,
        calorie_goal: cycle.calorieGoal, protein_goal: cycle.proteinGoal, carbs_goal: cycle.carbsGoal,
        fat_goal: cycle.fatGoal, water_goal: cycle.waterGoal,
        created_at: cycle.createdAt, completed_at: cycle.completedAt,
      }))
      await respond(cycles.length)
      return
    }
    const table = url.pathname.split('/').at(-1) ?? ''
    if (table in rows) {
      if (method === 'GET') {
        if (failJournal) { await respond({ code: 'TEST503', message: 'Fixture database unavailable' }, 503); return }
        await respond(table === 'profiles' ? rows[table][0] : rows[table])
      } else if (method === 'POST' && Array.isArray(body)) {
        const created = (body as Row[]).map((item) => {
          expect(item.user_id).toBe(userId)
          return { ...item, id: typeof item.id === 'string' ? item.id : randomUUID(), created_at: new Date().toISOString() }
        })
        rows[table].push(...created)
        await respond(created.map((row) => ({ id: row.id })))
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
  else await page.getByRole('link', { name: /^Konto i ustawienia:/ }).click()
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
  await expect(page.getByRole('heading', { name: 'Cele', level: 1, exact: true })).toHaveCount(0)
})

test('real SDK login, cloud write/reload, required unit and function error', async ({ page }) => {
  const mocked = await fixture(page)
  await login(page)
  await expect(page.getByRole('heading', { name: 'Cele', level: 1, exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /^Konto i ustawienia: Cloud test/ })).toBeVisible()
  await expect(page.getByText(/Przykładowe dane/)).toHaveCount(0)
  await page.locator('nav:visible a[href="/meals"]').first().click()
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
  await expect(page.getByRole('heading', { name: 'Cele', level: 1, exact: true })).toBeVisible()
  await page.goto(`${origin}/reset-password`)
  await page.getByLabel('Nowe hasło').fill('test-new-password')
  await page.getByRole('button', { name: 'Zapisz hasło' }).click()
  await expect(page.getByRole('heading', { name: 'Cele', level: 1, exact: true })).toBeVisible()
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
  await expect(page.getByRole('heading', { name: 'Ustal swoje cele', exact: true })).toBeVisible()
  await page.getByRole('radio', { name: /^Utrzymanie/ }).check()
  await page.getByRole('button', { name: 'Oblicz propozycję' }).click()
  await expect(page.getByText('54 lat z ankiety treningowej')).toBeVisible()
  await page.getByRole('button', { name: 'Ukryj kalkulator' }).click()
  await page.getByLabel('Masa na początku (kg)').fill('75')
  await page.getByLabel('Masa docelowa (kg)').fill('73')
  await page.getByLabel('Koniec', { exact: true }).fill('2100-01-01')
  await page.getByRole('checkbox', { name: /Sprawdziłem/ }).check()
  expect(mocked.rows.goal_cycles).toHaveLength(0)
  await page.getByRole('button', { name: 'Zatwierdź cele i rozpocznij cykl' }).click()
  await expect(page.getByRole('heading', { name: 'Cele', exact: true })).toBeVisible()
  expect(mocked.rows.goal_cycles).toMatchObject([{ kind: 'maintenance', start_weight_kg: 75, target_weight_kg: 73, calorie_goal: 2200 }])
  expect(mocked.rows.measurements).toMatchObject([{ weight_kg: 75 }])
  expect(mocked.rows.profiles[0].goals_setup_done_at).toEqual(expect.any(String))
  await page.locator('nav:visible a[href="/plan"]').first().click()
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
  await expect(page.getByRole('heading', { name: 'Ustal swoje cele', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Pomiń na razie' }).click()
  await expect(page.getByRole('heading', { name: 'Cele', level: 1, exact: true })).toBeVisible()
  expect(mocked.rows.profiles[0].onboarding_completed_at).toEqual(expect.any(String))
  expect(mocked.rows.profiles[0].goals_setup_done_at).toEqual(expect.any(String))
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Cele', level: 1, exact: true })).toBeVisible()
  await page.locator('nav:visible a[href="/plan"]').click()
  await page.getByRole('link', { name: 'Stwórz plan' }).click()
  await expect(page.getByRole('heading', { name: 'Kilka słów o Tobie', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Anuluj' }).first().click()
  await expect(page.getByRole('heading', { name: 'Plan treningowy', exact: true })).toBeVisible()
})

test('an adult can skip training and explicitly approve manual nutrition goals', async ({ page }) => {
  const mocked = await fixture(page, false, false)
  await login(page)
  await page.getByRole('button', { name: 'Pomiń na razie' }).click()
  await expect(page.getByRole('heading', { name: 'Ustal swoje cele', exact: true })).toBeVisible()
  await page.getByLabel('Wiek (lata)').fill('29')
  await expect(page.getByRole('button', { name: 'Oblicz propozycję' })).toHaveCount(0)
  await page.getByLabel('Masa na początku (kg)').fill('70')
  await page.getByLabel('Koniec', { exact: true }).fill('2100-01-01')
  await page.getByLabel('Energia (kcal / dzień)').fill('2300')
  await page.getByRole('button', { name: 'Zatwierdź cele i rozpocznij cykl' }).click()
  await expect(page.getByRole('alert')).toContainText('Zaznacz potwierdzenie')
  expect(mocked.rows.goal_cycles).toHaveLength(0)
  await page.getByRole('checkbox', { name: /Sprawdziłem/ }).check()
  await page.getByRole('button', { name: 'Zatwierdź cele i rozpocznij cykl' }).click()
  await expect(page.getByRole('heading', { name: 'Cele', exact: true })).toBeVisible()
  expect(mocked.rows.goal_cycles).toMatchObject([{ kind: 'manual', calorie_goal: 2300 }])
  expect(mocked.rows.training_plans).toHaveLength(0)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Cele', exact: true })).toBeVisible()
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
  await expect(page.getByRole('heading', { name: 'Cele', level: 1, exact: true })).toBeVisible()
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

test('Skan posiłku recognises a tray after consent, lets the user correct it and saves the confirmed plate', async ({ page }) => {
  const mocked = await fixture(page)
  const requests: { authorization: string; images: string[] }[] = []
  await page.route('**/api/kitchen/status', (route) => route.fulfill({ json: { available: true, limits: { vision: 12, image: 30 } } }))
  await page.route('**/api/meal/plate', async (route) => {
    requests.push({ authorization: route.request().headers().authorization ?? '', images: (route.request().postDataJSON() as { images: string[] }).images })
    await route.fulfill({ json: {
      items: [
        { name: 'chicken nuggets', brand: null, size: null, count: 6 }, { name: 'french fries', brand: null, size: 'L', count: null },
        { name: 'garlic sauce', brand: null, size: 'S', count: 1 }, { name: 'zzzzqqq', brand: null, size: null, count: null },
      ],
      photos: 1, analysed: 1,
    } })
  })
  await login(page)
  await expect(page.getByRole('heading', { name: 'Cele', level: 1, exact: true })).toBeVisible()
  await page.goto(`${origin}/meals/scan`)
  await expect(page.getByRole('heading', { name: 'Zdjęcie tacy lub talerza' })).toBeVisible()
  await page.locator('input[type=file]').nth(1).setInputFiles({ name: 'taca.jpg', mimeType: 'image/jpeg', buffer: await bigPhoto(page) })
  await expect(page.getByAltText('Podgląd zdjęcia 1 z 1')).toBeVisible()
  await page.getByRole('button', { name: 'Rozpoznaj posiłek' }).click()
  await expect(page.getByRole('alert')).toContainText('zgodę')
  expect(requests).toHaveLength(0)
  await page.getByRole('checkbox', { name: /zostanie pomniejszone, pozbawione danych EXIF/ }).check()
  await page.getByRole('button', { name: 'Rozpoznaj posiłek' }).click()
  await expect(page.getByText(/Rozpoznałem 3 pozycje/)).toBeVisible()
  expect(requests).toHaveLength(1)
  expect(requests[0].authorization).toMatch(/^Bearer /)
  expect(requests[0].images).toHaveLength(1)
  expect(requests[0].images[0]).toMatch(/^\/9j\//)
  await expect(page.getByText(/Nie znalazłem w bazie: zzzzqqq/)).toBeVisible()
  const nuggets = page.locator('.scan-row').filter({ hasText: 'Nuggetsy z kurczaka' })
  await expect(nuggets).toContainText('Rozpoznano: chicken nuggets')
  await expect(nuggets).toContainText('6 szt. (ok. 102 g)')
  await nuggets.getByLabel('Liczba sztuk (szt.)').fill('9')
  await expect(nuggets).toContainText('9 szt. (ok. 153 g)')
  await page.locator('.scan-row').filter({ hasText: 'Sos czosnkowy' }).getByRole('button', { name: 'Usuń: Sos czosnkowy lub tatarski' }).click()
  await page.getByRole('button', { name: 'Zapisz w Posiłkach' }).click()
  await expect(page).toHaveURL(/\/meals$/)
  await expect.poll(() => mocked.rows.meal_entries.length).toBe(2)
  expect(mocked.rows.meal_entries).toMatchObject([
    { user_id: userId, portion: 153, food: { id: 'scan-nuggets', source: 'custom', estimated: true, unit: 'g' } },
    { user_id: userId, portion: 165, food: { id: 'scan-fries' } },
  ])
  await page.reload()
  await expect(page.getByText('Nuggetsy z kurczaka (skan)')).toBeVisible()
})

test('Odczyt etykiety fills the custom product form after consent and warns when the numbers disagree', async ({ page }) => {
  await fixture(page)
  const requests: { authorization: string; images: string[] }[] = []
  let reading = { name: 'Jogurt naturalny', brand: 'Bakoma', unit: 'g', kcal: 61, protein: 4.3, carbs: 5, fat: 3, fiber: null, consistent: true }
  await page.route('**/api/kitchen/status', (route) => route.fulfill({ json: { available: true, limits: { vision: 12, image: 30 } } }))
  await page.route('**/api/meal/label', async (route) => {
    requests.push({ authorization: route.request().headers().authorization ?? '', images: (route.request().postDataJSON() as { images: string[] }).images })
    await route.fulfill({ json: { label: reading } })
  })
  await login(page)
  await expect(page.getByRole('heading', { name: 'Cele', level: 1, exact: true })).toBeVisible()
  await page.goto(`${origin}/meals`)
  await page.getByRole('button', { name: 'Dodaj do: Śniadanie' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Własny produkt' }).click()
  await dialog.locator('input[type=file]').nth(1).setInputFiles({ name: 'etykieta.jpg', mimeType: 'image/jpeg', buffer: await bigPhoto(page) })
  await expect(dialog.getByAltText('Podgląd zdjęcia etykiety')).toBeVisible()
  await dialog.getByRole('button', { name: 'Odczytaj wartości' }).click()
  await expect(dialog.getByRole('alert')).toContainText('zgodę')
  expect(requests).toHaveLength(0)
  await dialog.getByRole('checkbox', { name: /wyłącznie po to, by odczytać liczby z etykiety/ }).check()
  await dialog.getByRole('button', { name: 'Odczytaj wartości' }).click()
  await expect(dialog.getByLabel('Nazwa produktu')).toHaveValue('Jogurt naturalny')
  await expect(dialog.getByLabel('Energia (kcal)')).toHaveValue('61')
  await expect(dialog.getByLabel('Białko (g)')).toHaveValue('4.3')
  await expect(dialog.getByLabel('Błonnik (g)')).toHaveValue('')
  await expect(dialog.getByText(/Sprawdź każdą liczbę ze zdjęciem/)).toBeVisible()
  expect(requests).toHaveLength(1)
  expect(requests[0].authorization).toMatch(/^Bearer /)
  expect(requests[0].images).toHaveLength(1)
  reading = { ...reading, kcal: 610, consistent: false }
  await dialog.locator('input[type=file]').nth(1).setInputFiles({ name: 'etykieta.jpg', mimeType: 'image/jpeg', buffer: await bigPhoto(page) })
  await dialog.getByRole('button', { name: 'Odczytaj wartości' }).click()
  await expect(dialog.getByText(/nie zgadzają się z białkiem/)).toBeVisible()
  await expect(dialog.getByLabel('Energia (kcal)')).toHaveValue('610')
})

test('Skan posiłku uses the official menu of a recognised chain and offers a one-tap correction', async ({ page }) => {
  const mocked = await fixture(page)
  await page.route('**/api/kitchen/status', (route) => route.fulfill({ json: { available: true, limits: { vision: 12, image: 30 } } }))
  await page.route('**/api/meal/plate', (route) => route.fulfill({ json: {
    items: [
      { name: 'Big Mac', brand: "McDonald's", size: null, count: 1 }, { name: 'french fries', brand: "McDonald's", size: 'L', count: null },
    ],
    photos: 1, analysed: 1,
  } }))
  await login(page)
  await expect(page.getByRole('heading', { name: 'Cele', level: 1, exact: true })).toBeVisible()
  await page.goto(`${origin}/meals/scan`)
  await page.locator('input[type=file]').nth(1).setInputFiles({ name: 'taca.jpg', mimeType: 'image/jpeg', buffer: await bigPhoto(page) })
  await expect(page.getByAltText('Podgląd zdjęcia 1 z 1')).toBeVisible()
  await page.getByRole('checkbox', { name: /zostanie pomniejszone, pozbawione danych EXIF/ }).check()
  await page.getByRole('button', { name: 'Rozpoznaj posiłek' }).click()
  const mac = page.locator('.scan-row').filter({ has: page.getByText('Big Mac', { exact: true }) })
  await expect(mac).toContainText("McDonald's")
  await expect(mac).toContainText('porcja z menu')
  await expect(mac).toContainText('oficjalne dane sieci w Polsce')
  await expect(mac).toContainText('Rozpoznano: Big Mac (McDonald\'s)')
  await expect(mac.getByRole('group', { name: /Rozmiar porcji/ })).toHaveCount(0)
  await expect(mac.locator('.scan-row-kcal strong')).toHaveText(/54[34] kcal/)
  const fries = page.locator('.scan-row').filter({ has: page.getByText('Frytki Duże', { exact: true }) })
  await expect(fries).toContainText("McDonald's")
  await mac.getByText('To nie ta pozycja? Zmień').click()
  await mac.getByRole('searchbox', { name: 'Szukaj dania, dodatku lub napoju' }).fill('cheeseburger')
  await mac.getByRole('group', { name: 'Wyniki wyszukiwania' }).getByRole('button', { name: /Cheeseburger · McDonald's/ }).first().click()
  await expect(page.locator('.scan-row').filter({ hasText: 'Cheeseburger' }).first().locator('.scan-row-kcal strong')).toHaveText(/30[5-7] kcal/)
  await page.getByRole('button', { name: 'Zapisz w Posiłkach' }).click()
  await expect(page).toHaveURL(/\/meals$/)
  await expect.poll(() => mocked.rows.meal_entries.length).toBe(2)
  expect(mocked.rows.meal_entries).toMatchObject([
    { food: { brand: "McDonald's", estimated: false, source: 'custom' } },
    { food: { brand: "McDonald's", estimated: false } },
  ])
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

test('cloud workouts keep their sets and measurements keep optional body values, while older rows still load', async ({ page }) => {
  const mocked = await fixture(page)
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' })
  mocked.rows.workouts.push({
    id: randomUUID(), user_id: userId, created_at: '2026-10-01T10:00:00Z', date: '2026-10-01', name: 'Stary trening', kind: 'run',
    minutes: 30, distance_km: 5, calories: null, effort: null, elevation_m: null, import_hash: null,
  })
  mocked.rows.measurements.push({ id: randomUUID(), user_id: userId, created_at: '2026-10-01T10:00:00Z', date: today, weight_kg: 80 })
  await login(page)
  await expect(page.getByRole('heading', { name: 'Cele', level: 1, exact: true })).toBeVisible()
  await page.goto(`${origin}/workouts`)
  await page.getByRole('button', { name: 'Wszystkie', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Stary trening' })).toBeVisible()
  await page.getByRole('button', { name: 'Dodaj trening', exact: true }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nazwa treningu', { exact: true }).fill('Siła w chmurze')
  await dialog.getByLabel('Rodzaj', { exact: true }).selectOption('strength')
  await dialog.getByLabel('Czas (min)', { exact: true }).fill('40')
  await dialog.getByRole('button', { name: 'Dodaj serię' }).click()
  await dialog.getByLabel('Seria 1: ćwiczenie', { exact: true }).fill('Przysiad goblet z hantlem')
  await dialog.getByLabel('Seria 1: powtórzenia', { exact: true }).fill('10')
  await dialog.getByLabel('Seria 1: ciężar w kg', { exact: true }).fill('16')
  await dialog.getByRole('button', { name: 'Zapisz trening' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(mocked.rows.workouts.at(-1)).toMatchObject({ user_id: userId, sets: [{ exercise: 'goblet-squat-db', reps: 10, weightKg: 16, seconds: null }] })
  await page.reload()
  await page.getByText('Serie: 1', { exact: true }).click()
  await expect(page.getByText('10 × 16 kg')).toBeVisible()
  await page.goto(`${origin}/progress`)
  await page.getByRole('button', { name: 'Dodaj pomiar', exact: true }).click()
  dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Masa ciała (kg)', { exact: true })).toHaveValue('80')
  await dialog.getByText('Więcej pomiarów').click()
  await dialog.getByLabel('Obwód talii (cm)', { exact: true }).fill('90')
  await dialog.getByLabel('Tkanka tłuszczowa (%)', { exact: true }).fill('24.5')
  await dialog.getByRole('button', { name: 'Zapisz pomiar' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(mocked.rows.measurements.at(-1)).toMatchObject({ weight_kg: 80, waist_cm: 90, hips_cm: null, body_fat_pct: 24.5 })
  await page.reload()
  await expect(page.getByRole('cell', { name: '24,5 %', exact: true })).toBeVisible()
})

test('cloud meal copy, templates, backup restore and calculated goals use the account tables', async ({ page }) => {
  const mocked = await fixture(page)
  const warsawDay = (offset: number) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' }).format(new Date(Date.now() + offset * 86_400_000))
  const food = {
    id: 'off:5901234123457', name: 'Owsianka chmurowa', brand: 'Test', barcode: null, source: 'open-food-facts', unit: 'g',
    nutrients: { kcal: 380, protein: 12, carbs: 60, fat: 7, fiber: null },
  }
  mocked.rows.meal_entries.push({ id: randomUUID(), user_id: userId, created_at: '2026-10-01T08:00:00Z', date: warsawDay(-1), meal: 'breakfast', food, portion: 80 })
  await login(page)
  await expect(page.getByRole('heading', { name: 'Cele', level: 1, exact: true })).toBeVisible()
  await page.locator('nav:visible a[href="/meals"]').first().click()
  await page.getByRole('button', { name: 'Kopiuj z wczoraj: Śniadanie (1 pozycja)' }).click()
  await expect.poll(() => mocked.rows.meal_entries.length).toBe(2)
  expect(mocked.calls.some((call) => call.path.endsWith('/meal_entries') && Array.isArray(call.body))).toBe(true)
  expect(mocked.rows.meal_entries[1]).toMatchObject({ user_id: userId, date: warsawDay(0), meal: 'breakfast', portion: 80 })

  await page.getByRole('button', { name: 'Dodaj do: Śniadanie' }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Zapisz śniadanie jako zestaw' }).click()
  await dialog.getByRole('button', { name: 'Zapisz zestaw' }).click()
  await expect(dialog.getByRole('button', { name: /^Moje śniadanie/ })).toBeVisible()
  expect(mocked.rows.meal_templates).toMatchObject([{ user_id: userId, name: 'Moje śniadanie', items: [{ portion: 80, food: { name: 'Owsianka chmurowa' } }] }])
  await dialog.getByLabel('Posiłek dla zestawu', { exact: true }).selectOption('dinner')
  await dialog.getByRole('button', { name: /^Moje śniadanie.*Kolacja/ }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(mocked.rows.meal_entries.filter((row) => row.meal === 'dinner')).toHaveLength(1)

  await openSettings(page)
  const backup = {
    format: 'flexa-journal', version: 1, exportedAt: '2026-10-01T10:00:00.000Z', mode: 'demo',
    data: {
      profile: { displayName: 'Z kopii', calorieGoal: 2100, proteinGoal: 120, carbsGoal: 250, fatGoal: 70, waterGoal: 2200, weeklyMinutesGoal: 150, targetWeight: null },
      meals: [
        { id: randomUUID(), date: warsawDay(-1), meal: 'breakfast', food, portion: 80 },
        { id: randomUUID(), date: warsawDay(-1), meal: 'lunch', food, portion: 150 },
      ],
      workouts: [{ id: randomUUID(), date: warsawDay(-2), name: 'Bieg z kopii', kind: 'run', minutes: 30, distanceKm: 5, calories: null, effort: 5, elevationM: null, importHash: null }],
      water: [{ id: randomUUID(), date: warsawDay(-2), amountMl: 250 }],
      measurements: [{ id: randomUUID(), date: warsawDay(-2), weightKg: 70.5 }],
      customFoods: [{ ...food, id: 'legacy', source: 'custom', name: 'Własny z kopii' }],
    },
  }
  await page.locator('input[type="file"][accept*="json"]').setInputFiles({ name: 'flexa-demo.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) })
  dialog = page.getByRole('dialog', { name: 'Przywróć z kopii' })
  await expect(dialog.getByRole('row', { name: /^Posiłki/ }).getByRole('cell')).toHaveText(['2', '1', '1'])
  await dialog.getByRole('button', { name: 'Dodaj brakujące wpisy' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(mocked.rows.meal_entries).toHaveLength(4)
  expect(mocked.rows.workouts).toMatchObject([{ user_id: userId, name: 'Bieg z kopii', distance_km: 5 }])
  expect(mocked.rows.water_entries).toHaveLength(1)
  expect(mocked.rows.measurements).toMatchObject([{ weight_kg: 70.5 }])
  expect(mocked.rows.custom_foods).toHaveLength(1)
  expect(mocked.rows.custom_foods[0].id).toMatch(/^[0-9a-f-]{36}$/)
  expect(mocked.rows.profiles[0].display_name).toBe('Cloud test')

  await page.goto(`${origin}/goals/new`)
  await page.getByLabel('Wiek (lata)').fill('40')
  await page.getByRole('radio', { name: /^Redukcja/ }).check()
  await page.getByLabel('Masa na początku (kg)').fill('80')
  await page.getByLabel('Koniec', { exact: true }).fill('2100-01-01')
  await page.getByRole('button', { name: 'Oblicz propozycję' }).click()
  await page.getByText('Mężczyzna', { exact: true }).click()
  await page.getByLabel('Wzrost (cm)', { exact: true }).fill('180')
  await page.getByRole('radio', { name: /^Niska/ }).check()
  await page.getByRole('button', { name: 'Policz orientacyjnie' }).click()
  await expect(page.locator('.goals-proposal')).toContainText('1870')
  expect(mocked.rows.profiles[0].calorie_goal).toBe(2200)
  await page.getByRole('button', { name: 'Przenieś propozycję do pól' }).click()
  await page.getByRole('checkbox', { name: /Sprawdziłem/ }).check()
  await page.getByRole('button', { name: 'Zatwierdź cele i rozpocznij cykl' }).click()
  await expect(page.getByRole('heading', { name: 'Cele', exact: true })).toBeVisible()
  expect(mocked.rows.profiles[0]).toMatchObject({ calorie_goal: 1870, protein_goal: 128, fat_goal: 52, carbs_goal: 223, water_goal: 2800, weekly_minutes_goal: 180 })
  expect(mocked.rows.goal_cycles).toMatchObject([{ kind: 'reduction', calorie_goal: 1870 }])
  expect(JSON.stringify(mocked.calls)).not.toMatch(/"age"|height/)
})

test('cloud custom workouts are stored in their own table and removed again', async ({ page }) => {
  const mocked = await fixture(page)
  mocked.rows.workouts.push({
    id: randomUUID(), user_id: userId, created_at: '2026-10-01T10:00:00Z', date: '2026-10-01', name: 'Siłownia chmurowa', kind: 'strength',
    minutes: 50, distance_km: null, calories: null, effort: null, elevation_m: null, import_hash: null,
    sets: [{ exercise: 'goblet-squat-db', reps: 10, weightKg: 20, seconds: null }],
  })
  await login(page)
  await expect(page.getByRole('heading', { name: 'Cele', level: 1, exact: true })).toBeVisible()
  await page.locator('nav:visible a[href="/workouts"]').first().click()
  await page.getByRole('button', { name: 'Zapisz jako własny trening: Siłownia chmurowa' }).click()
  await expect(page.locator('.my-workouts-list')).toContainText('Siłownia chmurowa')
  expect(mocked.rows.workout_templates).toMatchObject([{
    user_id: userId, name: 'Siłownia chmurowa', kind: 'strength', minutes: 50,
    sets: [{ exercise: 'goblet-squat-db', reps: 10, weightKg: 20 }],
  }])
  await page.getByRole('button', { name: 'Usuń własny trening: Siłownia chmurowa' }).click()
  await expect.poll(() => mocked.rows.workout_templates, { timeout: 15_000 }).toEqual([])
})
