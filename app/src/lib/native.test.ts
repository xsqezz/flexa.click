import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ANDROID_APK_URL, ANDROID_CERT_SHA256, androidAppVersion, checkAppUpdate, saveJsonNatively } from './native'

function userAgent(value: string) {
  vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(value)
}

afterEach(() => {
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
