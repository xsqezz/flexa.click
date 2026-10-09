import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowLeftRight, BookmarkCheck, BookmarkPlus, CookingPot, Clock3, Plus, RefreshCw, ShoppingBasket, SlidersHorizontal, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { foodSchema, mealNames, type Food, type MealKind } from '../../../shared/domain'
import { getIngredient } from '../../../shared/kitchen/lookup'
import { equipmentLabels } from '../../../shared/kitchen/types'
import { useAuth } from '../lib/Auth'
import { useJournal } from '../lib/Journal'
import { today } from '../lib/dates'
import { recipeFood, swapOptions } from '../lib/kitchen/engine'
import { generateDishImage } from '../lib/kitchen/ai-client'
import type { Preferences, Recipe, RecipeLine } from '../lib/kitchen/context'
import { cap, joinList, minutesLabel, quantityLabel } from '../lib/kitchen/text'
import { stableUuid } from '../lib/ids'
import { addRecipeLines } from '../lib/shopping'
import { useShopping } from '../lib/useShopping'
import { useFeedback } from './Feedback'
import { Button, Drawer, Field, Notice, errorMessage } from './ui'

const imageCache = new Map<string, string>()
const cacheLimit = 16

function remember(signature: string, url: string) {
  imageCache.set(signature, url)
  while (imageCache.size > cacheLimit) {
    const [oldest] = imageCache.keys()
    URL.revokeObjectURL(imageCache.get(oldest) ?? '')
    imageCache.delete(oldest)
  }
}

function DishPicture({ recipe, aiReady }: { recipe: Recipe; aiReady: boolean }) {
  const auth = useAuth()
  const token = auth.session?.access_token ?? null
  const signature = `${recipe.format}|${recipe.style}|${recipe.imageIds.join(',')}`
  const [failed, setFailed] = useState<Record<string, string>>({})
  const [, refresh] = useState(0)
  const latest = useRef(recipe)
  useEffect(() => { latest.current = recipe })
  const cached = imageCache.get(signature)
  const canGenerate = aiReady && token !== null && auth.mode === 'cloud'
  useEffect(() => {
    if (!canGenerate || !token || imageCache.has(signature) || failed[signature]) return
    const controller = new AbortController()
    generateDishImage(latest.current, token, controller.signal)
      .then((blob) => { remember(signature, URL.createObjectURL(blob)); refresh((value) => value + 1) })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setFailed((current) => ({ ...current, [signature]: errorMessage(cause) })) })
    return () => controller.abort()
  }, [canGenerate, token, signature, failed])
  const emojis = recipe.imageIds.map((id) => getIngredient(id).emoji)
  if (cached) return <figure className="kitchen-photo">
    <img src={cached} alt={`Poglądowe zdjęcie potrawy wygenerowane przez AI: ${recipe.title}`} width="1024" height="1024" />
    <figcaption>Poglądowe zdjęcie wygenerowane przez AI — Twoje danie może wyglądać inaczej.</figcaption>
  </figure>
  const loading = canGenerate && !failed[signature]
  return <figure className="kitchen-photo kitchen-plate" aria-busy={loading || undefined}>
    <div role="img" aria-label={`Ilustracja składników: ${recipe.imageIds.map((id) => getIngredient(id).nom).join(', ')}`}>
      {emojis.map((emoji, index) => <span key={`${emoji}${index}`} aria-hidden="true">{emoji}</span>)}
    </div>
    <figcaption role={loading ? 'status' : undefined}>
      {loading ? 'Generuję poglądowe zdjęcie potrawy…' : failed[signature] ? `${failed[signature]} Pokazuję ilustrację składników.` : 'Ilustracja składników. Zdjęcie potrawy wygenerujemy po zalogowaniu.'}
    </figcaption>
  </figure>
}

function Row({ line, onSwap }: { line: RecipeLine; onSwap?: () => void }) {
  const item = getIngredient(line.id)
  return <li className="kitchen-ingredient">
    <span className="kitchen-emoji" aria-hidden="true">{item.emoji}</span>
    <span className="kitchen-ingredient-text"><strong>{cap(item.nom)}</strong><small>{quantityLabel(item, line.grams, line.taste)}</small></span>
    {onSwap && <button type="button" className="text-link" onClick={onSwap} aria-label={`Zamień składnik: ${item.nom}`}><ArrowLeftRight size={15} aria-hidden="true" />Zamień</button>}
  </li>
}

