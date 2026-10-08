/**
 * Flexa działa też jako aplikacja na Androida (powłoka z WebView, zob. docs/ANDROID.md). Powłoka dopisuje swoją
 * wersję do User-Agent i udostępnia stronie mały kanał `window.flexaNative`; w zwykłej przeglądarce nic z tego nie istnieje.
 */
import { z } from 'zod'

export const ANDROID_APK_URL = 'https://github.com/xsqezz/flexa.click/releases/latest/download/flexa.apk'

/** Odcisk SHA-256 certyfikatu, którym podpisujemy aplikację; test pilnuje zgodności z android/signing-fingerprint.txt. */
export const ANDROID_CERT_SHA256 = '6E:48:98:1B:51:24:BC:BD:F8:BC:F2:4C:A7:18:FA:94:21:DC:EE:5B:6E:0B:7D:E9:05:43:69:92:1B:CE:1B:70'

type NativeEvent = { data?: unknown }
type NativeListener = (event: NativeEvent) => void
/** Obiekt wstrzykiwany przez androidx.webkit (`WebViewCompat.addWebMessageListener`): odpowiedzi przychodzą jako zdarzenia `message`. */
type NativeBridge = {
  postMessage: (message: string) => void
  addEventListener?: (type: 'message', listener: NativeListener) => void
  onmessage?: NativeListener | null
}

/** Wersja aplikacji na Androida albo `null`, gdy strona jest otwarta w zwykłej przeglądarce. */
export function androidAppVersion(): string | null {
  if (typeof navigator === 'undefined') return null
  return /\bFlexaAndroid\/(\d+\.\d+\.\d+)/.exec(navigator.userAgent)?.[1] ?? null
}

/** Czy zainstalowana aplikacja ma co najmniej podaną wersję (`[1, 1]` = 1.1.0). */
function appAtLeast(major: number, minor: number): boolean {
  const version = androidAppVersion()
  if (!version) return false
  const [appMajor, appMinor] = version.split('.').map(Number)
  return appMajor > major || (appMajor === major && appMinor >= minor)
}

function bridge(): NativeBridge | null {
  if (typeof window === 'undefined') return null
  const candidate = (window as unknown as { flexaNative?: unknown }).flexaNative
  return candidate && typeof (candidate as NativeBridge).postMessage === 'function' ? candidate as NativeBridge : null
}

export type SavedFileType = 'application/json' | 'text/csv'

/** Czy zainstalowana wersja aplikacji umie zapisać dany typ pliku (CSV od 1.1.0). */
export function canSaveNatively(mime: SavedFileType): boolean {
  if (!androidAppVersion() || !bridge()) return false
  if (mime === 'application/json') return true
  return appAtLeast(1, 1)
}

/** Przekazuje plik do systemowego okna „Zapisz jako”. Poza aplikacją (albo w starszej wersji) zwraca `false`, więc przeglądarka pobierze plik sama. */
export function saveFileNatively(name: string, text: string, mime: SavedFileType): boolean {
  const native = bridge()
  if (!native || !canSaveNatively(mime)) return false
  native.postMessage(JSON.stringify({ type: 'save-file', name, mime, text }))
  return true
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

// Przypomnienia (aplikacja 1.1.0+). Ustawienia zostają w telefonie; strona tylko je wysyła i odczytuje.

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const weekdaySchema = z.number().int().min(0).max(6)
const unique = (values: number[]) => new Set(values).size === values.length
const reminderText = z.string().trim().min(1).max(120).regex(/^[^\p{Cc}]*$/u)

export const reminderSettingsSchema = z.strictObject({
  training: z.strictObject({
    enabled: z.boolean(),
    time: timeSchema,
    /** 0 = poniedziałek … 6 = niedziela, tak jak w planie treningowym. */
    weekdays: z.array(weekdaySchema).max(7).refine(unique),
    title: reminderText.optional(),
    sessions: z.array(z.strictObject({ weekday: weekdaySchema, name: reminderText, minutes: z.number().int().min(1).max(600) }))
      .max(7).refine((sessions) => unique(sessions.map((session) => session.weekday))).optional(),
  }).refine((training) => !training.enabled || training.weekdays.length > 0),
  water: z.strictObject({
    enabled: z.boolean(), from: timeSchema, to: timeSchema, everyHours: z.number().int().min(1).max(4),
  }).refine((water) => water.from < water.to),
})
export type ReminderSettings = z.infer<typeof reminderSettingsSchema>
export type NotificationPermission = 'granted' | 'denied' | 'default'
export type ReminderState = ReminderSettings & { permission: NotificationPermission; supported: true }

const replySchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('reminders.state'), id: z.string().optional(),
    training: reminderSettingsSchema.shape.training, water: reminderSettingsSchema.shape.water,
    permission: z.enum(['granted', 'denied', 'default']), supported: z.literal(true),
  }),
  z.strictObject({ type: z.literal('reminders.error'), id: z.string().optional(), reason: z.string() }),
])

