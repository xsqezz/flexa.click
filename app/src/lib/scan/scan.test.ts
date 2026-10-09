// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { foodSchema } from '../../../../shared/domain'
import { aiLimits, type AiBinding } from '../../../../shared/kitchen/ai'
import { getPlateItem, plateGroups, plateItems, plateItemsById, type PlateItem } from '../../../../shared/meal-scan/catalog'
import { estimateLine, estimatePlate, lineFood, lineGrams, lineProblem, portionText } from '../../../../shared/meal-scan/estimate'
import { handlePlateRequest, mergePlateFindings, parsePlateText, platePrompt } from '../../../../shared/meal-scan/ai'
import { chainMenuNames } from '../../../../shared/meal-scan/anchors'
import { loadPlateLibrary } from '../../../../shared/meal-scan/library'
import { detectBrand, matchDescriptor, searchPlateItems, tokenize, type Descriptor } from '../../../../shared/meal-scan/match'
import { lineForItem, resolveFindings } from './client'

const library = () => [...plateItemsById.values()]

describe('hand-made plate table', () => {
  it('has unique kebab-case ids and sensible portion sizes', () => {
    expect(new Set(plateItems.map((entry) => entry.id)).size).toBe(plateItems.length)
    expect(plateItems.length).toBeGreaterThanOrEqual(60)
    for (const entry of plateItems) {
      expect(entry.id).toMatch(/^[a-z0-9-]{2,40}$/)
      expect(entry.sizes.S).toBeLessThan(entry.sizes.M)
      expect(entry.sizes.M).toBeLessThan(entry.sizes.L)
      if (entry.piece) expect(entry.piece.grams).toBeLessThanOrEqual(entry.sizes.L)
      expect(entry.en?.length, entry.id).toBeGreaterThan(0)
    }
  })

  it('keeps every energy value consistent with its macronutrients', () => {
    for (const { id, per100: n } of plateItems) {
      const derived = 4 * n.protein + 4 * n.carbs + 9 * n.fat - 2 * n.fiber
      const allowed = Math.max(25, n.kcal * 0.12)
      expect(Math.abs(n.kcal - derived), `${id}: ${n.kcal} kcal vs ${derived.toFixed(0)} from macros`).toBeLessThanOrEqual(allowed)
      expect(n.protein + n.carbs + n.fat, id).toBeLessThanOrEqual(100)
    }
  })

  it('rejects unknown ids', () => {
    expect(() => getPlateItem('unicorn')).toThrow('Unknown')
  })
})

