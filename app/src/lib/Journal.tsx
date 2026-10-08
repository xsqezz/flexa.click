import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Journal } from '../../../shared/domain'
import { DemoRepository, SupabaseRepository, type Command } from './repository'
import { supabase } from './supabase'
import { useAuth } from './Auth'
import { useFeedback } from '../components/Feedback'
import { rememberGoalsReviewed } from '../components/FirstSteps'

/** Usunięcia, które można cofnąć: wpis znika od razu, a zapis następuje dopiero po zniknięciu komunikatu „Cofnij”. */
export type UndoableDelete = Extract<Command, { type: 'meal.delete' | 'workout.delete' | 'measurement.delete' | 'water.delete' }>

type JournalContextValue = {
  data: Journal | undefined; loading: boolean; error: string | null; pending: boolean
  execute: (command: Command) => Promise<void>; refresh: () => void
  /** Ukrywa wpis i pokazuje komunikat z „Cofnij”; usunięcie trafia do bazy po kilku sekundach. */
  removeWithUndo: (command: UndoableDelete, message: string) => void
  syncState: 'live' | 'polling' | 'local'; syncing: boolean
}
const JournalContext = createContext<JournalContextValue | null>(null)

function withoutHidden(journal: Journal, hidden: ReadonlySet<string>): Journal {
  if (!hidden.size) return journal
  return {
    ...journal,
    meals: journal.meals.filter((item) => !hidden.has(item.id)),
    workouts: journal.workouts.filter((item) => !hidden.has(item.id)),
    water: journal.water.filter((item) => !hidden.has(item.id)),
    measurements: journal.measurements.filter((item) => !hidden.has(item.id)),
  }
}

export function JournalProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const feedback = useFeedback()
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
  const runCommand = mutation.mutateAsync
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set())
  const queued = useRef(new Map<string, UndoableDelete>())

  const unhide = useCallback((id: string) => setHidden((current) => {
    const next = new Set(current)
    next.delete(id)
    return next
  }), [])

  const commit = useCallback(async (id: string) => {
    const command = queued.current.get(id)
    if (!command) return
    queued.current.delete(id)
    try { await runCommand(command) }
    catch (cause) { feedback(cause instanceof Error ? cause.message : 'Nie udało się usunąć wpisu.', { tone: 'error' }) }
    finally { unhide(id) }
  }, [runCommand, feedback, unhide])

  const flush = useCallback(async () => {
    await Promise.all([...queued.current.keys()].map((id) => commit(id)))
  }, [commit])

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') void flush() }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onHide)
      void flush()
    }
  }, [flush])

  const removeWithUndo = useCallback((command: UndoableDelete, message: string) => {
    queued.current.set(command.id, command)
    setHidden((current) => new Set(current).add(command.id))
    feedback(message, {
      action: { label: 'Cofnij', onAction: () => { queued.current.delete(command.id); unhide(command.id) } },
      onDismiss: () => { void commit(command.id) },
    })
  }, [feedback, commit, unhide])

  const data = useMemo(() => query.data && withoutHidden(query.data, hidden), [query.data, hidden])

  useEffect(() => {
    if (auth.mode !== 'cloud' || !supabase || !userId) return
    const channel = supabase.channel(`journal:${userId}`).on('postgres_changes', {
      event: '*', schema: 'public', filter: `user_id=eq.${userId}`,
    }, () => { void queryClient.invalidateQueries({ queryKey: key }) })
      .subscribe((status) => { setLive(status === 'SUBSCRIBED') })
    return () => { void supabase?.removeChannel(channel) }
  }, [auth.mode, userId, key, queryClient])

  return <JournalContext.Provider value={{
    data, loading: query.isPending,
    error: query.error ? auth.mode === 'demo' && query.error instanceof Error ? query.error.message
      : 'Nie udało się odczytać dziennika. Sprawdź połączenie, migrację bazy i uprawnienia konta. Twoje dane nie zostały zastąpione demem.' : null,
    pending: mutation.isPending,
    execute: async (command) => {
      await flush()
      await runCommand(command)
      if (command.type === 'goals.start') rememberGoalsReviewed(userId)
    },
    removeWithUndo,
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
