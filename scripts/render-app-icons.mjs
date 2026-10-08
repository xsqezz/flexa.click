#!/usr/bin/env node
// Renderuje ikony aplikacji (PWA, iOS) z logo Flexa do app/public/icons/. Uruchom ponownie po zmianie logo:
//   node scripts/render-app-icons.mjs
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from '@playwright/test'

const out = join(import.meta.dirname, '..', 'app', 'public', 'icons')
const glyph = 'M11 26V11h16l-3 5H16v3h7l-3 5h-4v2z'
const icons = [
  // Zwykła ikona: zaokrąglony kwadrat jak favicon, przezroczyste rogi.
  { name: 'icon-192.png', size: 192, svg: `<rect width="36" height="36" rx="11" fill="#276043"/><path d="${glyph}" fill="#fff"/>` },
  { name: 'icon-512.png', size: 512, svg: `<rect width="36" height="36" rx="11" fill="#276043"/><path d="${glyph}" fill="#fff"/>` },
  // Maskable: pełne tło, znak w bezpiecznym obszarze (środkowe 80%).
  { name: 'maskable-512.png', size: 512, svg: `<rect width="36" height="36" fill="#276043"/><g transform="  translate(18 18) scale(1.05) translate(-19 -18.5)"><path d="${glyph}" fill="#fff"/></g>` },
  // iOS sam zaokrągla rogi, więc tło wypełnia cały kwadrat.
  { name: 'apple-touch-icon.png', size: 180, svg: `<rect width="36" height="36" fill="#276043"/><g transform="translate(18 18) scale(1.15) translate(-19 -18.5)"><path d="${glyph}" fill="#fff"/></g>` },
]

mkdirSync(out, { recursive: true })
const browser = await chromium.launch()
try {
  for (const icon of icons) {
    const page = await browser.newPage({ viewport: { width: icon.size, height: icon.size } })
    await page.setContent(`<html><body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="${icon.size}" height="${icon.size}">${icon.svg}</svg></body></html>`)
    await page.screenshot({ path: join(out, icon.name), omitBackground: true })
    await page.close()
    console.log(`app/public/icons/${icon.name}`)
  }
} finally {
  await browser.close()
}
