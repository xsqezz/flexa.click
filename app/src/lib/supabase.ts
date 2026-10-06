import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { validatePublicBackendConfiguration } from '../../../shared/configuration'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

export const configurationError = validatePublicBackendConfiguration(url, key)
export const supabase = url && key && !configurationError
  ? createClient<Database>(url, key, {
    db: { timeout: 15_000, retry: false },
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  })
  : null

export const privacyContact = import.meta.env.VITE_PRIVACY_CONTACT?.trim() ?? ''
export const privacyOperator = import.meta.env.VITE_PRIVACY_OPERATOR?.trim() ?? ''
export const registrationConfigured = Boolean(supabase && privacyContact && privacyOperator)