describe('full plate library', () => {
  beforeAll(async () => { await loadPlateLibrary() })

  it('knows at least 5000 different things that can appear on a plate', () => {
    const items = library()
    expect(items.length).toBeGreaterThanOrEqual(8000)
    const distinct = new Set(items.map((entry) => `${entry.brand ?? ''}|${(entry.en?.[0] ?? entry.name).toLowerCase()}`))
    expect(distinct.size).toBeGreaterThanOrEqual(5000)
    const groups = new Set(items.map((entry) => entry.group))
    for (const group of plateGroups) expect(groups.has(group), group).toBe(true)
  })

  it('has only valid, consistent records', () => {
    const seen = new Set<string>()
    for (const entry of library()) {
      expect(seen.has(entry.id), `duplicate ${entry.id}`).toBe(false)
      seen.add(entry.id)
      const n = entry.per100
      for (const value of [n.kcal, n.protein, n.carbs, n.fat, n.fiber]) expect(value, entry.id).toBeGreaterThanOrEqual(0)
      expect(n.protein + n.carbs + n.fat, entry.id).toBeLessThanOrEqual(105)
      expect(n.kcal, entry.id).toBeLessThanOrEqual(900)
      expect(entry.name.length, entry.id).toBeGreaterThan(1)
      expect(entry.sizes.S, entry.id).toBeGreaterThan(0)
      if (!entry.fixed) { expect(entry.sizes.S, entry.id).toBeLessThan(entry.sizes.M); expect(entry.sizes.M, entry.id).toBeLessThan(entry.sizes.L) }
      if (entry.fixed) expect(entry.brand, entry.id).toBeTruthy()
      if (entry.group !== 'alcohol') {
        const derived = 4 * n.protein + 4 * n.carbs + 9 * n.fat - 2 * n.fiber
        expect(Math.abs(n.kcal - derived), `${entry.id} ${entry.name}`).toBeLessThanOrEqual(Math.max(30, n.kcal * 0.2))
      }
    }
  })

  it('turns every library item into a valid diary product', () => {
    for (const entry of library()) {
      const estimate = estimateLine({ id: entry.id, ...(entry.fixed ? {} : { size: 'L' as const }) })
      const { food, portion } = lineFood(estimate)
      expect(foodSchema.safeParse(food).success, entry.id).toBe(true)
      expect(portion * (food.nutrients.kcal ?? 0) / 100).toBeCloseTo(estimate.kcal.typical, 0)
    }
  })

  it('carries the official menus of McDonald\'s, Burger King and KFC in Poland', () => {
    for (const brand of ["McDonald's", 'Burger King', 'KFC']) {
      const own = library().filter((entry) => entry.brand === brand && entry.region === 'PL')
      expect(own.length, brand).toBeGreaterThanOrEqual(50)
      expect(own.every((entry) => entry.fixed), brand).toBe(true)
      expect(chainMenuNames[brand]?.length, brand).toBeGreaterThanOrEqual(50)
    }
    const byName = (brand: string, pattern: RegExp) => library().find((entry) => entry.brand === brand && entry.region === 'PL' && pattern.test(entry.name))
    const bigMac = byName("McDonald's", /^Big Mac$/)
    expect(bigMac?.per100.kcal).toBe(231)
    expect(bigMac?.sizes.M).toBeGreaterThan(200)
    expect(byName('Burger King', /^Whopper$/)).toBeTruthy()
    expect(byName('KFC', /^Zinger Burger$/)).toBeTruthy()
    for (const size of [/małe/i, /średnie/i, /duże/i]) expect(byName("McDonald's", new RegExp(`^Frytki ${size.source}`, 'i'))).toBeTruthy()
    expect(byName('Burger King', /^Frytki małe/)).toBeTruthy()
    expect(byName('KFC', /^Frytki/)).toBeTruthy()
    expect(library().some((entry) => entry.region === 'US' && entry.brand === 'Wendy\'s')).toBe(true)
  })

  it('treats an official portion as fixed, narrow and exact in the diary', () => {
    const big = library().find((entry) => entry.id === 'mcd-big-mac') as PlateItem
    const estimate = estimateLine({ id: big.id })
    expect(estimate.precision).toBe('official')
    expect(estimate.grams).toBe(big.sizes.M)
    expect(estimate.kcal.typical).toBeGreaterThan(520)
    expect(estimate.kcal.typical).toBeLessThan(570)
    expect((estimate.kcal.high - estimate.kcal.low) / estimate.kcal.typical).toBeLessThan(0.12)
    expect(lineGrams({ id: big.id, size: 'L', count: 2 })).toEqual({ grams: 2 * big.sizes.M, precision: 'official' })
    const { food } = lineFood(estimate)
    expect(food.brand).toBe("McDonald's")
    expect(food.estimated).toBe(false)
    expect(portionText(estimate)).toMatch(/porcja z menu/)
    expect(estimatePlate([{ id: big.id }]).confidence).toBe('high')
  })
})

