import { createReadStream, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'

const port = Number(process.env.PORT ?? 4174)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port.')
const root = resolve('dist-site')
const types = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.jpg', 'image/jpeg'],
  ['.ico', 'image/x-icon'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.xml', 'application/xml; charset=utf-8'],
  ['.woff2', 'font/woff2'],
])

function resolveFile(pathname) {
  let decoded
  try { decoded = decodeURIComponent(pathname) } catch { return undefined }
  if (decoded.includes('\0')) return undefined
  const relative = normalize(decoded.endsWith('/') ? `${decoded}index.html` : decoded).replace(/^[/\\]+/, '')
  const file = resolve(join(root, relative))
  if (file !== root && !file.startsWith(root + sep)) return undefined
  return file
}

const server = createServer((request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
  const file = resolveFile(pathname)
  const stats = file ? statSync(file, { throwIfNoEntry: false }) : undefined
  if (stats?.isDirectory()) {
    response.writeHead(301, { Location: `${pathname}/` })
    response.end()
    return
  }
  const type = file && types.get(extname(file).toLowerCase())
  if (!stats?.isFile() || !type) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Build the site first: npm run build:site')
    return
  }
  response.writeHead(200, { 'Content-Type': type, 'Content-Length': stats.size, 'X-Content-Type-Options': 'nosniff' })
  if (request.method === 'HEAD') response.end()
  else createReadStream(file).pipe(response)
})
server.listen(port, '127.0.0.1', () => console.log(`Flexa public site: http://127.0.0.1:${port}`))
