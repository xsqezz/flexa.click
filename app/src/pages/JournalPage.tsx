import { useJournal } from '../lib/Journal'
import { dateLabel, shiftDate, weekStart } from '../lib/dates'
import { integerFormat, numberFormat, nutritionTotal } from '../lib/nutrition'
import { DateControl, PageHeader, useWorkspace } from '../components/Workspace'
import { NutritionSummary, WaterPanel } from '../components/Summaries'
import { MealList } from '../components/MealList'
import { WeekStrip } from '../components/WeekStrip'

export function JournalPage() {
  const { data } = useJournal()
  const { date, setDate } = useWorkspace()
  if (!data) throw new Error('Journal data is unavailable')
  const start = weekStart(date)
  const week = Array.from({ length: 7 }, (_, index) => {
    const day = shiftDate(start, index)
    const meals = data.meals.filter((meal) => meal.date === day)
    const water = data.water.filter((entry) => entry.date === day).reduce((sum, entry) => sum + entry.amountMl, 0)
    return { day, meals, water }
  })
  const logged = week.filter((entry) => entry.meals.length)
  const average = logged.length ? logged.reduce((sum, entry) => sum + nutritionTotal(entry.meals, 'kcal').value, 0) / logged.length : null
  const dayMeals = data.meals.filter((meal) => meal.date === date)
  return <>
    <PageHeader title="Dziennik żywienia" description="Cały tydzień w jednym miejscu. Dotknij dnia, żeby zobaczyć i uzupełnić posiłki." />
    <div className="page-toolbar"><DateControl /></div>
    <WeekStrip />
    <div className="dashboard-grid"><div className="dashboard-main">
      <section className="panel meal-panel" aria-labelledby="journal-day-title">
        <div className="section-heading"><h2 id="journal-day-title">{dateLabel(date, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
          <span className="section-meta">{dayMeals.length ? `${dayMeals.length} ${dayMeals.length === 1 ? 'wpis' : dayMeals.length < 5 ? 'wpisy' : 'wpisów'}` : 'bez wpisów'}</span>
        </div>
        <MealList date={date} />
      </section>
      <NutritionSummary meals={dayMeals} profile={data.profile} />
      <section className="panel" aria-labelledby="journal-week-title">
        <div className="section-heading"><h2 id="journal-week-title">Tydzień w liczbach</h2>
          <span className="section-meta">{average === null ? 'brak wpisów w tym tygodniu' : `średnio ${integerFormat.format(average)} kcal w ${logged.length} ${logged.length === 1 ? 'zapisanym dniu' : 'zapisanych dniach'}`}</span>
        </div>
        <div className="table-scroll"><table className="week-table">
          <caption className="sr-only">Suma energii, makroskładników i wody w kolejnych dniach tygodnia</caption>
          <thead><tr><th scope="col">Dzień</th><th scope="col">Energia</th><th scope="col">Białko</th><th scope="col">Węglowodany</th><th scope="col">Tłuszcze</th><th scope="col">Woda</th></tr></thead>
          <tbody>{week.map(({ day, meals, water }) => <tr key={day} className={day === date ? 'selected' : undefined}>
            <th scope="row"><button type="button" className="text-link" onClick={() => setDate(day)} aria-label={`Pokaż ${dateLabel(day, { weekday: 'long', day: 'numeric', month: 'long' })}`}>
              {dateLabel(day, { weekday: 'short', day: 'numeric' })}</button></th>
            {meals.length ? <>
              <td>{integerFormat.format(nutritionTotal(meals, 'kcal').value)} kcal</td>
              {(['protein', 'carbs', 'fat'] as const).map((nutrient) => {
                const total = nutritionTotal(meals, nutrient)
                return <td key={nutrient}>{numberFormat.format(total.value)} g{total.missing ? <span className="missing-mark" title="Niektóre produkty nie mają tej wartości"> *</span> : null}</td>
              })}
            </> : <td colSpan={4} className="muted-cell">—</td>}
            <td>{water ? `${numberFormat.format(water / 1000)} l` : '—'}</td>
          </tr>)}</tbody>
        </table></div>
        {week.some(({ meals }) => (['protein', 'carbs', 'fat'] as const).some((nutrient) => nutritionTotal(meals, nutrient).missing > 0))
          && <p className="source-credit">* Część produktów nie ma tej wartości w bazie, więc suma jest niepełna.</p>}
      </section>
    </div><aside className="dashboard-aside"><WaterPanel data={data} date={date} />
      <div className="quiet-note"><p>Wartości z baz społecznościowych mogą być niepełne. Porównaj produkt z etykietą. Nieznane makro pokazujemy jako brak danych, a nie zero.</p></div>
    </aside></div>
  </>
}