function Ingredients({ recipe, onSwap }: { recipe: Recipe; onSwap: (id: string) => void }) {
  const swappable = new Set(Object.entries(recipe.picks).filter(([slot]) => !['style', 'method', 'kind'].includes(slot)).flatMap(([, ids]) => ids))
  const mine = recipe.lines.filter((line) => line.owned && !line.staple)
  const bought = recipe.lines.filter((line) => !line.owned && !line.staple)
  const basics = recipe.lines.filter((line) => line.staple && !line.taste)
  const taste = recipe.lines.filter((line) => line.taste)
  const group = (title: string, lines: RecipeLine[]) => lines.length > 0 && <section className="kitchen-group" aria-label={title}>
    <h5>{title}</h5>
    <ul className="kitchen-ingredients">{lines.map((line) => <Row key={line.id} line={line} onSwap={swappable.has(line.id) ? () => onSwap(line.id) : undefined} />)}</ul>
  </section>
  return <>
    {group('Z Twoich produktów', mine)}
    {group('Do dokupienia', bought)}
    {(basics.length > 0 || taste.length > 0) && <section className="kitchen-group" aria-label="Podstawowe dodatki">
      <h5>Podstawowe dodatki z kuchni</h5>
      <ul className="kitchen-ingredients">
        {basics.map((line) => <Row key={line.id} line={line} />)}
        {taste.length > 0 && <li className="kitchen-ingredient">
          <span className="kitchen-emoji" aria-hidden="true">🧂</span>
          <span className="kitchen-ingredient-text"><strong>{cap(joinList(taste.map((line) => getIngredient(line.id).nom)))}</strong><small>do smaku</small></span>
        </li>}
      </ul>
    </section>}
  </>
}

const defaultMeal = (): MealKind => { const hour = new Date().getHours(); return hour < 11 ? 'breakfast' : hour < 16 ? 'lunch' : hour < 21 ? 'dinner' : 'snack' }

function DiaryDrawer({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const { execute, pending } = useJournal()
  const feedback = useFeedback()
  const [meal, setMeal] = useState<MealKind>(defaultMeal)
  const [portions, setPortions] = useState('1')
  const [error, setError] = useState<string | null>(null)
  const count = Number(portions.replace(',', '.'))
  const valid = Number.isFinite(count) && count >= 0.5 && count <= 4
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!valid) { setError('Podaj liczbę porcji od 0,5 do 4.'); return }
    setError(null)
    try {
      await execute({ type: 'meal.add', value: { date: today(), meal, food: recipeFood(recipe), portion: Math.max(1, Math.round(recipe.servingGrams * count)) } })
      feedback('Posiłek dodany do dziennika. Smacznego!')
      onClose()
    } catch (cause) { setError(errorMessage(cause)) }
  }
  return <Drawer title="Dodaj do dziennika" onClose={pending ? () => {} : onClose}>
    <p>{recipe.title}. Zapiszemy wartości odżywcze porcji obliczone z surowych składników.</p>
    {error && <Notice tone="error">{error}</Notice>}
    <form className="form-stack" onSubmit={(event) => { void save(event) }}>
      <Field label="Posiłek"><select value={meal} onChange={(event) => setMeal(event.target.value as MealKind)}>
        {Object.entries(mealNames).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></Field>
      <Field label="Ile porcji zjadłeś?" hint={`Jedna porcja to ok. ${recipe.servingGrams} g i ${recipe.perServing.kcal} kcal.`}>
        <input inputMode="decimal" value={portions} onChange={(event) => setPortions(event.target.value)} aria-invalid={!valid || undefined} /></Field>
      <Button type="submit" busy={pending}>Dodaj do dziennika</Button>
    </form>
  </Drawer>
}