describe('matching what a photo model says to the library', () => {
  beforeAll(async () => { await loadPlateLibrary() })

  const named = (brand: string | null, pattern: RegExp) => (item: PlateItem) => (brand === null || item.brand === brand) && pattern.test(item.name)
  const mcd = "McDonald's"
  // A hand-labelled benchmark of what vision models typically write for a tray or plate.
  const cases: [Descriptor, (item: PlateItem) => boolean][] = [
    [{ name: 'Big Mac', brand: mcd }, (item) => item.id === 'mcd-big-mac'],
    [{ name: "McDonald's Big Mac" }, (item) => item.id === 'mcd-big-mac'],
    [{ name: 'french fries', brand: mcd, size: 'L' }, named(mcd, /^Frytki Duże/)],
    [{ name: 'french fries', brand: mcd, size: 'S' }, named(mcd, /^Frytki Małe/)],
    [{ name: 'large french fries', brand: 'Burger King' }, named('Burger King', /^Frytki duże/)],
    [{ name: 'french fries', brand: 'KFC' }, named('KFC', /^Frytki/)],
    [{ name: 'chicken nuggets', brand: mcd, count: 6 }, named(mcd, /^6 McNuggets/)],
    [{ name: 'chicken nuggets', brand: mcd, count: 9 }, named(mcd, /^9 McNuggets/)],
    [{ name: 'McChicken', brand: mcd }, named(mcd, /^McChicken$/)],
    [{ name: 'Filet-O-Fish', brand: mcd }, named(mcd, /Filet-O-Fish/)],
    [{ name: 'McRoyal', brand: mcd }, named(mcd, /^McRoyal$/)],
    [{ name: 'Whopper', brand: 'Burger King' }, named('Burger King', /^Whopper$/)],
    [{ name: 'Double Whopper', brand: 'Burger King' }, named('Burger King', /^Double Whopper$/)],
    [{ name: 'onion rings', brand: 'Burger King' }, named('Burger King', /(Onion Rings|Krążki)/)],
    [{ name: 'Zinger burger', brand: 'KFC' }, named('KFC', /^Zinger Burger$/)],
    [{ name: 'Twister', brand: 'KFC' }, named('KFC', /^Twister/)],
    [{ name: 'fried chicken drumstick', brand: 'KFC' }, named('KFC', /nóżka/)],
    [{ name: 'Coca-Cola', brand: mcd, size: 'M' }, named(mcd, /^Coca-Cola 0,4l/)],
    [{ name: 'cheeseburger' }, named(null, /^Cheeseburger/)],
    [{ name: 'hamburger' }, named(null, /^Hamburger/)],
    [{ name: 'chicken nuggets' }, named(null, /Nuggets/i)],
    [{ name: 'fried chicken wings' }, (item) => /Skrzydeł|Skrzydło/.test(item.name)],
    [{ name: 'coleslaw' }, named(null, /(Colesław|coleslaw)/i)],
    [{ name: 'onion rings' }, named(null, /Krążki cebulowe/)],
    [{ name: 'cola' }, named(null, /^Cola/)],
    [{ name: 'orange juice' }, named(null, /^Sok pomarańczowy/)],
    [{ name: 'milkshake' }, named(null, /(Shake|koktajl|Koktajl)/)],
    [{ name: 'apple pie' }, named(null, /(Szarlotka|pie jabłkowy)/i)],
    [{ name: 'caesar salad' }, named(null, /(Cezar|z kurczakiem)/)],
    [{ name: 'greek salad' }, named(null, /grecka/)],
    [{ name: 'pepperoni pizza slice' }, named(null, /(pepperoni|wędliną)/i)],
    [{ name: 'margherita pizza' }, named(null, /(margherita|serem)/i)],
    [{ name: 'kebab' }, named(null, /^Kebab/)],
    [{ name: 'pierogi' }, named(null, /^Pierogi/)],
    [{ name: 'bigos' }, named(null, /^Bigos/)],
    [{ name: 'sushi roll' }, named(null, /Sushi/)],
    [{ name: 'ramen' }, named(null, /^Ramen/)],
    [{ name: 'lasagna' }, named(null, /Lasagne/)],
    [{ name: 'mashed potatoes' }, named(null, /Puree/)],
    [{ name: 'rice' }, named(null, /^Ryż/)],
    [{ name: 'grilled chicken breast' }, named(null, /Pierś z kurczaka/)],
    [{ name: 'scrambled eggs' }, named(null, /Jajecznica/)],
    [{ name: 'pancakes' }, named(null, /(Naleśnik|pancakes)/i)],
    [{ name: 'croissant' }, named(null, /Croissant/)],
    [{ name: 'hot dog' }, named(null, /(Hot dog|Parówk)/)],
    [{ name: 'burrito' }, named(null, /Burrito/)],
    [{ name: 'tacos' }, named(null, /Taco/)],
    [{ name: 'pad thai' }, named(null, /Pad thai/)],
    [{ name: 'latte' }, named(null, /(Latte|Kawa z mlekiem)/)],
    [{ name: 'black coffee' }, named(null, /(Kawa|Espresso|Americano)/)],
    [{ name: 'beer' }, named(null, /^Piwo/)],
    [{ name: 'red wine' }, named(null, /^Wino czerwone/)],
    [{ name: 'donut' }, named(null, /(Pączek|Donut)/)],
    [{ name: 'brownie' }, named(null, /Brownie/)],
    [{ name: 'banana' }, named(null, /Banan/)],
    [{ name: 'apple' }, named(null, /Jabłko/)],
    [{ name: 'broccoli' }, named(null, /(Brokuł|Warzywa)/)],
    [{ name: 'hummus' }, named(null, /Hummus/)],
    [{ name: 'falafel' }, named(null, /Falafel/)],
    [{ name: 'ketchup' }, named(null, /Ketchup/)],
    [{ name: 'mayonnaise' }, named(null, /Majonez/)],
    [{ name: 'bbq sauce' }, named(null, /(BBQ|Barbeque)/)],
    [{ name: 'mac and cheese' }, named(null, /Makaron z serem/)],
    [{ name: 'tomato soup' }, named(null, /pomidorow/i)],
    [{ name: 'chocolate cake' }, named(null, /(czekolad|Ciasto)/i)],
    [{ name: 'spaghetti bolognese' }, named(null, /(Spaghetti|Makaron)/)],
  ]

  it('finds the right item for the benchmark: top-1 for 9 of 10 and top-3 for nearly all', () => {
    let top1 = 0
    let top3 = 0
    const misses: string[] = []
    for (const [descriptor, expected] of cases) {
      const match = matchDescriptor(descriptor, 3)
      if (match.candidates[0] && expected(match.candidates[0].item)) top1 += 1
      else misses.push(`${descriptor.name}${descriptor.brand ? ` @${descriptor.brand}` : ''} -> ${match.candidates.map((entry) => entry.item.name).join(' | ')}`)
      if (match.candidates.some((entry) => expected(entry.item))) top3 += 1
    }
    expect(top1 / cases.length, misses.join('\n')).toBeGreaterThanOrEqual(0.9)
    expect(top3 / cases.length, misses.join('\n')).toBeGreaterThanOrEqual(0.97)
  })

  it('knows when it does not know', () => {
    expect(matchDescriptor({ name: 'unicorn steak with stardust' }).confidence).not.toBe('sure')
    expect(matchDescriptor({ name: '' }).candidates).toEqual([])
    expect(matchDescriptor({ name: 'Big Mac', brand: mcd }).confidence).toBe('sure')
    expect(matchDescriptor({ name: 'cheeseburger' }).confidence).toBe('sure')
  })

  it('recognises chains however a model writes them', () => {
    expect(detectBrand("mcdonald's")).toBe(mcd)
    expect(detectBrand('McDonalds fries')).toBe(mcd)
    expect(detectBrand('BK')).toBe('Burger King')
    expect(detectBrand('Kentucky Fried Chicken')).toBe('KFC')
    expect(detectBrand('homemade')).toBeNull()
  })

  it('tokenises English and Polish menu words alike', () => {
    expect(tokenize('French fries')).toEqual(tokenize('french fry'))
    expect(tokenize('Frytki Duże')).toContain('large')
    expect(tokenize('a plate of Nuggets')).toEqual(['nugget'])
  })

  it('searches by hand in Polish, with half-typed words and without diacritics', () => {
    const first = (query: string) => searchPlateItems(query, 5).map((entry) => entry.item.name)
    expect(first('frytki')[0]).toBe('Frytki')
    expect(first('paczek')[0]).toMatch(/Pączek/)
    expect(first('big mac')[0]).toBe('Big Mac')
    expect(first('kotlet sch')[0]).toMatch(/Kotlet schabowy/)
    expect(first('pierog').join(' ')).toMatch(/Pierogi/)
    expect(searchPlateItems('zzzz')).toEqual([])
    expect(searchPlateItems('')).toEqual([])
  })

  it('turns findings into lines, keeping counts and sizes sensible', () => {
    const fries = getPlateItem('fries')
    expect(lineForItem(fries, { size: 'L', count: null })).toEqual({ id: 'fries', size: 'L' })
    expect(lineForItem(getPlateItem('nuggets'), { size: null, count: 6 })).toEqual({ id: 'nuggets', count: 6 })
    expect(lineForItem(getPlateItem('hamburger'), { size: 'M', count: 2 })).toEqual({ id: 'hamburger', count: 2 })
    expect(lineForItem(getPlateItem('mcd-big-mac'), { size: 'L', count: 2 })).toEqual({ id: 'mcd-big-mac', count: 2 })
    expect(lineForItem(getPlateItem('mcd-6-mcnuggets'), { size: null, count: 6 })).toEqual({ id: 'mcd-6-mcnuggets' })
    const { resolved, unknown } = resolveFindings([
      { name: 'Big Mac', brand: mcd, size: null, count: 1 },
      { name: 'french fries', brand: mcd, size: 'M', count: null },
      { name: 'zzzzqqq', brand: null, size: null, count: null },
    ])
    expect(resolved.map((entry) => entry.line.id)).toEqual(['mcd-big-mac', expect.stringMatching(/^mcd-frytki/)])
    expect(resolved[0].heard).toBe("Big Mac (McDonald's)")
    expect(resolved[0].alternatives.length).toBeGreaterThan(0)
    expect(unknown).toEqual(['zzzzqqq'])
  })
})

