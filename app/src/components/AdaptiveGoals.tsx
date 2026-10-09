import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, TrendingDown, TrendingUp } from 'lucide-react'
import type { GoalCycle, Journal } from '../../../shared/domain'
import { adaptiveInsight } from '../lib/adaptive'
import { cycleSummary, nextCycleHint } from '../lib/cycle-summary'
import { dateLabel, shiftDate, today } from '../lib/dates'
import { cycleNames, effectiveCycle } from '../lib/goals'
import { useJournal } from '../lib/Journal'
import { integerFormat, numberFormat } from '../lib/nutrition'
import { useFeedback } from './Feedback'
import { Button, Notice, errorMessage } from './ui'

const dismissKey = (cycle: GoalCycle) => `flexa:adaptive-dismissed:${cycle.id}`
const snoozeDays = 7

function dismissedRecently(cycle: GoalCycle, day: string): boolean {
  try {
    const stored = localStorage.getItem(dismissKey(cycle))
    return stored !== null && stored > shiftDate(day, -snoozeDays)
  } catch { return false }
}

const signed = (value: number, digits = 1) => `${value > 0 ? '+' : ''}${value.toLocaleString('pl-PL', { maximumFractionDigits: digits })}`

export function CycleRecap({ journal, cycle }: { journal: Journal; cycle: GoalCycle }) {
  const summary = cycleSummary(journal, cycle)
  const hint = cycle.status === 'completed' || cycle.endDate < today() ? nextCycleHint(cycle.kind) : null
  return <>
    <div className="overview-strip cycle-recap" role="group" aria-label={`Podsumowanie cyklu: ${cycleNames[cycle.kind]}`}>
      <div><small>Zmiana masy</small>
        <strong>{summary.changeKg === null ? '—' : `${signed(summary.changeKg)} kg`}</strong>
        {summary.weeklyKg !== null && <small>trend {signed(summary.weeklyKg, 2)} kg/tydz.</small>}</div>
      <div><small>Średnio dziennie</small>
        <strong>{summary.averageKcal === null ? '—' : `${integerFormat.format(summary.averageKcal)} kcal`}</strong>
        {summary.averageDeviation !== null && <small>{signed(summary.averageDeviation, 0)} kcal wobec celu</small>}</div>
      <div><small>Dni z wpisami</small>
        <strong>{summary.loggedDays} / {Math.max(1, summary.elapsedDays)}</strong>
        <small>z {summary.days} dni cyklu</small></div>
    </div>
    {hint && <p className="goals-help">{hint}</p>}
  </>
}

export function AdaptiveGoals({ journal }: { journal: Journal }) {
  const { execute, pending } = useJournal()
  const feedback = useFeedback()
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const attempt = useRef<{ input: string; id: string } | null>(null)
  const day = today()
  const cycle = effectiveCycle(journal, day)
  const insight = adaptiveInsight(journal, day)
  if (!cycle || !insight) return null
  void version

  async function apply() {
    if (insight?.status !== 'suggest') return
    const key = JSON.stringify(insight.proposal)
    if (attempt.current?.input !== key) attempt.current = { input: key, id: crypto.randomUUID() }
    setError(null)
    try {
      await execute({ type: 'goals.start', id: attempt.current.id, value: insight.proposal })
      feedback('Nowy cel energii zatwierdzony. Poprzedni cykl trafił do archiwum.')
    } catch (cause) { setError(errorMessage(cause)) }
  }

  function snooze() {
    if (!cycle) return
    try { localStorage.setItem(dismissKey(cycle), day) } catch { /* private mode: the card simply returns */ }
    setVersion((value) => value + 1)
  }

  if (insight.status === 'suggest' && dismissedRecently(cycle, day)) return null
  const Icon = insight.status === 'suggest' && insight.direction === 'decrease' ? TrendingDown : TrendingUp
  return <section className="panel adaptive-panel" aria-labelledby="adaptive-title">
    <h2 id="adaptive-title"><Icon size={19} aria-hidden="true" />Trend a Twój cel</h2>
    {insight.status === 'insufficient' && <>
      <p className="goals-help">Żeby ocenić tempo zmian, potrzebujemy trochę więcej danych:</p>
      <ul className="adaptive-reasons">{insight.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
    </>}
    {insight.status === 'on-track' && <p>Tempo zmian ({signed(insight.trend.weeklyKg, 2)} kg/tydz.) mieści się w założeniach cyklu „{cycleNames[cycle.kind]}”
      ({insight.band[0].toLocaleString('pl-PL')}…{insight.band[1].toLocaleString('pl-PL')} kg/tydz.). Średnio {integerFormat.format(insight.averageKcal)} kcal dziennie. Nic nie trzeba zmieniać.</p>}
    {insight.status === 'goal-reached' && <>
      <p>{insight.message}</p>
      <Link className="text-link" to="/goals/new">Wybierz kolejny cykl <ArrowRight size={16} aria-hidden="true" /></Link>
    </>}
    {insight.status === 'suggest' && <>
      <p>{insight.reason}</p>
      <dl className="adaptive-change">
        <div><dt>Obecny cel</dt><dd>{integerFormat.format(cycle.calorieGoal)} kcal</dd></div>
        <div><dt>Propozycja</dt><dd>{integerFormat.format(insight.proposal.calorieGoal)} kcal <small>({signed(insight.deltaKcal, 0)})</small></dd></div>
        <div><dt>Węglowodany</dt><dd>{numberFormat.format(insight.proposal.carbsGoal)} g</dd></div>
      </dl>
      <p className="goals-help">Białko i tłuszcze zostają bez zmian. Zatwierdzenie zaczyna nowy cykl od dziś do {dateLabel(cycle.endDate)}; poprzedni trafia do archiwum.
        To propozycja ogólna, nie porada medyczna.</p>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="adaptive-actions">
        <Button type="button" busy={pending} onClick={() => { void apply() }}>Zatwierdź propozycję</Button>
        <Button type="button" variant="secondary" onClick={snooze}>Nie teraz</Button>
      </div>
    </>}
  </section>
}