function SwapDrawer({ recipe, lineId, owned, preferences, onPick, onClose }:
  { recipe: Recipe; lineId: string; owned: readonly string[]; preferences: Preferences; onPick: (recipe: Recipe) => void; onClose: () => void }) {
  const current = getIngredient(lineId)
  const options = useMemo(() => swapOptions(recipe, lineId, owned, preferences), [recipe, lineId, owned, preferences])
  const delta = (next: number, base: number, unit: string) => `${next - base >= 0 ? '+' : '−'}${Math.abs(Math.round(next - base))} ${unit}`
  return <Drawer title={`Zamień: ${current.nom}`} onClose={onClose}>
    <p>Wybierz zamiennik — przepis, kroki i makroskładniki przeliczą się od razu.</p>
    {options.length === 0 && <Notice>Nie znalazłem pasującego zamiennika dla tego dania. Spróbuj „Inny przepis”.</Notice>}
    <ul className="kitchen-swaps">
      {options.map((option) => {
        const item = getIngredient(option.id)
        return <li key={option.id}><button type="button" onClick={() => onPick(option.recipe)}>
          <span className="kitchen-emoji" aria-hidden="true">{item.emoji}</span>
          <span className="kitchen-swap-text"><strong>{cap(item.nom)}</strong>
            <small>{option.owned ? 'Masz w domu' : 'Do dokupienia'} · {delta(option.recipe.perServing.kcal, recipe.perServing.kcal, 'kcal')} · {delta(option.recipe.perServing.protein, recipe.perServing.protein, 'g białka')}</small></span>
        </button></li>
      })}
    </ul>
  </Drawer>
}

const numbers = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 })

/** Stores the recipe as the user's own product (per 100 g, estimated) so it can be found in the meal search later. */
function libraryFood(recipe: Recipe, owner: string): Food {
  return foodSchema.parse({ ...recipeFood(recipe), id: stableUuid(`recipe:${owner}:${recipe.key}`) })
}

function SaveToLibrary({ recipe }: { recipe: Recipe }) {
  const auth = useAuth()
  const { data, execute, pending } = useJournal()
  const feedback = useFeedback()
  const [busy, setBusy] = useState(false)
  const food = libraryFood(recipe, auth.session?.user.id ?? 'demo')
  const saved = Boolean(data?.customFoods.some((item) => item.id === food.id))
  async function save() {
    if (saved) { feedback('Ten przepis jest już w Twojej bibliotece produktów.'); return }
    setBusy(true)
    try {
      await execute({ type: 'food.save', value: food })
      feedback(`Zapisano „${food.name}” w bibliotece. Znajdziesz go w wyszukiwarce przy dodawaniu posiłku.`)
    } catch (cause) { feedback(errorMessage(cause), { tone: 'error' }) }
    finally { setBusy(false) }
  }
  return <Button variant="secondary" busy={busy} disabled={pending && !busy} onClick={() => { void save() }}>
    {saved ? <BookmarkCheck size={17} aria-hidden="true" /> : <BookmarkPlus size={17} aria-hidden="true" />}
    {saved ? 'Zapisano w bibliotece' : 'Zapisz w bibliotece'}
  </Button>
}

function AddToShopping({ recipe }: { recipe: Recipe }) {
  const { update } = useShopping()
  const navigate = useNavigate()
  const feedback = useFeedback()
  const missing = recipe.lines.filter((line) => !line.owned && !line.staple)
  if (!missing.length) return null
  return <Button variant="secondary" onClick={() => {
    update((items) => addRecipeLines(items, missing.map((line) => ({
      id: line.id, name: cap(getIngredient(line.id).nom), grams: line.grams, taste: line.taste,
    })), recipe.title))
    feedback(`Dodano ${missing.length} ${missing.length === 1 ? 'pozycję' : 'pozycji'} do listy zakupów.`, { action: { label: 'Otwórz', onAction: () => navigate('/kitchen/shopping') } })
  }}><ShoppingBasket size={17} aria-hidden="true" />Dodaj brakujące do zakupów</Button>
}

