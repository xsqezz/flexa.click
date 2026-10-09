import { useId, useState, type FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { workoutNames, workoutSchema, type Workout, type WorkoutSet } from '../../../shared/domain'
import { useJournal } from '../lib/Journal'
import { importActivityFile } from '../lib/activity-import'
import { exercises } from '../lib/training/library'
import { exerciseName, rowsToSets } from '../lib/training/sets'
import { Button, Drawer, Field, Notice, errorMessage } from './ui'
import { useFeedback } from './Feedback'

export type WorkoutPreset = {
  name: string; kind: Workout['kind']; minutes: number
  distanceKm?: number | null
  sets?: WorkoutSet[]
  /** `repeat` copies an earlier diary entry; otherwise the preset comes from the training plan. */
  origin?: 'plan' | 'repeat' | 'template'
}

type SetRow = { key: number; exercise: string; reps: string; weight: string }
const exerciseNames = [...new Set(exercises.filter((exercise) => exercise.measure === 'reps' && exercise.pattern !== 'warmup' && exercise.pattern !== 'cooldown')
  .map((exercise) => exercise.name))].sort((a, b) => a.localeCompare(b, 'pl'))
let rowKey = 0
const toRow = (set: WorkoutSet): SetRow => ({
  key: ++rowKey, exercise: exerciseName(set.exercise),
  reps: set.reps === null ? '' : String(set.reps), weight: set.weightKg === null ? '' : String(set.weightKg),
})

function SetsEditor({ rows, onChange }: { rows: SetRow[]; onChange: (rows: SetRow[]) => void }) {
  const listId = useId()
  const update = (key: number, patch: Partial<SetRow>) => onChange(rows.map((row) => row.key === key ? { ...row, ...patch } : row))
  function add() {
    const last = rows.at(-1)
    onChange([...rows, { key: ++rowKey, exercise: last?.exercise ?? '', reps: last?.reps ?? '', weight: last?.weight ?? '' }])
  }
  return <fieldset className="sets-editor">
    <legend>Serie <span>(opcjonalnie)</span></legend>
    <p className="sets-editor-hint">Zapisz ćwiczenie, powtórzenia i ciężar. Nowa seria kopiuje poprzednią, więc zmieniasz tylko to, co inne.</p>
    <datalist id={listId}>{exerciseNames.map((name) => <option key={name} value={name}>{name}</option>)}</datalist>
    {rows.length > 0 && <div className="sets-editor-head" aria-hidden="true"><span>Ćwiczenie</span><span>Powt.</span><span>kg</span></div>}
    <ol className="sets-editor-rows">
      {rows.map((row, index) => <li key={row.key} className="sets-editor-row">
        <input className="sets-editor-exercise" list={listId} maxLength={80} value={row.exercise} aria-label={`Seria ${index + 1}: ćwiczenie`}
          onChange={(event) => update(row.key, { exercise: event.target.value })} placeholder="Np. Przysiad goblet z hantlem" />
        <input type="number" inputMode="numeric" min="1" max="100" step="1" value={row.reps} aria-label={`Seria ${index + 1}: powtórzenia`} placeholder="powt."
          onChange={(event) => update(row.key, { reps: event.target.value })} />
        <input type="number" inputMode="decimal" min="0" max="500" step="0.25" value={row.weight} aria-label={`Seria ${index + 1}: ciężar w kg`} placeholder="kg"
          onChange={(event) => update(row.key, { weight: event.target.value })} />
        <button type="button" className="icon-button" aria-label={`Usuń serię ${index + 1}`} onClick={() => onChange(rows.filter((item) => item.key !== row.key))}><Trash2 size={16} /></button>
      </li>)}
    </ol>
    <Button type="button" variant="ghost" onClick={add} disabled={rows.length >= 200}><Plus size={16} aria-hidden="true" />Dodaj serię</Button>
  </fieldset>
}

export function WorkoutDrawer({ date, preset, onClose }: { date: string; preset?: WorkoutPreset; onClose: () => void }) {
  const { execute, pending } = useJournal()
  const feedback = useFeedback()
  const [tab, setTab] = useState<'manual' | 'import'>('manual')
  const [draft, setDraft] = useState<Omit<Workout, 'id'> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [kind, setKind] = useState<Workout['kind']>(preset?.kind ?? 'run')
  const [rows, setRows] = useState<SetRow[]>(() => (preset?.sets ?? []).map(toRow))
  const repeat = preset?.origin === 'repeat'
  const fromTemplate = preset?.origin === 'template'

  async function read(file: File) {
    setError(null); setDraft(null); setReading(true)
    try {
      const imported = await importActivityFile(file)
      setDraft(imported)
      setKind(imported.kind)
    }
    catch (cause) { setError(errorMessage(cause)) }
    finally { setReading(false) }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const optional = (name: string) => String(values.get(name) ?? '').trim() === '' ? null : Number(values.get(name))
    const sets = rowsToSets(rows)
    if (typeof sets === 'string') { setError(sets); return }
    const parsed = workoutSchema.omit({ id: true }).safeParse({
      date: values.get('date'), name: values.get('name'), kind,
      minutes: Number(values.get('minutes')), distanceKm: optional('distance'),
      calories: optional('calories'), effort: optional('effort'),
      elevationM: draft?.elevationM ?? null, importHash: draft?.importHash ?? null,
      ...(sets.length ? { sets } : {}),
    })
    if (!parsed.success) { setError('Sprawdź czas, dystans, datę oraz wysiłek (1–10). Nieznane wartości zostaw puste.'); return }
    setError(null)
    try { await execute({ type: 'workout.add', value: parsed.data }); feedback('Aktywność zapisana. Dobry krok!'); onClose() }
    catch (cause) { setError(errorMessage(cause)) }
  }

  const title = repeat ? 'Powtórz trening' : fromTemplate ? 'Zapisz własny trening' : preset ? 'Zapisz trening z planu' : 'Dodaj trening'
  return <Drawer title={title} onClose={pending || reading ? () => {} : onClose}>
    {fromTemplate && <p>Wartości pochodzą z Twojego zapisanego treningu. Zmień to, co dziś wyglądało inaczej — data jest ustawiona na dziś.</p>}
    {preset && !repeat && !fromTemplate && <p>Sprawdź czas i dodaj odczuwalny wysiłek. Trening trafi do dziennika aktywności.</p>}
    {repeat && <p>Wartości pochodzą z wcześniejszego wpisu. Zmień to, co dziś wyglądało inaczej — data jest ustawiona na dziś.</p>}
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
        <Field label="Rodzaj"><select name="kind" value={kind} onChange={(event) => setKind(event.target.value as Workout['kind'])}>{Object.entries(workoutNames).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></Field>
        <Field label="Data"><input name="date" type="date" required min="1900-01-01" max="2100-12-31" defaultValue={draft?.date ?? date} /></Field>
        <Field label="Czas (min)"><input name="minutes" type="number" inputMode="decimal" min="0.1" max="1440" step="0.1" required defaultValue={draft ? Number(draft.minutes.toFixed(1)) : preset?.minutes ?? ''} /></Field>
        <Field label="Dystans (km)" hint="Opcjonalnie."><input name="distance" type="number" inputMode="decimal" min="0" max="2000" step="0.01" defaultValue={draft?.distanceKm != null ? Number(draft.distanceKm.toFixed(2)) : preset?.distanceKm ?? ''} /></Field>
        <Field label="Energia (kcal)" hint="Szacunek z urządzenia; nie zwiększa celu diety."><input name="calories" type="number" inputMode="decimal" min="0" max="30000" step="0.1" defaultValue={draft?.calories ?? ''} /></Field>
        <Field label="Odczuwalny wysiłek (RPE)" hint="1 — bardzo lekko, 10 — maksymalnie."><input name="effort" type="number" inputMode="numeric" min="1" max="10" step="1" defaultValue="" /></Field>
      </div>
      {(kind === 'strength' || rows.length > 0) && <SetsEditor rows={rows} onChange={setRows} />}
      <Button type="submit" busy={pending}>Zapisz trening</Button>
    </form>}
  </Drawer>
}
