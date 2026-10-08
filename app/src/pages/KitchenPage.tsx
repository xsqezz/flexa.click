import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Camera, Check, ImagePlus, Search, ShieldCheck, Sparkles, X } from 'lucide-react'
import { ingredients } from '../../../shared/kitchen/ingredients'
import { getIngredient, normalizeName } from '../../../shared/kitchen/lookup'
import { equipmentKinds, equipmentLabels, type Equipment, type IngredientCategory } from '../../../shared/kitchen/types'
import { useAuth } from '../lib/Auth'
import { suggestRecipes } from '../lib/kitchen/engine'
import {
  avoidKinds, avoidLabels, moodLabels, moods, sizeLabels, sizeOptions, stapleIds, timeOptions,
  type Avoid, type Preferences, type Recipe,
} from '../lib/kitchen/context'
import {
  KitchenAiError, kitchenAiAvailable, photoConsentGiven, preparePhoto, recognizePhoto, rememberPhotoConsent, type PreparedPhoto,
} from '../lib/kitchen/ai-client'
import { clearKitchen, readKitchen, writeKitchen } from '../lib/kitchen/storage'
import { cap, minutesLabel } from '../lib/kitchen/text'
import { PageHeader } from '../components/Workspace'
import { RecipeView } from '../components/RecipeView'
import { Button, Field, Notice, errorMessage } from '../components/ui'

type Step = 'ingredients' | 'preferences' | 'recipe'
const stepLabels: Record<Step, string> = { ingredients: 'Produkty', preferences: 'Preferencje', recipe: 'Przepis' }
const stepOrder: Step[] = ['ingredients', 'preferences', 'recipe']

const groups: { id: string; title: string; categories: IngredientCategory[]; open: boolean }[] = [
  { id: 'protein', title: 'Mięso, ryby i jajka', categories: ['meat', 'fish', 'egg'], open: true },
  { id: 'veg', title: 'Warzywa', categories: ['veg'], open: true },
  { id: 'dairy', title: 'Nabiał i sery', categories: ['dairy', 'cheese'], open: false },
  { id: 'fruit', title: 'Owoce', categories: ['fruit'], open: false },
  { id: 'carb', title: 'Zboża, makarony i pieczywo', categories: ['grain', 'bread'], open: false },
  { id: 'legume', title: 'Strączkowe i tofu', categories: ['legume'], open: false },
  { id: 'extras', title: 'Tłuszcze, orzechy, sosy i słodkie dodatki', categories: ['fat', 'nut', 'sauce', 'sweet', 'liquid'], open: false },
  { id: 'spice', title: 'Przyprawy i zioła', categories: ['spice'], open: false },
]

const pickable = ingredients.filter((item) => !stapleIds.has(item.id) && item.id !== 'water')
const searchText = new Map(pickable.map((item) => [item.id, normalizeName(`${item.nom} ${item.aliases.join(' ')}`)]))

function Chip({ pressed, onClick, children, label }: { pressed: boolean; onClick: () => void; children: React.ReactNode; label?: string }) {
  return <button type="button" className="kitchen-chip" aria-pressed={pressed} onClick={onClick} aria-label={label}>
    {pressed && <Check size={15} aria-hidden="true" />}{children}
  </button>
}

