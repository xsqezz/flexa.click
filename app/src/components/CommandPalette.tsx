import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import {
  CalendarDays, Camera, ChartNoAxesCombined, ChefHat, CircleHelp, ClipboardList, Download, Droplet, Dumbbell, History, Play, Ruler,
  ScanBarcode, Search, Settings2, Shield, Target, Utensils, X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { mealNames } from '../../../shared/domain'
import { useJournal } from '../lib/Journal'
import { dateLabel, today } from '../lib/dates'
import { numberFormat } from '../lib/nutrition'
import { sessionTitle, weekdayIndex } from '../lib/training/format'
import { useFeedback } from './Feedback'
import { useWorkspace } from './Workspace'
import { errorMessage } from './ui'

type Item = { id: string; group: string; label: string; detail?: string; keywords?: string; icon: ReactNode; run: () => void }

/** Porównanie bez wielkości liter i polskich znaków: „zolty” znajdzie „Żółty”. */
export function normalize(text: string): string {
  return text.toLocaleLowerCase('pl-PL').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l')
}

export function matches(item: { label: string; detail?: string; keywords?: string; group: string }, query: string): boolean {
  const haystack = normalize(`${item.label} ${item.detail ?? ''} ${item.keywords ?? ''} ${item.group}`)
  return normalize(query).split(/\s+/).filter(Boolean).every((word) => haystack.includes(word))
}

const icon = (Icon: typeof Search) => <Icon size={18} aria-hidden="true" />

/** Wyszukiwarka i lista poleceń (Ctrl+K): strony, szybkie akcje i wpisy z dziennika. */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const listId = useId()
  const titleId = useId()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const navigate = useNavigate()
  const workspace = useWorkspace()
  const { data, execute } = useJournal()
  const feedback = useFeedback()

  useEffect(() => {
    const dialog = ref.current
    const previousFocus = document.activeElement
    dialog?.showModal()
    input.current?.focus()
    return () => {
      dialog?.close()
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
    }
  }, [])

  const items = useMemo<Item[]>(() => {
    const go = (to: string) => () => navigate(to)
    const plan = data?.training.plan
    const todayIndex = weekdayIndex(today())
    const sessionIndex = plan ? plan.sessions.findIndex((session) => session.weekday === todayIndex) : -1
    const list: Item[] = [
      { id: 'add-meal', group: 'Dodaj', label: 'Dodaj posiłek', keywords: 'jedzenie produkt kalorie', icon: icon(Utensils), run: () => workspace.openMeal() },
      { id: 'scan', group: 'Dodaj', label: 'Skanuj kod kreskowy', keywords: 'ean aparat kamera', icon: icon(ScanBarcode), run: () => workspace.openMeal(undefined, 'barcode') },
      { id: 'scan-plate', group: 'Dodaj', label: 'Skan posiłku ze zdjęcia', keywords: 'talerz taca fast food zdjecie kalorie makro jedzenie ai', icon: icon(Camera), run: go('/meals/scan') },
      { id: 'water', group: 'Dodaj', label: 'Dodaj wodę 250 ml', keywords: 'picie nawodnienie szklanka', icon: icon(Droplet), run: () => {
        execute({ type: 'water.add', value: { date: workspace.date, amountMl: 250 } })
          .then(() => feedback('Dodano 250 ml wody.'), (cause: unknown) => feedback(errorMessage(cause), { tone: 'error' }))
      } },
      { id: 'add-workout', group: 'Dodaj', label: 'Dodaj trening', keywords: 'aktywnosc bieg spacer rower gpx tcx import', icon: icon(Dumbbell), run: workspace.openWorkout },
      { id: 'add-measurement', group: 'Dodaj', label: 'Dodaj pomiar', keywords: 'waga masa ciala', icon: icon(Ruler), run: workspace.openMeasurement },
      ...(plan && sessionIndex >= 0 ? [{
        id: 'start-session', group: 'Dodaj', label: 'Rozpocznij dzisiejszy trening',
        detail: sessionTitle(plan.sessions[sessionIndex], sessionIndex, plan.answers.goal), keywords: 'plan cwiczenia', icon: icon(Play),
        run: go(`/plan/${plan.sessions[sessionIndex].key}`),
      }] : []),
      { id: 'page-today', group: 'Przejdź do', label: 'Dzisiaj', keywords: 'pulpit start podsumowanie', icon: icon(CalendarDays), run: go('/') },
      { id: 'page-goals', group: 'Przejdź do', label: 'Cele', keywords: 'kalorie makro waga cykle', icon: icon(Target), run: go('/goals') },
      { id: 'page-meals', group: 'Przejdź do', label: 'Posiłki', keywords: 'dziennik tydzien jedzenie', icon: icon(Utensils), run: go('/meals') },
      { id: 'page-plan', group: 'Przejdź do', label: 'Treningi', keywords: 'plan treningowy cwiczenia tydzien', icon: icon(ClipboardList), run: go('/plan') },
      { id: 'page-kitchen', group: 'Przejdź do', label: 'Kuchnia', keywords: 'przepis gotowanie lodowka', icon: icon(ChefHat), run: go('/kitchen') },
      { id: 'page-workouts', group: 'Przejdź do', label: 'Historia treningów', keywords: 'aktywnosc treningi', icon: icon(History), run: go('/workouts') },
      { id: 'page-progress', group: 'Przejdź do', label: 'Postępy', keywords: 'wykresy waga pomiary analiza', icon: icon(ChartNoAxesCombined), run: go('/progress') },
      { id: 'page-settings', group: 'Przejdź do', label: 'Konto i ustawienia', keywords: 'ustawienia profil eksport konto', icon: icon(Settings2), run: go('/settings') },
      { id: 'plan-new', group: 'Przejdź do', label: plan ? 'Zmień odpowiedzi w planie treningowym' : 'Ułóż plan treningowy', keywords: 'ankieta plan', icon: icon(ClipboardList), run: go('/plan/new') },
      { id: 'export', group: 'Przejdź do', label: 'Eksport i kopia danych', keywords: 'json csv kopia zapasowa pobierz', icon: icon(Download), run: go('/settings') },
      { id: 'page-about', group: 'Przejdź do', label: 'O Flexa', keywords: 'pomoc informacje kontakt', icon: icon(CircleHelp), run: go('/about') },
      { id: 'page-privacy', group: 'Przejdź do', label: 'Prywatność', keywords: 'dane rodo', icon: icon(Shield), run: go('/privacy') },
    ]
    if (query.trim().length >= 2 && data) {
      const seenFoods = new Set<string>()
      const meals = [...data.meals].sort((a, b) => b.date.localeCompare(a.date))
      for (const meal of meals) {
        const key = `${normalize(meal.food.name)}|${meal.date}`
        if (seenFoods.has(key)) continue
        seenFoods.add(key)
        list.push({
          id: `meal-${meal.id}`, group: 'W dzienniku', label: meal.food.name,
          detail: `${dateLabel(meal.date)} · ${mealNames[meal.meal]} · ${numberFormat.format(meal.portion)} ${meal.food.unit ?? ''}`.trim(),
          icon: icon(Utensils), run: () => { workspace.setDate(meal.date); navigate('/meals') },
        })
      }
      for (const workout of [...data.workouts].sort((a, b) => b.date.localeCompare(a.date))) {
        list.push({
          id: `workout-${workout.id}`, group: 'W dzienniku', label: workout.name,
          detail: `${dateLabel(workout.date)} · ${numberFormat.format(workout.minutes)} min`,
          icon: icon(Dumbbell), run: () => { workspace.setDate(workout.date); navigate('/workouts') },
        })
      }
    }
    return list
  }, [data, query, navigate, workspace, execute, feedback])

  const results = useMemo(() => {
    const found = query.trim() ? items.filter((item) => matches(item, query)) : items.filter((item) => item.group !== 'W dzienniku')
    const fromJournal = found.filter((item) => item.group === 'W dzienniku').slice(0, 12)
    return [...found.filter((item) => item.group !== 'W dzienniku'), ...fromJournal]
  }, [items, query])
  const current = Math.min(active, Math.max(results.length - 1, 0))

  function choose(item: Item) {
    onClose()
    item.run()
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive((current + 1) % Math.max(results.length, 1)) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((current - 1 + results.length) % Math.max(results.length, 1)) }
    else if (event.key === 'Home') { event.preventDefault(); setActive(0) }
    else if (event.key === 'End') { event.preventDefault(); setActive(Math.max(results.length - 1, 0)) }
    else if (event.key === 'Enter' && results[current]) { event.preventDefault(); choose(results[current]) }
  }

  useEffect(() => {
    document.getElementById(`${listId}-${current}`)?.scrollIntoView({ block: 'nearest' })
  }, [current, listId])

  return <dialog ref={ref} className="palette" aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); onClose() }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <h2 id={titleId} className="sr-only">Szukaj w Flexa</h2>
    <div className="palette-search">
      <Search size={19} aria-hidden="true" />
      <input ref={input} type="search" role="combobox" aria-expanded="true" aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={results.length ? `${listId}-${current}` : undefined} aria-label="Szukaj stron, akcji i wpisów"
        placeholder="Szukaj: posiłek, woda, plan, nazwa produktu…" value={query} autoComplete="off"
        onChange={(event) => { setQuery(event.target.value); setActive(0) }} onKeyDown={onKeyDown} />
      <button className="icon-button" type="button" aria-label="Zamknij wyszukiwanie" onClick={onClose}><X size={18} /></button>
    </div>
    <ul id={listId} role="listbox" aria-label="Wyniki" className="palette-results">
      {results.map((item, index) => <li key={item.id} id={`${listId}-${index}`} role="option" aria-selected={index === current}
        className={index === current ? 'active' : undefined} onMouseMove={() => setActive(index)} onClick={() => choose(item)}>
        <span className="palette-icon">{item.icon}</span>
        <span className="palette-text"><strong>{item.label}</strong>{item.detail && <small>{item.detail}</small>}</span>
        <span className="palette-group">{item.group}</span>
      </li>)}
    </ul>
    {!results.length && <p className="palette-empty" role="status">Nic nie znaleziono dla „{query}”. Spróbuj krótszej nazwy.</p>}
    <p className="palette-hint" aria-hidden="true"><kbd>↑</kbd><kbd>↓</kbd> wybór · <kbd>Enter</kbd> otwórz · <kbd>Esc</kbd> zamknij</p>
  </dialog>
}
