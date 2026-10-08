import { createRequire } from 'node:module'
import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const origin = `http://127.0.0.1:${process.env.PLAYWRIGHT_PAGES_ONLY === '1' ? 4175 : 4174}`
const APK = 'https://github.com/xsqezz/flexa.click/releases/latest/download/flexa.apk'
const sections = [['Funkcje', 'features'], ['Jak to działa', 'how'], ['Android', 'android'], ['Pytania', 'faq']] as const
const zxing = createRequire(import.meta.url)('@zxing/library')

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
}

async function accessible(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
  expect(result.violations.map((violation) => ({
    id: violation.id, impact: violation.impact, nodes: violation.nodes.map((node) => node.target),
  }))).toEqual([])
}

async function openMenuIfCollapsed(page: Page) {
  const toggle = page.getByRole('button', { name: 'Menu', exact: true })
  if (await toggle.isVisible() && await toggle.getAttribute('aria-expanded') === 'false') await toggle.click()
}

function decodeQrPath(path: string, dimension: number) {
  const modules = Array.from({ length: dimension }, () => new Array<boolean>(dimension).fill(false))
  for (const [, x, y, width] of path.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    for (let dx = 0; dx < Number(width); dx++) modules[Number(y)][Number(x) + dx] = true
  }
  const scale = 4
  const size = dimension * scale
  const luminance = new Uint8ClampedArray(size * size).fill(255)
  modules.forEach((row, y) => row.forEach((dark, x) => {
    if (!dark) return
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) luminance[(y * scale + dy) * size + x * scale + dx] = 0
  }))
  const bitmap = new zxing.BinaryBitmap(new zxing.HybridBinarizer(new zxing.RGBLuminanceSource(luminance, size, size)))
  return new zxing.QRCodeReader().decode(bitmap, new Map([[zxing.DecodeHintType.PURE_BARCODE, true]])).getText() as string
}

test('header anchors lead to existing sections and the sources page', async ({ page }) => {
  await page.goto(origin)
  const nav = page.getByRole('navigation', { name: 'Menu strony' })
  for (const [name, id] of sections) {
    await expect(page.locator(`#${id}`)).toHaveCount(1)
    await openMenuIfCollapsed(page)
    await nav.getByRole('link', { name, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`#${id}$`))
    await expect(page.locator(`#${id}`)).toBeInViewport()
    const top = await page.locator(`#${id}`).evaluate((node) => node.getBoundingClientRect().top)
    expect(top).toBeGreaterThanOrEqual(0)
  }
  await expect(page.locator('#site-menu nav a[href="setup.html"]')).toHaveText('Źródła')
  await expect(page.locator('a.skip-link')).toHaveAttribute('href', '#main')
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('faq')!).scrollMarginTop)).not.toBe('0px')
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('the menu is a keyboard-operable disclosure that closes on Escape and on link choice', async ({ page }) => {
    await page.goto(origin)
    const toggle = page.getByRole('button', { name: 'Menu', exact: true })
    const faqLink = page.getByRole('navigation', { name: 'Menu strony' }).getByRole('link', { name: 'Pytania', exact: true })
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(toggle).toHaveAttribute('aria-controls', 'site-menu')
    await expect(faqLink).toBeHidden()
    await toggle.focus()
    await page.keyboard.press('Enter')
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(faqLink).toBeVisible()
    await expect(page.locator('#site-menu .header-actions .button:not([hidden])').first()).toBeVisible()
    await page.keyboard.press('Tab')
    await expect(page.locator('#site-menu a').first()).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(toggle).toBeFocused()
    await expect(faqLink).toBeHidden()
    await page.keyboard.press('Space')
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await accessible(page)
    await faqLink.click()
    await expect(page).toHaveURL(/#faq$/)
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(page.locator('#faq')).toBeInViewport()
  })
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } })

  test('the menu falls back to a visible list and every install option stays visible', async ({ page }) => {
    await page.goto(origin)
    await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeHidden()
    for (const [name] of sections) await expect(page.getByRole('navigation', { name: 'Menu strony' }).getByRole('link', { name, exact: true })).toBeVisible()
    const options = page.locator('[data-install-options] > .install-option')
    await expect(options).toHaveCount(3)
    expect(await options.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-platform')))).toEqual(['android', 'ios', 'desktop'])
    for (const name of ['Android', 'iPhone i iPad', 'Komputer']) await expect(page.getByRole('heading', { name, exact: true, level: 3 })).toBeVisible()
    await expect(page.locator('#android').getByRole('link', { name: /Pobierz Flexa \(\.apk\)/ })).toBeVisible()
    await noOverflow(page)
  })
})

test('the landing has no horizontal overflow at 320, 390 and 1440 px and passes axe', async ({ page }) => {
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(origin)
    await expect(page.getByRole('heading', { name: /Jedzenie.*Ruch.*Twój rytm/ })).toBeVisible()
    await noOverflow(page)
    await openMenuIfCollapsed(page)
    await noOverflow(page)
    for (const summary of await page.locator('#faq summary').all()) await summary.click()
    await noOverflow(page)
    await accessible(page)
  }
})

test('FAQ uses native disclosures with the promised questions', async ({ page }) => {
  await page.goto(`${origin}/#faq`)
  await expect(page.getByRole('heading', { name: 'Pytania.', level: 2 })).toBeVisible()
  const questions = ['Czy Flexa jest darmowa?', 'Gdzie są moje dane?', 'Czy muszę zakładać konto?', 'Czy jest aplikacja na telefon?', 'Czego Flexa nie robi?', 'Skąd są dane produktów?']
  await expect(page.locator('#faq details > summary')).toHaveText(questions)
  const data = page.locator('#faq details').filter({ hasText: 'Gdzie są moje dane?' })
  await expect(data).not.toHaveAttribute('open')
  await data.locator('summary').focus()
  await page.keyboard.press('Enter')
  await expect(data).toHaveAttribute('open')
  await expect(data).toContainText('Frankfurt')
  await expect(data).toContainText('eksport JSON')
  await expect(page.locator('#faq details').filter({ hasText: 'Skąd są dane produktów?' })).toContainText('ODbL')
})

