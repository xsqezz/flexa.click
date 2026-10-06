import { createClient } from '@supabase/supabase-js'

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function env(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new HttpError(503, `Brakuje konfiguracji serwera (${name}).`)
  return value
}

export function adminClient() {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function requireUser(request: Request) {
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) throw new HttpError(401, 'Zaloguj się ponownie.')
  const client = createClient(
    env('SUPABASE_URL'),
    Deno.env.get('SUPABASE_ANON_KEY') ?? env('SUPABASE_PUBLISHABLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: authorization } } },
  )
  const { data, error } = await client.auth.getUser(authorization.slice(7))
  if (error || !data.user) throw new HttpError(401, 'Sesja wygasła. Zaloguj się ponownie.')
  return { user: data.user, client }
}

export async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    throw new HttpError(415, 'Żądanie musi mieć format JSON.')
  }
  const reader = request.body?.getReader()
  if (!reader) throw new HttpError(400, 'Brak treści żądania.')
  const parts: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 16_384) {
        await reader.cancel()
        throw new HttpError(413, 'Żądanie jest zbyt duże.')
      }
      parts.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength }
  try { return JSON.parse(new TextDecoder().decode(bytes)) }
  catch { throw new HttpError(400, 'Niepoprawny JSON.') }
}

export function endpoint(handler: (request: Request) => Promise<unknown>) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('origin')
    const allowed = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((value) => value.trim())
    const headers = new Headers({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Vary': 'Origin',
    })
    if (origin && allowed.includes(origin)) headers.set('Access-Control-Allow-Origin', origin)
    try {
      if (origin && !allowed.includes(origin)) throw new HttpError(403, 'Ten adres aplikacji nie jest dozwolony w konfiguracji serwera.')
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
      if (request.method !== 'POST') throw new HttpError(405, 'Użyj metody POST.')
      return new Response(JSON.stringify(await handler(request)), { headers })
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500
      const message = error instanceof HttpError ? error.message : 'Błąd serwera. Spróbuj ponownie później.'
      console.error('Flexa endpoint failed', { status, type: error instanceof Error ? error.name : 'Unknown' })
      if (status === 429) headers.set('Retry-After', '60')
      return new Response(JSON.stringify({ error: message }), { status, headers })
    }
  }
}
