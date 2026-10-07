import { useState, type FormEvent } from 'react'
import { workoutNames, workoutSchema, type Workout } from '../../../shared/domain'
import { useJournal } from '../lib/Journal'
import { importActivityFile } from '../lib/activity-import'
import { Button, Drawer, Field, Notice, errorMessage } from './ui'
import { useFeedback } from './Feedback'

export type WorkoutPreset = { name: string; kind: Workout['kind']; minutes: number }

export function WorkoutDrawer({ date, preset, onClose }: { date: string; preset?: WorkoutPreset; onClose: () => void }) {
  const { execute, pending } = useJournal()
  const feedback = useFeedback()
  const [tab, setTab] = useState<'manual' | 'import'>('manual')
  const [draft, setDraft] = useState<Omit<Workout, 'id'> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)

  async function read(file: File) {
    setError(null); setDraft(null); setReading(true)
    try { setDraft(await importActivityFile(file)) }
    catch (cause) { setError(errorMessage(cause)) }
    finally { setReading(false) }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const optional = (name: string) => String(values.get(name) ?? '').trim() === '' ? null : Number(values.get(name))
    const parsed = workoutSchema.omit({ id: true }).safeParse({
      date: values.get('date'), name: values.get('name'), kind: values.get('kind'),
      minutes: Number(values.get('minutes')), distanceKm: optional('distance'),
      calories: optional('calories'), effort: optional('effort'),
      elevationM: draft?.elevationM ?? null, importHash: draft?.importHash ?? null,
    })
    if (!parsed.success) { setError('Sprawdź czas, dystans, datę oraz wysiłek (1–10). Nieznane wartości zostaw puste.'); return }
    setError(null)
    try { await execute({ type: 'workout.add', value: parsed.data }); feedback('Aktywność zapisana. Dobry krok!'); onClose() }
    catch (cause) { setError(errorMessage(cause)) }
  }

  return <Drawer title={preset ? 'Zapisz trening z planu' : 'Dodaj trening'} onClose={pending || reading ? () => {} : onClose}>
    {preset && <p>Sprawdź czas i dodaj odczuwalny wysiłek. Trening trafi do dziennika aktywności.</p>}
    {!preset && <div className="segmented-control" aria-label="Sposób dodania aktywności">
      <button aria-pressed={tab === 'manual'} onClick={() => { setTab('manual'); setDraft(null); setError(null) }}>Ręcznie</button>
      <button aria-pressed={tab === 'import'} onClick={() => { setTab('import'); setError(null) }}>Import GPX / TCX</button>
    </div>}
    {error && <Notice tone="error">{error}</Notice>}
    {tab === 'import' && <>
      <p className="source-credit">Plik odczytujemy na Twoim urządzeniu. Zapisujemy tylko podsumowanie, nie współrzędne ani cały plik. Maksymalnie 5 MB, jedna aktywność i 20 000 punktów GPX.</p>
      <Field label="Plik aktywności"><input type="file" accept=".gpx,.tcx" disabled={reading || pending} onChange={(event) => {
        const file = event.target.files?.[0]
        if (file) void read(file)
      }} /></Field>
      {reading && <Notice>Odczytuję plik…</Notice>}
      {draft && <Notice>Plik odczytany. Sprawdź datę, sport i podsumowanie przed zapisaniem.</Notice>}
    </>}
    {(tab === 'manual' || draft) && <form key={draft?.importHash ?? 'manual'} className="form-stack" style={{ marginTop: 20 }}
      onSubmit={(event) => { void save(event) }}>
      <Field label="Nazwa treningu"><input name="name" maxLength={120} required defaultValue={draft?.name ?? preset?.name ?? ''} placeholder="Np. spokojny bieg w parku" /></Field>
      <div className="form-grid">
        <Field label="Rodzaj"><select name="kind" defaultValue={draft?.kind ?? preset?.kind ?? 'run'}>{Object.entries(workoutNames).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></Field>
        <Field label="Data"><input name="date" type="date" required min="1900-01-01" max="2100-12-31" defaultValue={draft?.date ?? date} /></Field>
        <Field label="Czas (min)"><input name="minutes" type="number" inputMode="decimal" min="0.1" max="1440" step="0.1" required defaultValue={draft ? Number(draft.minutes.toFixed(1)) : preset?.minutes ?? ''} /></Field>
        <Field label="Dystans (km)" hint="Opcjonalnie."><input name="distance" type="number" inputMode="decimal" min="0" max="2000" step="0.01" defaultValue={draft?.distanceKm != null ? Number(draft.distanceKm.toFixed(2)) : ''} /></Field>
        <Field label="Energia (kcal)" hint="Szacunek z urządzenia; nie zwiększa celu diety."><input name="calories" type="number" inputMode="decimal" min="0" max="30000" step="0.1" defaultValue={draft?.calories ?? ''} /></Field>
        <Field label="Odczuwalny wysiłek (RPE)" hint="1 — bardzo lekko, 10 — maksymalnie."><input name="effort" type="number" inputMode="numeric" min="1" max="10" step="1" defaultValue="" /></Field>
      </div>
      <Button type="submit" busy={pending}>Zapisz trening</Button>
    </form>}
  </Drawer>
}