test('canonical, Open Graph, Twitter card and JSON-LD metadata are complete', async ({ page, request }) => {
  await page.goto(origin)
  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href')
  expect(canonical).toMatch(/^https:\/\/[^/]+\/(?:[^/]+\/)?$/)
  const meta = (selector: string) => page.locator(`meta[${selector}]`).getAttribute('content')
  expect(await meta('property="og:url"')).toBe(canonical)
  expect(await meta('property="og:locale"')).toBe('pl_PL')
  expect(await meta('property="og:type"')).toBe('website')
  expect(await meta('property="og:title"')).toContain('Flexa')
  expect(await meta('property="og:description"')).toBe(await meta('name="description"'))
  expect(await meta('property="og:image"')).toBe(`${canonical}og-image.png`)
  expect(await meta('name="twitter:card"')).toBe('summary_large_image')
  expect(await meta('name="twitter:image"')).toBe(`${canonical}og-image.png`)
  expect(await meta('name="twitter:title"')).toBeTruthy()
  const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() ?? '')
  expect(ld).toMatchObject({
    '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Flexa', applicationCategory: 'HealthApplication',
    operatingSystem: 'Web, Android', inLanguage: 'pl', url: canonical, offers: { '@type': 'Offer', price: '0', priceCurrency: 'PLN' },
  })
  expect(await page.content()).not.toMatch(/\{\{[A-Z_]+\}\}/)

  const image = await request.get(`${origin}/og-image.png`)
  expect(image.status()).toBe(200)
  expect(image.headers()['content-type']).toBe('image/png')
  const png = await image.body()
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630])

  const robots = await request.get(`${origin}/robots.txt`)
  expect(robots.status()).toBe(200)
  expect(robots.headers()['content-type']).toContain('text/plain')
  expect(await robots.text()).toContain(`Sitemap: ${canonical}sitemap.xml`)
  const sitemap = await request.get(`${origin}/sitemap.xml`)
  expect(sitemap.status()).toBe(200)
  expect(sitemap.headers()['content-type']).toContain('xml')
  const locations = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])
  expect(locations).toEqual([canonical, `${canonical}setup.html`])
  await page.goto(`${origin}/setup.html`)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${canonical}setup.html`)
})

test('install block offers the APK with a scannable QR code and highlights the matching device', async ({ page }, testInfo) => {
  await page.goto(origin)
  const android = page.locator('#android')
  await expect(android.getByRole('link', { name: /Pobierz Flexa \(\.apk\)/ })).toHaveAttribute('href', APK)
  const qr = android.getByRole('img', { name: /Kod QR z linkiem do pobrania Flexa na Androida/ })
  await expect(qr).toBeVisible()
  const viewBox = await qr.getAttribute('viewBox')
  const dimension = Number(viewBox?.split(' ')[2])
  expect(decodeQrPath(await qr.locator('path').getAttribute('d') ?? '', dimension)).toBe(APK)
  const first = page.locator('[data-install-options] > .install-option').first()
  await expect(first).toHaveAttribute('data-platform', testInfo.project.name === 'mobile' ? 'android' : 'desktop')
  await expect(first).toHaveClass(/is-match/)
  await expect(first).toContainText('Pasuje do Twojego urządzenia')
  await expect(page.locator('.install-option.is-match')).toHaveCount(1)
  for (const name of ['Android', 'iPhone i iPad', 'Komputer']) await expect(page.getByRole('heading', { name, exact: true, level: 3 })).toBeVisible()
  await expect(page.locator('.install-option[data-platform="desktop"]')).toContainText('Zainstaluj z paska adresu')
  await expect(page.locator('.install-option[data-platform="ios"]')).toContainText('Do ekranu początkowego')
  const screens = page.locator('#screens img')
  await expect(screens).toHaveCount(4)
  for (const image of await screens.all()) {
    await expect(image).toHaveAttribute('alt', /.{20,}/)
    await expect(image).toHaveAttribute('width', '780')
  }
  await expect(page.locator('#screens .screens-note')).toContainText('tryb')
})

test.describe('on an iPhone', () => {
  test.use({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' })

  test('the add-to-home-screen steps come first', async ({ page }) => {
    await page.goto(origin)
    const first = page.locator('[data-install-options] > .install-option').first()
    await expect(first).toHaveAttribute('data-platform', 'ios')
    await expect(first).toContainText('Pasuje do Twojego urządzenia')
    await expect(page.locator('#android').getByRole('link', { name: /Pobierz Flexa \(\.apk\)/ })).toBeVisible()
  })
})

test.describe('inside the Android app', () => {
  test.use({ userAgent: 'Mozilla/5.0 (Linux; Android 16; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36 FlexaAndroid/1.2.3' })

  test('the APK download is hidden and the app explains updates instead', async ({ page }) => {
    await page.goto(origin)
    await expect(page.locator('#android').getByRole('link', { name: /Pobierz Flexa \(\.apk\)/ })).toHaveCount(0)
    await expect(page.getByRole('img', { name: /Kod QR/ })).toHaveCount(0)
    await expect(page.getByText('Masz już aplikację Flexa.')).toBeVisible()
    await expect(page.locator('[data-install-options] > .install-option').first()).toHaveAttribute('data-platform', 'android')
    await accessible(page)
  })
})
