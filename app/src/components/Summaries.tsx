import { Droplets, Minus, Plus, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Journal, Meal } from '../../../shared/domain'
import { daysEndingAt, dateLabel, weekStart, shiftDate } from '../lib/dates'
import { calorieStatus, integerFormat, numberFormat, nutritionTotal, progress } from '../lib/nutrition'
import { useJournal } from '../lib/Journal'
import { useFeedback } from './Feedback'
import { useWorkspace } from './Workspace'
import { Button, Notice, errorMessage } from './ui'

const macroDefinitions = [
  { key: 'protein', name: 'Białko', goal: 'proteinGoal', className: 'protein' },
  { key: 'carbs', name: 'Węglowodany', goal: 'carbsGoal', className: 'carbs' },
  { key: 'fat', name: 'Tłuszcze', goal: 'fatGoal', className: 'fat' },
] as const

export function NutritionSummary({ meals, profile }: { meals: Meal[]; profile: Journal['profile'] }) {
  const energy = nutritionTotal(meals, 'kcal').value
  const percent = progress(energy, profile.calorieGoal)
  return <section className="panel nutrition-panel" aria-label="Podsumowanie żywienia">
    <div className="nutrition-main">
      <div>
        <div className="summary-label">Energia na dziś</div>
        <div className="energy-value">{integerFormat.format(energy)} <span>/ {integerFormat.format(profile.calorieGoal)} kcal</span></div>
        <p className="energy-caption">{calorieStatus(energy, profile.calorieGoal)}</p>
        <div className="energy-meter" role="progressbar" aria-label="Realizacja celu energetycznego"
          aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}
          aria-valuetext={`${integerFormat.format(energy)} z ${integerFormat.format(profile.calorieGoal)} kilokalorii`}>
          <span style={{ transform: `scaleX(${percent / 100})` }} />
        </div>
      </div>
      <div className="energy-symbol" aria-hidden="true"><svg viewBox="0 0 90 90">
        <path d="M54 9C28 20 17 35 23 54c6 20 23 22 36 12 12-10 15-34-5-57Z" fill="#b9d9a9" />
        <path d="M25 80C29 53 37 39 53 25M34 55l-5-17M40 44l19-4" fill="none" stroke="#356d47" strokeWidth="3" strokeLinecap="round" />
      </svg></div>
    </div>
    <div className="macros">
      {macroDefinitions.map((macro) => {
        const total = nutritionTotal(meals, macro.key)
        const goal = profile[macro.goal]
        return <div className={`macro ${macro.className}`} key={macro.key}>
          <span className="macro-label"><i />{macro.name}</span>
          <div><strong>{total.missing > 0 ? '≥ ' : ''}{numberFormat.format(total.value)}</strong><span> / {goal > 0 ? numberFormat.format(goal) : '—'} g</span></div>
          <div className="macro-meter" aria-hidden="true"><span style={{ width: `${progress(total.value, goal)}%` }} /></div>
          {total.missing > 0 && <small>Brak danych w {total.missing} {total.missing === 1 ? 'wpisie' : 'wpisach'}</small>}
        </div>
      })}
    </div>
    <div className="summary-footnote">Cel ustalasz Ty. Energia treningów nie zwiększa go automatycznie. <Link to="/settings">Zmień cele</Link></div>
  </section>
}

export function WaterPanel({ data, date }: { data: Journal; date: string }) {
  const { execute, pending } = useJournal()
  const feedback = useFeedback()
  const [error, setError] = useState<string | null>(null)
  const entries = data.water.filter((entry) => entry.date === date)
  const amount = entries.reduce((sum, entry) => sum + entry.amountMl, 0)
  const target = data.profile.waterGoal
  async function add() {
    setError(null)
    try { await execute({ type: 'water.add', value: { date, amountMl: 250 } }); feedback('Dodano 250 ml wody.') }
    catch (cause) { setError(errorMessage(cause)) }
  }
  async function undo() {
    const last = entries.at(-1)
    if (!last) return
    setError(null)
    try { await execute({ type: 'water.delete', id: last.id }); feedback('Cofnięto ostatni wpis wody.') }
    catch (cause) { setError(errorMessage(cause)) }
  }
  return <section className="panel water-panel">
    <div className="panel-title"><h2>Nawodnienie</h2><Droplets size={20} aria-hidden="true" /></div>
    <div className="water-value">{numberFormat.format(amount / 1000)} <span>/ {numberFormat.format(target / 1000)} l</span></div>
    <div className="water-glasses" aria-hidden="true">
      {Array.from({ length: 8 }, (_, index) => <svg key={index} viewBox="0 0 25 34">
        <path d="M3 3h19l-3 27H6L3 3Z" fill={index < progress(amount, target) / 12.5 ? '#b6d3f0' : '#eef3f6'} stroke="#7a9bb9" strokeWidth="1.5" />
        {index < progress(amount, target) / 12.5 && <path d="M5 14h15l-2 14H7L5 14Z" fill="#4985ba" />}
      </svg>)}
    </div>
    {error && <Notice tone="error">{error}</Notice>}
    <div className="button-row">
      <Button variant="secondary" onClick={() => { void add() }} busy={pending}><Plus size={16} aria-hidden="true" />250 ml</Button>
      <button className="icon-button" disabled={pending || !entries.length} aria-label="Cofnij ostatni wpis wody" onClick={() => { void undo() }}><Minus size={18} /></button>
    </div>
  </section>
}

export function WeeklyActivity({ data, date }: { data: Journal; date: string }) {
  const { openWorkout } = useWorkspace()
  const start = weekStart(date)
  const end = shiftDate(start, 6)
  const workouts = data.workouts.filter((workout) => workout.date >= start && workout.date <= end)
  const minutes = workouts.reduce((sum, workout) => sum + workout.minutes, 0)
  const goal = data.profile.weeklyMinutesGoal
  const days = daysEndingAt(end, 7)
  const max = Math.max(60, ...days.map((day) => workouts.filter((workout) => workout.date === day).reduce((sum, workout) => sum + workout.minutes, 0)))
  return <section className="panel weekly-panel">
    <div className="panel-title"><h2>Ruch w tym tygodniu</h2><TrendingUp size={20} aria-hidden="true" /></div>
    <div className="weekly-total">{integerFormat.format(minutes)} <span>min {goal > 0 ? `/ ${integerFormat.format(goal)}` : ''}</span></div>
    <p>{workouts.length} {workouts.length === 1 ? 'aktywność' : 'aktywności'} · {dateLabel(start, { day: 'numeric', month: 'short' })} – {dateLabel(end, { day: 'numeric', month: 'short' })}</p>
    <div className="week-bars" role="img" aria-label={`Łącznie ${integerFormat.format(minutes)} minut aktywności w tygodniu.`}>
      {days.map((day) => {
        const value = workouts.filter((workout) => workout.date === day).reduce((sum, workout) => sum + workout.minutes, 0)
        return <div className={day === date ? 'week-bar-day selected' : 'week-bar-day'} key={day}>
          <span className="week-bar-track"><span style={{ height: `${Math.max(4, value / max * 100)}%` }} /></span>
          <small>{dateLabel(day, { weekday: 'short' }).slice(0, 2)}</small>
        </div>
      })}
    </div>
    <Button variant="ghost" onClick={openWorkout}><Plus size={16} aria-hidden="true" />Dodaj aktywność</Button>
  </section>
}
