import { test, expect } from '@playwright/test'

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
  await page.locator('nav:visible a[href="#/journal"]').click()
  await expect(page).toHaveURL(/#\/journal$/)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Dziennik żywienia', exact: true })).toBeVisible()
  await page.locator('nav:visible a[href="#/settings"]').click()
  await expect(page.getByRole('heading', { name: 'Cele i konto', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Eksportuj dane JSON' })).toBeVisible()
  await page.goto(`${origin}/app/#/privacy`)
  await expect(page.getByRole('heading', { name: 'Twój dziennik. Twoja prywatność.' })).toBeVisible()
  expect(errors).toEqual([])
  expect(failures).toEqual([])
})