describe('portion estimates', () => {
  it('uses the medium size by default and shows an honest range around it', () => {
    const fries = estimateLine({ id: 'fries' })
    expect(fries.precision).toBe('estimated')
    expect(fries.grams).toBe(115)
    expect(fries.kcal.typical).toBeCloseTo(115 * 3.12, 5)
    expect(fries.kcal.low).toBeLessThan(fries.kcal.typical)
    expect(fries.kcal.high).toBeGreaterThan(fries.kcal.typical)
    expect(estimateLine({ id: 'fries', size: 'L' }).grams).toBe(165)
    expect(estimateLine({ id: 'fries', size: 'S' }).kcal.typical).toBeLessThan(fries.kcal.typical)
  })

  it('counts pieces, multiplies portions and prefers typed amounts', () => {
    expect(lineGrams({ id: 'nuggets', count: 6 })).toEqual({ grams: 102, precision: 'counted' })
    expect(lineGrams({ id: 'hamburger', count: 2 }).grams).toBe(210)
    expect(lineGrams({ id: 'fries', count: 2, size: 'S' })).toEqual({ grams: 160, precision: 'estimated' })
    expect(lineGrams({ id: 'fries', size: 'L', grams: 130 })).toEqual({ grams: 130, precision: 'weighed' })
    expect(lineGrams({ id: 'fries', grams: 99999 }).grams).toBe(5000)
    expect(lineGrams({ id: 'nuggets', count: 999 }).grams).toBe(60 * 17)
  })

  it('narrows the range as the amount becomes more certain', () => {
    const width = (line: Parameters<typeof estimateLine>[0]) => { const { kcal } = estimateLine(line); return (kcal.high - kcal.low) / kcal.typical }
    expect(width({ id: 'burger-gourmet' })).toBeGreaterThan(width({ id: 'burger-gourmet', count: 1 }))
    expect(width({ id: 'burger-gourmet', count: 1 })).toBeGreaterThan(width({ id: 'burger-gourmet', grams: 330 }))
    expect(width({ id: 'burger-gourmet', grams: 330 })).toBeGreaterThan(width({ id: 'burger-gourmet', exact: { kcal: 900, protein: 45, carbs: 60, fat: 55 } }))
    expect(width({ id: 'burger-gourmet' })).toBeGreaterThan(width({ id: 'cola' }))
  })

  it('lets the menu or package values replace the table', () => {
    const own = estimateLine({ id: 'burger-double', exact: { kcal: 563, protein: 26, carbs: 45, fat: 33 } })
    expect(own.precision).toBe('exact')
    expect(own.kcal).toEqual({ low: 563, typical: 563, high: 563 })
    expect(own.grams).toBe(215)
    const { food, portion } = lineFood(own)
    expect(food.estimated).toBe(false)
    expect(food.name).toContain('z menu')
    expect(food.id).toMatch(/^scan-burger-double-own-/)
    expect(portion * food.nutrients.kcal / 100).toBeCloseTo(563, 0)
    expect(lineFood(estimateLine({ id: 'burger-double', exact: { kcal: 600, protein: 26, carbs: 45, fat: 33 } })).food.id).not.toBe(food.id)
  })

  it('sums ranges and grades the confidence of the whole meal', () => {
    const tray = estimatePlate([{ id: 'burger-double' }, { id: 'fries' }, { id: 'cola' }])
    expect(tray.totals.kcal.typical).toBeCloseTo(215 * 2.51 + 115 * 3.12 + 400 * 0.42, 5)
    expect(tray.totals.kcal.low).toBeLessThan(tray.totals.kcal.typical)
    expect(tray.confidence).toBe('rough')
    expect(tray.spreadPercent).toBeGreaterThan(15)
    const weighed = estimatePlate([{ id: 'chicken-grilled', grams: 150 }, { id: 'rice-cooked', grams: 180 }])
    expect(weighed.confidence).toBe('high')
    expect(estimatePlate([{ id: 'kebab', grams: 450 }, { id: 'fries', grams: 120 }]).confidence).toBe('medium')
    const sure = estimatePlate([{ id: 'burger-double', exact: { kcal: 550, protein: 25, carbs: 45, fat: 30 } }])
    expect(sure.confidence).toBe('high')
    expect(estimatePlate([]).totals.kcal.typical).toBe(0)
  })

  it('turns every table line into a valid diary product whose portion reproduces the estimate', () => {
    for (const entry of plateItems) {
      const estimate = estimateLine({ id: entry.id, size: 'L' })
      const { food, portion } = lineFood(estimate)
      expect(foodSchema.safeParse(food).success, entry.id).toBe(true)
      expect(portion * (food.nutrients.kcal ?? 0) / 100).toBeCloseTo(estimate.kcal.typical, 0)
      expect(food.estimated).toBe(true)
    }
    expect(lineFood(estimateLine({ id: 'fries' })).food.id).toBe('scan-fries')
  })

  it('describes portions in Polish and validates typed values', () => {
    expect(portionText(estimateLine({ id: 'nuggets', count: 6 }))).toBe('6 szt. (ok. 102 g)')
    expect(portionText(estimateLine({ id: 'fries' }))).toBe('ok. 115 g')
    expect(portionText(estimateLine({ id: 'fries', grams: 120 }))).toBe('120 g')
    expect(lineProblem({ id: 'fries', grams: 0 })).toMatch(/Podaj ilość/)
    expect(lineProblem({ id: 'nuggets', count: 2.5 })).toMatch(/sztuk/)
    expect(lineProblem({ id: 'fries', exact: { kcal: -1, protein: 0, carbs: 0, fat: 0 } })).toMatch(/nieujemnymi/)
    expect(lineProblem({ id: 'fries', exact: { kcal: 9000, protein: 0, carbs: 0, fat: 0 } })).toMatch(/zakresem/)
    expect(lineProblem({ id: 'nope' })).toMatch(/Nieznany/)
    expect(lineProblem({ id: 'fries', size: 'L', exact: { kcal: 500, protein: 6, carbs: 60, fat: 25 } })).toBeNull()
  })
})

