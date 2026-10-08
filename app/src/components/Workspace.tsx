import { createContext, useContext, useEffect, useRef, useState, type TouchEvent } from 'react'
import {
  CalendarDays, ChartNoAxesCombined, ChefHat, ChevronLeft, ChevronRight, CircleHelp, Cloud, CloudOff, Dumbbell, LogOut, Plus, Search,
  Settings2, Utensils,
} from 'lucide-react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import type { MealKind } from '../../../shared/domain'
import { useAuth } from '../lib/Auth'
import { useJournal } from '../lib/Journal'
import { dateLabel, shiftDate, today } from '../lib/dates'
import { Brand, Button, Notice, Skeleton, errorMessage } from './ui'
import { MealDrawer } from './MealDrawer'
import { WorkoutDrawer, type WorkoutPreset } from './WorkoutDrawer'
import { MeasurementDrawer } from './MeasurementDrawer'
import { DemoRecovery } from './DemoRecovery'
import { QuickAdd } from './QuickAdd'
import { CommandPalette } from './CommandPalette'
import { InstallButton } from './InstallButton'

export type MealTab = 'search' | 'barcode' | 'custom'
type WorkspaceValue = {
  date: string; setDate: (date: string) => void
  openMeal: (kind?: MealKind, tab?: MealTab) => void; openWorkout: () => void; openMeasurement: () => void
  openPlannedWorkout: (preset: WorkoutPreset) => void
  openQuickAdd: () => void; openSearch: () => void
}
const WorkspaceContext = createContext<WorkspaceValue | null>(null)

type Section = { to: string; label: string; short: string; Icon: typeof CalendarDays; matches: (path: string) => boolean }
export const sections: Section[] = [
  { to: '/', label: 'Dzisiaj', short: 'Dzisiaj', Icon: CalendarDays, matches: (path) => path === '/' },
  { to: '/journal', label: 'Dziennik', short: 'Dziennik', Icon: Utensils, matches: (path) => path.startsWith('/journal') },
  { to: '/kitchen', label: 'Smart Kuchnia', short: 'Kuchnia', Icon: ChefHat, matches: (path) => path.startsWith('/kitchen') },
  { to: '/plan', label: 'Trening', short: 'Trening', Icon: Dumbbell, matches: (path) => path.startsWith('/plan') || path.startsWith('/workouts') },
  { to: '/progress', label: 'Postępy', short: 'Postępy', Icon: ChartNoAxesCombined, matches: (path) => path.startsWith('/progress') },
]

/** Pory dnia, dla których „Dodaj posiłek” podpowiada odpowiedni posiłek. */
export function mealForHour(hour: number): MealKind {
  if (hour >= 4 && hour < 11) return 'breakfast'
  if (hour >= 11 && hour < 16) return 'lunch'
  if (hour >= 16 && hour < 21) return 'dinner'
  return 'snack'
}

const DATED_ROUTES = ['/', '/journal', '/workouts', '/progress']
const SWIPE_ROUTES = ['/', '/journal']

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName))
}