function PhotoPanel({ aiReady, onFound }: { aiReady: boolean | null; onFound: (ids: string[]) => void }) {
  const auth = useAuth()
  const token = auth.session?.access_token ?? null
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null)
  const [remembered, setRemembered] = useState(photoConsentGiven)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState<'preparing' | 'working' | null>(null)
  const [result, setResult] = useState<{ ids: string[]; unknown: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)
  const preview = photo?.preview
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  if (auth.mode !== 'cloud') return <Notice>Rozpoznawanie produktów ze zdjęcia działa po zalogowaniu. W trybie demo wybierz produkty ręcznie poniżej.</Notice>
  if (aiReady === false) return <Notice>Rozpoznawanie ze zdjęcia jest chwilowo niedostępne. Wybierz produkty ręcznie poniżej.</Notice>

  async function choose(file: File | undefined) {
    if (!file) return
    setError(null); setResult(null); setBusy('preparing')
    try { setPhoto(await preparePhoto(file)) }
    catch (cause) { setPhoto(null); setError(errorMessage(cause)) }
    finally { setBusy(null) }
  }

  async function recognize() {
    if (!photo || !token) return
    if (!remembered && !consent) { setError('Zaznacz zgodę na wysłanie zdjęcia do rozpoznania.'); return }
    rememberPhotoConsent(true)
    setRemembered(true)
    setError(null); setBusy('working')
    try {
      const found = await recognizePhoto(photo.images, token)
      onFound(found.items)
      setResult({ ids: found.items, unknown: found.unknown })
      setPhoto(null)
    } catch (cause) {
      setError(cause instanceof KitchenAiError ? cause.message : errorMessage(cause))
    } finally { setBusy(null) }
  }

  const seen = result?.ids.map((id) => getIngredient(id).nom) ?? []
  return <section className="kitchen-photo-panel" aria-labelledby="photo-title">
    <h3 id="photo-title" className="kitchen-heading">Zdjęcie lodówki lub produktów</h3>
    <p className="kitchen-note">Zrób zdjęcie wnętrza lodówki, spiżarni albo produktów na blacie — rozpoznam, co masz, a Ty poprawisz listę.</p>
    <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(event) => { void choose(event.target.files?.[0]); event.target.value = '' }} />
    <input ref={gallery} type="file" accept="image/*" hidden onChange={(event) => { void choose(event.target.files?.[0]); event.target.value = '' }} />
    <div className="button-row">
      <Button onClick={() => camera.current?.click()} disabled={busy !== null}><Camera size={17} aria-hidden="true" />Zrób zdjęcie</Button>
      <Button variant="secondary" onClick={() => gallery.current?.click()} disabled={busy !== null}><ImagePlus size={17} aria-hidden="true" />Wybierz z galerii</Button>
    </div>
    {busy === 'preparing' && <p className="kitchen-note" role="status">Przygotowuję zdjęcie…</p>}
    {photo && <div className="kitchen-photo-preview">
      <img src={photo.preview} alt="Podgląd wybranego zdjęcia produktów" />
      <div>
        {remembered
          ? <p className="kitchen-note">Zgoda na wysyłanie zdjęć do rozpoznania jest zapisana na tym urządzeniu. <button type="button" className="text-link" onClick={() => { rememberPhotoConsent(false); setRemembered(false); setConsent(false) }}>Cofnij zgodę</button></p>
          : <label className="checkbox-label"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
            <span>Rozumiem, że zdjęcie zostanie pomniejszone, pozbawione danych EXIF (np. lokalizacji) i wysłane do Cloudflare Workers AI wyłącznie w celu rozpoznania produktów. Flexa go nie zapisuje.</span></label>}
        <div className="button-row">
          <Button onClick={() => { void recognize() }} busy={busy === 'working'}><Sparkles size={17} aria-hidden="true" />Rozpoznaj produkty</Button>
          <Button variant="ghost" onClick={() => setPhoto(null)} disabled={busy === 'working'}>Usuń zdjęcie</Button>
        </div>
      </div>
    </div>}
    {error && <Notice tone="error">{error}</Notice>}
    {result && <div role="status" className="notice notice-success">
      {seen.length ? <p><strong>Widzę na zdjęciu:</strong> {seen.join(', ')}. Dodałem to do Twojej listy — popraw ją poniżej, jeśli coś się nie zgadza.</p>
        : <p>Nie rozpoznałem produktów na tym zdjęciu. Spróbuj z bliższej odległości, przy lepszym świetle, albo wybierz produkty ręcznie.</p>}
      {result.unknown.length > 0 && <p>Nie mam w bazie: {result.unknown.join(', ')}. Dodaj podobne produkty ręcznie.</p>}
    </div>}
    <p className="kitchen-note"><ShieldCheck size={15} aria-hidden="true" /> Dzienny limit: kilka zdjęć na konto. Zdjęcie nie jest nigdzie zapisywane.</p>
  </section>
}

