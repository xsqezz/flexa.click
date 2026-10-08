#!/usr/bin/env node
// Lokalny serwer do testowania aktualizacji aplikacji na Androida bez publikowania wydania.
// Wystawia update.json i flexa.apk; emulator widzi komputer pod adresem 10.0.2.2.
//
//   node scripts/android-update-server.mjs <nowy.apk> --version 1.0.1 --notes "Zmiana 1|Zmiana 2"
//        [--port 8099] [--force] [--min-supported <kod>] [--slow <ms na kawałek 256 kB>]
//
// Zainstalowana wersja debug musi być zbudowana z adresami tego serwera (zob. docs/ANDROID.md, „Test aktualizacji”).
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { manifestFor } from './android-manifest.mjs'
import { readVersionFile, versionCodeFor } from './lib/android-version.mjs'

const CHUNK = 256 * 1024

export function startUpdateServer({ apk, version, minSupported, notes, minSdk = 26, port = 8099, slowMs = 0, log = () => {} }) {
  const bytes = readFileSync(apk)
  const code = versionCodeFor(version)
  let manifest = ''
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname
    log(`${request.method} ${path} ${request.headers['user-agent'] ?? ''}`)
    if (path === '/update.json') {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      response.end(manifest)
    } else if (path === '/flexa.apk') {
      response.writeHead(200, { 'content-type': 'application/vnd.android.package-archive', 'content-length': bytes.length, 'cache-control': 'no-store' })
      let offset = 0
      const next = () => {
        if (offset >= bytes.length) return response.end()
        response.write(bytes.subarray(offset, offset + CHUNK))
        offset += CHUNK
        slowMs ? setTimeout(next, slowMs) : setImmediate(next)
      }
      next()
    } else {
      response.writeHead(404)
      response.end('not found')
    }
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '0.0.0.0', () => {
      const actualPort = server.address().port
      manifest = `${JSON.stringify(manifestFor({
        apk,
        version: { name: version, code, minSupported },
        minSdk,
        urlBase: `http://10.0.2.2:${actualPort}`,
        notes,
      }), null, 2)}\n`
      resolve({ server, port: actualPort, manifest: () => JSON.parse(manifest) })
    })
  })
}

function option(args, name) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2)
  try {
    const apk = args.find((arg) => /\.apk$/i.test(arg))
    const version = option(args, '--version')
    const notes = (option(args, '--notes') ?? '').split('|').map((line) => line.trim()).filter(Boolean)
    if (!apk || !version || notes.length === 0) {
      throw new Error('Użycie: node scripts/android-update-server.mjs <nowy.apk> --version X.Y.Z --notes "Zmiana 1|Zmiana 2" [--port 8099] [--force] [--min-supported <kod>] [--slow <ms>]')
    }
    const minSupported = args.includes('--force')
      ? versionCodeFor(version)
      : Number(option(args, '--min-supported') ?? readVersionFile('android/version.properties').minSupported)
    const { port, manifest } = await startUpdateServer({
      apk, version, minSupported, notes,
      port: Number(option(args, '--port') ?? 8099),
      slowMs: Number(option(args, '--slow') ?? 0),
      log: (line) => console.log(new Date().toISOString(), line),
    })
    const published = manifest()
    console.log(`Serwer aktualizacji: http://10.0.2.2:${port}/update.json (z komputera: http://localhost:${port}/update.json)`)
    console.log(`Wersja ${published.versionName} (${published.versionCode}), minimalna obsługiwana ${published.minSupportedVersionCode}, ${published.sizeBytes} B`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
