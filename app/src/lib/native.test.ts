import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ANDROID_APK_URL, ANDROID_CERT_SHA256, androidAppVersion, canSaveNatively, checkAppUpdate, getReminders, openNotificationSettings,
  mealRemindersSupported, remindersSupported, saveFileNatively, saveJsonNatively, setReminders, type ReminderSettings,
} from './native'

function userAgent(value: string) {
  vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(value)
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  delete (window as unknown as { flexaNative?: unknown }).flexaNative
})

describe('Android app detection', () => {
  it('reads the app version from the user agent', () => {
    userAgent('Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/133.0 Mobile Safari/537.36 FlexaAndroid/1.2.3')
    expect(androidAppVersion()).toBe('1.2.3')
  })

  it('accepts a version suffix such as -debug', () => {
    userAgent('Mozilla/5.0 Chrome/133 Mobile Safari/537.36 FlexaAndroid/1.0.0-debug')
    expect(androidAppVersion()).toBe('1.0.0')
  })

  it('is empty in a normal browser', () => {
    userAgent('Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/133.0 Mobile Safari/537.36')
    expect(androidAppVersion()).toBeNull()
    userAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/140.0')
    expect(androidAppVersion()).toBeNull()
  })

  it('does not mistake a similar token for the app', () => {
    userAgent('FlexaAndroidX/1.0.0 NotFlexaAndroid/1.0.0')
    expect(androidAppVersion()).toBeNull()
  })
})

describe('messages to the Android app', () => {
  it('does nothing without the app, so the browser can handle the file itself', () => {
    expect(saveJsonNatively('a.json', '{}')).toBe(false)
    expect(checkAppUpdate()).toBe(false)
  })

  it('hands an export to the app', () => {
    const postMessage = vi.fn()
    ;(window as unknown as { flexaNative: unknown }).flexaNative = { postMessage }
    expect(saveJsonNatively('flexa-cloud-2026-10-08.json', '{"a":1}')).toBe(true)
    expect(postMessage).toHaveBeenCalledTimes(1)
    expect(JSON.parse(postMessage.mock.calls[0][0] as string)).toEqual({
      type: 'save-file', name: 'flexa-cloud-2026-10-08.json', mime: 'application/json', text: '{"a":1}',
    })
  })

  it('asks the app to look for updates', () => {
    const postMessage = vi.fn()
    ;(window as unknown as { flexaNative: unknown }).flexaNative = { postMessage }
    expect(checkAppUpdate()).toBe(true)
    expect(JSON.parse(postMessage.mock.calls[0][0] as string)).toEqual({ type: 'check-update' })
  })

  it('ignores an object that is not a message channel', () => {
    ;(window as unknown as { flexaNative: unknown }).flexaNative = { postMessage: 'nope' }
    expect(saveJsonNatively('a.json', '{}')).toBe(false)
  })

  it('hands CSV files only to app versions that can save them', () => {
    const postMessage = vi.fn()
    ;(window as unknown as { flexaNative: unknown }).flexaNative = { postMessage }
    userAgent('Mozilla/5.0 Chrome/133 Mobile Safari/537.36 FlexaAndroid/1.0.4')
    expect(canSaveNatively('application/json')).toBe(true)
    expect(canSaveNatively('text/csv')).toBe(false)
    expect(saveFileNatively('posilki.csv', 'a;b', 'text/csv')).toBe(false)
    userAgent('Mozilla/5.0 Chrome/133 Mobile Safari/537.36 FlexaAndroid/1.1.0')
    expect(saveFileNatively('posilki.csv', 'a;b', 'text/csv')).toBe(true)
    expect(JSON.parse(postMessage.mock.calls[0][0] as string)).toEqual({ type: 'save-file', name: 'posilki.csv', mime: 'text/csv', text: 'a;b' })
  })
})

const APP_1_1 = 'Mozilla/5.0 (Linux; Android 16) Chrome/133.0 Mobile Safari/537.36 FlexaAndroid/1.1.0'
const settings: ReminderSettings = {
  training: { enabled: true, time: '18:30', weekdays: [0, 2, 4], sessions: [{ weekday: 0, name: 'Dzień 1: Całe ciało A', minutes: 45 }] },
  water: { enabled: true, from: '09:00', to: '21:00', everyHours: 2 },
}
type Sent = Record<string, unknown>

