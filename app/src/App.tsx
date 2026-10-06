import { useEffect } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/Auth'
import { JournalProvider } from './lib/Journal'
import { FeedbackProvider } from './components/Feedback'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Workspace } from './components/Workspace'
import { AuthPage } from './pages/AuthPage'
import { Dashboard } from './pages/Dashboard'
import { JournalPage } from './pages/JournalPage'
import { WorkoutsPage } from './pages/WorkoutsPage'
import { ProgressPage } from './pages/ProgressPage'
import { SettingsPage } from './pages/SettingsPage'
import { InformationPage } from './pages/InformationPage'
import { Brand, Skeleton } from './components/ui'

function SessionGate() {
  const auth = useAuth()
  if (auth.loading) return <main className="fatal-error"><Brand /><Skeleton /></main>
  return auth.mode === 'guest' ? <Navigate to="/login" replace /> : <Outlet />
}

function DemoEntry() {
  const auth = useAuth()
  useEffect(() => {
    if (!auth.loading && auth.mode !== 'demo') auth.enterDemo()
  }, [auth])
  return auth.mode === 'demo' ? <Navigate to="/" replace /> : <main className="fatal-error"><Brand /><Skeleton /></main>
}

export default function App() {
  return <ErrorBoundary><BrowserRouter><AuthProvider><FeedbackProvider>
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route path="/signup" element={<AuthPage />} />
      <Route path="/demo" element={<DemoEntry />} />
      <Route path="/reset-password" element={<AuthPage />} />
      <Route path="/privacy" element={<InformationPage kind="privacy" />} />
      <Route path="/sources" element={<InformationPage kind="sources" />} />
      <Route element={<SessionGate />}>
        <Route element={<JournalProvider><Workspace /></JournalProvider>}>
          <Route index element={<Dashboard />} />
          <Route path="/journal" element={<JournalPage />} />
          <Route path="/workouts" element={<WorkoutsPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<main className="fatal-error"><Brand /><h1>Tego miejsca nie ma w dzienniku</h1><a className="button button-primary" href="/">Wróć do Flexa</a></main>} />
    </Routes>
  </FeedbackProvider></AuthProvider></BrowserRouter></ErrorBoundary>
}
