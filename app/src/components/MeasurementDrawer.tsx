import { useState, type FormEvent } from 'react'
import { measurementSchema } from '../../../shared/domain'
import { useJournal } from '../lib/Journal'
import { useFeedback } from './Feedback'
import { Button, Drawer, Field, Notice, errorMessage } from './ui'

export function MeasurementDrawer({ date, onClose }: { date: string; onClose: () => void }) {
  const { execute, pending } = useJournal()
  const feedback = useFeedback()
  const [error, setError] = useState<string | null>(null)
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const parsed = measurementSchema.omit({ id: true }).safeParse({ date: values.get('date'), weightKg: Number(values.get('weight')) })
    if (!parsed.success) { setError('Sprawdź datę i pomiar (20–500 kg).'); return }
    setError(null)
    try { await execute({ type: 'measurement.add', value: parsed.data }); feedback('Pomiar zapisany.'); onClose() }
    catch (cause) { setError(errorMessage(cause)) }
  }
  return <Drawer title="Dodaj pomiar" onClose={pending ? () => {} : onClose}>
    <p>To Twój punkt odniesienia, nie ocena. Dla każdego dnia przechowujemy jeden pomiar; ponowny zapis zastąpi poprzednią wartość.</p>
    {error && <Notice tone="error">{error}</Notice>}
    <form className="form-stack" onSubmit={(event) => { void save(event) }}>
      <Field label="Data pomiaru"><input name="date" type="date" required min="1900-01-01" max="2100-12-31" defaultValue={date} /></Field>
      <Field label="Masa ciała (kg)"><input name="weight" type="number" inputMode="decimal" min="20" max="500" step="0.1" required /></Field>
      <Button type="submit" busy={pending}>Zapisz pomiar</Button>
    </form>
  </Drawer>
}
