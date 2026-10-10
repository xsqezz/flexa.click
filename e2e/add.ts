import type { Page } from '@playwright/test'

/** The page-level add buttons are gone: everything is added from the one "Dodaj" button. */
export async function openAdd(page: Page, entry: 'Posiłek' | 'Trening' | 'Pomiar') {
  await page.getByRole('button', { name: 'Dodaj', exact: true }).first().click()
  await page.getByRole('button', { name: new RegExp(`^${entry}`) }).click()
}
