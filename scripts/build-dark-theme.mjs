#!/usr/bin/env node
// Tworzy ciemny motyw (app/src/theme-dark.css) z jasnego arkusza app/src/styles.css.
// Każdą regułę z kolorami powtarzamy w @media (prefers-color-scheme: dark) z kolorami przeliczonymi w OKLab:
// jasne tła ciemnieją, ciemny tekst jaśnieje, odcień zostaje. Uruchom po każdej zmianie kolorów w styles.css:
//   node scripts/build-dark-theme.mjs        (test w scripts/dark-theme.test.mjs pilnuje, czy plik jest aktualny)
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = join(import.meta.dirname, '..')
export const SOURCE = join(root, 'app', 'src', 'styles.css')
export const TARGET = join(root, 'app', 'src', 'theme-dark.css')

/** Zmienne motywu w trybie ciemnym. --pine służy tu jako kolor tekstu i obramowań, więc jest jaśniejszy. */
const VARIABLES = {
  '--pine': '#7cc59a', '--pine-dark': '#a5dcb9', '--text': '#e3ece6', '--muted': '#a3b4aa', '--line': '#2c3a32',
  '--surface': '#18211c', '--protein': '#7fb2e6', '--carbs': '#e0ad5f', '--fat': '#b99be0',
  '--ink-soft': '#c4d3c9', '--wash': '#1f2c25',
}
/** Przyciski i powierzchnie z białym tekstem: ciemniejsza zieleń, żeby biały tekst miał kontrast co najmniej 4,5:1. */
const SOLID = { 'var(--pine)': '#2f7650', 'var(--pine-dark)': '#256140' }
const PAGE_BACKGROUND = '#0f1612'
/** Tło strony jest najciemniejsze, a białe panele odrobinę jaśniejsze — jak „uniesione” karty. */
const EXACT_BACKGROUND = { '#f5f7f6': PAGE_BACKGROUND, '#f7f9f6': PAGE_BACKGROUND, '#ffffff': VARIABLES['--surface'], '#fff': VARIABLES['--surface'] }

// --- kolory: hex <-> OKLab -------------------------------------------------------------------------
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

function parseHex(hex) {
  let value = hex.slice(1)
  if (value.length === 3 || value.length === 4) value = [...value].map((char) => char + char).join('')
  const [r, g, b] = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16) / 255)
  const alpha = value.length === 8 ? value.slice(6) : ''
  return { r, g, b, alpha }
}

function toOklab({ r, g, b }) {
  const [lr, lg, lb] = [r, g, b].map(toLinear)
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  }
}

function fromOklab({ L, a, b }) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  return `#${rgb.map((c) => Math.round(Math.min(1, Math.max(0, toGamma(Math.min(1, Math.max(0, c))))) * 255).toString(16).padStart(2, '0')).join('')}`
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

/** Przelicza kolor w zależności od roli: tło, tekst albo linia. */
export function darkColor(hex, role) {
  const exact = role === 'background' ? EXACT_BACKGROUND[hex.toLowerCase()] : undefined
  if (exact) return exact
  const parsed = parseHex(hex)
  const lab = toOklab(parsed)
  if (parsed.alpha) {
    // Półprzezroczyste cienie i tła okien dialogowych: ciemne zostają, jasne nakładki słabną.
    if (lab.L < 0.5) return hex
    return `${fromOklab({ ...lab, L: 0.35 })}${parsed.alpha}`
  }
  let L = lab.L
  let chroma = 1
  if (role === 'background') {
    if (L < 0.8) return hex
    L = clamp(0.2 + (1 - L) * 1.5, 0.19, 0.42)
    chroma = 2.2
  } else if (role === 'border') {
    if (L < 0.8) return hex
    L = clamp(0.3 + (1 - L) * 0.8, 0.3, 0.5)
    chroma = 1.6
  } else {
    if (L > 0.62) return hex
    L = clamp(1.04 - L * 0.6, 0.62, 0.92)
  }
  return fromOklab({ L, a: lab.a * chroma, b: lab.b * chroma })
}

