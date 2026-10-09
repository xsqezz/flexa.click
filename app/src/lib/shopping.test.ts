import { beforeEach, describe, expect, it } from 'vitest'
import {
  addManualItem, addRecipeLines, clearDone, readShopping, removeItem, shoppingText, toggleItem, writeShopping,
} from './shopping'

describe('shopping list', () => {
  beforeEach(() => localStorage.clear())

  it('adds recipe lines and sums grams for the same ingredient', () => {
    let items = addRecipeLines([], [{ id: 'chicken-breast', name: 'Pierś z kurczaka', grams: 200, taste: false }], 'Curry')
    items = addRecipeLines(items, [{ id: 'chicken-breast', name: 'Pierś z kurczaka', grams: 150, taste: false }, { id: 'salt', name: 'Sól', grams: 1, taste: true }], 'Sałatka')
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ grams: 350, note: 'Curry, Sałatka', done: false })
    expect(items[1]).toMatchObject({ grams: null, taste: true })
  })

  it('reopens a checked item when it is needed again', () => {
    let items = addRecipeLines([], [{ id: 'rice', name: 'Ryż', grams: 100, taste: false }], 'A')
    items = toggleItem(items, 'i-rice')
    expect(items[0]!.done).toBe(true)
    items = addRecipeLines(items, [{ id: 'rice', name: 'Ryż', grams: 100, taste: false }], 'B')
    expect(items[0]).toMatchObject({ done: false, grams: 200 })
  })

  it('adds manual items without duplicates and ignores blanks', () => {
    let items = addManualItem([], '  Mleko   owsiane ', 'm1')
    items = addManualItem(items, 'mleko owsiane', 'm2')
    items = addManualItem(items, '   ', 'm3')
    expect(items).toHaveLength(1)
    expect(items[0]!.name).toBe('Mleko owsiane')
  })

  it('removes, clears checked items and builds shareable text of open items only', () => {
    let items = addManualItem(addManualItem([], 'Chleb', 'a'), 'Masło', 'b')
    items = toggleItem(items, 'a')
    expect(shoppingText(items, (item) => item.name)).toBe('Lista zakupów — Flexa\n☐ Masło')
    expect(clearDone(items).map((item) => item.id)).toEqual(['b'])
    expect(removeItem(items, 'b').map((item) => item.id)).toEqual(['a'])
  })

  it('stores per scope and survives corrupt data', () => {
    writeShopping('demo', addManualItem([], 'Jajka', 'x'))
    expect(readShopping('demo')).toHaveLength(1)
    expect(readShopping('other')).toEqual([])
    localStorage.setItem('flexa:shopping:v1:demo', '{broken')
    expect(readShopping('demo')).toEqual([])
  })
})
