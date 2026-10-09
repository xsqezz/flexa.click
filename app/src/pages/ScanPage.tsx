import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Camera, Check, ImagePlus, Plus, Search, ShieldCheck, Sparkles, Trash2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { mealNames, type MealKind } from '../../../shared/domain'
import { getPlateItem, plateSizeLabels, plateSizes, type PlateSize } from '../../../shared/meal-scan/catalog'
import {
  confidenceLabels, estimateLine, estimatePlate, lineFood, lineProblem, portionText, scaleToKcal, type Band, type PlateLine,
} from '../../../shared/meal-scan/estimate'
import { loadPlateLibrary } from '../../../shared/meal-scan/library'
import { searchPlateItems, type Confidence } from '../../../shared/meal-scan/match'
import { useAuth } from '../lib/Auth'
import { useJournal } from '../lib/Journal'
import { dateLabel, today } from '../lib/dates'
import { plural } from '../lib/templates'
import { integerFormat, numberFormat } from '../lib/nutrition'
import { KitchenAiError, kitchenAiAvailable, preparePhoto, type PreparedPhoto } from '../lib/kitchen/ai-client'
import { lineWithHabit, readHabits, rememberLines, saveHabits } from '../lib/scan/habits'
import { analysePlate, lineForItem, rememberScanConsent, resolveFindings, scanConsentGiven } from '../lib/scan/client'
import { DateControl, PageHeader, mealForHour, useWorkspace } from '../components/Workspace'
import { useFeedback } from '../components/Feedback'
import { Button, Notice, errorMessage } from '../components/ui'

type Entry = { key: string; line: PlateLine; heard?: string; alternatives?: string[]; confidence?: Confidence }
const maxEntries = 25
const quickPicks = ['burger-double', 'fries', 'cola', 'pizza-cheese', 'kebab', 'nuggets', 'sauce-ketchup', 'salad-plain']
const sourceLabels = { PL: 'oficjalne dane sieci w Polsce', US: 'dane sieci z USA (starsze, orientacyjne)' } as const
const precisionLabels = { exact: 'wartości z menu', weighed: 'podana ilość', counted: 'policzone sztuki', official: 'porcja z oficjalnego menu', estimated: 'ocena na oko' } as const

const kcalRange = (band: Band) => band.low === band.high ? integerFormat.format(band.typical) : `${integerFormat.format(band.low)}–${integerFormat.format(band.high)}`
const without = (line: PlateLine, ...keys: ('count' | 'grams' | 'exact')[]): PlateLine => {
  const copy = { ...line }
  for (const key of keys) delete copy[key]
  return copy
}
const parseNumber = (value: string): number | null => {
  const trimmed = value.trim().replace(',', '.')
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function ItemPicker({ onPick, alternatives = [], label = 'Podobne pozycje', disabled = false, placeholder = 'Szukaj: frytki, kebab, cola, sos czosnkowy…' }: { onPick: (id: string) => void; alternatives?: readonly string[]; label?: string; disabled?: boolean; placeholder?: string }) {
  const [query, setQuery] = useState('')
  const found = useMemo(() => searchPlateItems(query, 12).map((entry) => entry.item), [query])
  return <>
    <label className="kitchen-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Szukaj dania, dodatku lub napoju</span>
      <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} autoComplete="off" disabled={disabled} /></label>
    {query.trim() ? <div className="kitchen-chips" role="group" aria-label="Wyniki wyszukiwania">
      {found.length ? found.map((item) => <button key={item.id} type="button" className="kitchen-chip" onClick={() => { onPick(item.id); setQuery('') }} disabled={disabled}><Plus size={15} aria-hidden="true" />{item.name}{item.brand ? ` · ${item.brand}` : ''}</button>)
        : <p className="scan-lead">Nie ma takiej pozycji. Spróbuj prostszej nazwy albo podobnego dania i wpisz własne wartości z menu.</p>}
    </div> : alternatives.length > 0 && <div className="kitchen-chips" role="group" aria-label={label}>
      {alternatives.map((id) => <button key={id} type="button" className="kitchen-chip" onClick={() => onPick(id)} disabled={disabled}>{getPlateItem(id).name}{getPlateItem(id).brand ? ` · ${getPlateItem(id).brand}` : ''}</button>)}
    </div>}
  </>
}

