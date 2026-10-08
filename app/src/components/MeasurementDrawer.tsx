import { useState, type FormEvent } from 'react'
import { measurementSchema } from '../../../shared/domain'
import { useJournal } from '../lib/Journal'
import { useFeedback } from './Feedback'
import { Button, Drawer, Field, Notice, errorMessage } from './ui'

export function MeasurementDrawer({ date, onClose }: { date: string; onClose: () => void }) {
  const { data, execute, pending } = useJournal()
  const feedback = useFeedback()
  const [error, setError] = useState<string | null>(null)
  const existing = data?.measurements.find((measurement) => measurement.date === date)
  const hasExtras = existing?.waistCm != null || existing?.hipsCm != null || existing?.bodyFatPct != null
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const optional = (name: string) => String(values.get(name) ?? '').trim() === '' ? null : Number(values.get(name))
    const parsed = measurementSchema.omit({ id: true }).safeParse({
      date: values.get('date'), weightKg: Number(values.get('weight')),
      waistCm: optional('waist'), hipsCm: optional('hips'), bodyFatPct: optional('bodyFat'),
    })
    if (!parsed.success) { setError('Sprawdź datę i pomiary: masa 20–500 kg, obwody 40–250 cm, tkanka tłuszczowa 2–70%.'); return }
    setError(null)
    try { await execute({ type: 'measurement.add', value: parsed.data }); feedback('Pomiar zapisany.'); onClose() }
    catch (cause) { setError(errorMessage(cause)) }
  }
  return <Drawer title="Dodaj pomiar" onClose={pending ? () => {} : onClose}>
    <p>To Twój punkt odniesienia, nie ocena. Dla każdego dnia przechowujemy jeden pomiar; ponowny zapis zastąpi poprzednie wartości z tego dnia.</p>
    {error && <Notice tone="error">{error}</Notice>}
    <form className="form-stack" onSubmit={(event) => { void save(event) }}>
      <Field label="Data pomiaru"><input name="date" type="date" required min="1900-01-01" max="2100-12-31" defaultValue={date} /></Field>
      <Field label="Masa ciała (kg)" hint={existing ? 'Wpisaliśmy zapisany pomiar z tego dnia — zmień go albo uzupełnij.' : undefined}><input name="weight" type="number" inputMode="decimal" min="20" max="500" step="0.1" required defaultValue={existing?.weightKg ?? ''} /></Field>
      <details className="more-measurements" open={hasExtras}>
        <summary>Więcej pomiarów</summary>
        <p>Opcjonalnie. Mierz w tych samych warunkach, np. rano, aby wartości dało się porównać.</p>
        <div className="form-grid">
          <Field label="Obwód talii (cm)"><input name="waist" type="number" inputMode="decimal" min="40" max="250" step="0.1" defaultValue={existing?.waistCm ?? ''} /></Field>
          <Field label="Obwód bioder (cm)"><input name="hips" type="number" inputMode="decimal" min="40" max="250" step="0.1" defaultValue={existing?.hipsCm ?? ''} /></Field>
          <Field label="Tkanka tłuszczowa (%)" hint="Np. z wagi z analizatorem — to szacunek urządzenia."><input name="bodyFat" type="number" inputMode="decimal" min="2" max="70" step="0.1" defaultValue={existing?.bodyFatPct ?? ''} /></Field>
        </div>
      </details>
      <Button type="submit" busy={pending}>Zapisz pomiar</Button>
    </form>
  </Drawer>
}
