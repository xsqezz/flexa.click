import { copyFileSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const destination = 'dist-site'
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
for (const file of ['index.html', 'setup.html', 'styles.css', 'favicon.svg']) {
  const output = join(destination, file)
  if (file.endsWith('.html')) {
    const html = readFileSync(join('site', file), 'utf8')
      .replaceAll('{{APP_URL}}', () => escape(app?.origin ?? 'setup.html'))
      .replaceAll('{{DEMO_URL}}', () => escape(app ? `${app.origin}/demo` : 'setup.html#demo'))
      .replaceAll('{{APP_CTA}}', app ? 'Otwórz aplikację' : 'Jak uruchomić Flexa')
    writeFileSync(output, html)
  } else copyFileSync(join('site', file), output)
}
writeFileSync(join(destination, '.nojekyll'), '')
const cname = join(destination, 'CNAME')
const domain = process.env.FLEXA_SITE_DOMAIN?.trim()
if (domain) {
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain)) {
    throw new Error('FLEXA_SITE_DOMAIN is not a valid hostname.')
  }
  writeFileSync(cname, `${domain}\n`)
} else if (existsSync(cname)) unlinkSync(cname)
console.log(`Public site built. Application link: ${app?.origin ?? 'setup instructions (not configured)'}.`)
