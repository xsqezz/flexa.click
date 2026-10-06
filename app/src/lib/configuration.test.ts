import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({ fixtureClient: true })) }))

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })

describe('public backend configuration', () => {
  it('leaves cloud unavailable instead of pretending to save accounts', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '')
    const config = await import('./supabase')
    expect(config.supabase).toBeNull()
    expect(config.registrationConfigured).toBe(false)
  })
  it('accepts public keys and requires a real operator/contact for registration', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.example.invalid')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test_only')
    vi.stubEnv('VITE_PRIVACY_OPERATOR', 'Operator testowy')
    vi.stubEnv('VITE_PRIVACY_CONTACT', 'privacy@example.invalid')
    const config = await import('./supabase')
    expect(config.configurationError).toBeNull()
    expect(config.registrationConfigured).toBe(true)
  })
  it.each(['sb_secret_test_only', `eyJ0ZXN0.${btoa(JSON.stringify({ role: 'service_role' }))}.test`,
    `eyJ0ZXN0.${btoa(JSON.stringify({ sub: 'no-role' }))}.test`])('rejects a non-public key: %s', async (key) => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.example.invalid')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', key)
    const config = await import('./supabase')
    expect(config.configurationError).not.toBeNull()
    expect(config.supabase).toBeNull()
  })
  it.each(['http://test.example.invalid', 'ftp://localhost', 'https://user:password@test.example.invalid',
    'https://test.example.invalid/rest/v1'])('rejects an unsafe or non-origin URL: %s', async (url) => {
    vi.stubEnv('VITE_SUPABASE_URL', url)
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test_only')
    const config = await import('./supabase')
    expect(config.configurationError).not.toBeNull()
    expect(config.supabase).toBeNull()
  })
})