export function Workspace() {
  const auth = useAuth()
  const journal = useJournal()
  const { pathname } = useLocation()
  const [date, setDate] = useState(today)
  const [meal, setMeal] = useState<{ kind: MealKind; tab: MealTab } | null>(null)
  const [workout, setWorkout] = useState<{ preset?: WorkoutPreset } | null>(null)
  const [measurement, setMeasurement] = useState(false)
  const [quickAdd, setQuickAdd] = useState(false)
  const [search, setSearch] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [online, setOnline] = useState(navigator.onLine)
  const touch = useRef<{ x: number; y: number; time: number } | null>(null)
  const datedPage = DATED_ROUTES.includes(pathname)

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearch(true)
        return
      }
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return
      if (document.querySelector('dialog[open]')) return
      if (event.key === '/') { event.preventDefault(); setSearch(true); return }
      if (!datedPage) return
      if (event.key === 'ArrowLeft') setDate((current) => current > '1900-01-01' ? shiftDate(current, -1) : current)
      else if (event.key === 'ArrowRight') setDate((current) => current < '2100-12-31' ? shiftDate(current, 1) : current)
      else if (event.key === 't' || event.key === 'T') setDate(today())
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [datedPage])

  function onTouchStart(event: TouchEvent<HTMLElement>) {
    const point = event.touches[0]
    const target = event.target instanceof Element ? event.target : null
    touch.current = event.touches.length === 1 && SWIPE_ROUTES.includes(pathname) && !target?.closest('input, select, textarea, .table-scroll, [data-no-swipe]')
      ? { x: point.clientX, y: point.clientY, time: Date.now() } : null
  }
  function onTouchEnd(event: TouchEvent<HTMLElement>) {
    const start = touch.current
    touch.current = null
    if (!start) return
    const point = event.changedTouches[0]
    const dx = point.clientX - start.x
    const dy = point.clientY - start.y
    if (Math.abs(dx) < 70 || Math.abs(dy) > 45 || Date.now() - start.time > 700) return
    setDate((current) => shiftDate(current, dx < 0 ? 1 : -1))
  }

  const workspace: WorkspaceValue = {
    date, setDate,
    openMeal: (kind = mealForHour(new Date().getHours()), tab = 'search') => setMeal({ kind, tab }),
    openWorkout: () => setWorkout({}), openMeasurement: () => setMeasurement(true),
    openPlannedWorkout: (preset) => setWorkout({ preset }),
    openQuickAdd: () => setQuickAdd(true), openSearch: () => setSearch(true),
  }
  const accountName = journal.data?.profile.displayName ?? 'Flexa'
  return <WorkspaceContext.Provider value={workspace}>
    <a className="skip-link" href="#main">Przejdź do treści</a>
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <nav aria-label="Menu główne" className="main-nav">
          {sections.map(({ to, label, Icon, matches }) => {
            const active = matches(pathname)
            return <Link key={to} to={to} className={active ? 'nav-item active' : 'nav-item'} aria-current={active ? 'page' : undefined}>
              <Icon size={20} aria-hidden="true" /><span>{label}</span>
            </Link>
          })}
          <NavLink to="/settings" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <Settings2 size={20} aria-hidden="true" /><span>Cele i konto</span>
          </NavLink>
        </nav>
        <div className="sidebar-note">
          <span className="small-mark" aria-hidden="true">f.</span>
          <p>Twój rytm.<br /><strong>Bez abonamentu.</strong></p>
          <Link to="/sources">Poznaj źródła danych <ChevronRight size={15} aria-hidden="true" /></Link>
          <InstallButton />
        </div>
        <div className="sidebar-bottom">
          <Link className="nav-item" to="/about"><CircleHelp size={19} aria-hidden="true" />O Flexa</Link>
          <button className="nav-item" onClick={() => { void auth.signOut().catch((cause: unknown) => setError(errorMessage(cause))) }}>
            <LogOut size={19} aria-hidden="true" />{auth.mode === 'demo' ? 'Wyjdź z demo' : 'Wyloguj się'}
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="topbar-product">Jedzenie. Ruch. Jeden rytm.</span>
          <span className="sync-label">
            {online ? <Cloud size={16} aria-hidden="true" /> : <CloudOff size={16} aria-hidden="true" />}
            {auth.mode === 'demo' ? 'Demo · lokalny zapis' : !online ? 'Brak połączenia' : journal.syncing ? 'Synchronizowanie…' : journal.syncState === 'live' ? 'Dane na bieżąco' : 'Odświeżanie co minutę'}
          </span>
          <button className="topbar-search" type="button" onClick={() => setSearch(true)} aria-keyshortcuts="Control+K">
            <Search size={17} aria-hidden="true" /><span>Szukaj</span><kbd aria-hidden="true">Ctrl K</kbd>
          </button>
          <Button className="topbar-add" onClick={() => setQuickAdd(true)}><Plus size={18} aria-hidden="true" />Dodaj</Button>
          <Link className="account-link" to="/settings" aria-label={`Konto: ${accountName}, cele i ustawienia`}>
            <span className="user-avatar" aria-hidden="true">{accountName.slice(0, 1).toUpperCase()}</span>
            <span className="account-label" aria-hidden="true">Konto</span>
          </Link>
        </header>
        <main id="main" className="main-content" tabIndex={-1} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {auth.mode === 'demo' && <div className="demo-strip"><span className="status-dot" />Przykładowe dane. Zmiany zostają tylko na tym urządzeniu.</div>}
          {!online && auth.mode === 'cloud' && <Notice>Jesteś offline. Zapis do chmury wymaga połączenia; formularze nie udają synchronizacji.</Notice>}
          {error && <Notice tone="error">{error}</Notice>}
          {journal.error && <Notice tone="error">{journal.error} <button className="text-link" onClick={journal.refresh}>Spróbuj ponownie</button></Notice>}
          {journal.error && !journal.data && auth.mode === 'demo' && <DemoRecovery />}
          {journal.loading ? <Skeleton /> : journal.data && <Outlet />}
        </main>
        <footer className="workspace-footer"><span>Flexa · Twój dziennik, Twoje dane</span>
          <div><Link to="/about">O Flexa</Link><Link to="/privacy">Prywatność</Link><Link to="/sources">Źródła i licencje</Link></div>
        </footer>
      </div>
      <nav className="mobile-nav" aria-label="Menu mobilne">
        {sections.slice(0, 2).map((section) => <MobileLink key={section.to} section={section} pathname={pathname} />)}
        <button type="button" className="mobile-add" onClick={() => setQuickAdd(true)}>
          <span className="mobile-add-mark"><Plus size={22} aria-hidden="true" /></span>Dodaj
        </button>
        {sections.slice(2).map((section) => <MobileLink key={section.to} section={section} pathname={pathname} />)}
      </nav>
    </div>
    {quickAdd && <QuickAdd date={date} onClose={() => setQuickAdd(false)} />}
    {search && <CommandPalette onClose={() => setSearch(false)} />}
    {meal && <MealDrawer date={date} initialMeal={meal.kind} initialTab={meal.tab} onClose={() => setMeal(null)} />}
    {workout && <WorkoutDrawer date={workout.preset ? today() : date} preset={workout.preset} onClose={() => setWorkout(null)} />}
    {measurement && <MeasurementDrawer date={date} onClose={() => setMeasurement(false)} />}
  </WorkspaceContext.Provider>
}

