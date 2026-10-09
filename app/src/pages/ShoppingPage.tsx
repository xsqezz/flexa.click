import { useState, type FormEvent } from 'react'
import { ArrowLeft, Check, Copy, Plus, Share2, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getIngredient } from '../../../shared/kitchen/lookup'
import { useFeedback } from '../components/Feedback'
import { PageHeader } from '../components/Workspace'
import { Button, Field } from '../components/ui'
import { quantityLabel } from '../lib/kitchen/text'
import { addManualItem, clearDone, removeItem, shoppingText, toggleItem, type ShoppingItem } from '../lib/shopping'
import { useShopping } from '../lib/useShopping'

function describe(item: ShoppingItem): string {
  if (!item.ingredientId) return item.name
  const quantity = item.taste ? 'do smaku' : item.grams ? quantityLabel(getIngredient(item.ingredientId), item.grams, false) : ''
  return quantity ? `${item.name} — ${quantity}` : item.name
}

export function ShoppingPage() {
  const { items, update } = useShopping()
  const feedback = useFeedback()
  const [text, setText] = useState('')
  const open = items.filter((item) => !item.done)
  const done = items.filter((item) => item.done)

  function add(event: FormEvent) {
    event.preventDefault()
    if (!text.trim()) return
    update((current) => addManualItem(current, text, crypto.randomUUID()))
    setText('')
  }

  async function share() {
    const body = shoppingText(items, describe)
    try {
      if (navigator.share) { await navigator.share({ title: 'Lista zakupów', text: body }); return }
      await navigator.clipboard.writeText(body)
      feedback('Lista skopiowana do schowka.')
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      feedback('Nie udało się udostępnić listy. Spróbuj ją skopiować ręcznie.', { tone: 'error' })
    }
  }

  const row = (item: ShoppingItem) => <li key={item.id} className={item.done ? 'shopping-item done' : 'shopping-item'}>
    <button type="button" className="shopping-check" role="checkbox" aria-checked={item.done} aria-label={`${describe(item)}${item.done ? ', kupione' : ''}`}
      onClick={() => update((current) => toggleItem(current, item.id))}>{item.done && <Check size={16} aria-hidden="true" />}</button>
    <span className="shopping-text"><strong>{item.name}</strong>
      <small>{[item.ingredientId ? (item.taste ? 'do smaku' : item.grams ? quantityLabel(getIngredient(item.ingredientId), item.grams, false) : '') : '', item.note].filter(Boolean).join(' · ')}</small></span>
    <button type="button" className="icon-button" aria-label={`Usuń z listy: ${item.name}`} onClick={() => update((current) => removeItem(current, item.id))}><Trash2 size={17} aria-hidden="true" /></button>
  </li>

  return <>
    <PageHeader title="Lista zakupów" description="Brakujące składniki z przepisów i własne pozycje. Lista zostaje na tym urządzeniu i działa bez internetu." primary="none" />
    <Link className="text-link" to="/kitchen"><ArrowLeft size={16} aria-hidden="true" />Wróć do Smart Kuchni</Link>
    <section className="panel shopping-panel" aria-labelledby="shopping-title">
      <h2 id="shopping-title">Do kupienia <small>({open.length})</small></h2>
      <form className="shopping-add" onSubmit={add}>
        <Field label="Dodaj pozycję"><input value={text} maxLength={80} placeholder="np. mleko owsiane" onChange={(event) => setText(event.target.value)} /></Field>
        <Button type="submit" variant="secondary"><Plus size={17} aria-hidden="true" />Dodaj do listy</Button>
      </form>
      {open.length ? <ul className="shopping-list">{open.map(row)}</ul>
        : <p className="goals-help">{items.length ? 'Wszystko kupione.' : 'Lista jest pusta. Dodaj pozycję albo użyj „Dodaj brakujące do zakupów” przy przepisie.'}</p>}
      {done.length > 0 && <>
        <h3 className="shopping-done-title">Kupione ({done.length})</h3>
        <ul className="shopping-list">{done.map(row)}</ul>
      </>}
      {items.length > 0 && <div className="adaptive-actions">
        <Button type="button" variant="secondary" onClick={() => { void share() }}>{typeof navigator.share === 'function' ? <Share2 size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}{typeof navigator.share === 'function' ? 'Udostępnij' : 'Kopiuj listę'}</Button>
        {done.length > 0 && <Button type="button" variant="secondary" onClick={() => update(clearDone)}>Wyczyść kupione</Button>}
      </div>}
    </section>
  </>
}