export const REMINDERS_GET_TIMEOUT_MS = 5_000
/** Zapis może czekać na systemowe pytanie o zgodę na powiadomienia, więc daje użytkownikowi czas. */
export const REMINDERS_SET_TIMEOUT_MS = 120_000

export class NativeReplyError extends Error {}

/** Czy ta wersja aplikacji obsługuje przypomnienia (od 1.1.0). */
export function remindersSupported(): boolean {
  return bridge() !== null && appAtLeast(1, 1)
}

const pending = new Map<string, (reply: unknown) => void>()
const listening = new WeakSet<object>()
let sequence = 0

function dispatch(event: NativeEvent) {
  if (typeof event?.data !== 'string') return
  let reply: unknown
  try { reply = JSON.parse(event.data) } catch { return }
  const id = (reply as { id?: unknown } | null)?.id
  if (typeof id !== 'string') return
  pending.get(id)?.(reply)
}

function listen(native: NativeBridge) {
  if (listening.has(native)) return
  listening.add(native)
  if (typeof native.addEventListener === 'function') { native.addEventListener('message', dispatch); return }
  const previous = native.onmessage
  native.onmessage = (event) => { previous?.(event); dispatch(event) }
}

function request(message: Record<string, unknown>, timeoutMs: number): Promise<ReminderState> {
  const native = bridge()
  if (!native || !remindersSupported()) return Promise.reject(new NativeReplyError('Ta wersja aplikacji nie obsługuje przypomnień.'))
  listen(native)
  sequence += 1
  const id = `r-${Date.now().toString(36)}-${sequence}`
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new NativeReplyError('Aplikacja nie odpowiedziała. Spróbuj ponownie.'))
    }, timeoutMs)
    pending.set(id, (raw) => {
      pending.delete(id)
      clearTimeout(timer)
      const reply = replySchema.safeParse(raw)
      if (!reply.success) reject(new NativeReplyError('Aplikacja odpowiedziała w nieznanym formacie. Zaktualizuj ją i spróbuj ponownie.'))
      else if (reply.data.type === 'reminders.error') reject(new NativeReplyError('Aplikacja nie przyjęła tych ustawień. Sprawdź godziny i dni.'))
      else {
        const { training, water, permission, supported } = reply.data
        resolve({ training, water, permission, supported })
      }
    })
    native.postMessage(JSON.stringify({ ...message, id }))
  })
}

/** Aktualne ustawienia przypomnień z aplikacji albo `null`, gdy nie są dostępne (przeglądarka, starsza wersja, brak odpowiedzi). */
export async function getReminders(timeoutMs = REMINDERS_GET_TIMEOUT_MS): Promise<ReminderState | null> {
  if (!remindersSupported()) return null
  try { return await request({ type: 'reminders.get' }, timeoutMs) } catch { return null }
}

/** Zapisuje ustawienia w aplikacji. Gdy włączasz przypomnienie, Android 13+ zapyta o zgodę na powiadomienia; odpowiedź zawiera wynik. */
export async function setReminders(settings: ReminderSettings, timeoutMs = REMINDERS_SET_TIMEOUT_MS): Promise<ReminderState> {
  const parsed = reminderSettingsSchema.safeParse(settings)
  if (!parsed.success) throw new NativeReplyError('Sprawdź godziny i dni przypomnień.')
  return request({ type: 'reminders.set', ...parsed.data }, timeoutMs)
}

/** Otwiera systemowe ustawienia powiadomień Flexa (gdy zgoda została odrzucona). */
export function openNotificationSettings(): boolean {
  const native = bridge()
  if (!native || !remindersSupported()) return false
  native.postMessage(JSON.stringify({ type: 'reminders.open-settings' }))
  return true
}
