import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/Auth'
import { useJournal } from '../lib/Journal'
import { useWorkspace } from './Workspace'

const key = (user: string) => `flexa:first-steps:${user}`

/** Zapamiętuje, że użytkownik przejrzał cele (po zapisie profilu). */
export function rememberGoalsReviewed(user: string | undefined) {
  if (!user) return
  try {
    const saved = JSON.parse(localStorage.getItem(key(user)) ?? '{}') as Record<string, unknown>
    localStorage.setItem(key(user), JSON.stringify({ ...saved, goals: true }))
  } catch { /* brak dostępu do pamięci przeglądarki nie blokuje zapisu celów */ }
}

function readState(user: string): { goals?: boolean; hidden?: boolean } {
  try { return JSON.parse(localStorage.getItem(key(user)) ?? '{}') as { goals?: boolean; hidden?: boolean } }
  catch { return {} }
}

/** „Zacznij tu”: kilka pierwszych kroków dla nowego konta. Znika, gdy wszystko jest zrobione albo po ukryciu. */
export function FirstSteps() {
  const auth = useAuth()
  const { data } = useJournal()
  const { openMeal, openQuickAdd } = useWorkspace()
  const user = auth.session?.user.id
  const [state, setState] = useState(() => (user ? readState(user) : {}))
  if (auth.mode !== 'cloud' || !user || !data || state.hidden) return null
  const steps = [
    { done: Boolean(state.goals || data.goals.cycles.length), label: 'Sprawdź swoje cele kalorii i makro', action: <Link to="/goals">Ustaw cele</Link> },
    { done: data.meals.length > 0, label: 'Zapisz pierwszy posiłek', action: <button type="button" className="text-link" onClick={() => openMeal()}>Wybierz produkt</button> },
    { done: data.water.length > 0, label: 'Dodaj szklankę wody', action: <button type="button" className="text-link" onClick={openQuickAdd}>Otwórz „Dodaj”</button> },
    { done: Boolean(data.training.plan), label: 'Ułóż plan treningowy', action: <Link to="/plan/new">Ułóż plan</Link> },
  ]
  const done = steps.filter((step) => step.done).length
  if (done === steps.length) return null
  function hide() {
    if (!user) return
    const next = { ...state, hidden: true }
    try { localStorage.setItem(key(user), JSON.stringify(next)) } catch { /* ukrycie działa do odświeżenia */ }
    setState(next)
  }
  return <section className="panel first-steps" aria-labelledby="first-steps-title">
    <div className="section-heading">
      <h2 id="first-steps-title">Zacznij tu</h2>
      <span className="section-meta">{done} z {steps.length}</span>
      <button type="button" className="icon-button" aria-label="Ukryj listę „Zacznij tu”" onClick={hide}><X size={17} /></button>
    </div>
    <ol>
      {steps.map((step) => <li key={step.label} className={step.done ? 'done' : undefined}>
        <span className="first-steps-mark" aria-hidden="true">{step.done && <Check size={14} />}</span>
        <span className="first-steps-label">{step.label}{step.done && <span className="sr-only"> — zrobione</span>}</span>
        {!step.done && step.action}
      </li>)}
    </ol>
  </section>
}
