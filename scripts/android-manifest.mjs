#!/usr/bin/env node
// Tworzy update.json: opis najnowszego wydania, który aplikacja pobiera, żeby wiedzieć o aktualizacji.
//
//   node scripts/android-manifest.mjs --apk <plik.apk> --out <update.json> --tag android-v1.0.1
//        [--repo właściciel/repozytorium] [--url-base <adres>] [--version-file android/version.properties]
//        [--notes android/release-notes.txt] [--gradle android/app/build.gradle.kts]
//
// --url-base zastępuje adres z GitHub Releases (używane tylko do lokalnych testów aktualizacji).
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { readNotes, readVersionFile } from './lib/android-version.mjs'

export const SCHEMA = 1

/** Składa opis wydania z gotowych wartości; używają go zarówno wydanie, jak i lokalny serwer testowy. */
export function manifestFor({ apk, version, minSdk, urlBase, notes, now = new Date() }) {
  const bytes = readFileSync(apk)
  return {
    schema: SCHEMA,
    versionName: version.name,
    versionCode: version.code,
    minSupportedVersionCode: version.minSupported,
    minSdk,
    apkUrl: `${urlBase.replace(/\/$/, '')}/flexa.apk`,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    sizeBytes: bytes.length,
    releasedAt: now.toISOString(),
    notes,
  }
}

export function buildManifest({ apk, tag, repo, urlBase, versionFile, notesFile, gradleFile, now = new Date() }) {
  const version = readVersionFile(versionFile)
  if (tag && tag !== `android-v${version.name}`) {
    throw new Error(`Tag ${tag} nie pasuje do wersji ${version.name} z ${versionFile} (oczekiwano android-v${version.name}).`)
  }
  const minSdk = Number(/minSdk\s*=\s*(\d+)/.exec(readFileSync(gradleFile, 'utf8'))?.[1])
  if (!Number.isInteger(minSdk)) throw new Error(`Nie znaleziono minSdk w ${gradleFile}`)
  return manifestFor({
    apk,
    version,
    minSdk,
    urlBase: urlBase ?? `https://github.com/${repo}/releases/download/android-v${version.name}`,
    notes: readNotes(notesFile),
    now,
  })
}

function option(args, name, fallback) {
  const index = args.indexOf(name)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2)
  try {
    const apk = option(args, '--apk')
    const out = option(args, '--out', 'update.json')
    if (!apk) throw new Error('Podaj --apk <plik.apk>')
    const manifest = buildManifest({
      apk,
      tag: option(args, '--tag'),
      repo: option(args, '--repo', 'xsqezz/flexa.click'),
      urlBase: option(args, '--url-base'),
      versionFile: option(args, '--version-file', 'android/version.properties'),
      notesFile: option(args, '--notes', 'android/release-notes.txt'),
      gradleFile: option(args, '--gradle', 'android/app/build.gradle.kts'),
    })
    writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`)
    console.log(`Zapisano ${out}: wersja ${manifest.versionName} (${manifest.versionCode}), ${manifest.sizeBytes} B, sha256 ${manifest.sha256.slice(0, 12)}…`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
