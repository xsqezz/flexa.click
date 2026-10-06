import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'

export async function callFunction(name: string, body: object): Promise<unknown> {
  if (!supabase) throw new Error('Usługa nie jest skonfigurowana.')
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      let payload: unknown
      try { payload = await error.context.json() }
      catch { throw new Error('Serwer zwrócił nieczytelną odpowiedź. Spróbuj ponownie.', { cause: error }) }
      if (typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'string') {
        throw new Error(payload.error)
      }
    }
    throw new Error('Nie udało się połączyć z funkcją serwera. Sprawdź wdrożenie i połączenie.', { cause: error })
  }
  return data
}
