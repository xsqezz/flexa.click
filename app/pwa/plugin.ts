import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'

/** Adres podstrony w zależności od routera: konta używają zwykłych ścieżek, demo na GitHub Pages — `#/`. */
function route(path: string, hashRouter: boolean): string {
  return hashRouter ? `./#/${path}` : `./${path}`
}

export function manifest(hashRouter: boolean) {
  const shortcut = (name: string, path: string) => ({ name, url: route(path, hashRouter), icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }] })
  return {
    name: 'Flexa — dziennik jedzenia i treningów',
    short_name: 'Flexa',
    description: 'Darmowy dziennik jedzenia, treningów i postępów. Twój rytm w jednym miejscu.',
    lang: 'pl',
    dir: 'ltr',
    id: './',
    start_url: './',
    scope: './',
    display: 'standalone',
    background_color: '#f5f7f6',
    theme_color: '#276043',
    categories: ['health', 'fitness', 'food', 'lifestyle'],
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      shortcut('Dziennik', 'journal'),
      shortcut('Plan treningowy', 'plan'),
      shortcut('Smart Kuchnia', 'kitchen'),
      shortcut('Postępy', 'progress'),
    ],
  }
}

/** Dodaje do builda manifest aplikacji i service worker z listą plików tej wersji (zmiana plików = nowa wersja). */
export function pwa({ hashRouter }: { hashRouter: boolean }): Plugin {
  return {
    name: 'flexa-pwa',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle).filter((file) => file.startsWith('assets/') && !file.endsWith('.map')).sort()
      const assets = [...files, 'favicon.svg', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png']
      const version = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 12)
      const template = readFileSync(join(import.meta.dirname, 'sw.js'), 'utf8')
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: `${JSON.stringify(manifest(hashRouter), null, 2)}\n` })
      this.emitFile({
        type: 'asset', fileName: 'sw.js',
        source: template.replace('__VERSION__', version).replace('__ASSETS__', JSON.stringify(assets)),
      })
    },
  }
}
