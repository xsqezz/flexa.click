import { useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ChevronRight, Search, Utensils } from 'lucide-react'
import { foodSchema, mealNames, mealSchema, type Food, type MealKind, type SearchResponse } from '../../../shared/domain'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../lib/Auth'
import { useJournal } from '../lib/Journal'
import { searchFoods } from '../lib/search'
import { numberFormat } from '../lib/nutrition'
import { sourceNames } from '../lib/sources'
import { useFeedback } from './Feedback'
import { Button, Drawer, EmptyState, Field, Notice, errorMessage } from './ui'
import { CameraScanner } from './CameraScanner'
import { SourceCredit } from './SourceCredit'
import { catalogGroups, requiredProducts } from '../../../shared/polish-catalog'
import { suggestedFoods } from '../lib/templates'
import { today } from '../lib/dates'
import { MealTemplates } from './MealTemplates'

const mealKinds: MealKind[] = ['breakfast', 'lunch', 'dinner', 'snack']
const nutrientFields = [
  { name: 'kcal', label: 'Energia (kcal)', required: true, max: 2000 },
  { name: 'protein', label: 'Białko (g)', max: 100 },
  { name: 'carbs', label: 'Węglowodany (g)', max: 100 },
  { name: 'fat', label: 'Tłuszcze (g)', max: 100 },
  { name: 'fiber', label: 'Błonnik (g)', max: 100 },
] as const

