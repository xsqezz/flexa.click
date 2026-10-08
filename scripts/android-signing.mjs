#!/usr/bin/env node
// Klucz podpisujący aplikację na Androida. Android instaluje aktualizację tylko wtedy, gdy nowa wersja jest
// podpisana tym samym kluczem co zainstalowana, więc ten klucz trzeba zachować (kopia zapasowa!).
//
//   node scripts/android-signing.mjs create       tworzy keystore i plik z hasłami (nie nadpisuje istniejących)
//   node scripts/android-signing.mjs fingerprint  wypisuje odcisk SHA-256 certyfikatu
//   node scripts/android-signing.mjs github       zapisuje sekrety w GitHub Actions (wartości nie są wypisywane)
//
// Opcje: --dir <katalog> (domyślnie ~/.flexa/android-signing), --repo <właściciel/repozytorium>
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)
const command = args[0]
const option = (name, fallback) => {
  const index = args.indexOf(name)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}
const directory = resolve(option('--dir', join(homedir(), '.flexa', 'android-signing')))
const repository = option('--repo', 'xsqezz/flexa.click')
const keystorePath = join(directory, 'flexa-release.jks')
const propertiesPath = join(directory, 'signing.properties')
const alias = 'flexa'

function keytool() {
  const home = process.env.JAVA_HOME
  return home ? join(home, 'bin', process.platform === 'win32' ? 'keytool.exe' : 'keytool') : 'keytool'
}

function run(program, programArgs, { env = {}, input } = {}) {
  const result = spawnSync(program, programArgs, { env: { ...process.env, ...env }, encoding: 'utf8', input })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${program} zakończył się błędem:\n${result.stderr || result.stdout}`)
  return result.stdout
}

function readProperties() {
  if (!existsSync(propertiesPath)) throw new Error(`Brak ${propertiesPath}. Najpierw uruchom: node scripts/android-signing.mjs create`)
  const values = {}
  for (const line of readFileSync(propertiesPath, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Z_]+)=(.*)$/.exec(line)
    if (match) values[match[1]] = match[2]
  }
  return values
}

function fingerprint(values) {
  const listing = run(keytool(), ['-list', '-v', '-keystore', values.FLEXA_KEYSTORE_FILE, '-alias', values.FLEXA_KEY_ALIAS, '-storepass:env', 'FLEXA_PASSWORD'], {
    env: { FLEXA_PASSWORD: values.FLEXA_KEYSTORE_PASSWORD },
  })
  const match = /SHA-?256:\s*([0-9A-F:]{95})/i.exec(listing)
  if (!match) throw new Error('Nie udało się odczytać odcisku SHA-256.')
  return match[1].toUpperCase()
}

function create() {
  if (existsSync(keystorePath) || existsSync(propertiesPath)) {
    throw new Error(`Klucz już istnieje w ${directory}. Nie nadpisuję go: utrata klucza uniemożliwia aktualizacje zainstalowanych aplikacji.`)
  }
  mkdirSync(directory, { recursive: true })
  const password = randomBytes(24).toString('base64url')
  run(keytool(), [
    '-genkeypair', '-keystore', keystorePath, '-storetype', 'PKCS12', '-alias', alias,
    '-keyalg', 'RSA', '-keysize', '4096', '-validity', '36500',
    '-dname', 'CN=Flexa, OU=Android, O=Flexa, C=PL',
    '-storepass:env', 'FLEXA_PASSWORD', '-keypass:env', 'FLEXA_PASSWORD',
  ], { env: { FLEXA_PASSWORD: password } })
  writeFileSync(propertiesPath, [
    `FLEXA_KEYSTORE_FILE=${keystorePath.replaceAll('\\', '/')}`,
    `FLEXA_KEYSTORE_PASSWORD=${password}`,
    `FLEXA_KEY_ALIAS=${alias}`,
    `FLEXA_KEY_PASSWORD=${password}`,
    '',
  ].join('\n'), { mode: 0o600 })
  console.log(`Utworzono klucz: ${keystorePath}`)
  console.log(`Hasła zapisano w: ${propertiesPath}`)
  console.log(`Odcisk SHA-256: ${fingerprint(readProperties())}`)
  console.log('Zrób teraz kopię zapasową całego katalogu (np. w menedżerze haseł). GitHub nie pozwala odczytać sekretów z powrotem.')
}

function github() {
  const values = readProperties()
  const secrets = {
    ANDROID_KEYSTORE_BASE64: readFileSync(keystorePath).toString('base64'),
    ANDROID_KEYSTORE_PASSWORD: values.FLEXA_KEYSTORE_PASSWORD,
    ANDROID_KEY_ALIAS: values.FLEXA_KEY_ALIAS,
    ANDROID_KEY_PASSWORD: values.FLEXA_KEY_PASSWORD,
  }
  for (const [name, value] of Object.entries(secrets)) {
    run('gh', ['secret', 'set', name, '--repo', repository], { input: value })
    console.log(`Ustawiono sekret ${name} w ${repository}`)
  }
}

try {
  if (command === 'create') create()
  else if (command === 'fingerprint') console.log(fingerprint(readProperties()))
  else if (command === 'github') github()
  else {
    console.error('Użycie: node scripts/android-signing.mjs <create|fingerprint|github> [--dir katalog] [--repo właściciel/repozytorium]')
    process.exitCode = 2
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
