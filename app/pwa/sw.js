/* Flexa service worker — generated at build time by app/pwa/plugin.ts. Do not edit the built copy. */
/* Zasady: nie zapisujemy w pamięci niczego z konta (Supabase, /api) ani zapytań do innych domen.
   Strony HTML zawsze najpierw z sieci; bez sieci otwiera się zapisana powłoka aplikacji. */
const VERSION = '__VERSION__'
const ASSETS = __ASSETS__
const SHELL = `flexa-shell-${VERSION}`
const RUNTIME = 'flexa-runtime-v1'
const RUNTIME_LIMIT = 60
const scope = self.registration.scope
const resolve = (path) => new URL(path, scope).href
const SHELL_URL = resolve('./')

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL)
    await cache.addAll([SHELL_URL, ...ASSETS.map(resolve)])
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names.filter((name) => name.startsWith('flexa-shell-') && name !== SHELL).map((name) => caches.delete(name)))
    await self.clients.claim()
  })())
})

async function trim(cache) {
  const keys = await cache.keys()
  await Promise.all(keys.slice(0, Math.max(0, keys.length - RUNTIME_LIMIT)).map((key) => cache.delete(key)))
}

async function navigation(request) {
  try {
    return await fetch(request)
  } catch (error) {
    const shell = await caches.match(SHELL_URL, { cacheName: SHELL, ignoreVary: true })
    if (shell) return shell
    throw error
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreVary: true })
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok && response.type === 'basic') {
    const cache = await caches.open(RUNTIME)
    await cache.put(request, response.clone())
    await trim(cache)
  }
  return response
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(RUNTIME)
  const cached = await cache.match(request, { ignoreVary: true })
  const network = fetch(request).then(async (response) => {
    if (response.ok && response.type === 'basic') {
      await cache.put(request, response.clone())
      await trim(cache)
    }
    return response
  })
  if (cached) {
    event.waitUntil(network.catch(() => undefined))
    return cached
  }
  return network
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || request.headers.has('range')) return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || !request.url.startsWith(scope)) return
  const path = url.pathname.slice(new URL(scope).pathname.length)
  if (path.startsWith('api/') || path === 'sw.js') return
  if (request.mode === 'navigate') {
    event.respondWith(navigation(request))
  } else if (path.startsWith('assets/')) {
    event.respondWith(cacheFirst(request))
  } else {
    event.respondWith(staleWhileRevalidate(request, event))
  }
})