// --- arkusz: proste parsowanie reguł i bloków @media -----------------------------------------------
function parseBlocks(css) {
  const blocks = []
  let index = 0
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '')
  while (index < text.length) {
    const open = text.indexOf('{', index)
    if (open < 0) break
    const prelude = text.slice(index, open).trim()
    let depth = 1
    let cursor = open + 1
    while (cursor < text.length && depth > 0) {
      if (text[cursor] === '{') depth++
      else if (text[cursor] === '}') depth--
      cursor++
    }
    const body = text.slice(open + 1, cursor - 1)
    if (prelude.startsWith('@media')) blocks.push({ media: prelude, children: parseBlocks(body) })
    else if (!prelude.startsWith('@')) blocks.push({ selector: prelude, body })
    index = cursor
  }
  return blocks
}

const COLOR = /#[0-9a-fA-F]{3,8}\b|\bwhite\b|\bvar\(--(?:pine|pine-dark|surface)\)/g

function roleFor(property) {
  if (/^(background|background-color|box-shadow)$/.test(property)) return 'background'
  if (/^(border|border-(top|right|bottom|left)(-color)?|border-color|outline|outline-color|text-decoration|text-decoration-color|column-rule)$/.test(property)) return 'border'
  if (/^(color|fill|stroke|caret-color|accent-color)$/.test(property)) return 'text'
  return null
}

function convertDeclaration(declaration) {
  const colon = declaration.indexOf(':')
  if (colon < 0) return null
  const property = declaration.slice(0, colon).trim()
  const value = declaration.slice(colon + 1).trim()
  if (property.startsWith('--')) return null
  const role = roleFor(property)
  if (!role) return null
  if (property === 'box-shadow') {
    // Cienie zostają ciemne; zmieniamy tylko „wewnętrzne obramowania” rysowane jasnym kolorem.
    if (!/inset/.test(value)) return null
  }
  let changed = false
  const next = value.replace(COLOR, (match) => {
    let result = match
    if (match === 'white') result = role === 'text' ? match : darkColor('#ffffff', role)
    else if (match.startsWith('var(')) {
      if (role === 'background' && SOLID[match]) result = SOLID[match]
      else if (role === 'text' && match === 'var(--surface)') result = '#ffffff'
    } else result = darkColor(match, role === 'background' && property === 'box-shadow' ? 'border' : role)
    if (result !== match) changed = true
    return result
  })
  return changed ? `${property}: ${next}` : null
}

function convertRule({ selector, body }) {
  if (selector === ':root') return null
  const declarations = body.split(';').map((part) => part.trim()).filter(Boolean).map(convertDeclaration).filter(Boolean)
  return declarations.length ? `${selector} { ${declarations.join('; ')}; }` : null
}

/** Ręcznie dobrane reguły dla kolorów zapisanych w atrybutach SVG (wykresy, szklanki wody), których nie ma w styles.css. */
const EXTRA = [
  '.chart-svg line[stroke="#e4eae5"] { stroke: #2c3a32; }',
  '.chart-svg polyline[stroke="#326b49"] { stroke: #7cc59a; }',
  '.chart-svg circle[fill="#326b49"] { fill: #7cc59a; }',
  '.chart-svg rect[fill="#729263"] { fill: #6fa57f; }',
  '.chart-svg line[stroke="#7a9566"] { stroke: #9bbf8c; }',
  '.water-glasses path[fill="#eef3f6"] { fill: #243039; }',
  '.water-glasses path[stroke="#7a9bb9"] { stroke: #6f93b3; }',
]

export function buildDarkTheme(css) {
  const lines = []
  for (const block of parseBlocks(css)) {
    if (block.media) {
      const inner = block.children.map((child) => (child.selector ? convertRule(child) : null)).filter(Boolean)
      if (inner.length) lines.push(`@media ${block.media.slice(6).trim()} {`, ...inner.map((line) => `  ${line}`), '}')
    } else {
      const rule = convertRule(block)
      if (rule) lines.push(rule)
    }
  }
  const variables = Object.entries(VARIABLES).map(([name, value]) => `${name}: ${value};`).join(' ')
  return [
    '/* Ciemny motyw — plik generowany przez scripts/build-dark-theme.mjs ze styles.css. Nie edytuj ręcznie. */',
    '@media (prefers-color-scheme: dark) {',
    `  :root { color-scheme: dark; color: ${VARIABLES['--text']}; background: ${PAGE_BACKGROUND}; ${variables} }`,
    ...lines.map((line) => `  ${line}`.replace(/\n {2}/g, '\n    ')),
    ...EXTRA.map((line) => `  ${line}`),
    '}',
    '',
  ].join('\n')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeFileSync(TARGET, buildDarkTheme(readFileSync(SOURCE, 'utf8')))
  console.log(`Zapisano ${TARGET}`)
}