function PlateRow({ entry, onChange, onReplace, onRemove }: { entry: Entry; onChange: (line: PlateLine) => void; onReplace: (id: string) => void; onRemove: () => void }) {
  const id = useId()
  const { line } = entry
  const item = getPlateItem(line.id)
  const estimate = estimateLine(lineProblem(line) ? { id: line.id } : line)
  const problem = lineProblem(line)
  const [own, setOwn] = useState(() => line.exact
    ? { kcal: String(line.exact.kcal), protein: String(line.exact.protein), carbs: String(line.exact.carbs), fat: String(line.exact.fat) }
    : { kcal: '', protein: '', carbs: '', fat: '' })
  const activeSize: PlateSize | null = line.grams === undefined && !(line.count && item.piece) ? line.size ?? 'M' : null

  function setOwnValue(key: keyof typeof own, value: string) {
    const next = { ...own, [key]: value }
    setOwn(next)
    const kcal = parseNumber(next.kcal)
    const rest = without(line, 'exact')
    if (kcal === null) {
      onChange(rest)
      return
    }
    const given = {
      protein: parseNumber(next.protein) ?? undefined, carbs: parseNumber(next.carbs) ?? undefined, fat: parseNumber(next.fat) ?? undefined,
    }
    onChange({ ...rest, exact: Number.isFinite(kcal) && kcal >= 0 ? scaleToKcal(rest, kcal, {
      ...(Number.isFinite(given.protein) ? { protein: given.protein } : {}), ...(Number.isFinite(given.carbs) ? { carbs: given.carbs } : {}), ...(Number.isFinite(given.fat) ? { fat: given.fat } : {}),
    }) : { kcal: Number.NaN, protein: 0, carbs: 0, fat: 0 } })
  }

  return <li className="scan-row">
    <div className="scan-row-head">
      <div>
        <strong>{item.name}</strong>
        <span>{item.brand ? `${item.brand} · ` : ''}{portionText(estimate)} · {precisionLabels[estimate.precision]}</span>
        {item.brand && item.region && <span className="scan-heard">Źródło: {sourceLabels[item.region]}</span>}
        {entry.heard && <span className="scan-heard">Rozpoznano: {entry.heard}</span>}
      </div>
      <div className="scan-row-kcal">
        <strong>{integerFormat.format(estimate.kcal.typical)} kcal</strong>
        {estimate.kcal.low !== estimate.kcal.high && <small>zakres {kcalRange(estimate.kcal)}</small>}
      </div>
      <button type="button" className="icon-button" aria-label={`Usuń: ${item.name}`} onClick={onRemove}><Trash2 size={17} aria-hidden="true" /></button>
    </div>
    {entry.confidence && entry.confidence !== 'sure' && <p className="scan-check" role="note">Nie jestem pewien tej pozycji — sprawdź ją albo zmień na właściwą.</p>}
    {entry.heard && <details className="scan-swap">
      <summary>To nie ta pozycja? Zmień</summary>
      <div className="scan-more-body"><ItemPicker onPick={onReplace} alternatives={entry.alternatives} /></div>
    </details>}
    {!item.fixed && <fieldset className="scan-sizes">
      <legend className="sr-only">Rozmiar porcji: {item.name}</legend>
      {plateSizes.map((size) => <label key={size} className="scan-size">
        <input type="radio" name={`${id}-size`} checked={activeSize === size}
          onChange={() => onChange({ id: line.id, size, ...(line.exact ? { exact: line.exact } : {}) })} />
        <span><strong>{plateSizeLabels[size]}</strong><small>{item.sizes[size]} {item.unit}</small></span>
      </label>)}
    </fieldset>}
    <div className="scan-row-fields">
      <label className="scan-field">
        <span>{item.piece ? `Liczba sztuk (${item.piece.label})` : 'Liczba porcji'}</span>
        <input type="number" inputMode="numeric" min="1" max="60" step="1" value={line.count ?? ''}
          onChange={(event) => {
            const value = parseNumber(event.target.value)
            const rest = without(line, 'count', 'grams')
            onChange(value === null ? { ...rest, size: line.size ?? 'M' } : { ...rest, count: value, ...(item.piece ? {} : { size: line.size ?? 'M' }) })
          }} />
      </label>
      <details className="scan-more">
        <summary>Dokładniej: waga lub wartości z menu</summary>
        <div className="scan-more-body">
          <label className="scan-field">
            <span>Dokładna ilość ({item.unit})</span>
            <input type="number" inputMode="decimal" min="1" max="5000" step="1" value={line.grams ?? ''}
              onChange={(event) => {
                const value = parseNumber(event.target.value)
                const rest = without(line, 'count', 'grams')
                onChange(value === null ? { ...rest, size: line.size ?? 'M' } : { ...rest, grams: value })
              }} />
          </label>
          <fieldset className="scan-own">
            <legend>Własne wartości całej porcji z menu, aplikacji sieci lub etykiety</legend>
            <p>Jeśli znasz kalorie z menu, wpisz je — zastąpią szacunek. Puste makro policzymy proporcjonalnie.</p>
            <div className="scan-own-grid">
              {([['kcal', 'Energia (kcal)'], ['protein', 'Białko (g)'], ['carbs', 'Węglowodany (g)'], ['fat', 'Tłuszcze (g)']] as const).map(([key, label]) => <label key={key} className="scan-field">
                <span>{label}</span>
                <input type="number" inputMode="decimal" min="0" step="0.1" value={own[key]} onChange={(event) => setOwnValue(key, event.target.value)} />
              </label>)}
            </div>
          </fieldset>
        </div>
      </details>
    </div>
    {problem && <Notice tone="error">{problem}</Notice>}
  </li>
}

