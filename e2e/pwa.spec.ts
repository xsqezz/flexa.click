import { test, expect } from '@playwright/test'

test.use({ serviceWorkers: 'allow' })

test('the app is installable and the demo opens offline after the first visit', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Service worker behaviour does not depend on the viewport.')
  const manifest = await (await page.request.get('/manifest.webmanifest')).json() as {
    name: string; start_url: string; display: string; icons: { src: string; sizes: string; purpose: string }[]; shortcuts: { url: string }[]
  }
  expect(manifest.display).toBe('standalone')
  expect(manifest.start_url).toBe('./')
  expect(manifest.icons.map((icon) => `${icon.sizes}:${icon.purpose}`)).toEqual(expect.arrayContaining(['192x192:any', '512x512:any', '512x512:maskable']))
  expect(manifest.shortcuts.map((shortcut) => shortcut.url)).toContain('./plan')
  for (const icon of manifest.icons) expect((await page.request.get(`/${icon.src}`)).ok()).toBe(true)

  await page.goto('/demo')
  await expect(page.getByRole('heading', { name: 'Cele', level: 1, exact: true })).toBeVisible()
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest')
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  if (!await page.evaluate(() => Boolean(navigator.serviceWorker.controller))) await page.reload()
  const cached = await page.evaluate(async () => {
    const names = await caches.keys()
    const shell = names.find((name) => name.startsWith('flexa-shell-'))
    return shell ? (await (await caches.open(shell)).keys()).map((request) => new URL(request.url).pathname) : []
  })
  expect(cached).toContain('/')
  expect(cached.some((path) => path.startsWith('/assets/') && path.endsWith('.js'))).toBe(true)

  await context.setOffline(true)
  await page.goto('/meals')
  await expect(page.getByRole('heading', { name: 'Posiłki', exact: true })).toBeVisible()
  await context.setOffline(false)
})

test('the worker never caches account data or API calls', async ({ page }) => {
  const source = await (await page.request.get('/sw.js')).text()
  expect(source).not.toContain('__VERSION__')
  expect(source).not.toContain('__ASSETS__')
  expect(source).toContain("path.startsWith('api/')")
  expect(source).toContain('url.origin !== self.location.origin')
})