describe('plate photo analysis', () => {
  const token = 'aaa.bbb.ccc'
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array.from({ length: 2000 }, (_, index) => index % 251)])
  const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64')
  type Fetcher = typeof fetch
  const rpc = (answer: boolean | number): Fetcher => vi.fn(async () => typeof answer === 'number'
    ? new Response('{}', { status: answer })
    : new Response(JSON.stringify(answer), { status: 200, headers: { 'content-type': 'application/json' } })) as unknown as Fetcher
  const request = (body?: unknown, headers: Record<string, string> = { authorization: ['Bearer', token].join(' ') }, method = 'POST', action = 'plate') =>
    new Request(`https://flexa.test/api/meal/${action}`, { method, headers: { 'content-type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  const deps = (ai: AiBinding | undefined, fetcher: Fetcher = rpc(true)) => ({ ai, supabaseUrl: 'https://project.supabase.co/', supabaseKey: 'sb_publishable_test', fetch: fetcher })
  const aiReturning = (...results: unknown[]) => {
    const run = vi.fn()
    for (const result of results) run.mockImplementationOnce(async () => { if (result instanceof Error) throw result; return result })
    return { run } as AiBinding & { run: ReturnType<typeof vi.fn> }
  }
  const body = async (response: Response) => await response.json() as Record<string, unknown>

  it('lists the chain menus, asks for English names and never asks the model for calories', () => {
    const prompt = platePrompt()
    expect(prompt).toContain("McDonald's: ")
    expect(prompt).toContain('Big Mac')
    expect(prompt).toContain('Burger King: ')
    expect(prompt).toContain('KFC: ')
    expect(prompt).toContain('name | brand | size | count')
    expect(prompt).toContain('NONE')
    expect(prompt).toMatch(/never estimate calories/i)
    expect(prompt.length).toBeLessThan(22000)
  })

  it('parses name, brand, size and count lines defensively', () => {
    const text = [
      "1. Big Mac | McDonald's | - | 1",
      '- french fries | McDonald\'s | large | 1',
      'chicken nuggets | - | - | 6',
      'orange juice | - | small | 1',
      'pierogi with meat | - | - | 8',
      'no separators here',
      'french fries | McDonald\'s | large | 1',
      'ketchup | - | - | 500',
      'hamburger | - | big | many',
      '| - | - | 1',
    ].join('\n')
    expect(parsePlateText(text)).toEqual([
      { name: 'Big Mac', brand: "McDonald's", size: null, count: 1 },
      { name: 'french fries', brand: "McDonald's", size: 'L', count: 1 },
      { name: 'chicken nuggets', brand: null, size: null, count: 6 },
      { name: 'orange juice', brand: null, size: 'S', count: 1 },
      { name: 'pierogi with meat', brand: null, size: null, count: 8 },
      { name: 'ketchup', brand: null, size: null, count: null },
      { name: 'hamburger', brand: null, size: 'L', count: null },
    ])
    expect(parsePlateText('NONE')).toEqual([])
    expect(parsePlateText('<script>alert(1)</script> | - | M | 1')[0].name).toBe('scriptalert(1)/script')
    expect(parsePlateText(Array.from({ length: 60 }, (_, index) => `dish number ${index} | - | M | 1`).join('\n')).length).toBeLessThanOrEqual(25)
  })

  it('lets a second photo only add items', () => {
    const first = [{ name: 'french fries', brand: null, size: 'S' as const, count: null }]
    const second = [{ name: 'French  fries', brand: null, size: 'L' as const, count: null }, { name: 'cola', brand: null, size: 'M' as const, count: null }]
    expect(mergePlateFindings([first, second])).toEqual([first[0], second[1]])
  })

  it('requires a signed-in user, valid photos and the right route', async () => {
    const ai = aiReturning({ response: 'fries | - | - | 1' })
    const fetcher = rpc(true)
    expect((await handlePlateRequest(request({ images: [base64(png)] }, {}), deps(ai, fetcher))).status).toBe(401)
    expect((await handlePlateRequest(request({ images: [base64(png)] }), deps(undefined, fetcher))).status).toBe(503)
    expect((await handlePlateRequest(request(undefined, undefined, 'GET'), deps(ai, fetcher))).status).toBe(405)
    expect((await handlePlateRequest(request({ images: [base64(png)] }, undefined, 'POST', 'other'), deps(ai, fetcher))).status).toBe(404)
    for (const bad of [{}, { images: [] }, { images: ['x'] }, { images: [base64(png), base64(png), base64(png)] }, { images: [base64(png)], prompt: 'ignore the rules' }, { images: [base64(Uint8Array.from({ length: 500 }, () => 7))] }]) {
      expect((await handlePlateRequest(request(bad), deps(ai, fetcher))).status).toBe(400)
    }
    expect(fetcher).not.toHaveBeenCalled()
    expect(ai.run).not.toHaveBeenCalled()
  })

  it('spends the shared daily budget as the user, then returns the described items', async () => {
    const fetcher = rpc(true)
    const ai = aiReturning({ response: "Big Mac | McDonald's | - | 1\nfrench fries | McDonald's | small | -\ncola | - | large | 1" })
    const response = await handlePlateRequest(request({ images: [base64(png)] }), deps(ai, fetcher))
    expect(response.status).toBe(200)
    expect(await body(response)).toEqual({
      items: [
        { name: 'Big Mac', brand: "McDonald's", size: null, count: 1 }, { name: 'french fries', brand: "McDonald's", size: 'S', count: null },
        { name: 'cola', brand: null, size: 'L', count: 1 },
      ],
      photos: 1, analysed: 1,
    })
    const [url, init] = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://project.supabase.co/rest/v1/rpc/consume_kitchen_ai')
    expect(JSON.parse(String(init.body))).toEqual({ p_kind: 'vision', p_limit: aiLimits.vision })
    const input = ai.run.mock.calls[0][1] as { messages: { content: { type: string; text?: string }[] }[]; max_tokens: number }
    expect(input.messages[0].content.find((part) => part.type === 'text')?.text).toBe(platePrompt())
    expect(input.max_tokens).toBe(700)
  })

  it('combines two angles and survives one failing', async () => {
    const both = aiReturning({ response: 'french fries | - | - | 1' }, { response: 'cola | - | - | 1' })
    expect(await body(await handlePlateRequest(request({ images: [base64(png), base64(png)] }), deps(both)))).toMatchObject({ items: [{ name: 'french fries' }, { name: 'cola' }], photos: 2, analysed: 2 })
    const partial = aiReturning({ response: 'french fries | - | - | 1' }, new Error('down'), new Error('down'), new Error('down'))
    expect(await body(await handlePlateRequest(request({ images: [base64(png), base64(png)] }), deps(partial)))).toMatchObject({ items: [{ name: 'french fries' }], photos: 2, analysed: 1 })
  })

  it('reports an empty plate, a spent limit and a model outage without leaking details', async () => {
    expect(await body(await handlePlateRequest(request({ images: [base64(png)] }), deps(aiReturning({ response: 'NONE' }))))).toMatchObject({ items: [] })
    const denied = await handlePlateRequest(request({ images: [base64(png)] }), deps(aiReturning({ response: 'fries | - | - | 1' }), rpc(false)))
    expect(denied.status).toBe(429)
    const down = await handlePlateRequest(request({ images: [base64(png)] }), deps(aiReturning(new Error('secret /internal/path'), new Error('again'))))
    expect(down.status).toBe(503)
    expect(JSON.stringify(await body(down))).not.toMatch(/secret|internal/)
  })
})
