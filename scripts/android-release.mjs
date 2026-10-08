#!/usr/bin/env node
// Wydaje nową wersję aplikacji na Androida: podbija numer, zapisuje opis zmian, robi commit i tag,
// a po wypchnięciu taga GitHub Actions buduje podpisany APK i publikuje go razem z update.json.
//
//   node scripts/android-release.mjs 1.0.1 --notes "Pierwsza zmiana|Druga zmiana"
//
// Opcje: --force      wymusza aktualizację (starsze wersje nie pozwolą korzystać z aplikacji bez niej)
//        --dry-run    pokazuje, co zostałoby zrobione, niczego nie zmieniając
//        --no-push    robi commit i tag lokalnie, bez wypychania
import { spawnSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { compareVersions, readVersionFile, versionCodeFor, writeVersionFile } from './lib/android-version.mjs'

const VERSION_FILE = 'android/version.properties'
const NOTES_FILE = 'android/release-notes.txt'

const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const option = (name) => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

function git(...gitArgs) {
  const result = spawnSync('git', gitArgs, { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`git ${gitArgs.join(' ')} nie powiodło się:\n${result.stderr || result.stdout}`)
  return result.stdout.trim()
}

function main() {
  const version = args.find((arg) => /^\d/.test(arg))
  const notes = (option('--notes') ?? '').split('|').map((line) => line.trim()).filter(Boolean)
  if (!version || notes.length === 0) {
    throw new Error('Użycie: node scripts/android-release.mjs <X.Y.Z> --notes "Zmiana 1|Zmiana 2" [--force] [--dry-run] [--no-push]')
  }
  if (!existsSync(VERSION_FILE)) throw new Error(`Uruchom skrypt z katalogu głównego repozytorium (brak ${VERSION_FILE}).`)
  const current = readVersionFile(VERSION_FILE)
  if (compareVersions(version, current.name) <= 0) {
    throw new Error(`Nowa wersja ${version} musi być wyższa niż obecna ${current.name}.`)
  }
  const tag = `android-v${version}`
  if (git('tag', '--list', tag)) throw new Error(`Tag ${tag} już istnieje.`)
  if (git('status', '--porcelain')) throw new Error('Drzewo robocze ma niezatwierdzone zmiany. Zatwierdź je albo schowaj przed wydaniem.')

  const minSupported = flag('--force') ? versionCodeFor(version) : current.minSupported
  console.log(`Wydanie ${current.name} -> ${version} (kod ${versionCodeFor(version)}${flag('--force') ? ', wymuszona aktualizacja' : ''})`)
  notes.forEach((line) => console.log(`  • ${line}`))
  if (flag('--dry-run')) return

  writeVersionFile(VERSION_FILE, { name: version, minSupported })
  writeFileSync(NOTES_FILE, `${notes.join('\n')}\n`)
  git('add', VERSION_FILE, NOTES_FILE)
  git('commit', '-m', `Release Android ${version}`)
  git('tag', '-a', tag, '-m', `Flexa na Androida ${version}`)
  if (flag('--no-push')) {
    console.log(`Gotowe lokalnie. Wypchnij: git push && git push origin ${tag}`)
    return
  }
  git('push')
  git('push', 'origin', tag)
  console.log(`Wypchnięto ${tag}. GitHub Actions zbuduje APK i opublikuje wydanie: https://github.com/xsqezz/flexa.click/actions`)
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
