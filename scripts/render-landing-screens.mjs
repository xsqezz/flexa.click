#!/usr/bin/env node
// Robi zrzuty ekranu trybu demo (telefon, jasny motyw) dla strony głównej: site/screens/*.jpg.
// Wymaga zbudowanej aplikacji (npm run build); uruchom po większych zmianach wyglądu:
//   node scripts/render-landing-screens.mjs
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from '@playwright/test'

const out = join(import.meta.dirname, '..', 'site', 'screens')
const port = 4196
const shots = [
  { file: 'dzisiaj.jpg', route: '/', wait: 'Dzisiaj, w Twoim rytmie' },
  { file: 'dziennik.jpg', route: '/journal', wait: 'Dziennik żywienia' },
  { file: 'trening.jpg', route: '/plan', wait: 'Twój plan treningowy' },
  { file: 'postepy.jpg', route: '/progress', wait: 'Postępy bez pośpiechu' },
]

mkdirSync(out, { recursive: true })
const server = spawn(process.execPath, [join(import.meta.dirname, '..', 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', String(port), '--strictPort'], { cwd: join(import.meta.dirname, '..', 'app'), stdio: 'ignore' })
await new Promise((resolve) => setTimeout(resolve, 3000))
const browser = await chromium.launch()
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'light', locale: 'pl-PL', timezoneId: 'Europe/Warsaw',
    isMobile: true, hasTouch: true, serviceWorkers: 'block',
  })
  const page = await context.newPage()
  await page.goto(`http://127.0.0.1:${port}/demo`)
  await page.getByRole('heading', { name: 'Dzisiaj, w Twoim rytmie' }).waitFor()
  for (const shot of shots) {
    await page.goto(`http://127.0.0.1:${port}${shot.route}`)
    await page.getByRole('heading', { name: shot.wait }).waitFor()
    await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; } .toast { display: none !important; }' })
    await page.waitForTimeout(400)
    await page.screenshot({ path: join(out, shot.file), type: 'jpeg', quality: 82 })
    console.log(`site/screens/${shot.file}`)
  }
} finally {
  await browser.close()
  server.kill()
}