/** Imitates the object androidx.webkit injects: replies arrive asynchronously as `message` events. */
function mockApp(respond: (message: Sent) => unknown, style: 'listener' | 'onmessage' = 'listener') {
  userAgent(APP_1_1)
  const listeners: ((event: { data: unknown }) => void)[] = []
  const sent: Sent[] = []
  const native: Record<string, unknown> = {
    postMessage: (raw: string) => {
      const message = JSON.parse(raw) as Sent
      sent.push(message)
      const reply = respond(message)
      if (reply === undefined) return
      queueMicrotask(() => {
        const event = { data: typeof reply === 'string' ? reply : JSON.stringify(reply) }
        listeners.forEach((listener) => listener(event))
        ;(native.onmessage as ((event: { data: unknown }) => void) | undefined)?.(event)
      })
    },
  }
  if (style === 'listener') native.addEventListener = (_type: string, listener: (event: { data: unknown }) => void) => listeners.push(listener)
  ;(window as unknown as { flexaNative: unknown }).flexaNative = native
  return sent
}

const stateFor = (message: Sent, permission = 'granted') => ({
  type: 'reminders.state', id: message.id, training: message.training ?? settings.training,
  water: message.water ?? settings.water, permission, supported: true,
})

describe('reminders in the Android app', () => {
  it('are available only from app version 1.1.0 with the message channel', () => {
    expect(remindersSupported()).toBe(false)
    userAgent('Mozilla/5.0 Chrome/133 Mobile Safari/537.36 FlexaAndroid/1.0.9')
    ;(window as unknown as { flexaNative: unknown }).flexaNative = { postMessage: vi.fn() }
    expect(remindersSupported()).toBe(false)
    userAgent(APP_1_1)
    expect(remindersSupported()).toBe(true)
    userAgent('Mozilla/5.0 Chrome/133 Mobile Safari/537.36 FlexaAndroid/2.0.0')
    expect(remindersSupported()).toBe(true)
    delete (window as unknown as { flexaNative?: unknown }).flexaNative
    expect(remindersSupported()).toBe(false)
  })

  it('returns null without asking an app that cannot answer', async () => {
    const postMessage = vi.fn()
    userAgent('Mozilla/5.0 Chrome/133 Mobile Safari/537.36 FlexaAndroid/1.0.0')
    ;(window as unknown as { flexaNative: unknown }).flexaNative = { postMessage }
    await expect(getReminders()).resolves.toBeNull()
    expect(postMessage).not.toHaveBeenCalled()
    expect(openNotificationSettings()).toBe(false)
  })

  it('reads the current settings through message events', async () => {
    const sent = mockApp((message) => stateFor(message, 'default'))
    await expect(getReminders()).resolves.toEqual({ ...settings, permission: 'default', supported: true })
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ type: 'reminders.get' })
    expect(sent[0].id).toMatch(/^[A-Za-z0-9-]{1,40}$/)
  })

  it('also works with a channel that only offers onmessage', async () => {
    mockApp((message) => stateFor(message), 'onmessage')
    await expect(getReminders()).resolves.toMatchObject({ permission: 'granted' })
    await expect(getReminders()).resolves.toMatchObject({ permission: 'granted' })
  })

  it('saves settings and reports the notification permission', async () => {
    const sent = mockApp((message) => stateFor(message, 'denied'))
    await expect(setReminders(settings)).resolves.toEqual({ ...settings, permission: 'denied', supported: true })
    expect(sent[0]).toEqual({ type: 'reminders.set', id: sent[0].id, ...settings })
  })

  it('matches each reply to its own request', async () => {
    mockApp((message) => message.type === 'reminders.get'
      ? stateFor({ ...message, training: { ...settings.training, enabled: false } })
      : stateFor(message))
    const [read, saved] = await Promise.all([getReminders(), setReminders(settings)])
    expect(read?.training.enabled).toBe(false)
    expect(saved.training.enabled).toBe(true)
  })

  it('ignores replies meant for someone else and gives up after a timeout', async () => {
    vi.useFakeTimers()
    mockApp(() => ({ type: 'reminders.state', id: 'someone-else', ...settings, permission: 'granted', supported: true }))
    const read = getReminders(1_000)
    const saved = setReminders(settings, 2_000)
    const failure = expect(saved).rejects.toThrow('Aplikacja nie odpowiedziała')
    await vi.advanceTimersByTimeAsync(2_000)
    await expect(read).resolves.toBeNull()
    await failure
  })

  it('rejects malformed or refused replies', async () => {
    mockApp((message) => ({ ...stateFor(message), permission: 'maybe' }))
    await expect(setReminders(settings)).rejects.toThrow('nieznanym formacie')
    await expect(getReminders()).resolves.toBeNull()
    mockApp((message) => ({ ...stateFor(message), extra: true }))
    await expect(setReminders(settings)).rejects.toThrow('nieznanym formacie')
    mockApp((message) => ({ ...stateFor(message), water: { ...settings.water, everyHours: 9 } }))
    await expect(setReminders(settings)).rejects.toThrow('nieznanym formacie')
    mockApp((message) => 'not json' + String(message.id))
    await expect(getReminders(50)).resolves.toBeNull()
    mockApp((message) => ({ type: 'reminders.error', id: message.id, reason: 'invalid' }))
    await expect(setReminders(settings)).rejects.toThrow('nie przyjęła')
  })

  it('validates settings before sending them', async () => {
    const sent = mockApp((message) => stateFor(message))
    const invalid: ReminderSettings[] = [
      { ...settings, water: { ...settings.water, everyHours: 5 } },
      { ...settings, water: { ...settings.water, from: '21:00', to: '09:00' } },
      { ...settings, training: { ...settings.training, weekdays: [] } },
      { ...settings, training: { ...settings.training, weekdays: [7] } },
      { ...settings, training: { ...settings.training, weekdays: [1, 1] } },
      { ...settings, training: { ...settings.training, time: '7:00' } },
      { ...settings, training: { ...settings.training, title: 'a\nb' } },
    ]
    for (const value of invalid) await expect(setReminders(value)).rejects.toThrow('Sprawdź godziny i dni')
    expect(sent).toHaveLength(0)
    await expect(setReminders({ ...settings, training: { enabled: false, time: '18:00', weekdays: [] } })).resolves.toMatchObject({ permission: 'granted' })
  })

  it('opens the system notification settings', () => {
    const sent = mockApp(() => undefined)
    expect(openNotificationSettings()).toBe(true)
    expect(sent).toEqual([{ type: 'reminders.open-settings' }])
  })
})

