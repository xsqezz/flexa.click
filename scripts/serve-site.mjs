import { createReadStream, existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'

const port = Number(process.env.PORT ?? 4174)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port.')
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/setup.html', ['setup.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/favicon.svg', ['favicon.svg', 'image/svg+xml']],
  ['/app/', ['app/index.html', 'text/html; charset=utf-8']],
  ['/app/index.html', ['app/index.html', 'text/html; charset=utf-8']],
  ['/app/favicon.svg', ['app/favicon.svg', 'image/svg+xml']],
  ['/app/data/polish-products.json', ['app/data/polish-products.json', 'application/json; charset=utf-8']],
])
const server = createServer((request, response) => {
  const path = new URL(request.url ?? '/', 'http://localhost').pathname
  const asset = /^\/app\/assets\/[A-Za-z0-9_-]+\.(js|css)$/.exec(path)
  const file = files.get(path) ?? (asset ? [path.slice(1), asset[1] === 'css' ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8'] : undefined)
  if (!file || !existsSync(join('dist-site', file[0]))) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Build the site first: npm run build:site')
    return
  }
  response.writeHead(200, { 'Content-Type': file[1], 'X-Content-Type-Options': 'nosniff' })
  createReadStream(join('dist-site', file[0])).pipe(response)
})
server.listen(port, '127.0.0.1', () => console.log(`Flexa public site: http://127.0.0.1:${port}`))