function Picker({ owned, onToggle }: { owned: readonly string[]; onToggle: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const tokens = normalizeName(query).split(' ').filter(Boolean)
  const results = tokens.length ? pickable.filter((item) => tokens.every((token) => searchText.get(item.id)?.includes(token))) : []
  const selected = new Set(owned)
  const chip = (id: string) => { const item = getIngredient(id); return <Chip key={id} pressed={selected.has(id)} onClick={() => onToggle(id)}><span aria-hidden="true">{item.emoji}</span>{cap(item.nom)}</Chip> }
  return <section aria-labelledby="picker-title">
    <h3 id="picker-title" className="kitchen-heading">Wybierz produkty ręcznie</h3>
    <label className="kitchen-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Szukaj produktu</span>
      <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Szukaj produktu, np. kurczak, cukinia, ryż" autoComplete="off" /></label>
    {tokens.length > 0 ? <div className="kitchen-chips" role="group" aria-label="Wyniki wyszukiwania">
      {results.length ? results.map((item) => chip(item.id)) : <p className="kitchen-note">Nie ma takiego produktu w bazie. Spróbuj prostszej nazwy.</p>}
    </div> : groups.map((group) => {
      const items = pickable.filter((item) => group.categories.includes(item.category))
      const count = items.filter((item) => selected.has(item.id)).length
      return <details key={group.id} className="kitchen-group-details" open={group.open}>
        <summary>{group.title}{count > 0 && <span className="kitchen-count"> · {count}</span>}</summary>
        <div className="kitchen-chips" role="group" aria-label={group.title}>{items.map((item) => chip(item.id))}</div>
      </details>
    })}
  </section>
}

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

function PreferencesStep({ preferences, onChange }: { preferences: Preferences; onChange: (next: Preferences) => void }) {
  const set = <K extends keyof Preferences>(key: K, value: Preferences[K]) => onChange({ ...preferences, [key]: value })
  return <div className="kitchen-form">
    <fieldset className="kitchen-question">
      <legend>Ile masz czasu na przygotowanie posiłku?</legend>
      <div className="kitchen-chips">{timeOptions.map((minutes) => <Chip key={minutes} pressed={preferences.minutes === minutes} onClick={() => set('minutes', minutes)}>{minutes === 90 ? '60 min lub więcej' : `${minutes} min`}</Chip>)}</div>
    </fieldset>
    <fieldset className="kitchen-question">
      <legend>Jaki sprzęt kuchenny masz do dyspozycji?</legend>
      <div className="kitchen-chips">{equipmentKinds.map((kind) => <Chip key={kind} pressed={preferences.equipment.includes(kind)} onClick={() => set('equipment', toggle<Equipment>(preferences.equipment, kind))}>{equipmentLabels[kind]}</Chip>)}</div>
      {preferences.equipment.length === 0 && <p className="kitchen-note" role="status">Wybierz przynajmniej jedno urządzenie, np. patelnię.</p>}
    </fieldset>
    <fieldset className="kitchen-question">
      <legend>Czego NIE lubisz, na co masz alergię lub na co masz dziś ochotę?</legend>
      <p className="kitchen-note">Nie jem lub mam alergię na:</p>
      <div className="kitchen-chips">{avoidKinds.map((kind) => <Chip key={kind} pressed={preferences.avoid.includes(kind)} onClick={() => set('avoid', toggle<Avoid>(preferences.avoid, kind))}>{avoidLabels[kind]}</Chip>)}</div>
      <Field label="Inne produkty, których nie lubisz"><input value={preferences.dislikes} maxLength={200} onChange={(event) => set('dislikes', event.target.value)} placeholder="Np. papryka, grzyby, kolendra" /></Field>
      <p className="kitchen-note">Na co masz dziś ochotę?</p>
      <div className="choice-list" role="radiogroup" aria-label="Na co masz dziś ochotę?">
        {moods.map((mood) => <label key={mood} className="choice"><input type="radio" name="mood" checked={preferences.mood === mood} onChange={() => set('mood', mood)} />
          <span className="choice-text"><strong>{moodLabels[mood].title}</strong><small>{moodLabels[mood].description}</small></span></label>)}
      </div>
    </fieldset>
    <fieldset className="kitchen-question">
      <legend>Dla ilu osób i jak duża porcja?</legend>
      <div className="kitchen-chips">{([1, 2, 3, 4] as const).map((count) => <Chip key={count} pressed={preferences.servings === count} onClick={() => set('servings', count)}>{count} {count === 1 ? 'osoba' : 'osoby'}</Chip>)}</div>
      <div className="kitchen-chips">{sizeOptions.map((size) => <Chip key={size} pressed={preferences.size === size} onClick={() => set('size', size)}>{sizeLabels[size]}</Chip>)}</div>
    </fieldset>
    <label className="checkbox-label kitchen-staples"><input type="checkbox" checked={preferences.staples} onChange={(event) => set('staples', event.target.checked)} />
      <span>Mam w domu podstawowe dodatki: sól, pieprz, paprykę słodką, zioła i olej rzepakowy.</span></label>
  </div>
}

export function KitchenPage() {
  const auth = useAuth()
  const [initial] = useState(readKitchen)
  const [step, setStep] = useState<Step>('ingredients')
  const [owned, setOwned] = useState<string[]>(initial.owned)
  const [preferences, setPreferences] = useState<Preferences>(initial.preferences)
  const [aiReady, setAiReady] = useState<boolean | null>(null)
  const [session, setSession] = useState<{ list: Recipe[]; index: number; current: Recipe; relaxed: boolean } | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { writeKitchen({ owned, preferences }) }, [owned, preferences])
  useEffect(() => {
    if (auth.mode !== 'cloud') return
    let active = true
    void kitchenAiAvailable().then((value) => { if (active) setAiReady(value) })
    return () => { active = false }
  }, [auth.mode])
  useEffect(() => { heading.current?.focus({ preventScroll: true }); window.scrollTo(0, 0) }, [step])

  const addOwned = (ids: readonly string[]) => setOwned((current) => [...new Set([...current, ...ids])].slice(0, 80))
  const index = stepOrder.indexOf(step)

  function showRecipes() {
    const { recipes, relaxed } = suggestRecipes(owned, preferences)
    setSession(recipes.length ? { list: recipes, index: 0, current: recipes[0], relaxed } : null)
    setStep('recipe')
  }

  const canContinue = step === 'ingredients' ? owned.length > 0 : step === 'preferences' ? preferences.equipment.length > 0 : false
  return <>
    <PageHeader title="Smart Kuchnia" description="Powiedz, co masz w domu — ułożę przepis z makroskładnikami, dopasowany do czasu i sprzętu." primary="none" />
    <nav aria-label="Kroki Smart Kuchni" className="kitchen-steps-nav">
      <ol>{stepOrder.map((item, position) => <li key={item} aria-current={item === step ? 'step' : undefined} className={position < index ? 'done' : undefined}>
        <span aria-hidden="true">{position < index ? <Check size={14} /> : position + 1}</span>
        <span className="kitchen-step-label">{stepLabels[item]}{position < index && <span className="sr-only"> (gotowe)</span>}</span></li>)}</ol>
    </nav>
    <div className="panel kitchen-panel">
      <h2 ref={heading} tabIndex={-1} className={step === 'recipe' ? 'kitchen-title sr-only' : 'kitchen-title'}>
        {step === 'ingredients' ? 'Co masz w domu?' : step === 'preferences' ? 'Kilka szybkich pytań' : 'Twój przepis'}
      </h2>
      {step === 'ingredients' && <>
        <PhotoPanel aiReady={aiReady} onFound={addOwned} />
        <section aria-labelledby="owned-title" className="kitchen-owned">
          <h3 id="owned-title" className="kitchen-heading">Twoje produkty <small>({owned.length})</small></h3>
          {owned.length === 0 ? <p className="kitchen-note">Na razie pusto. Zrób zdjęcie albo wybierz produkty poniżej.</p>
            : <div className="kitchen-chips" role="group" aria-label="Wybrane produkty">{owned.map((id) => {
              const item = getIngredient(id)
              return <button key={id} type="button" className="kitchen-chip kitchen-chip-selected" onClick={() => setOwned((current) => current.filter((value) => value !== id))} aria-label={`Usuń: ${item.nom}`}>
                <span aria-hidden="true">{item.emoji}</span>{cap(item.nom)}<X size={14} aria-hidden="true" /></button>
            })}</div>}
          {owned.length > 0 && <button type="button" className="text-link" onClick={() => { setOwned([]); clearKitchen() }}>Wyczyść listę</button>}
        </section>
        <Picker owned={owned} onToggle={(id) => setOwned((current) => toggle(current, id))} />
      </>}
      {step === 'preferences' && <PreferencesStep preferences={preferences} onChange={setPreferences} />}
      {step === 'recipe' && (session
        ? <>
          {session.relaxed && <Notice>W {preferences.minutes} minut nie zmieszczę żadnego dania z tych produktów. Pokazuję najszybsze propozycje — zajmą ok. {minutesLabel(session.list[0].minutes)}. Wydłuż czas lub zaznacz więcej sprzętu, jeśli chcesz coś szybszego.</Notice>}
          <RecipeView recipe={session.current} index={session.index} total={session.list.length} owned={owned} preferences={preferences} aiReady={aiReady === true}
            onPick={(next) => setSession({ ...session, current: next })}
            onNext={() => { const next = (session.index + 1) % session.list.length; setSession({ ...session, index: next, current: session.list[next] }) }}
            onEditPreferences={() => setStep('preferences')} />
        </>
        : <div className="kitchen-empty">
          <Notice>Z tych produktów i takiego sprzętu nie umiem jeszcze ułożyć pełnego dania. Dodaj białko (np. jajka, kurczaka) albo kilka warzyw, albo zaznacz więcej sprzętu.</Notice>
          <div className="button-row"><Button variant="secondary" onClick={() => setStep('ingredients')}><ArrowLeft size={17} aria-hidden="true" />Zmień produkty</Button>
            <Button variant="secondary" onClick={() => setStep('preferences')}>Zmień preferencje</Button></div>
        </div>)}
      {step !== 'recipe' && <div className="kitchen-nav">
        {step === 'preferences' ? <Button variant="secondary" onClick={() => setStep('ingredients')}><ArrowLeft size={17} aria-hidden="true" />Wstecz</Button> : <span />}
        <Button disabled={!canContinue} onClick={() => (step === 'ingredients' ? setStep('preferences') : showRecipes())}>
          {step === 'ingredients' ? 'Dalej: preferencje' : 'Pokaż przepis'}<ArrowRight size={17} aria-hidden="true" /></Button>
      </div>}
    </div>
  </>
}
