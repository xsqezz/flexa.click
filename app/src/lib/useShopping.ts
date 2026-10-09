import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { useAuth } from './Auth'
import { readShopping, subscribeShopping, writeShopping, type ShoppingItem } from './shopping'

/** Reactive view of this device's shopping list; every change is written to localStorage at once. */
export function useShopping(): { items: ShoppingItem[]; update: (change: (items: ShoppingItem[]) => ShoppingItem[]) => void } {
  const auth = useAuth()
  const scope = auth.session?.user.id ?? 'demo'
  const raw = useSyncExternalStore(
    subscribeShopping,
    () => { try { return localStorage.getItem(`flexa:shopping:v1:${scope}`) ?? '[]' } catch { return '[]' } },
    () => '[]',
  )
  const items = useMemo(() => { void raw; return readShopping(scope) }, [raw, scope])
  const update = useCallback((change: (current: ShoppingItem[]) => ShoppingItem[]) => {
    writeShopping(scope, change(readShopping(scope)))
  }, [scope])
  return { items, update }
}