function PhotoPanel({ aiReady, onAnalysed }: { aiReady: boolean | null; onAnalysed: (analysis: Awaited<ReturnType<typeof analysePlate>>) => Promise<void> }) {
  const auth = useAuth()
  const token = auth.session?.access_token ?? null
  const [photos, setPhotos] = useState<PreparedPhoto[]>([])
  const [remembered, setRemembered] = useState(scanConsentGiven)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState<'preparing' | 'working' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)
  const previews = useRef<string[]>([])
  previews.current = photos.map((photo) => photo.preview)
  useEffect(() => () => { for (const url of previews.current) URL.revokeObjectURL(url) }, [])

  if (auth.mode !== 'cloud') return <Notice>Rozpoznawanie ze zdjęcia działa po zalogowaniu. W trybie demo złóż talerz ręcznie — wyszukaj składniki poniżej.</Notice>
  if (aiReady === false) return <Notice>Rozpoznawanie ze zdjęcia jest chwilowo niedostępne. Złóż talerz ręcznie — wyszukaj składniki poniżej.</Notice>

  async function choose(file: File | undefined) {
    if (!file) return
    if (photos.length >= 2) { setError('Możesz dodać najwyżej dwa zdjęcia: całość i drugie ujęcie.'); return }
    setError(null); setBusy('preparing')
    try {
      const prepared = await preparePhoto(file, { crops: false })
      setPhotos((current) => [...current, prepared])
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(null) }
  }

  function drop(index: number) {
    setPhotos((current) => {
      URL.revokeObjectURL(current[index]?.preview ?? '')
      return current.filter((_, position) => position !== index)
    })
  }

  async function analyse() {
    if (!photos.length || !token) return
    if (!remembered && !consent) { setError('Zaznacz zgodę na wysłanie zdjęcia do analizy.'); return }
    rememberScanConsent(true); setRemembered(true)
    setError(null); setBusy('working')
    try {
      const analysis = await analysePlate(photos.map((photo) => photo.images[0]), token)
      await onAnalysed(analysis)
      for (const photo of photos) URL.revokeObjectURL(photo.preview)
      setPhotos([])
    } catch (cause) {
      setError(cause instanceof KitchenAiError ? cause.message : errorMessage(cause))
    } finally { setBusy(null) }
  }

  return <section className="panel scan-photo" aria-labelledby="scan-photo-title">
    <h2 id="scan-photo-title">Zdjęcie tacy lub talerza</h2>
    <p className="scan-lead">Zrób zdjęcie z góry, przy dobrym świetle, tak by wszystko było widać — także napój i sosy. Opcjonalnie dodaj drugie ujęcie z boku.</p>
    <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(event) => { void choose(event.target.files?.[0]); event.target.value = '' }} />
    <input ref={gallery} type="file" accept="image/*" hidden onChange={(event) => { void choose(event.target.files?.[0]); event.target.value = '' }} />
    <div className="button-row">
      <Button onClick={() => camera.current?.click()} disabled={busy !== null || photos.length >= 2}><Camera size={17} aria-hidden="true" />Zrób zdjęcie</Button>
      <Button variant="secondary" onClick={() => gallery.current?.click()} disabled={busy !== null || photos.length >= 2}><ImagePlus size={17} aria-hidden="true" />Wybierz z galerii</Button>
    </div>
    {busy === 'preparing' && <p className="scan-lead" role="status">Przygotowuję zdjęcie…</p>}
    {photos.length > 0 && <div className="scan-previews">
      <ul>{photos.map((photo, index) => <li key={photo.preview}>
        <img src={photo.preview} alt={`Podgląd zdjęcia ${index + 1} z ${photos.length}`} />
        <button type="button" className="icon-button" aria-label={`Usuń zdjęcie ${index + 1}`} onClick={() => drop(index)} disabled={busy === 'working'}><Trash2 size={16} aria-hidden="true" /></button>
      </li>)}</ul>
      {remembered
        ? <p className="scan-lead">Zgoda na wysyłanie zdjęć do analizy jest zapisana na tym urządzeniu. <button type="button" className="text-link" onClick={() => { rememberScanConsent(false); setRemembered(false); setConsent(false) }}>Cofnij zgodę</button></p>
        : <label className="checkbox-label"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
          <span>Rozumiem, że zdjęcie zostanie pomniejszone, pozbawione danych EXIF (np. lokalizacji) i wysłane do Cloudflare Workers AI wyłącznie po to, by rozpoznać potrawy. Flexa go nie zapisuje.</span></label>}
      <div className="button-row">
        <Button onClick={() => { void analyse() }} busy={busy === 'working'}><Sparkles size={17} aria-hidden="true" />Rozpoznaj posiłek</Button>
      </div>
      {busy === 'working' && <p className="scan-lead" role="status">Analizuję zdjęcie — zwykle kilka sekund, czasem dłużej.</p>}
    </div>}
    {error && <Notice tone="error">{error}</Notice>}
    <p className="scan-lead"><ShieldCheck size={15} aria-hidden="true" /> Dzienny limit: kilka zdjęć na konto, wspólnie z Smart Kuchnią. Zdjęcie nie jest nigdzie zapisywane.</p>
  </section>
}

