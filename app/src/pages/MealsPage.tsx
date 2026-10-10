import { CalendarRange, PenLine, ScanLine } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useJournal } from '../lib/Journal'
import { dateLabel } from '../lib/dates'
import { DateControl, PageHeader, useWorkspace } from '../components/Workspace'
import { MealList } from '../components/MealList'
import { WeekStrip } from '../components/WeekStrip'
import { RepeatDay } from '../components/RepeatDay'

export function MealsPage() {
  const { data } = useJournal()
  const { date } = useWorkspace()
  if (!data) throw new Error('Journal data is unavailable')
  const dayMeals = data.meals.filter((meal) => meal.date === date)
  return <>
    <PageHeader title="Posiłki" description="Dodawaj i przeglądaj jedzenie według pory dnia. Bilans i historię kalorii znajdziesz w Celach." />
    <div className="page-toolbar"><DateControl />
      <Link className="button button-secondary" to="/meals/scan"><ScanLine size={17} aria-hidden="true" />Skanuj posiłek ze zdjęcia</Link>
      <Link className="button button-secondary" to="/meals/quick"><PenLine size={17} aria-hidden="true" />Szybki wpis</Link>
      <Link className="button button-secondary" to="/meals/plan"><CalendarRange size={17} aria-hidden="true" />Plan tygodnia</Link></div>
    <WeekStrip />
    <RepeatDay date={date} />
    <section className="panel meal-panel meals-page-list" aria-labelledby="meals-day-title">
      <div className="section-heading"><h2 id="meals-day-title">{dateLabel(date, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
        <span className="section-meta">{dayMeals.length ? `${dayMeals.length} ${dayMeals.length === 1 ? 'wpis' : dayMeals.length < 5 ? 'wpisy' : 'wpisów'}` : 'bez wpisów'}</span>
      </div>
      <MealList date={date} />
    </section>
    <p className="source-credit">Wartości z baz społecznościowych mogą być niepełne. Porównaj produkt z etykietą. Brakujących składników odżywczych nie liczymy jako zera.</p>
  </>
}
