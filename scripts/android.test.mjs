import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { buildManifest } from './android-manifest.mjs'
import { startUpdateServer } from './android-update-server.mjs'
import { compareVersions, parseVersion, readVersionFile, versionCodeFor } from './lib/android-version.mjs'

function workspace({ version = '1.2.3', code = 1002003, min = 1000000, notes = 'Pierwsza\n\n  Druga  \n', apk = 'fake apk bytes' } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'flexa-android-'))
  const files = {
    versionFile: join(dir, 'version.properties'),
    notesFile: join(dir, 'notes.txt'),
    gradleFile: join(dir, 'build.gradle.kts'),
    apk: join(dir, 'flexa.apk'),
  }
  writeFileSync(files.versionFile, `VERSION_NAME=${version}\nVERSION_CODE=${code}\nMIN_SUPPORTED_VERSION_CODE=${min}\n`)
  writeFileSync(files.notesFile, notes)
  writeFileSync(files.gradleFile, 'android {\n  defaultConfig {\n    minSdk = 26\n  }\n}\n')
  writeFileSync(files.apk, apk)
  return files
}

test('version codes grow with the version number', () => {
  assert.equal(versionCodeFor('1.0.0'), 1000000)
  assert.equal(versionCodeFor('1.2.3'), 1002003)
  assert.equal(versionCodeFor('2.0.0'), 2000000)
  assert.ok(compareVersions('1.0.10', '1.0.9') > 0)
  assert.ok(compareVersions('1.10.0', '1.9.99') > 0)
  assert.ok(compareVersions('1.0.0', '1.0.0') === 0)
  assert.throws(() => parseVersion('1.2'), /X\.Y\.Z/)
  assert.throws(() => parseVersion('1.2.3-beta'), /X\.Y\.Z/)
  assert.throws(() => parseVersion('1.1000.0'), /X\.Y\.Z/)
  assert.throws(() => parseVersion('2147.0.0'), /poza zakresem/)
})

test('the version file is validated', () => {
  const ok = workspace()
  assert.deepEqual(readVersionFile(ok.versionFile), { name: '1.2.3', code: 1002003, minSupported: 1000000 })
  assert.throws(() => readVersionFile(workspace({ code: 5 }).versionFile), /nie pasuje/)
  assert.throws(() => readVersionFile(workspace({ min: 2000000 }).versionFile), /MIN_SUPPORTED/)
})

test('the manifest describes the apk and the release', () => {
  const files = workspace()
  const manifest = buildManifest({ ...files, tag: 'android-v1.2.3', repo: 'owner/repo', now: new Date('2026-10-08T12:00:00Z') })
  assert.deepEqual(manifest, {
    schema: 1,
    versionName: '1.2.3',
    versionCode: 1002003,
    minSupportedVersionCode: 1000000,
    minSdk: 26,
    apkUrl: 'https://github.com/owner/repo/releases/download/android-v1.2.3/flexa.apk',
    sha256: createHash('sha256').update('fake apk bytes').digest('hex'),
    sizeBytes: 14,
    releasedAt: '2026-10-08T12:00:00.000Z',
    notes: ['Pierwsza', 'Druga'],
  })
})

test('the hash matches the file contents', () => {
  const files = workspace({ apk: 'abc' })
  const manifest = buildManifest({ ...files, repo: 'owner/repo' })
  assert.equal(manifest.sha256, createHash('sha256').update(readFileSync(files.apk)).digest('hex'))
})

test('a local url base replaces the GitHub address', () => {
  const manifest = buildManifest({ ...workspace(), urlBase: 'http://10.0.2.2:8099/dl/' })
  assert.equal(manifest.apkUrl, 'http://10.0.2.2:8099/dl/flexa.apk')
})

test('a tag that does not match the version is refused', () => {
  assert.throws(() => buildManifest({ ...workspace(), tag: 'android-v9.9.9', repo: 'owner/repo' }), /nie pasuje do wersji/)
})

test('the local update server publishes the manifest and streams the apk', async () => {
  const files = workspace({ apk: 'x'.repeat(600_000) })
  const { server, port, manifest } = await startUpdateServer({
    apk: files.apk, version: '1.4.0', minSupported: 1004000, notes: ['Nowość'], port: 0,
  })
  try {
    const published = await (await fetch(`http://127.0.0.1:${port}/update.json`)).json()
    assert.deepEqual(published, manifest())
    assert.equal(published.versionCode, 1004000)
    assert.equal(published.minSupportedVersionCode, 1004000)
    assert.equal(published.apkUrl, `http://10.0.2.2:${port}/flexa.apk`)
    const download = Buffer.from(await (await fetch(`http://127.0.0.1:${port}/flexa.apk`)).arrayBuffer())
    assert.equal(download.length, published.sizeBytes)
    assert.equal(createHash('sha256').update(download).digest('hex'), published.sha256)
    assert.equal((await fetch(`http://127.0.0.1:${port}/other`)).status, 404)
  } finally {
    server.close()
    server.closeAllConnections()
  }
})
