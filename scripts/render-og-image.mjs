// One-off generator for site/og-image.png (1200×630 social card). Run: node scripts/render-og-image.mjs
// The PNG is committed; rerun only when the landing headline or identity changes.
import { readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const logo = readFileSync('site/favicon.svg', 'utf8')
const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, Arial, sans-serif; color: #20352b; background: radial-gradient(700px 420px at 95% -5%, #d6f3e4, transparent 70%), radial-gradient(600px 420px at 0% 100%, #e8e0ff, transparent 70%), #f7f9f6; -webkit-font-smoothing: antialiased; }
  .card { display: grid; grid-template-columns: 1fr 450px; gap: 48px; align-items: center; height: 100%; padding: 64px 72px; border-bottom: 14px solid #0b7a55; }
  .brand { display: flex; align-items: center; gap: 12px; color: #0b7a55; font-size: 44px; font-weight: 750; letter-spacing: -.045em; }
  .brand svg { width: 52px; height: 52px; }
  .brand span { color: #0b7a55; margin-left: -12px; }
  h1 { margin-top: 30px; font-size: 86px; line-height: 1; letter-spacing: -.04em; font-weight: 650; }
  h1 span { background: linear-gradient(90deg, #1f8a5b, #5b3fc4); -webkit-background-clip: text; background-clip: text; color: transparent; }
  p { margin-top: 26px; font-size: 25px; line-height: 1.4; color: #536752; max-width: 30ch; }
  .board { background: #fff; border: 1px solid #d5e1d3; border-radius: 32px; padding: 26px 30px; transform: rotate(1deg); box-shadow: 0 30px 70px #2a4a2722; }
  .label { display: flex; justify-content: space-between; font-size: 15px; color: #4f6850; }
  .total { margin-top: 18px; padding: 16px 18px; border-radius: 22px; background: #d6f3e4; font-size: 16px; color: #2c4034; }
  .total strong { display: block; margin-top: 6px; font-size: 50px; font-weight: 600; color: #20352b; letter-spacing: -.03em; }
  .total small { font-size: 18px; color: #627265; font-weight: 400; letter-spacing: 0; }
  .macros { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 18px; font-size: 14px; color: #2c4034; }
  .macros > div { padding: 14px; border-radius: 18px; }
  .macros > div:nth-child(1) { background: #d9ecff; } .macros > div:nth-child(2) { background: #fff0bd; } .macros > div:nth-child(3) { background: #e8e0ff; }
  .macros strong { display: block; margin: 6px 0 8px; font-size: 21px; color: #20352b; font-weight: 550; }
  .macros i { display: block; height: 6px; border-radius: 999px; }
  .row { display: flex; justify-content: space-between; gap: 16px; padding: 14px 18px; margin-top: 10px; border-radius: 18px; background: #f1f6f1; font-size: 18px; }
  .row span { color: #627265; }
  .row:last-child { background: #ffe4d1; }
</style></head><body><div class="card">
  <div>
    <div class="brand">${logo}flexa<span>.</span></div>
    <h1>Jedzenie.<br>Ruch.<br><span>Twój rytm.</span></h1>
    <p>Darmowy dziennik jedzenia, treningów i postępów. Bez abonamentu.</p>
  </div>
  <div class="board">
    <div class="label"><span>Tak może wyglądać Twój dzień</span><span>Przykładowe dane</span></div>
    <div class="total">Energia z posiłków<strong>1 580 <small>/ 2 200 kcal</small></strong></div>
    <div class="macros">
      <div>Białko<strong>112 g</strong><i style="background:#477db4;width:80%"></i></div>
      <div>Węglowodany<strong>187 g</strong><i style="background:#ba8745;width:70%"></i></div>
      <div>Tłuszcze<strong>43 g</strong><i style="background:#9273aa;width:66%"></i></div>
    </div>
    <div class="row">Owsianka z jogurtem<span>450 kcal</span></div>
    <div class="row">Bieg w parku<span>6,2 km · 38 min</span></div>
  </div>
</div></body></html>`

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
  await page.setContent(html)
  await page.screenshot({ path: 'site/og-image.png', type: 'png' })
} finally {
  await browser.close()
}
console.log('Rendered site/og-image.png (1200×630).')