describe('Android release identity', () => {
  const read = (path: string) => readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../..', path), 'utf8')

  it('shows the same certificate fingerprint that CI enforces and that app links trust', () => {
    expect(read('android/signing-fingerprint.txt').trim()).toBe(ANDROID_CERT_SHA256)
    const links = JSON.parse(read('app/public/.well-known/assetlinks.json')) as { target: { package_name: string; sha256_cert_fingerprints: string[] } }[]
    expect(links).toHaveLength(1)
    expect(links[0].target.package_name).toBe('click.flexa.app')
    expect(links[0].target.sha256_cert_fingerprints).toEqual([ANDROID_CERT_SHA256])
  })

  it('downloads the APK from this repository releases', () => {
    expect(ANDROID_APK_URL).toBe('https://github.com/xsqezz/flexa.click/releases/latest/download/flexa.apk')
    expect(ANDROID_CERT_SHA256).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/)
  })
})

describe('meal reminders (app 1.2.0+)', () => {
  const APP_1_2 = 'Mozilla/5.0 (Linux; Android 16) Chrome/133.0 Mobile Safari/537.36 FlexaAndroid/1.2.0'
  const withMeals: ReminderSettings = { ...settings, meals: { enabled: true, times: ['08:30', '13:30', '19:00'] } }

  it('are supported only from version 1.2.0', () => {
    mockApp((message) => stateFor(message))
    expect(mealRemindersSupported()).toBe(false)
    userAgent(APP_1_2)
    expect(mealRemindersSupported()).toBe(true)
  })

  it('are sent to a 1.2.0 app and read back from its state', async () => {
    const sent = mockApp((message) => ({ ...stateFor(message), meals: message.meals }))
    userAgent(APP_1_2)
    const state = await setReminders(withMeals)
    expect(sent[0]!.meals).toEqual({ enabled: true, times: ['08:30', '13:30', '19:00'] })
    expect(state.meals).toEqual({ enabled: true, times: ['08:30', '13:30', '19:00'] })
  })

  it('are left out for an older app, which rejects unknown fields', async () => {
    const sent = mockApp((message) => stateFor(message))
    await setReminders(withMeals)
    expect(sent[0]).not.toHaveProperty('meals')
  })

  it('refuse unordered, empty or duplicate times before anything is sent', async () => {
    const sent = mockApp((message) => stateFor(message))
    userAgent(APP_1_2)
    for (const times of [['19:00', '08:30'], ['08:30', '08:30'], [] as string[]]) {
      await expect(setReminders({ ...settings, meals: { enabled: true, times } })).rejects.toThrow()
    }
    expect(sent).toHaveLength(0)
  })
})
