import { ArrowLeft, ChevronRight } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useJournal } from '../lib/Journal'
import { dateLabel } from '../lib/dates'
import { integerFormat, numberFormat } from '../lib/nutrition'
import { exerciseHistory, formatSet, type ExerciseHistory } from '../lib/training/sets'
import { LineChart, Sparkline } from '../components/Charts'
import { EmptyState } from '../components/ui'
import { TrainingTabs } from '../components/Workspace'

const sessionsLabel = (count: number) => `${count} ${count === 1 ? 'trening' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'treningi' : 'treningów'}`
const usesLoad = (item: ExerciseHistory) => item.sessions.some((session) => session.volume > 0)
const sessionValue = (item: ExerciseHistory) => (session: ExerciseHistory['sessions'][number]) => usesLoad(item) ? session.volume : session.reps

function Values({ item }: { item: ExerciseHistory }) {
  const last = item.sessions[item.sessions.length - 1]
  return <div className="workout-values">
    <div><small>Najcięższa seria</small><strong>{item.heaviest ? formatSet(item.heaviest) : '—'}</strong></div>
    <div><small>Szacowane 1RM · szacunek</small><strong>{item.estimate === null ? '—' : `${numberFormat.format(item.estimate)} kg`}</strong></div>
    <div><small>{usesLoad(item) ? 'Objętość ostatnio · kg × powt.' : 'Powtórzenia ostatnio'}</small><strong>{integerFormat.format(sessionValue(item)(last))}</strong></div>
  </div>
}

function Header({ title, description, back }: { title: string; description: string; back: { to: string; label: string } }) {
  return <><TrainingTabs /><header className="page-header exercise-history-header">
    <div><Link className="text-link" to={back.to}><ArrowLeft size={15} aria-hidden="true" />{back.label}</Link><h1>{title}</h1><p>{description}</p></div>
  </header></>
}

const estimateNote = 'Szacowane 1RM to wynik wzoru Epleya z serii do 15 powtórzeń — orientacyjna liczba, nie test ani cel do sprawdzania.'

export function ExerciseHistoryPage() {
  const { data } = useJournal()
  const { exercise } = useParams()
  if (!data) throw new Error('Journal data is unavailable')
  const history = exerciseHistory(data.workouts)
  if (exercise !== undefined) {
    const item = history.find((entry) => entry.exercise === exercise)
    if (!item) return <>
      <Header title="Historia ćwiczenia" description="Nie znaleźliśmy zapisanych serii tego ćwiczenia." back={{ to: '/workouts/exercises', label: 'Wszystkie ćwiczenia' }} />
      <section className="panel"><EmptyState title="Brak serii do pokazania">Serie mogły zostać usunięte razem z treningiem. <Link to="/workouts/exercises">Wróć do listy ćwiczeń</Link>.</EmptyState></section>
    </>
    const load = usesLoad(item)
    const value = sessionValue(item)
    return <>
      <Header title={item.name} description={`${sessionsLabel(item.sessions.length)} z zapisanymi seriami · ostatnio ${dateLabel(item.lastDate)}`} back={{ to: '/workouts/exercises', label: 'Wszystkie ćwiczenia' }} />
      <section className="panel exercise-history-summary"><Values item={item} /></section>
      <section className="panel chart-section">
        <h2>{load ? 'Objętość na trening' : 'Powtórzenia na trening'}</h2>
        <p>{load ? 'Suma powtórzeń × ciężar ze wszystkich serii tego ćwiczenia w danym treningu.' : 'Suma powtórzeń ze wszystkich serii tego ćwiczenia w danym treningu.'}</p>
        <LineChart points={[...item.sessions.reduce((days, session) => days.set(session.date, (days.get(session.date) ?? 0) + value(session)), new Map<string, number>())]
          .map(([date, total]) => ({ date, value: total }))}
          label={load ? 'Objętość' : 'Powtórzenia'} unit={load ? 'kg × powt.' : 'powt.'} empty="Brak danych do wykresu." />
      </section>
      <section className="panel">
        <h2>Treningi z tym ćwiczeniem</h2>
        <div className="table-scroll" tabIndex={0} role="region" aria-label={`Tabela serii: ${item.name}`}><table className="exercise-history-table"><caption className="sr-only">Serie ćwiczenia {item.name}</caption>
          <thead><tr><th scope="col">Data</th><th scope="col">Serie</th><th scope="col">{load ? 'Objętość (kg × powt.)' : 'Powtórzenia'}</th><th scope="col">Najcięższa seria</th><th scope="col">Szac. 1RM (kg)</th></tr></thead>
          <tbody>{[...item.sessions].reverse().map((session) => <tr key={`${session.workoutId}-${session.date}`}>
            <td>{dateLabel(session.date)}</td>
            <td className="exercise-history-sets">{session.sets.map(formatSet).join(', ')}</td>
            <td>{integerFormat.format(value(session))}</td>
            <td>{session.heaviest ? formatSet(session.heaviest) : '—'}</td>
            <td>{session.estimate === null ? '—' : numberFormat.format(session.estimate)}</td>
          </tr>)}</tbody>
        </table></div>
        <p className="source-credit">{estimateNote}</p>
      </section>
    </>
  }
  return <>
    <Header title="Historia ćwiczeń" description="Twoje serie z dziennika: kiedy ostatnio, najcięższa seria i objętość treningu." back={{ to: '/workouts', label: 'Treningi' }} />
    {history.length === 0 ? <section className="panel"><EmptyState title="Tu pojawią się Twoje serie">
      Wpisz powtórzenia i ciężar w trakcie treningu z planu albo dodaj serie przy zapisie treningu siłowego („Dodaj trening” → Trening siłowy → Serie).
    </EmptyState></section> : <>
      <ul className="exercise-history-list">
        {history.map((item) => <li key={item.exercise} className="panel">
          <div className="exercise-history-title">
            <h2><Link to={`/workouts/exercises/${encodeURIComponent(item.exercise)}`}>{item.name}<ChevronRight size={16} aria-hidden="true" /></Link></h2>
            <Sparkline values={item.sessions.map(sessionValue(item))} />
          </div>
          <p>Ostatnio {dateLabel(item.lastDate)} · {sessionsLabel(item.sessions.length)}</p>
          <Values item={item} />
        </li>)}
      </ul>
      <p className="source-credit">{estimateNote}</p>
    </>}
  </>
}
