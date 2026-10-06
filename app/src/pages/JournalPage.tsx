import { useJournal } from '../lib/Journal'
import { DateControl, PageHeader, useWorkspace } from '../components/Workspace'
import { NutritionSummary, WaterPanel } from '../components/Summaries'
import { MealList } from '../components/MealList'

export function JournalPage() {
  const { data } = useJournal()
  const { date } = useWorkspace()
  if (!data) throw new Error('Journal data is unavailable')
  return <>
    <PageHeader title="Dziennik żywienia" description="Porcje, które znasz. Wartości, które możesz sprawdzić." />
    <div className="page-toolbar"><DateControl /></div>
    <div className="dashboard-grid"><div className="dashboard-main">
      <NutritionSummary meals={data.meals.filter((meal) => meal.date === date)} profile={data.profile} />
      <section className="panel meal-panel"><MealList date={date} /></section>
    </div><aside className="dashboard-aside"><WaterPanel data={data} date={date} />
      <div className="quiet-note"><p>Wartości z baz społecznościowych mogą być niepełne. Porównaj produkt z etykietą. Nieznane makro pokazujemy jako brak danych, a nie zero.</p></div>
    </aside></div>
  </>
}
