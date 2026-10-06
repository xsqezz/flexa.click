import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', '../supabase/functions/_tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
