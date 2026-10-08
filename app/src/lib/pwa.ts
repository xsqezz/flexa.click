import { androidAppVersion } from './native'

/**
 * Rejestruje service worker, dzięki któremu Flexa instaluje się jak aplikacja i otwiera bez sieci.
 * Pomijamy go w trybie deweloperskim i w aplikacji na Androida, która ma własny ekran braku połączenia.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator) || androidAppVersion()) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // Bez service workera aplikacja działa normalnie, tylko nie otworzy się offline.
    })
  })
}

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
let deferred: InstallPrompt | null = null
const listeners = new Set<() => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferred = event as InstallPrompt
    listeners.forEach((listener) => listener())
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    listeners.forEach((listener) => listener())
  })
}

/** Czy przeglądarka pozwala teraz zainstalować Flexa przyciskiem (Chrome, Edge, Android). */
export function canInstall(): boolean {
  return deferred !== null
}

export function onInstallAvailabilityChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export async function promptInstall(): Promise<boolean> {
  const prompt = deferred
  if (!prompt) return false
  await prompt.prompt()
  const choice = await prompt.userChoice
  deferred = null
  listeners.forEach((listener) => listener())
  return choice.outcome === 'accepted'
}

/** Czy Flexa działa już jako zainstalowana aplikacja (okno bez paska przeglądarki). */
export function isStandalone(): boolean {
  return typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true)
}

export function isAppleMobile(): boolean {
  return typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent)
}
