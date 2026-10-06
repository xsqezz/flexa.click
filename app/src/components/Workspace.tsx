import { createContext, useContext, useEffect, useState } from 'react'
import { Activity, CalendarDays, ChartNoAxesCombined, ChevronLeft, ChevronRight, CircleHelp, Cloud, CloudOff, LogOut, Plus, Settings2, Utensils } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import type { MealKind } from '../../../shared/domain'
import { useAuth } from '../lib/Auth'
import { useJournal } from '../lib/Journal'
import { dateLabel, shiftDate, today } from '../lib/dates'
import { Brand, Button, Notice, Skeleton, errorMessage } from './ui'
import { MealDrawer } from './MealDrawer'
import { WorkoutDrawer } from './WorkoutDrawer'
import { MeasurementDrawer } from './MeasurementDrawer'
import { DemoRecovery } from './DemoRecovery'

type WorkspaceValue = {
  date: string; setDate: (date: string) => void
  openMeal: (kind?: MealKind) => void; openWorkout: () => void; openMeasurement: () => void
}
const WorkspaceContext = createContext<WorkspaceValue | null>(null)
const navigation = [
  { to: '/', label: 'Dzisiaj', Icon: CalendarDays },
  { to: '/journal', label: 'Dziennik', Icon: Utensils },
  { to: '/workouts', label: 'Treningi', Icon: Activity },
  { to: '/progress', label: 'Postępy', Icon: ChartNoAxesCombined },
]

export function Workspace() {
  const auth = useAuth()
  const journal = useJournal()
  const [date, setDate] = useState(today)
  const [meal, setMeal] = useState<MealKind | null>(null)
  const [workout, setWorkout] = useState(false)
  const [measurement, setMeasurement] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])
  return <WorkspaceContext.Provider value={{
    date, setDate, openMeal: (kind = 'breakfast') => setMeal(kind),
    openWorkout: () => setWorkout(true), openMeasurement: () => setMeasurement(true),
  }}>
    <a className="skip-link" href="#main">Przejdź do treści</a>
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <nav aria-label="Menu główne" className="main-nav">
          {navigation.map(({ to, label, Icon }) => <NavLink key={to} to={to} end className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <Icon size={20} aria-hidden="true" /><span>{label}</span>
          </NavLink>)}
          <NavLink to="/settings" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <Settings2 size={20} aria-hidden="true" /><span>Cele i konto</span>
          </NavLink>
        </nav>
        <div className="sidebar-note">
          <span className="small-mark" aria-hidden="true">f.</span>
          <p>Twój rytm.<br /><strong>Bez abonamentu.</strong></p>
          <Link to="/sources">Poznaj źródła danych <ChevronRight size={15} aria-hidden="true" /></Link>
        </div>
        <div className="sidebar-bottom">
          <Link className="nav-item" to="/sources"><CircleHelp size={19} aria-hidden="true" />O Flexa</Link>
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
          <Link className="user-avatar" to="/settings" aria-label="Otwórz ustawienia konta">
            {(journal.data?.profile.displayName ?? 'F').slice(0, 1).toUpperCase()}
          </Link>
        </header>
        <main id="main" className="main-content" tabIndex={-1}>
          {auth.mode === 'demo' && <div className="demo-strip"><span className="status-dot" />Przykładowe dane. Zmiany zostają tylko na tym urządzeniu.</div>}
          {!online && auth.mode === 'cloud' && <Notice>Jesteś offline. Zapis do chmury wymaga połączenia; formularze nie udają synchronizacji.</Notice>}
          {error && <Notice tone="error">{error}</Notice>}
          {journal.error && <Notice tone="error">{journal.error} <button className="text-link" onClick={journal.refresh}>Spróbuj ponownie</button></Notice>}
          {journal.error && !journal.data && auth.mode === 'demo' && <DemoRecovery />}
          {journal.loading ? <Skeleton /> : journal.data && <Outlet />}
        </main>
        <footer className="workspace-footer"><span>Flexa · Twój dziennik, Twoje dane</span>
          <div><Link to="/privacy">Prywatność</Link><Link to="/sources">Źródła i licencje</Link></div>
        </footer>
      </div>
      <nav className="mobile-nav" aria-label="Menu mobilne">
        {navigation.map(({ to, label, Icon }) => <NavLink key={to} to={to} end><Icon size={21} aria-hidden="true" />{label}</NavLink>)}
        <NavLink to="/settings"><Settings2 size={21} aria-hidden="true" />Konto</NavLink>
      </nav>
    </div>
    {meal && <MealDrawer date={date} initialMeal={meal} onClose={() => setMeal(null)} />}
    {workout && <WorkoutDrawer date={date} onClose={() => setWorkout(false)} />}
    {measurement && <MeasurementDrawer date={date} onClose={() => setMeasurement(false)} />}
  </WorkspaceContext.Provider>
}

export function useWorkspace() {
  const workspace = useContext(WorkspaceContext)
  if (!workspace) throw new Error('Workspace is missing')
  return workspace
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
    <button className="icon-button" aria-label="Poprzedni dzień" disabled={date === '1900-01-01'} onClick={() => setDate(shiftDate(date, -1))}><ChevronLeft size={18} /></button>
    <label className="date-label">
      <CalendarDays size={17} aria-hidden="true" />
      <span>{date === today() ? 'Dzisiaj' : dateLabel(date, { day: 'numeric', month: 'long' })}</span>
      <input type="date" value={date} min="1900-01-01" max="2100-12-31" aria-label="Dzień dziennika"
        onChange={(event) => { if (event.target.validity.valid && event.target.value) setDate(event.target.value) }} />
    </label>
    <button className="icon-button" aria-label="Następny dzień" disabled={date === '2100-12-31'} onClick={() => setDate(shiftDate(date, 1))}><ChevronRight size={18} /></button>
    {date !== today() && <button className="text-link" onClick={() => setDate(today())}>Dzisiaj</button>}
  </div>
}