function MobileLink({ section, pathname }: { section: Section; pathname: string }) {
  const active = section.matches(pathname)
  const { Icon } = section
  return <Link to={section.to} className={active ? 'active' : undefined} aria-current={active ? 'page' : undefined}>
    <Icon size={21} aria-hidden="true" />{section.short}
  </Link>
}

export function useWorkspace() {
  const workspace = useContext(WorkspaceContext)
  if (!workspace) throw new Error('Workspace is missing')
  return workspace
}

/** Przełącznik w zakładce „Trening”: plan tygodnia i historia zapisanych aktywności. */
export function TrainingTabs() {
  return <nav className="subnav" aria-label="Widok treningu">
    <NavLink to="/plan" end className={({ isActive }) => isActive ? 'active' : undefined}>Plan</NavLink>
    <NavLink to="/workouts" className={({ isActive }) => isActive ? 'active' : undefined}>Historia</NavLink>
  </nav>
}

export function PageHeader({ title, description, primary = 'meal' }:
  { title: string; description: string; primary?: 'meal' | 'workout' | 'measurement' | 'none' }) {
  const workspace = useWorkspace()
  return <header className="page-header">
    <div><h1>{title}</h1><p>{description}</p></div>
    {primary !== 'none' && <Button onClick={primary === 'meal' ? () => workspace.openMeal() : primary === 'workout' ? workspace.openWorkout : workspace.openMeasurement}>
      <Plus size={18} aria-hidden="true" />{primary === 'meal' ? 'Dodaj posiłek' : primary === 'workout' ? 'Dodaj trening' : 'Dodaj pomiar'}
    </Button>}
  </header>
}

export function DateControl() {
  const { date, setDate } = useWorkspace()
  return <div className="date-control">
    <button className="icon-button" aria-label="Poprzedni dzień" aria-keyshortcuts="ArrowLeft" disabled={date === '1900-01-01'} onClick={() => setDate(shiftDate(date, -1))}><ChevronLeft size={18} /></button>
    <label className="date-label">
      <CalendarDays size={17} aria-hidden="true" />
      <span>{date === today() ? 'Dzisiaj' : dateLabel(date, { day: 'numeric', month: 'long' })}</span>
      <input type="date" value={date} min="1900-01-01" max="2100-12-31" aria-label="Dzień dziennika"
        onChange={(event) => { if (event.target.validity.valid && event.target.value) setDate(event.target.value) }} />
    </label>
    <button className="icon-button" aria-label="Następny dzień" aria-keyshortcuts="ArrowRight" disabled={date === '2100-12-31'} onClick={() => setDate(shiftDate(date, 1))}><ChevronRight size={18} /></button>
    {date !== today() && <button className="text-link" onClick={() => setDate(today())} aria-keyshortcuts="T">Dzisiaj</button>}
  </div>
}
