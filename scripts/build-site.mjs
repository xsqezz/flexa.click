import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { qrSvg } from './lib/qr.mjs'
import { canonicalBase, robotsTxt, sitemapXml, softwareJsonLd } from './lib/site-meta.mjs'

const destination = 'dist-site'
const withDemo = process.argv.includes('--with-demo')
if (withDemo && !existsSync(join('app', 'dist-pages', 'index.html'))) {
  throw new Error('Build the Pages demo first: npm run build:pages --workspace app')
}
mkdirSync(destination, { recursive: true })
let app = null
if (process.env.FLEXA_APP_URL?.trim()) {
  app = new URL(process.env.FLEXA_APP_URL.trim())
  if (app.protocol !== 'https:' && !(app.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(app.hostname))) {
    throw new Error('FLEXA_APP_URL must use HTTPS, except for local previews.')
  }
  if (app.username || app.password || app.search || app.hash || app.pathname !== '/') {
    throw new Error('FLEXA_APP_URL must be an application origin, without credentials, path, query, or fragment.')
  }
}
const escape = (value) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const androidUrl = new URL(process.env.FLEXA_ANDROID_URL?.trim() || 'https://github.com/xsqezz/flexa.click/releases/latest/download/flexa.apk')
if (androidUrl.protocol !== 'https:') throw new Error('FLEXA_ANDROID_URL must use HTTPS.')
const domain = process.env.FLEXA_SITE_DOMAIN?.trim()
const base = canonicalBase(domain)
const description = 'Flexa łączy jedzenie, treningi i postępy w jednym darmowym dzienniku. Bez abonamentu, z Twoimi danymi pod kontrolą.'
const replacements = {
  APP_URL: escape(app?.origin ?? (withDemo ? 'app/#/demo' : 'setup.html')),
  DEMO_URL: escape(withDemo ? 'app/#/demo' : app ? `${app.origin}/demo` : 'setup.html#demo'),
  APP_CTA: app ? 'Otwórz aplikację' : withDemo ? 'Otwórz demo Flexa' : 'Jak uruchomić Flexa',
  // The separate demo button would duplicate the main call to action when the main one already opens the demo.
  DEMO_CTA_HIDDEN: !app && withDemo ? ' hidden' : '',
  ANDROID_URL: escape(androidUrl.href),
  ANDROID_QR: qrSvg(androidUrl.href, { label: 'Kod QR z linkiem do pobrania Flexa na Androida (.apk)', id: 'android-qr-title' }),
  SITE_BASE: escape(base),
  SITE_DESCRIPTION: escape(description),
  JSON_LD: softwareJsonLd({ base, androidUrl: androidUrl.href, description }),
}
for (const file of ['index.html', 'setup.html', 'styles.css', 'site.js', 'favicon.svg', 'og-image.png']) {
  const output = join(destination, file)
  if (file.endsWith('.html')) {
    const html = readFileSync(join('site', file), 'utf8').replace(/\{\{([A-Z_]+)\}\}/g, (placeholder, name) => {
      if (!(name in replacements)) throw new Error(`Unknown placeholder ${placeholder} in site/${file}.`)
      return replacements[name]
    })
    writeFileSync(output, html)
  } else copyFileSync(join('site', file), output)
}
writeFileSync(join(destination, 'robots.txt'), robotsTxt(base))
writeFileSync(join(destination, 'sitemap.xml'), sitemapXml(base))
const demoDestination = join(destination, 'app')
if (existsSync(demoDestination)) rmSync(demoDestination, { recursive: true })
if (withDemo) cpSync(join('app', 'dist-pages'), demoDestination, { recursive: true })
if (existsSync(join('site', 'screens'))) cpSync(join('site', 'screens'), join(destination, 'screens'), { recursive: true })
writeFileSync(join(destination, '.nojekyll'), '')
const cname = join(destination, 'CNAME')
if (domain) writeFileSync(cname, `${domain}\n`)
else if (existsSync(cname)) unlinkSync(cname)
console.log(`Public site built for ${base}. Application link: ${app?.origin ?? (withDemo ? 'included local demo' : 'setup instructions (not configured)')}.`)