export function RecipeView({ recipe, index, total, owned, preferences, aiReady, onPick, onNext, onEditPreferences }:
  { recipe: Recipe; index: number; total: number; owned: readonly string[]; preferences: Preferences; aiReady: boolean; onPick: (recipe: Recipe) => void; onNext: () => void; onEditPreferences: () => void }) {
  const [swapping, setSwapping] = useState<string | null>(null)
  const [logging, setLogging] = useState(false)
  const equipment = recipe.equipment.map((kind) => equipmentLabels[kind]).join(', ')
  return <article className="kitchen-recipe" aria-labelledby="recipe-title">
    <header className="kitchen-head">
      <p className="kitchen-subtitle">{recipe.subtitle}</p>
      <h3 id="recipe-title" className="kitchen-recipe-title">{recipe.title}</h3>
      <ul className="kitchen-meta">
        <li><Clock3 size={17} aria-hidden="true" /><span>ok. {minutesLabel(recipe.minutes)}</span></li>
        {equipment && <li><CookingPot size={17} aria-hidden="true" /><span>{equipment}</span></li>}
        <li><Users size={17} aria-hidden="true" /><span>{recipe.servings} {recipe.servings === 1 ? 'porcja' : recipe.servings < 5 ? 'porcje' : 'porcji'}</span></li>
      </ul>
    </header>
    <DishPicture recipe={recipe} aiReady={aiReady} />
    <section aria-labelledby="macros-title" className="kitchen-macros-section">
      <h4 id="macros-title" className="sr-only">Wartości odżywcze na 1 porcję</h4>
      <dl className="kitchen-macros">
        <div><dt><span aria-hidden="true">🔥</span> Kalorie</dt><dd>{numbers.format(recipe.perServing.kcal)}<small> kcal</small></dd></div>
        <div><dt><span aria-hidden="true">🥩</span> Białko</dt><dd>{numbers.format(recipe.perServing.protein)}<small> g</small></dd></div>
        <div><dt><span aria-hidden="true">🥑</span> Tłuszcze</dt><dd>{numbers.format(recipe.perServing.fat)}<small> g</small></dd></div>
        <div><dt><span aria-hidden="true">🍞</span> Węglowodany</dt><dd>{numbers.format(recipe.perServing.carbs)}<small> g</small></dd></div>
      </dl>
      <p className="kitchen-note">Wartości na 1 porcję (ok. {recipe.servingGrams} g), szacunkowe — liczone z surowych składników.</p>
    </section>
    <section className="kitchen-ingredients-section" aria-labelledby="ingredients-title">
      <h4 id="ingredients-title" className="kitchen-heading">Składniki <small>na {recipe.servings} {recipe.servings === 1 ? 'porcję' : recipe.servings < 5 ? 'porcje' : 'porcji'}</small></h4>
      <Ingredients recipe={recipe} onSwap={setSwapping} />
    </section>
    <section className="kitchen-steps-section" aria-labelledby="steps-title">
      <h4 id="steps-title" className="kitchen-heading">Przygotowanie</h4>
      <ol className="kitchen-steps">{recipe.steps.map((step) => <li key={step}>{step}</li>)}</ol>
      {recipe.tips.length > 0 && <ul className="kitchen-tips" aria-label="Wskazówki">{recipe.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>}
    </section>
    <p className="kitchen-note kitchen-disclaimer">To inspiracja, nie porada dietetyczna. Mięso, ryby i jajka zawsze dokładnie dogotuj, a przy alergii sprawdź skład produktów na opakowaniach.</p>
    <div className="kitchen-actions">
      <Button onClick={() => setLogging(true)}><Plus size={17} aria-hidden="true" />Dodaj do dziennika</Button>
      <SaveToLibrary recipe={recipe} />
        <AddToShopping recipe={recipe} />
      <Button variant="secondary" onClick={onNext} disabled={total < 2}><RefreshCw size={17} aria-hidden="true" />Inny przepis{total > 1 ? ` (${index + 1}/${total})` : ''}</Button>
      <Button variant="ghost" onClick={onEditPreferences}><SlidersHorizontal size={17} aria-hidden="true" />Zmień preferencje</Button>
    </div>
    {swapping && <SwapDrawer recipe={recipe} lineId={swapping} owned={owned} preferences={preferences} onPick={(next) => { onPick(next); setSwapping(null) }} onClose={() => setSwapping(null)} />}
    {logging && <DiaryDrawer recipe={recipe} onClose={() => setLogging(false)} />}
  </article>
}
