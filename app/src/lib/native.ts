/**
 * Flexa działa też jako aplikacja na Androida (powłoka z WebView, zob. docs/ANDROID.md). Powłoka dopisuje swoją
 * wersję do User-Agent i udostępnia stronie mały kanał `window.flexaNative`; w zwykłej przeglądarce nic z tego nie istnieje.
 */
export const ANDROID_APK_URL = 'https://github.com/xsqezz/flexa.click/releases/latest/download/flexa.apk'

/** Odcisk SHA-256 certyfikatu, którym podpisujemy aplikację; test pilnuje zgodności z android/signing-fingerprint.txt. */
export const ANDROID_CERT_SHA256 = '6E:48:98:1B:51:24:BC:BD:F8:BC:F2:4C:A7:18:FA:94:21:DC:EE:5B:6E:0B:7D:E9:05:43:69:92:1B:CE:1B:70'

type NativeBridge = { postMessage: (message: string) => void }

/** Wersja aplikacji na Androida albo `null`, gdy strona jest otwarta w zwykłej przeglądarce. */
export function androidAppVersion(): string | null {
  if (typeof navigator === 'undefined') return null
  return /\bFlexaAndroid\/(\d+\.\d+\.\d+)/.exec(navigator.userAgent)?.[1] ?? null
}

function bridge(): NativeBridge | null {
  if (typeof window === 'undefined') return null
  const candidate = (window as unknown as { flexaNative?: unknown }).flexaNative
  return candidate && typeof (candidate as NativeBridge).postMessage === 'function' ? candidate as NativeBridge : null
}

/** Przekazuje eksport do systemowego okna „Zapisz jako”. Poza aplikacją zwraca `false`, więc przeglądarka pobierze plik sama. */
export function saveJsonNatively(name: string, text: string): boolean {
  const native = bridge()
  if (!native) return false
  native.postMessage(JSON.stringify({ type: 'save-file', name, mime: 'application/json', text }))
  return true
}

/** Prosi aplikację o sprawdzenie aktualizacji; wynik pokaże sama (okno albo komunikat). */
export function checkAppUpdate(): boolean {
  const native = bridge()
  if (!native) return false
  native.postMessage(JSON.stringify({ type: 'check-update' }))
  return true
}
