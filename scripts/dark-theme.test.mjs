import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { SOURCE, TARGET, buildDarkTheme, darkColor } from './build-dark-theme.mjs'

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

test('app/src/theme-dark.css is up to date with styles.css (run node scripts/build-dark-theme.mjs)', () => {
  assert.equal(readFileSync(TARGET, 'utf8'), buildDarkTheme(readFileSync(SOURCE, 'utf8')))
})

test('light backgrounds become dark, dark text becomes light, mid-tones stay', () => {
  assert.ok(luminance(darkColor('#edf4eb', 'background')) < 0.05)
  assert.ok(luminance(darkColor('#20352b', 'text')) > 0.5)
  assert.equal(darkColor('#71985c', 'background'), '#71985c')
  assert.equal(darkColor('#14271c26', 'background'), '#14271c26')
})

test('key dark pairs meet WCAG AA contrast', () => {
  const css = readFileSync(TARGET, 'utf8')
  const variable = (name) => new RegExp(`${name}: (#[0-9a-f]{6})`).exec(css)?.[1]
  const page = /background: (#[0-9a-f]{6})/.exec(css)?.[1]
  const surface = variable('--surface')
  for (const [foreground, background, label] of [
    [variable('--text'), page, 'text on page'], [variable('--text'), surface, 'text on panel'],
    [variable('--muted'), surface, 'muted on panel'], [variable('--muted'), page, 'muted on page'],
    [variable('--pine'), surface, 'links on panel'], ['#ffffff', '#2f7650', 'button text'],
  ]) assert.ok(contrast(foreground, background) >= 4.5, `${label}: ${contrast(foreground, background).toFixed(2)}`)
})
