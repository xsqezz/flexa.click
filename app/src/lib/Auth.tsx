import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

type AuthContextValue = {
  session: Session | null; mode: 'guest' | 'cloud' | 'demo'
  loading: boolean; error: string | null
  enterDemo: () => void; signOut: () => Promise<void>
}
const AuthContext = createContext<AuthContextValue | null>(null)
const MODE_KEY = 'flexa:mode'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [demo, setDemo] = useState(() => sessionStorage.getItem(MODE_KEY) === 'demo')
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    let active = true
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, value) => {
      if (active) {
        setSession(value)
        setLoading(false)
      }
    })
    void supabase.auth.getSession().then(({ data, error: authError }) => {
      if (!active) return
      setSession(data.session)
      setError(authError ? 'Nie udało się odczytać sesji. Sprawdź połączenie i odśwież stronę.' : null)
      setLoading(false)
    }).catch((cause: unknown) => {
      if (active) {
        console.error('Session initialization failed', cause)
        setError('Nie udało się połączyć z usługą kont. Odśwież stronę lub wybierz demo.')
        setLoading(false)
      }
    })
    return () => { active = false; subscription.subscription.unsubscribe() }
  }, [])

  function enterDemo() {
    sessionStorage.setItem(MODE_KEY, 'demo')
    queryClient.clear()
    setDemo(true)
  }

  async function signOut() {
    if (!demo && supabase) {
      const { error: authError } = await supabase.auth.signOut({ scope: 'local' })
      if (authError) throw new Error('Nie udało się wylogować. Sprawdź połączenie i spróbuj ponownie.', { cause: authError })
      setSession(null)
    }
    sessionStorage.removeItem(MODE_KEY)
    queryClient.clear()
    setDemo(false)
  }

  return <AuthContext.Provider value={{
    session, mode: demo ? 'demo' : session ? 'cloud' : 'guest',
    loading: loading && !demo, error, enterDemo, signOut,
  }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('AuthProvider is missing')
  return auth
}
