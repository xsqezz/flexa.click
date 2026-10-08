// Wersje aplikacji na Androida: plik android/version.properties jest jedynym źródłem prawdy.
// Kod wersji (versionCode) wynika z numeru, więc nowszy numer zawsze oznacza nowszy kod:
//   X.Y.Z -> X * 1_000_000 + Y * 1_000 + Z   (np. 1.0.0 = 1000000, 1.2.3 = 1002003)
import { readFileSync, writeFileSync } from 'node:fs'

const VERSION = /^(\d{1,4})\.(\d{1,3})\.(\d{1,3})$/

export function parseVersion(name) {
  const match = VERSION.exec(name)
  if (!match) throw new Error(`Numer wersji musi mieć postać X.Y.Z (np. 1.2.3), a jest: "${name}"`)
  const [major, minor, patch] = match.slice(1).map(Number)
  if (minor > 999 || patch > 999 || major > 2146) throw new Error(`Numer wersji poza zakresem: "${name}"`)
  return { major, minor, patch }
}

export function versionCodeFor(name) {
  const { major, minor, patch } = parseVersion(name)
  return major * 1_000_000 + minor * 1_000 + patch
}

export function compareVersions(a, b) {
  return versionCodeFor(a) - versionCodeFor(b)
}

export function parseProperties(text) {
  const values = {}
  for (const line of text.split(/\r?\n/)) {
    if (line.trim().startsWith('#')) continue
    const match = /^\s*([A-Za-z0-9_.]+)\s*=\s*(.*?)\s*$/.exec(line)
    if (match) values[match[1]] = match[2]
  }
  return values
}

export function readVersionFile(path) {
  const values = parseProperties(readFileSync(path, 'utf8'))
  const name = values.VERSION_NAME
  const code = Number(values.VERSION_CODE)
  const minSupported = Number(values.MIN_SUPPORTED_VERSION_CODE)
  if (!name) throw new Error(`${path}: brakuje VERSION_NAME`)
  if (!Number.isInteger(code) || !Number.isInteger(minSupported)) throw new Error(`${path}: VERSION_CODE i MIN_SUPPORTED_VERSION_CODE muszą być liczbami`)
  if (code !== versionCodeFor(name)) throw new Error(`${path}: VERSION_CODE ${code} nie pasuje do wersji ${name} (powinno być ${versionCodeFor(name)})`)
  if (minSupported < 1 || minSupported > code) throw new Error(`${path}: MIN_SUPPORTED_VERSION_CODE musi mieścić się w zakresie 1..${code}`)
  return { name, code, minSupported }
}

export function writeVersionFile(path, { name, minSupported }) {
  writeFileSync(path, `VERSION_NAME=${name}\nVERSION_CODE=${versionCodeFor(name)}\nMIN_SUPPORTED_VERSION_CODE=${minSupported}\n`)
}

export function readNotes(path) {
  return readFileSync(path, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
}
