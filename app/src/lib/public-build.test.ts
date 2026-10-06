// @vitest-environment node
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..', '..', '..')
const app = join(root, 'app')

describe('deployment artifact boundaries', () => {
  it('rejects a secret frontend key before emitting any Vite bundle', () => {
    const temporary = mkdtempSync(join(tmpdir(), 'flexa-public-build-'))
    const output = join(temporary, 'unsafe-artifact')
    const secret = 'sb_secret_test_only'
    try {
      const build = spawnSync(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--outDir', output], {
        cwd: app, encoding: 'utf8', env: {
          ...process.env, VITE_SUPABASE_URL: 'https://backend.example.invalid',
          VITE_SUPABASE_PUBLISHABLE_KEY: secret,
        },
      })
      expect(build.status).toBe(1)
      expect(`${build.stdout}${build.stderr}`).toContain('Niepoprawna publiczna konfiguracja backendu')
      expect(`${build.stdout}${build.stderr}`).not.toContain(secret)
      expect(existsSync(output)).toBe(false)
    } finally { rmSync(temporary, { recursive: true, force: true }) }
  })
  it('builds configured and setup-only Pages artifacts without stale custom domains', () => {
    const temporary = mkdtempSync(join(tmpdir(), 'flexa-pages-build-'))
    try {
      cpSync(join(root, 'site'), join(temporary, 'site'), { recursive: true })
      const build = (url: string, domain: string) => spawnSync(process.execPath, [join(root, 'scripts', 'build-site.mjs')], {
        cwd: temporary, encoding: 'utf8', env: { ...process.env, FLEXA_APP_URL: url, FLEXA_SITE_DOMAIN: domain },
      })
      expect(build('https://app.example.invalid', 'flexa.click').status).toBe(0)
      const html = readFileSync(join(temporary, 'dist-site', 'index.html'), 'utf8')
      expect(html).toContain('https://app.example.invalid/demo')
      expect(html).not.toContain('{{')
      expect(readFileSync(join(temporary, 'dist-site', 'CNAME'), 'utf8').trim()).toBe('flexa.click')
      expect(build('', '').status).toBe(0)
      expect(existsSync(join(temporary, 'dist-site', 'CNAME'))).toBe(false)
      expect(readFileSync(join(temporary, 'dist-site', 'index.html'), 'utf8')).toContain('Jak uruchomić Flexa')
      expect(build('ftp://localhost', '').status).toBe(1)
    } finally { rmSync(temporary, { recursive: true, force: true }) }
  })
})
