export function validatePublicBackendConfiguration(urlValue?: string, keyValue?: string): string | null {
  const url = urlValue?.trim()
  const key = keyValue?.trim()
  if (!url && !key) return null
  if (!url || !key) return 'Uzupełnij obie zmienne Supabase w pliku app/.env.'
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(parsed.hostname))) {
      return 'Adres Supabase musi używać HTTPS (poza lokalnym środowiskiem).'
    }
    if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') {
      return 'Podaj origin projektu Supabase, bez ścieżki, hasła i parametrów.'
    }
  } catch {
    return 'VITE_SUPABASE_URL nie jest poprawnym adresem.'
  }
  if (key.startsWith('sb_secret_')) return 'Nie wolno używać tajnego klucza Supabase we frontendzie.'
  if (key.length > 8192 || /\s/.test(key)) return 'Publiczny klucz Supabase ma niepoprawny format.'
  if (key.startsWith('eyJ')) {
    try {
      const payload: unknown = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      if (typeof payload !== 'object' || payload === null || !('role' in payload) || payload.role !== 'anon') {
        return 'Frontend wymaga klucza anon/publishable, nigdy service_role.'
      }
    } catch {
      return 'Klucz Supabase ma niepoprawny format.'
    }
  } else if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
    return 'Użyj publicznego klucza publishable lub anon z ustawień Supabase.'
  }
  return null
}
