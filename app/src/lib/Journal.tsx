import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Journal } from '../../../shared/domain'
import { DemoRepository, SupabaseRepository, type Command } from './repository'
import { supabase } from './supabase'
import { useAuth } from './Auth'

type JournalContextValue = {
  data: Journal | undefined; loading: boolean; error: string | null; pending: boolean
  execute: (command: Command) => Promise<void>; refresh: () => void
  syncState: 'live' | 'polling' | 'local'; syncing: boolean
}
const JournalContext = createContext<JournalContextValue | null>(null)

export function JournalProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const userId = auth.session?.user.id
  const [live, setLive] = useState(false)
  const repository = useMemo(() => {
    if (auth.mode === 'demo') return new DemoRepository()
    if (supabase && userId) return new SupabaseRepository(supabase, userId)
    throw new Error('Nie ma aktywnej sesji konta.')
  }, [auth.mode, userId])
  const key = useMemo(() => ['journal', auth.mode, userId ?? 'demo'], [auth.mode, userId])
  const query = useQuery({
    queryKey: key, queryFn: ({ signal }) => repository.load(signal),
    refetchInterval: auth.mode === 'cloud' ? 60_000 : false,
  })
  const mutation = useMutation({
    mutationFn: (command: Command) => repository.execute(command),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: key }) },
  })

  useEffect(() => {
    if (auth.mode !== 'cloud' || !supabase || !userId) return
    const channel = supabase.channel(`journal:${userId}`).on('postgres_changes', {
      event: '*', schema: 'public', filter: `user_id=eq.${userId}`,
    }, () => { void queryClient.invalidateQueries({ queryKey: key }) })
      .subscribe((status) => { setLive(status === 'SUBSCRIBED') })
    return () => { void supabase?.removeChannel(channel) }
  }, [auth.mode, userId, key, queryClient])

  return <JournalContext.Provider value={{
    data: query.data, loading: query.isPending,
    error: query.error ? auth.mode === 'demo' && query.error instanceof Error ? query.error.message
      : 'Nie udało się odczytać dziennika. Sprawdź połączenie, migrację bazy i uprawnienia konta. Twoje dane nie zostały zastąpione demem.' : null,
    pending: mutation.isPending,
    execute: async (command) => { await mutation.mutateAsync(command) },
    refresh: () => { void query.refetch() },
    syncState: auth.mode === 'demo' ? 'local' : live ? 'live' : 'polling',
    syncing: query.isFetching,
  }}>{children}</JournalContext.Provider>
}

export function useJournal() {
  const journal = useContext(JournalContext)
  if (!journal) throw new Error('JournalProvider is missing')
  return journal
}
