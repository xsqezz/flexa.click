import { useId, useState, type FormEvent } from 'react'
import type { Profile } from '../../../shared/domain'
import { useJournal } from '../lib/Journal'
import {
  activityLevels, energyGoals, energyInputProblem, estimateEnergy, goalsFromEstimate,
  type ActivityLevel, type EnergyEstimate, type EnergyGoal, type Sex,
} from '../lib/energy'
import { integerFormat } from '../lib/nutrition'
import { useFeedback } from './Feedback'
import { Button, Drawer, Field, Notice, errorMessage } from './ui'
import { ChipChoice, ChoiceList } from './WizardFields'

const parse = (value: string) => value.trim() === '' ? Number.NaN : Number(value.replace(',', '.'))

/** Orientacyjne zapotrzebowanie (Mifflin–St Jeor). Dane z formularza zostają tylko w tym oknie. */
export function EnergyDrawer({ profile, onClose, onApplied }: { profile: Profile; onClose: () => void; onApplied: () => void }) {
  const { execute, pending } = useJournal()
  const feedback = useFeedback()
  const ids = { sex: useId(), activity: useId(), goal: useId(), result: useId() }
  const [sex, setSex] = useState<Sex | null>(null)
  const [age, setAge] = useState('')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [activity, setActivity] = useState<ActivityLevel | null>(null)
  const [goal, setGoal] = useState<EnergyGoal>('maintain')
  const [problem, setProblem] = useState<string | null>(null)
  const [estimate, setEstimate] = useState<EnergyEstimate | null>(null)
  const [error, setError] = useState<string | null>(null)

  function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const input = { sex: sex ?? undefined, age: parse(age), heightCm: parse(height), weightKg: parse(weight), activity: activity ?? undefined, goal }
    const issue = energyInputProblem(input)
    setProblem(issue)
    setEstimate(null)
    if (issue || !input.sex || !input.activity) return
    setEstimate(estimateEnergy({ ...input, sex: input.sex, activity: input.activity }))
    requestAnimationFrame(() => document.getElementById(ids.result)?.focus())
  }

  async function apply() {
    if (!estimate) return
    setError(null)
    try {
      await execute({ type: 'profile.save', value: goalsFromEstimate(profile, estimate) })
      feedback('Ustawiono nowe cele. Możesz je zawsze zmienić ręcznie.')
      onApplied()
    } catch (cause) { setError(errorMessage(cause)) }
  }

  const change = <T,>(set: (value: T) => void) => (value: T) => { set(value); setEstimate(null) }
  return <Drawer title="Orientacyjne zapotrzebowanie" onClose={pending ? () => {} : onClose}>
    <p>Policzymy szacunkowe dzienne zapotrzebowanie wzorem Mifflina–St Jeora. Wiek, płeć i wzrost służą tylko do obliczenia i nie są nigdzie zapisywane — po zamknięciu tego okna znikają.</p>
    <form className="form-stack energy-form" onSubmit={calculate} noValidate>
      <div>
        <h3 id={ids.sex} className="energy-label">Płeć używana we wzorze</h3>
        <ChipChoice name="energy-sex" value={sex} labelledBy={ids.sex} onChange={change(setSex)}
          options={[{ value: 'female', label: 'Kobieta' }, { value: 'male', label: 'Mężczyzna' }]} />
      </div>
      <div className="form-grid energy-grid">
        <Field label="Wiek (lata)" hint="Od 18 do 100 lat."><input inputMode="numeric" value={age} onChange={(event) => change(setAge)(event.target.value)} autoComplete="off" /></Field>
        <Field label="Wzrost (cm)"><input inputMode="decimal" value={height} onChange={(event) => change(setHeight)(event.target.value)} autoComplete="off" /></Field>
        <Field label="Masa ciała (kg)"><input inputMode="decimal" value={weight} onChange={(event) => change(setWeight)(event.target.value)} autoComplete="off" /></Field>
      </div>
      <div>
        <h3 id={ids.activity} className="energy-label">Codzienna aktywność</h3>
        <ChoiceList name="energy-activity" value={activity} labelledBy={ids.activity} onChange={change(setActivity)}
          options={activityLevels.map((level) => ({ value: level.id, title: level.label, description: level.description }))} />
      </div>
      <div>
        <h3 id={ids.goal} className="energy-label">Kierunek</h3>
        <ChoiceList name="energy-goal" value={goal} labelledBy={ids.goal} onChange={change(setGoal)}
          options={energyGoals.map((item) => ({ value: item.id, title: item.label, description: item.description }))} />
      </div>
      {problem && <Notice tone="error">{problem}</Notice>}
      <Button type="submit" variant="secondary">Oblicz</Button>
    </form>
    {estimate && <section className="energy-result" aria-labelledby={ids.result}>
      <h3 id={ids.result} tabIndex={-1}>Twój orientacyjny wynik</h3>
      <dl className="energy-values">
        <div><dt>Energia</dt><dd>{integerFormat.format(estimate.calories)} <small>kcal / dzień</small></dd></div>
        <div><dt>Białko</dt><dd>{integerFormat.format(estimate.protein)} <small>g</small></dd></div>
        <div><dt>Węglowodany</dt><dd>{integerFormat.format(estimate.carbs)} <small>g</small></dd></div>
        <div><dt>Tłuszcze</dt><dd>{integerFormat.format(estimate.fat)} <small>g</small></dd></div>
        <div><dt>Woda</dt><dd>{integerFormat.format(estimate.water)} <small>ml</small></dd></div>
      </dl>
      <p className="source-credit">Przemiana podstawowa ok. {integerFormat.format(estimate.bmr)} kcal, z aktywnością ok. {integerFormat.format(estimate.maintenance)} kcal. Białko 1,6 g/kg (najwyżej 200 g), tłuszcze 25% energii, węglowodany — reszta, woda 35 ml/kg.</p>
      <Notice>To orientacyjny szacunek, nie porada medyczna. Wzory mylą się nawet o kilkanaście procent, a ciąża, karmienie piersią, choroby i leki zmieniają potrzeby — wtedy ustal cele z lekarzem lub dietetykiem.</Notice>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="button-row">
        <Button onClick={() => { void apply() }} busy={pending}>Ustaw jako moje cele</Button>
        <Button variant="secondary" onClick={onClose} disabled={pending}>Zamknij bez zmian</Button>
      </div>
      <p className="source-credit">Zastąpimy cele energii, makroskładników i wody. Imię, cel aktywności i docelowa masa zostaną bez zmian.</p>
    </section>}
  </Drawer>
}
