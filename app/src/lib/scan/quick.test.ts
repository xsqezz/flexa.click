// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest'
import { getPlateItem } from '../../../../shared/meal-scan/catalog'
import { estimateLine } from '../../../../shared/meal-scan/estimate'
import { loadPlateLibrary } from '../../../../shared/meal-scan/library'
import { parseMealPhrase, queryVariants, splitAtWith } from '../../../../shared/meal-scan/phrase'
import { resolveQuick } from './quick'

describe('meal phrase parser', () => {
  it('splits on commas, "i", "oraz" and plus signs', () => {
    expect(parseMealPhrase('jajko, chleb i masło oraz kawa + sok').map((part) => part.query)).toEqual(['jajko', 'chleb', 'maslo', 'kawa', 'sok'])
  })

  it('reads number words and digits as piece counts', () => {
    expect(parseMealPhrase('dwa jajka')[0]).toMatchObject({ query: 'jajka', count: 2, grams: null })
    expect(parseMealPhrase('3 banany')[0]).toMatchObject({ query: 'banany', count: 3 })
    expect(parseMealPhrase('pół banana')[0]).toMatchObject({ query: 'banana', count: 0.5 })
    expect(parseMealPhrase('półtora porcji ryżu')[0]).toMatchObject({ query: 'ryzu', count: 1.5 })
  })

  it('reads exact weights and volumes, with decimal commas and glued units', () => {
    expect(parseMealPhrase('200 g ryżu')[0]).toMatchObject({ query: 'ryzu', grams: 200, count: null })
    expect(parseMealPhrase('150g twarogu')[0]).toMatchObject({ grams: 150 })
    expect(parseMealPhrase('0,5 l mleka')[0]).toMatchObject({ grams: 500 })
    expect(parseMealPhrase('2 dag sera')[0]).toMatchObject({ grams: 20 })
  })

  it('turns household measures into typical amounts', () => {
    expect(parseMealPhrase('szklanka mleka')[0]).toMatchObject({ query: 'mleka', grams: 250 })
    expect(parseMealPhrase('2 kromki chleba')[0]).toMatchObject({ query: 'chleba', grams: 70 })
    expect(parseMealPhrase('łyżka oliwy')[0]).toMatchObject({ grams: 15 })
  })

  it('reads sizes and ignores filler words', () => {
    expect(parseMealPhrase('duża pizza')[0]).toMatchObject({ size: 'L' })
    expect(parseMealPhrase('zjadłem porcję makaronu')[0]?.query).toBe('makaronu')
  })

  it('drops empty pieces, caps length and item count', () => {
    expect(parseMealPhrase('   ')).toEqual([])
    expect(parseMealPhrase(', , 2 ,')).toEqual([])
    expect(parseMealPhrase(Array.from({ length: 30 }, (_, index) => `produkt${index}`).join(', '))).toHaveLength(12)
    expect(parseMealPhrase('x'.repeat(2000))[0]!.raw.length).toBeLessThanOrEqual(400)
  })

  it('offers readings for Polish endings and a two-item split', () => {
    expect(queryVariants('ryzu')).toContain('ryz')
    expect(queryVariants('mleka')).toContain('mleko')
    expect(queryVariants('kawe')).toContain('kawa')
    expect(splitAtWith('owsianka z bananem')).toEqual(['owsianka', 'bananem'])
    expect(splitAtWith('owsianka')).toBeNull()
  })
})

describe('quick entry against the catalogue', () => {
  beforeAll(async () => { await loadPlateLibrary() })
  const names = (text: string) => resolveQuick(text).resolved.map((entry) => getPlateItem(entry.line.id).name)

  it('finds everyday Polish foods in several inflected forms', () => {
    const found = names('jajka, chleb, masło, mleko, banan, ryż')
    expect(found).toHaveLength(6)
    for (const name of found) expect(name.length).toBeGreaterThan(1)
    expect(resolveQuick('jajka, chleb, masło, mleko, banan, ryż').unknown).toEqual([])
    expect(resolveQuick('200 g ryżu').resolved).toHaveLength(1)
    expect(resolveQuick('szklanka mleka').resolved).toHaveLength(1)
  })

  it('applies amounts to the lines', () => {
    const [rice] = resolveQuick('200 g ryżu').resolved
    expect(rice!.line.grams).toBe(200)
    expect(estimateLine(rice!.line).grams).toBe(200)
    const [eggs] = resolveQuick('dwa jajka').resolved
    const item = getPlateItem(eggs!.line.id)
    expect(eggs!.line.count ?? 1).toBeGreaterThanOrEqual(item.piece ? 2 : 1)
    const [half] = resolveQuick('pół banana').resolved
    expect(half!.line.grams).toBeGreaterThan(20)
  })

  it('keeps unknown words instead of inventing food', () => {
    const result = resolveQuick('zzzxqv')
    expect(result.resolved).toEqual([])
    expect(result.unknown).toEqual(['zzzxqv'])
  })

  it('uses remembered portions only when the user gave no amount', () => {
    const habit = (id: string) => ({ id, grams: 77 })
    expect(resolveQuick('banan', habit).resolved[0]!.line.grams).toBe(77)
    expect(resolveQuick('200 g banana', habit).resolved[0]!.line.grams).toBe(200)
  })

  it('never drops the second food of "X z Y"', () => {
    const result = resolveQuick('owsianka z bananem')
    const found = result.resolved.map((entry) => getPlateItem(entry.line.id).name.toLowerCase())
    expect(found.length + result.unknown.length).toBeGreaterThanOrEqual(2)
    expect(found.some((name) => name.includes('owsianka'))).toBe(true)
    const bread = resolveQuick('2 kromki chleba z masłem')
    expect(bread.resolved.length + bread.unknown.length).toBeGreaterThanOrEqual(2)
    expect(bread.resolved[0]!.line.grams).toBe(70)
  })

  it('applies a trailing size word to the previous item instead of searching for it', () => {
    expect(parseMealPhrase('pizza margherita, duża')).toHaveLength(1)
    expect(parseMealPhrase('pizza margherita, duża')[0]!.size).toBe('L')
    expect(resolveQuick('pizza margherita, duża').resolved).toHaveLength(1)
  })})
