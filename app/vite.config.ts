import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { validatePublicBackendConfiguration } from '../shared/configuration.ts'

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, import.meta.dirname, 'VITE_')
  const error = validatePublicBackendConfiguration(environment.VITE_SUPABASE_URL, environment.VITE_SUPABASE_PUBLISHABLE_KEY)
  if (error) throw new Error(`Niepoprawna publiczna konfiguracja backendu: ${error}`)
  return {
    plugins: [react()],
    server: { host: '127.0.0.1', port: 5173 },
    preview: { host: '127.0.0.1', port: 4173 },
  }
})