export function MealDrawer({ date, initialMeal, initialTab = 'search', onClose }: { date: string; initialMeal: MealKind; initialTab?: 'search' | 'barcode' | 'custom'; onClose: () => void }) {
  const auth = useAuth()
  const { data, execute, pending } = useJournal()
  const feedback = useFeedback()
  const client = useQueryClient()
  const [tab, setTab] = useState<'search' | 'barcode' | 'custom'>(initialTab)
  const [query, setQuery] = useState('')
  const [barcode, setBarcode] = useState('')
  const [result, setResult] = useState<SearchResponse | null>(null)
  const [searching, setSearching] = useState(false)
  const [food, setFood] = useState<Food | null>(null)
  const [portion, setPortion] = useState('100')
  const [unit, setUnit] = useState<'g' | 'ml' | ''>('')
  const [error, setError] = useState<string | null>(null)
  const searchVersion = useRef(0)
  if (!data) throw new Error('Journal data is unavailable')
  const customFoods = data.customFoods
  const mode = auth.mode === 'demo' ? 'demo' : 'cloud'
  const recent = suggestedFoods(data.meals, customFoods, today())
  const lastPortion = new Map(recent.map((item) => [item.food.id, item.portion]))

  function select(value: Food, previousPortion?: number | null) {
    setError(null); setFood(value); setUnit(value.unit ?? ''); setPortion(previousPortion ? String(previousPortion) : '100')
  }

  async function search(input: { query: string } | { barcode: string }) {
    const version = ++searchVersion.current
    setError(null); setSearching(true); setResult(null)
    try {
      const response = await client.fetchQuery({
        queryKey: ['food-search', mode, auth.session?.user.id ?? 'demo', input, customFoods],
        queryFn: () => searchFoods(input, mode, customFoods),
        staleTime: 300_000, retry: false,
      })
      if (version === searchVersion.current) setResult(response)
    } catch (cause) { if (version === searchVersion.current) setError(errorMessage(cause)) }
    finally { if (version === searchVersion.current) setSearching(false) }
  }

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!food) return
    const values = new FormData(event.currentTarget)
    const parsed = mealSchema.omit({ id: true }).safeParse({
      date, meal: values.get('meal'), portion: Number(portion),
      food: { ...food, unit: unit || null },
    })
    if (!parsed.success) { setError('Sprawdź porcję i potwierdź, czy etykieta podaje wartości na 100 g czy 100 ml.'); return }
    setError(null)
    try { await execute({ type: 'meal.add', value: parsed.data }); feedback('Posiłek zapisany w dzienniku.'); onClose() }
    catch (cause) { setError(errorMessage(cause)) }
  }

  async function saveCustom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const value = (key: string) => String(values.get(key) ?? '').trim()
    const optional = (key: string) => value(key) === '' ? null : Number(value(key))
    const parsed = foodSchema.safeParse({
      id: crypto.randomUUID(), name: value('name'), brand: value('brand'),
      barcode: value('barcode') || null, source: 'custom', unit: value('unit'),
      nutrients: {
        kcal: Number(value('kcal')), protein: optional('protein'), carbs: optional('carbs'),
        fat: optional('fat'), fiber: optional('fiber'),
      },
    })
    if (!parsed.success) { setError('Sprawdź nazwę, wartości z etykiety i cyfrę kontrolną kodu. Nieznane makro zostaw puste.'); return }
    setError(null)
    try {
      await execute({ type: 'food.save', value: parsed.data })
      select(parsed.data); feedback('Produkt zapisany. Teraz wybierz porcję.')
    } catch (cause) { setError(errorMessage(cause)) }
  }

  const list = result ? result.foods : tab === 'search' ? recent.map((item) => item.food) : []
  const amount = Number(portion)
  return <Drawer title={food ? 'Twoja porcja' : 'Dodaj posiłek'} onClose={pending ? () => {} : onClose}>
    {error && <Notice tone="error">{error}</Notice>}
    {food ? <>
      <button className="text-link" onClick={() => { setFood(null); setError(null) }}><ArrowLeft size={16} aria-hidden="true" />Wybierz inny produkt</button>
      <div className="selected-food"><h3>{food.name}</h3><p>{food.brand || sourceNames[food.source]}</p></div>
      <form className="form-stack" onSubmit={(event) => { void add(event) }}>
        <Field label="Wartości na etykiecie dotyczą" hint="Dla płynów sprawdź, czy podano wartości na 100 ml. Nie zakładamy, że 1 ml waży 1 g.">
          <select value={unit} required onChange={(event) => {
            if (event.target.value === 'g' || event.target.value === 'ml') setUnit(event.target.value)
          }}><option value="" disabled>Wybierz podstawę wartości</option><option value="g">100 g produktu</option><option value="ml">100 ml produktu</option></select>
        </Field>
        <div className="form-grid">
          <Field label={`Porcja (${unit || 'g lub ml'})`}><input type="number" inputMode="decimal" min="0.1" max="10000" step="0.1" value={portion}
            onChange={(event) => setPortion(event.target.value)} required /></Field>
          <Field label="Posiłek"><select name="meal" defaultValue={initialMeal}>{mealKinds.map((kind) => <option value={kind} key={kind}>{mealNames[kind]}</option>)}</select></Field>
        </div>
        <div className="portion-totals">
          {nutrientFields.slice(0, 4).map(({ name, label }) => {
            const value = food.nutrients[name]
            return <div key={name}><span>{label.split(' (')[0]}</span><strong>{value === null ? 'brak danych' : `${numberFormat.format(value * (Number.isFinite(amount) ? amount : 0) / 100)} ${name === 'kcal' ? 'kcal' : 'g'}`}</strong></div>
          })}
        </div>
        <Button type="submit" busy={pending}>Dodaj do dziennika</Button>
      </form><SourceCredit food={food} />
    </> : <>
      <div className="segmented-control" aria-label="Sposób dodania produktu">
        <button aria-pressed={tab === 'search'} onClick={() => { setTab('search'); setResult(null); setError(null) }}>Wyszukaj</button>
        <button aria-pressed={tab === 'barcode'} onClick={() => { setTab('barcode'); setResult(null); setError(null) }}>Kod kreskowy</button>
        <button aria-pressed={tab === 'custom'} onClick={() => { setTab('custom'); setResult(null); setError(null) }}>Własny produkt</button>
      </div>
      {tab === 'custom' ? <form className="form-stack" onSubmit={(event) => { void saveCustom(event) }}>
        <p className="source-credit">Wpisz dane z etykiety. Produkt pozostaje prywatny i jest dostępny na Twoim koncie. Puste makro oznacza „nieznane”, nie zero.</p>
        <Field label="Nazwa produktu"><input name="name" required maxLength={200} /></Field>
        <Field label="Marka (opcjonalnie)"><input name="brand" maxLength={100} /></Field>
        <Field label="Wartości odżywcze na"><select name="unit" defaultValue="g"><option value="g">100 g</option><option value="ml">100 ml</option></select></Field>
        <div className="form-grid">{nutrientFields.map(({ name, label, max }) => <Field key={name} label={label}>
          <input name={name} type="number" inputMode="decimal" min="0" max={max} step="0.1" required={name === 'kcal'} />
        </Field>)}</div>
        <Field label="Kod kreskowy (opcjonalnie)" hint="EAN-8, UPC-A, EAN-13 lub GTIN-14 z poprawną cyfrą kontrolną."><input name="barcode" inputMode="numeric" pattern="[0-9]{8}|[0-9]{12}|[0-9]{13}|[0-9]{14}" maxLength={14} /></Field>
        <Button type="submit" busy={pending}>Zapisz produkt</Button>
      </form> : <>
        {tab === 'search' && <Field label="Podstawowe produkty — 150 pozycji">
          <select value="" onChange={(event) => {
            const entry = requiredProducts.find((item) => item.id === Number(event.target.value))
            if (entry) { setQuery(entry.name); void search({ query: entry.name }) }
          }}>
            <option value="">Wybierz produkt z polskiego katalogu</option>
            {catalogGroups.map((group) => <optgroup label={group.name} key={group.id}>
              {requiredProducts.filter((entry) => entry.group === group.id).map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
            </optgroup>)}
          </select>
        </Field>}
        {tab === 'barcode' && <><CameraScanner onDetected={(value) => { setBarcode(value); void search({ barcode: value }) }} />
          <p className="source-credit">Kod sprawdzamy w prawdziwym katalogu Open Food Facts, także bez konta. Wymagane jest połączenie z internetem.</p></>}
        <form className="search-form" onSubmit={(event) => {
          event.preventDefault()
          void search(tab === 'barcode' ? { barcode } : { query })
        }}>
          <label><span className="sr-only">{tab === 'barcode' ? 'Kod EAN lub UPC' : 'Nazwa produktu'}</span>
            <input placeholder={tab === 'barcode' ? 'Wpisz kod EAN / UPC' : 'Np. jogurt naturalny'}
              value={tab === 'barcode' ? barcode : query}
              inputMode={tab === 'barcode' ? 'numeric' : 'search'}
              minLength={tab === 'barcode' ? 8 : 2} maxLength={tab === 'barcode' ? 14 : 80} required
              onChange={(event) => tab === 'barcode' ? setBarcode(event.target.value) : setQuery(event.target.value)} />
          </label><Button type="submit" busy={searching}><Search size={17} aria-hidden="true" />Szukaj</Button>
        </form>
        {searching && <Notice>Wyszukuję produkty…</Notice>}
        {!result && !searching && tab === 'search' && <MealTemplates date={date} initialMeal={initialMeal} onAdded={onClose} />}
        {!result && tab === 'search' && <>
          <h3 className="recent-foods-heading">Częste, ostatnie i Twoje produkty</h3>
          <p className="source-credit">Dotknij produktu, a wpiszemy porcję z ostatniego razu. „Szukaj” sprawdza rzeczywisty katalog produktów, także w trybie lokalnym — nie tylko przykłady demo.</p>
        </>}
        {result?.warnings.map((warning) => <Notice key={warning}>{warning}</Notice>)}
        <ul className="food-results">{list.map((item) => {
          const previous = result ? null : lastPortion.get(item.id) ?? null
          return <li key={item.id}>
          <button className="food-result" disabled={item.nutrients.kcal === null} onClick={() => select(item, previous)}>
            <span className="food-mark"><Utensils size={17} aria-hidden="true" /></span><div><strong>{item.name}</strong>
              <small>{item.nutrients.kcal === null ? 'Brak kcal — uzupełnij jako własny produkt' : `${numberFormat.format(item.nutrients.kcal)} kcal / 100 ${item.unit ?? 'g lub ml'}`} · {sourceNames[item.source]}{item.estimated && ' · wartości szacunkowe'}{previous !== null && ` · ostatnio ${numberFormat.format(previous)} ${item.unit ?? ''}`}</small>
            </div><ChevronRight size={16} aria-hidden="true" />
          </button>
        </li>
        })}</ul>
        {result && !list.length && <EmptyState title="Tego produktu jeszcze nie znaleźliśmy" action={<button className="text-link" onClick={() => setTab('custom')}>Dodaj produkt z etykiety</button>}>
          Sprawdź kod lub nazwę. Darmowe bazy nie obejmują wszystkich produktów.
        </EmptyState>}
        <p className="source-credit">Katalog: <a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer">Open Food Facts</a> (<a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">ODbL</a>), opcjonalnie <a href="https://fdc.nal.usda.gov" target="_blank" rel="noreferrer">USDA</a> (CC0). Dane mogą wymagać sprawdzenia z etykietą.</p>
      </>}
    </>}
  </Drawer>
}