function AddItem({ onAdd, disabled, suggestions }: { onAdd: (id: string) => void; disabled: boolean; suggestions: boolean }) {
  return <section className="scan-add" aria-labelledby="scan-add-title">
    <h3 id="scan-add-title">Dodaj składnik</h3>
    <ItemPicker onPick={onAdd} disabled={disabled} alternatives={suggestions ? quickPicks : []} label="Najczęstsze pozycje" />
  </section>
}

export function ScanPage() {
  const auth = useAuth()
  const { execute, pending } = useJournal()
  const { date } = useWorkspace()
  const feedback = useFeedback()
  const navigate = useNavigate()
  const [entries, setEntries] = useState<Entry[]>([])
  const [meal, setMeal] = useState<MealKind>(() => mealForHour(new Date().getHours()))
  const [aiReady, setAiReady] = useState<boolean | null>(null)
  const [library, setLibrary] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [notice, setNotice] = useState<{ tone: 'info' | 'success'; text: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const counter = useRef(0)
  const scope = auth.session?.user.id ?? 'demo'
  useEffect(() => {
    let active = true
    loadPlateLibrary().then(() => { if (active) setLibrary('ready') }, () => { if (active) setLibrary('failed') })
    return () => { active = false }
  }, [])
  useEffect(() => {
    if (auth.mode !== 'cloud') return
    let active = true
    void kitchenAiAvailable().then((value) => { if (active) setAiReady(value) })
    return () => { active = false }
  }, [auth.mode])

  const newEntry = (line: PlateLine, extra: Partial<Entry> = {}): Entry => ({ key: `row-${counter.current++}`, line, ...extra })
  const problems = entries.some((entry) => lineProblem(entry.line))
  const plate = useMemo(() => estimatePlate(entries.filter((entry) => !lineProblem(entry.line)).map((entry) => entry.line)), [entries])
  const forDay = date === today() ? 'dziś' : dateLabel(date, { day: 'numeric', month: 'long' })

  async function onAnalysed(analysis: Awaited<ReturnType<typeof analysePlate>>) {
    await loadPlateLibrary()
    const { resolved, unknown } = resolveFindings(analysis.items)
    setEntries((current) => {
      const have = new Set(current.map((entry) => entry.line.id))
      const fresh = resolved.filter((entry) => !have.has(entry.line.id) && have.add(entry.line.id))
      return [...current, ...fresh.map((entry) => newEntry(entry.line, { heard: entry.heard, alternatives: entry.alternatives, confidence: entry.confidence }))].slice(0, maxEntries)
    })
    const unsure = resolved.filter((entry) => entry.confidence !== 'sure').length
    const missing = unknown.length ? ` Nie znalazłem w bazie: ${unknown.join(', ')} — wyszukaj podobną pozycję albo wpisz własne wartości.` : ''
    const doubt = unsure ? ` Oznaczyłem ${plural(unsure, ['pozycję', 'pozycje', 'pozycji'])} do sprawdzenia.` : ''
    setNotice(resolved.length
      ? { tone: 'success', text: `Rozpoznałem ${plural(resolved.length, ['pozycję', 'pozycje', 'pozycji'])}.${doubt} Sprawdź rozmiary i liczbę sztuk — to one najbardziej zmieniają wynik.${missing}` }
      : { tone: 'info', text: `Nie rozpoznałem jedzenia na tym zdjęciu. Zrób zdjęcie z góry przy lepszym świetle albo dodaj składniki ręcznie.${missing}` })
    if (analysis.analysed < analysis.photos) setNotice({ tone: 'info', text: 'Jedno ze zdjęć nie zostało przeanalizowane. Sprawdź listę i uzupełnij ją ręcznie.' })
  }

  function add(id: string) {
    if (entries.length >= maxEntries) { setError(`Na jednym talerzu zmieścimy najwyżej ${maxEntries} pozycji.`); return }
    setError(null)
    setEntries((current) => [...current, newEntry(lineWithHabit(readHabits(scope), id))])
  }

  function replace(key: string, id: string) {
    setEntries((current) => current.map((entry) => entry.key === key
      ? { ...entry, line: lineForItem(getPlateItem(id), { size: entry.line.size ?? null, count: entry.line.count ?? null }), confidence: 'sure' }
      : entry))
  }

  async function save() {
    if (!entries.length || problems) return
    setError(null)
    try {
      const value = plate.lines.map((estimate) => ({ date, meal, ...lineFood(estimate) }))
      await execute({ type: 'meal.addMany', value })
      saveHabits(scope, rememberLines(readHabits(scope), plate.lines.map((estimate) => estimate.line)))
      saveHabits(scope, rememberLines(readHabits(scope), plate.lines.map((estimate) => estimate.line)))
      feedback(`Zapisano ${plural(value.length, ['pozycję', 'pozycje', 'pozycji'])} w: ${mealNames[meal]}.`)
      navigate('/meals')
    } catch (cause) { setError(errorMessage(cause)) }
  }

  const macros = [['Białko', plate.totals.protein], ['Węglowodany', plate.totals.carbs], ['Tłuszcze', plate.totals.fat]] as const
  return <>
    <div className="goals-back"><Link to="/meals" className="text-link">← Wróć do Posiłków</Link></div>
    <PageHeader title="Skan posiłku" description="Zdjęcie tacy lub talerza zamienione w listę składników z kaloriami i makroskładnikami — do sprawdzenia i zapisania w Posiłkach." primary="none" />
    <div className="page-toolbar"><DateControl /></div>
    <Notice>To szacunek, nie pomiar. Ze zdjęcia nie da się odczytać wagi porcji ani oleju i sosów w środku, dlatego pokazujemy <strong>zakres</strong>. Najdokładniej policzysz posiłek, gdy poprawisz rozmiar lub liczbę sztuk, wpiszesz wagę albo kalorie z menu.</Notice>
    <div className="scan-layout">
      <div className="scan-main">
        <PhotoPanel aiReady={aiReady} onAnalysed={onAnalysed} />
        {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
        <section className="panel scan-list" aria-labelledby="scan-list-title">
          <h2 id="scan-list-title">Twój talerz <small>({entries.length})</small></h2>
          {entries.length === 0
            ? <p className="scan-lead">Na razie pusto. Zrób zdjęcie albo dodaj składniki poniżej.</p>
            : <ul className="scan-rows">{entries.map((entry) => <PlateRow key={entry.key} entry={entry}
              onChange={(line) => setEntries((current) => current.map((item) => item.key === entry.key ? { ...item, line } : item))}
              onReplace={(id) => replace(entry.key, id)}
              onRemove={() => setEntries((current) => current.filter((item) => item.key !== entry.key))} />)}</ul>}
          {library === 'loading' ? <p className="scan-lead" role="status">Wczytuję bazę potraw…</p>
            : library === 'failed' ? <Notice tone="error">Nie udało się wczytać bazy potraw. Odśwież stronę i spróbuj ponownie.</Notice>
              : <AddItem onAdd={add} disabled={false} suggestions={entries.length === 0} />}
        </section>
      </div>
      <aside className="panel scan-summary" aria-labelledby="scan-summary-title">
        <h2 id="scan-summary-title">Podsumowanie</h2>
        {entries.length === 0 ? <p className="scan-lead">Dodaj pierwszy składnik, aby zobaczyć kalorie i makroskładniki.</p> : <>
          <div className="scan-total">
            <span>Energia — wartość środkowa</span>
            <strong>{integerFormat.format(plate.totals.kcal.typical)} <small>kcal</small></strong>
            {plate.totals.kcal.low !== plate.totals.kcal.high && <span className="scan-range">Zakres: {kcalRange(plate.totals.kcal)} kcal</span>}
          </div>
          <dl className="scan-macros">
            {macros.map(([name, band]) => <div key={name}><dt>{name}</dt><dd>{numberFormat.format(Math.round(band.typical * 10) / 10)} g{band.low !== band.high && <small>{integerFormat.format(band.low)}–{integerFormat.format(band.high)}</small>}</dd></div>)}
          </dl>
          <p className="scan-confidence"><Check size={15} aria-hidden="true" />{confidenceLabels[plate.confidence]}{plate.spreadPercent > 0 && <> (±{plate.spreadPercent}%)</>}</p>
          <label className="field scan-meal"><span>Zapisz do posiłku ({forDay})</span>
            <select value={meal} onChange={(event) => setMeal(event.target.value as MealKind)}>
              {Object.entries(mealNames).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
            </select></label>
          {error && <Notice tone="error">{error}</Notice>}
          {problems && <Notice tone="error">Popraw wartości zaznaczone na liście, aby zapisać posiłek.</Notice>}
          <Button onClick={() => { void save() }} busy={pending} disabled={problems || entries.length === 0}><Plus size={17} aria-hidden="true" />Zapisz w Posiłkach</Button>
          <p className="source-credit">Zapiszemy wartość środkową każdej pozycji z oznaczeniem „skan”. Zakres zobaczysz tylko tutaj. Wartości z tabel to średnie — konkretny lokal może się różnić.</p>
        </>}
      </aside>
    </div>
  </>
}
