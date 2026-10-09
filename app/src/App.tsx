import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, HashRouter, Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/Auth'
import { JournalProvider, useJournal } from './lib/Journal'
import { FeedbackProvider } from './components/Feedback'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Workspace } from './components/Workspace'
import { AuthPage } from './pages/AuthPage'
import { MealsPage } from './pages/MealsPage'
import { WorkoutsPage } from './pages/WorkoutsPage'
import { ExerciseHistoryPage } from './pages/ExerciseHistoryPage'
import { ProgressPage } from './pages/ProgressPage'
import { SettingsPage } from './pages/SettingsPage'
import { InformationPage } from './pages/InformationPage'
import { AboutPage } from './pages/AboutPage'
import { PlanPage } from './pages/PlanPage'
import { PlanWizard } from './pages/PlanWizard'
import { GoalsPage, GoalsSetupPage, NewGoalCyclePage } from './pages/GoalsPage'
import { WorkoutPlayer } from './pages/WorkoutPlayer'
import { Brand, Skeleton } from './components/ui'

const MealPlanPage = lazy(() => import('./pages/MealPlanPage').then((module) => ({ default: module.MealPlanPage })))
const ShoppingPage = lazy(() => import('./pages/ShoppingPage').then((module) => ({ default: module.ShoppingPage })))
const KitchenPage = lazy(() => import('./pages/KitchenPage').then((module) => ({ default: module.KitchenPage })))
const ScanPage = lazy(() => import('./pages/ScanPage').then((module) => ({ default: module.ScanPage })))

function SessionGate() {
  const auth = useAuth()
  if (auth.loading) return <main className="fatal-error"><Brand /><Skeleton /></main>
  return auth.mode === 'guest' ? <Navigate to="/login" replace /> : <Outlet />
}

function JournalShell() {
  return <JournalProvider><Outlet /></JournalProvider>
}

function AccountSetupGate() {
  const auth = useAuth()
  const { data } = useJournal()
  if (auth.mode === 'cloud' && data) {
    if (!data.training.onboardingDone && !data.training.plan) return <Navigate to="/start" replace />
    if (!data.goals.setupDone) return <Navigate to="/goals/setup" replace />
  }
  return <Outlet />
}

function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => { if (!hash) window.scrollTo(0, 0) }, [pathname, hash])
  return null
}

function DemoEntry() {
  const auth = useAuth()
  useEffect(() => {
    if (!auth.loading && auth.mode !== 'demo') auth.enterDemo()
  }, [auth])
  return auth.mode === 'demo' ? <Navigate to="/" replace /> : <main className="fatal-error"><Brand /><Skeleton /></main>
}

export default function App() {
  const Router = import.meta.env.VITE_PAGES_DEMO === 'true' ? HashRouter : BrowserRouter
  return <ErrorBoundary><Router><AuthProvider><FeedbackProvider>
    <ScrollToTop />
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route path="/signup" element={<AuthPage />} />
      <Route path="/demo" element={<DemoEntry />} />
      <Route path="/reset-password" element={<AuthPage />} />
      <Route path="/privacy" element={<InformationPage kind="privacy" />} />
      <Route path="/sources" element={<InformationPage kind="sources" />} />
      <Route path="/about" element={<AboutPage />} />
      <Route element={<SessionGate />}>
        <Route element={<JournalShell />}>
          <Route path="/start" element={<PlanWizard mode="onboarding" />} />
          <Route path="/goals/setup" element={<GoalsSetupPage />} />
          <Route path="/plan/new" element={<PlanWizard mode="edit" />} />
          <Route path="/plan/:sessionKey" element={<WorkoutPlayer />} />
          <Route element={<AccountSetupGate />}>
            <Route element={<Workspace />}>
              <Route index element={<Navigate to="/goals" replace />} />
              <Route path="/goals" element={<GoalsPage />} />
              <Route path="/goals/new" element={<NewGoalCyclePage />} />
              <Route path="/meals" element={<MealsPage />} />
              <Route path="/meals/plan" element={<Suspense fallback={<Skeleton />}><MealPlanPage /></Suspense>} />
              <Route path="/meals/scan" element={<Suspense fallback={<Skeleton />}><ScanPage /></Suspense>} />
              <Route path="/journal" element={<Navigate to="/meals" replace />} />
              <Route path="/kitchen/shopping" element={<Suspense fallback={<Skeleton />}><ShoppingPage /></Suspense>} />
              <Route path="/kitchen" element={<Suspense fallback={<Skeleton />}><KitchenPage /></Suspense>} />
              <Route path="/plan" element={<PlanPage />} />
              <Route path="/workouts" element={<WorkoutsPage />} />
              <Route path="/workouts/exercises" element={<ExerciseHistoryPage />} />
              <Route path="/workouts/exercises/:exercise" element={<ExerciseHistoryPage />} />
              <Route path="/progress" element={<ProgressPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<main className="fatal-error"><Brand /><h1>Tego miejsca nie ma w dzienniku</h1><Link className="button button-primary" to="/">Wróć do Flexa</Link></main>} />
    </Routes>
  </FeedbackProvider></AuthProvider></Router></ErrorBoundary>
}
