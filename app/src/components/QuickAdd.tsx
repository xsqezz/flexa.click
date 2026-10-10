import { Camera, ChefHat, Droplet, Dumbbell, PenLine, Play, Ruler, ScanBarcode, Utensils } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { mealNames } from '../../../shared/domain'
import { useJournal } from '../lib/Journal'
import { dateLabel, today } from '../lib/dates'
import { sessionTitle, weekdayIndex } from '../lib/training/format'
import { useFeedback } from './Feedback'
import { mealForHour, useWorkspace } from './Workspace'
import { Drawer, errorMessage } from './ui'

/** Arkusz „Dodaj”: najczęstsze wpisy w jednym miejscu, z każdego ekranu. */
export function QuickAdd({ date, onClose }: { date: string; onClose: () => void }) {
  const { data, execute, pending } = useJournal()
  const workspace = useWorkspace()
  const feedback = useFeedback()
  const navigate = useNavigate()
  const meal = mealForHour(new Date().getHours())
  const plan = data?.training.plan
  const todayIndex = weekdayIndex(today())
  const sessionIndex = plan ? plan.sessions.findIndex((session) => session.weekday === todayIndex) : -1
  const session = plan && sessionIndex >= 0 ? plan.sessions[sessionIndex] : null
  const forDay = date === today() ? 'dziś' : dateLabel(date, { day: 'numeric', month: 'long' })

  function then(action: () => void) {
    onClose()
    action()
  }

  async function water() {
    try {
      await execute({ type: 'water.add', value: { date, amountMl: 250 } })
      onClose()
      feedback(`Dodano 250 ml wody (${forDay}).`)
    } catch (cause) { feedback(errorMessage(cause), { tone: 'error' }) }
  }

  return <Drawer title="Dodaj" onClose={onClose} variant="sheet">
    <p className="quick-add-date">Wpisy trafią do dnia: <strong>{forDay}</strong></p>
    <ul className="quick-add">
      <li><button type="button" onClick={() => then(() => workspace.openMeal(meal))}>
        <span className="quick-add-icon"><Utensils size={20} aria-hidden="true" /></span>
        <span><strong>Posiłek</strong><small>Wyszukaj produkt · podpowiadamy: {mealNames[meal].toLowerCase()}</small></span>
      </button></li>
      <li><button type="button" onClick={() => then(() => navigate('/meals/quick'))}>
        <span className="quick-add-icon"><PenLine size={20} aria-hidden="true" /></span>
        <span><strong>Szybki wpis</strong><small>Napisz lub podyktuj: „dwa jajka i tost”</small></span>
      </button></li>
      <li><button type="button" onClick={() => then(() => workspace.openMeal(meal, 'barcode'))}>
        <span className="quick-add-icon"><ScanBarcode size={20} aria-hidden="true" /></span>
        <span><strong>Skanuj kod kreskowy</strong><small>Aparat albo wpisany numer EAN</small></span>
      </button></li>
      <li><button type="button" onClick={() => then(() => navigate('/meals/scan'))}>
        <span className="quick-add-icon"><Camera size={20} aria-hidden="true" /></span>
        <span><strong>Skan posiłku</strong><small>Zdjęcie tacy lub talerza z kaloriami</small></span>
      </button></li>
      <li><button type="button" disabled={pending} onClick={() => { void water() }}>
        <span className="quick-add-icon"><Droplet size={20} aria-hidden="true" /></span>
        <span><strong>Woda +250 ml</strong><small>Jedno dotknięcie, cofniesz w panelu wody</small></span>
      </button></li>
      <li><button type="button" onClick={() => then(workspace.openWorkout)}>
        <span className="quick-add-icon"><Dumbbell size={20} aria-hidden="true" /></span>
        <span><strong>Trening</strong><small>Wpis ręczny albo plik GPX / TCX</small></span>
      </button></li>
      <li><button type="button" onClick={() => then(workspace.openMeasurement)}>
        <span className="quick-add-icon"><Ruler size={20} aria-hidden="true" /></span>
        <span><strong>Pomiar</strong><small>Masa ciała i inne pomiary</small></span>
      </button></li>
      <li><button type="button" onClick={() => then(() => navigate('/kitchen'))}>
        <span className="quick-add-icon"><ChefHat size={20} aria-hidden="true" /></span>
        <span><strong>Przepis z tego, co masz</strong><small>Smart Kuchnia</small></span>
      </button></li>
      {session && plan && <li><button type="button" onClick={() => then(() => navigate(`/plan/${session.key}`))}>
        <span className="quick-add-icon"><Play size={20} aria-hidden="true" /></span>
        <span><strong>Rozpocznij dzisiejszy trening</strong><small>{sessionTitle(session, sessionIndex, plan.answers.goal)} · ok. {session.minutes} min</small></span>
      </button></li>}
    </ul>
  </Drawer>
}
