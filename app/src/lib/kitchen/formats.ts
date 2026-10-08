import { getIngredient } from '../../../../shared/kitchen/lookup'
import type { Equipment, Ingredient } from '../../../../shared/kitchen/types'
import type { DishFormat, DishStyle } from '../../../../shared/kitchen/visual'
import type { Ctx, Draft, DraftLine, Mood } from './context'
import { cap, fill, joinList, roundUp } from './text'

const L = (id: string, grams: number, scale = false, taste = false): DraftLine => ({ id, grams, scale, ...(taste ? { taste } : {}) })

const noCarb = new Set(['oats', 'flour-wheat'])
const saladOnly = new Set(['pickled-cucumber', 'sauerkraut', 'radish', 'olives', 'lettuce', 'arugula', 'cucumber', 'avocado', 'beetroot-cooked'])
const rawOk = new Set(['bell-pepper', 'carrot', 'spinach', 'cabbage', 'tomato', 'corn-canned'])
const starch = new Set(['potato', 'sweet-potato'])

const isAromatic = (item: Ingredient) => item.roles.includes('aromatic')
const isMainVeg = (item: Ingredient) => item.category === 'veg' && item.roles.includes('veg') && !isAromatic(item)
const isRawProtein = (item: Ingredient) => !item.ready && item.roles.includes('protein') && (item.category === 'meat' || item.category === 'fish' || item.id === 'tofu')
const isReadyProtein = (item: Ingredient) => Boolean(item.ready) && item.roles.includes('protein') && ['meat', 'fish', 'legume', 'cheese', 'dairy'].includes(item.category)
const isGrain = (item: Ingredient) => item.roles.includes('carb') && (item.cook?.boil ?? 0) > 0 && !item.ready && !noCarb.has(item.id) && item.category !== 'veg'
const isSaladVeg = (item: Ingredient) => item.category === 'veg' && !isAromatic(item) && (Boolean(item.ready) || rawOk.has(item.id))
const softCheese = new Set(['cottage-cheese', 'quark', 'cream-cheese'])
const skilletCheese = new Set(['halloumi', 'feta'])
const isTopping = (item: Ingredient) => Boolean(item.ready) && ['cheese', 'meat'].includes(item.category) && !softCheese.has(item.id)
  && (item.roles.includes('protein') || item.roles.includes('topping'))
const cookTime = (item: Ingredient, method: keyof NonNullable<Ingredient['cook']>) => item.cook?.[method] ?? 0
const get = getIngredient

function fatFor(ctx: Ctx): Ingredient | null {
  if (ctx.owned.has('olive-oil')) return get('olive-oil')
  if (ctx.has('rapeseed-oil')) return get('rapeseed-oil')
  if (ctx.owned.has('butter')) return get('butter')
  return null
}

const seasoning = (ctx: Ctx): DraftLine[] => ctx.prefs.staples
  ? [L('salt', 2, false, true), L('pepper', 0.5, false, true), L('paprika-sweet', 1.5, false, true), L('herbs-mixed', 1, false, true)] : []
const seasonText = (ctx: Ctx) => ctx.prefs.staples ? 'Dopraw do smaku solą, pieprzem, papryką słodką i ziołami.' : 'Dopraw do smaku.'

function prepStep(items: readonly (Ingredient | undefined)[]): string | null {
  const seen = new Set<string>()
  const parts: string[] = []
  for (const item of items) {
    if (!item || seen.has(item.id)) continue
    seen.add(item.id)
    if (item.prep) parts.push(fill(item.prep, item))
  }
  return parts.length ? `Przygotuj składniki. ${parts.join(' ')}` : null
}
const prepTime = (items: readonly (Ingredient | undefined)[]) => Math.min(10, 2 + items.filter((item) => item?.prep).length)

function carbStep(item: Ingredient): string {
  const minutes = item.cook?.boil ?? 10
  if (item.id === 'couscous') return `Zalej ${item.acc} taką samą objętością wrzącej osolonej wody, przykryj na ${minutes} min, a potem rozluźnij widelcem.`
  if (starch.has(item.id)) return `Obierz i pokrój ${item.acc} w kostkę 2 cm. Gotuj w osolonej wodzie ok. ${minutes} min do miękkości, a potem odcedź.`
  if (item.id === 'pasta' || item.id === 'rice-noodles') return `W dużym garnku zagotuj osoloną wodę. Wsyp ${item.acc} i gotuj ok. ${minutes} min, aż będzie al dente, a potem odcedź.`
  return `Ugotuj ${item.acc} w osolonej wodzie lub według instrukcji na opakowaniu (ok. ${minutes} min), a potem odcedź.`
}

function readyStep(item: Ingredient): string {
  switch (item.category) {
    case 'legume': return `Dodaj ${item.acc} i podgrzewaj 2 min.`
    case 'fish': return `Rozdrobnij ${item.acc} widelcem i wmieszaj.`
    case 'cheese': case 'dairy':
      return item.id === 'halloumi'
        ? `Dodaj ${item.acc} i smaż po 1–2 min z każdej strony, aż się zarumieni.`
        : `Na koniec dodaj ${item.acc}, wymieszaj i podgrzewaj 1 min.`
    default: return `Dodaj ${item.acc} i podgrzewaj 1–2 min.`
  }
}

function proteinGrams(item: Ingredient): number {
  switch (item.id) {
    case 'minced-beef': case 'minced-pork': case 'minced-turkey': return 120
    case 'sausage': return 80
    case 'frankfurters': return 100
    case 'bacon': return 40
    case 'shrimp': return 120
    case 'salmon': case 'cod': return 140
    case 'tofu': return 130
    case 'ham': return 60
    case 'tuna-canned': return 80
    case 'sardines-canned': case 'mackerel-smoked': return 70
    case 'feta': case 'cottage-cheese': return 50
    case 'mozzarella': case 'halloumi': return 60
    case 'parmesan': return 15
    case 'chickpeas-canned': case 'kidney-beans-canned': case 'white-beans-canned': return 120
    default: return item.category === 'cheese' ? 30 : 130
  }
}

function vegLines(items: readonly Ingredient[], budget: number): DraftLine[] {
  const each = Math.max(50, Math.min(150, Math.round(budget / Math.max(1, items.length))))
  return items.map((item) => L(item.id, item.piece && item.piece <= 60 ? Math.max(each, item.piece) : each, true))
}

const styleOrder: Record<Mood, DishStyle[]> = {
  warm: ['tomato', 'curry', 'creamy', 'asian', 'mustard', 'pesto', 'lemon', 'herb'],
  light: ['lemon', 'herb', 'pesto', 'asian', 'mustard', 'creamy', 'tomato', 'curry'],
  protein: ['asian', 'tomato', 'creamy', 'mustard', 'lemon', 'pesto', 'curry', 'herb'],
  any: ['asian', 'tomato', 'creamy', 'lemon', 'mustard', 'pesto', 'curry', 'herb'],
  sweet: ['herb'],
}

type StyleChoice = { style: DishStyle; lines: DraftLine[]; key: Ingredient | null }

function styleChoices(ctx: Ctx, allowed: readonly DishStyle[]): StyleChoice[] {
  const has = (id: string) => ctx.owned.has(id)
  const options: Partial<Record<DishStyle, StyleChoice>> = { herb: { style: 'herb', lines: [], key: null } }
  if (has('soy-sauce')) options.asian = { style: 'asian', key: get('soy-sauce'), lines: [L('soy-sauce', 15), ...(has('honey') ? [L('honey', 5)] : []), ...(has('ginger') ? [L('ginger', 3)] : [])] }
  if (has('curry-powder')) {
    const liquid = has('coconut-milk') ? L('coconut-milk', 80) : has('yogurt-greek') ? L('yogurt-greek', 60) : has('yogurt-natural') ? L('yogurt-natural', 60) : null
    options.curry = { style: 'curry', key: get('curry-powder'), lines: [L('curry-powder', 3), ...(liquid ? [liquid] : [])] }
  }
  const tomato = ['passata', 'canned-tomatoes', 'tomato-paste'].find(has)
  if (tomato) options.tomato = { style: 'tomato', key: get(tomato), lines: tomato === 'tomato-paste' ? [L('tomato-paste', 25), L('water', 60)] : [L(tomato, tomato === 'passata' ? 120 : 150)] }
  const creamy = ['cream', 'cream-heavy', 'cream-cheese', 'yogurt-greek', 'yogurt-natural'].find(has)
  if (creamy) options.creamy = { style: 'creamy', key: get(creamy), lines: [L(creamy, creamy === 'cream-cheese' ? 30 : 50)] }
  if (has('pesto')) options.pesto = { style: 'pesto', key: get('pesto'), lines: [L('pesto', 25)] }
  if (has('mustard')) options.mustard = { style: 'mustard', key: get('mustard'), lines: [L('mustard', 12), ...(has('honey') ? [L('honey', 8)] : [])] }
  if (has('lemon')) options.lemon = { style: 'lemon', key: get('lemon'), lines: [L('lemon', 40)] }
  return styleOrder[ctx.prefs.mood].filter((style) => allowed.includes(style) && options[style]).map((style) => options[style] as StyleChoice)
}

function pickStyle(ctx: Ctx, allowed: readonly DishStyle[]): StyleChoice {
  const options = styleChoices(ctx, allowed)
  const fixed = ctx.picks?.style?.[0]
  const found = fixed ? options.find((option) => option.style === fixed) : undefined
  return found ?? options[ctx.variant % Math.max(1, options.length)] ?? { style: 'herb', lines: [], key: null }
}

const styleSubtitle: Record<DishStyle, string> = {
  herb: 'Z ziołami', asian: 'Po azjatycku, w sosie sojowym', tomato: 'W sosie pomidorowym', creamy: 'W kremowym sosie',
  lemon: 'Ze świeżą cytryną', curry: 'W sosie curry', mustard: 'Z glazurą musztardową', pesto: 'Z pesto',
}

/** Sentences that apply the chosen flavour to a hot pan dish. */
function styleSteps(choice: StyleChoice, hot = true): string[] {
  const names = choice.lines.map((line) => get(line.id))
  const [first] = names
  switch (choice.style) {
    case 'asian': {
      const honey = names.some((item) => item.id === 'honey')
      const ginger = names.some((item) => item.id === 'ginger')
      return [`Wlej ${first.acc}${honey ? ', dodaj miód' : ''}${ginger ? `${honey ? ' i' : ', dodaj'} drobno starty imbir` : ''}, wymieszaj i smaż jeszcze 1–2 min, aż składniki pokryją się glazurą.`]
    }
    case 'tomato': return [first.id === 'tomato-paste'
      ? `Rozmieszaj ${first.acc} z odrobiną wody, wlej do patelni, przykryj i duś na małym ogniu ok. 5 min.`
      : `Dodaj ${first.acc}, przykryj i duś na małym ogniu ok. 5 min, aż sos lekko zgęstnieje.`]
    case 'creamy': return [`${hot ? 'Zdejmij z ognia i wmieszaj' : 'Wmieszaj'} ${first.acc}, żeby sos nie zważył się od wysokiej temperatury.`]
    case 'pesto': return [`Zdejmij z ognia i wymieszaj z ${first.ins}.`]
    case 'mustard': return [`Dodaj ${first.acc}${names.some((item) => item.id === 'honey') ? ' wymieszaną z miodem' : ''} na ostatnią minutę i obtocz wszystkie składniki.`]
    case 'lemon': return ['Na koniec skrop sokiem z cytryny i wymieszaj.']
    case 'curry': return [`Dodaj ${first.acc} i smaż 30 sekund, aż zacznie pachnieć.${names[1] ? ` Wlej ${names[1].acc} i duś 5 min.` : ' Wlej 2–3 łyżki wody i duś 3 min.'}`]
    default: return []
  }
}

function equipmentList(...items: (Equipment | false)[]): Equipment[] {
  return items.filter((item): item is Equipment => Boolean(item))
}

function withTitle(head: string, tail: readonly Ingredient[]): string {
  const title = `${cap(head)}${tail.length ? ` z ${joinList(tail.map((item) => item.ins))}` : ''}`
  return title.length > 70 && tail.length > 1 ? withTitle(head, tail.slice(0, -1)) : title
}

/** Orders pan additions by cooking time: slow items start first and everything finishes together; leaves wilt last. `closing` is false when eggs or similar still follow. */
function panStages(entries: readonly Ingredient[], closing = true): { steps: string[]; minutes: number } {
  type Entry = { item: Ingredient; time: number }
  const timed: Entry[] = entries.map((item) => ({ item, time: cookTime(item, 'pan') }))
  const wilt = timed.filter((entry) => entry.time <= 2 && !isRawProtein(entry.item))
  const solid = timed.filter((entry) => !wilt.includes(entry)).sort((a, b) => b.time - a.time || a.item.id.localeCompare(b.item.id))
  const longest = solid[0]?.time ?? 0
  const groups: { start: number; time: number; members: Entry[] }[] = []
  for (const entry of solid) {
    const last = groups.at(-1)
    const tolerance = isRawProtein(entry.item) || last?.members.some((member) => isRawProtein(member.item)) ? 1 : 3
    if (last && last.time - entry.time <= tolerance) last.members.push(entry)
    else groups.push({ start: longest - entry.time, time: entry.time, members: [entry] })
  }
  const steps = groups.map((group, index) => {
    const next = groups[index + 1]
    const duration = next ? next.start - group.start : group.time
    const items = group.members.map((member) => member.item)
    const protein = items.find(isRawProtein)
    const motion = items.some((item) => item.category === 'fish') ? 'delikatnie obracając'
      : protein?.id.startsWith('minced') ? 'od czasu do czasu mieszając i rozdrabniając mięso łyżką' : 'od czasu do czasu mieszając'
    const done = protein?.done ? `, ${protein.done}` : ''
    const names = joinList(items.map((item) => item.acc))
    return index === 0 ? `Dodaj ${names}. Smaż ok. ${duration} min, ${motion}${done}.` : `Następnie dodaj ${names}. Smaż ok. ${duration} min${done}.`
  })
  if (wilt.length) {
    const lead = closing ? 'Na koniec dodaj' : steps.length ? 'Następnie dodaj' : 'Dodaj'
    steps.push(`${lead} ${joinList(wilt.map((entry) => entry.item.acc))} i mieszaj 1–2 min, aż zwiędnie.`)
  }
  return { steps, minutes: longest + (wilt.length ? 2 : 0) }
}

function proteinTip(item: Ingredient | undefined): string[] {
  if (!item) return []
  if (item.category === 'meat') return ['Mięso wyjmij z lodówki 15 minut przed smażeniem — usmaży się równiej.']
  if (item.category === 'fish') return ['Rybę smaż na dobrze rozgrzanej patelni i nie obracaj zbyt często — nie rozpadnie się.']
  if (item.id === 'tofu') return ['Dobrze osuszone tofu lepiej się rumieni i nie rozpada.']
  return []
}

function aromaticLines(items: readonly Ingredient[]): DraftLine[] {
  return items.map((item) => L(item.id, item.id === 'garlic' ? 4 : item.id === 'onion' ? 50 : 15))
}

function aromaticStep(items: readonly Ingredient[]): string | null {
  const onion = items.find((item) => item.id === 'onion' || item.id === 'leek')
  const garlic = items.find((item) => item.id === 'garlic')
  if (onion) return `Dodaj ${onion.acc} i smaż ok. 3 min, aż się zeszkli${garlic ? `, na ostatnie 30 sekund dodaj ${garlic.acc}` : ''}.`
  if (garlic) return `Dodaj ${garlic.acc} i smaż 30 sekund, uważając, żeby się nie przypalił.`
  return null
}

function heatStep(ctx: Ctx, vessel: string): string {
  const fat = fatFor(ctx)
  return fat ? `Rozgrzej ${vessel} z ${fat.ins} na średnim ogniu.` : `Rozgrzej suchą, nieprzywierającą ${vessel}.`
}

function searStep(item: Ingredient): string {
  const motion = item.category === 'fish' ? 'delikatnie obracając' : item.id.startsWith('minced') ? 'mieszając i rozdrabniając mięso łyżką' : 'co jakiś czas obracając'
  return `Dodaj ${item.acc}. Smaż ok. ${cookTime(item, 'pan')} min, ${motion}${item.done ? `, ${item.done}` : ''}.`
}

function skillet(ctx: Ctx): Draft | null {
  if (!ctx.equipment.has('pan')) return null
  const raw = ctx.pool((item) => isRawProtein(item) && cookTime(item, 'pan') > 0)
  const ready = ctx.pool((item) => isReadyProtein(item) && (item.category !== 'cheese' || skilletCheese.has(item.id)))
  const vegPool = ctx.pool((item) => isMainVeg(item) && !saladOnly.has(item.id) && !starch.has(item.id) && cookTime(item, 'pan') > 0)
  const carbPool = ctx.equipment.has('pot')
    ? ctx.pool((item) => (isGrain(item) || (starch.has(item.id) && cookTime(item, 'boil') > 0)) && 7 + cookTime(item, 'boil') <= ctx.prefs.minutes) : []
  const main = ctx.choose('protein', raw.length ? raw : ready, 1, true)[0]
  const veg = ctx.choose('veg', vegPool, 3, true)
  const carb = ctx.choose('carb', carbPool, 1, true)[0]
  if ([main, veg.length > 0, carb].filter(Boolean).length < 2 && veg.length < 2) return null
  const rawMain = main && isRawProtein(main) ? main : undefined
  const extraPool = ready.filter((item) => item.id !== main?.id && item.category !== 'fish')
  const extra = rawMain ? ctx.choose('extra', extraPool, 1, true)[0] : undefined
  const aromatics = ctx.choose('aromatic', ctx.pool((item) => item.id === 'onion' || item.id === 'garlic'), 2)
  const style = pickStyle(ctx, ['asian', 'tomato', 'creamy', 'lemon', 'mustard', 'pesto', 'curry', 'herb'])
  const mix = carb && (style.style === 'tomato' || style.style === 'asian' || style.style === 'curry')
  const steps: string[] = []
  if (carb) steps.push(carbStep(carb))
  const prep = prepStep([main, ...veg, ...aromatics, extra])
  if (prep) steps.push(prep)
  steps.push(heatStep(ctx, 'patelnię'))
  const aromatic = aromaticStep(aromatics)
  if (aromatic) steps.push(aromatic)
  const stages = panStages([...(rawMain ? [rawMain] : []), ...veg])
  steps.push(...stages.steps)
  if (main && !rawMain) steps.push(readyStep(main))
  if (extra) steps.push(readyStep(extra))
  steps.push(...styleSteps(style))
  steps.push(seasonText(ctx))
  steps.push(carb ? (mix ? `Wmieszaj ${carb.acc} z pierwszego kroku i podgrzewaj 2 min, delikatnie mieszając. Podawaj od razu.` : `Podawaj z ${carb.ins}.`) : 'Podawaj od razu, gorące.')
  const fat = fatFor(ctx)
  const lines: DraftLine[] = [
    ...(main ? [L(main.id, proteinGrams(main), true)] : []),
    ...vegLines(veg, 180), ...(carb ? [L(carb.id, starch.has(carb.id) ? 220 : 70, true)] : []),
    ...(extra ? [L(extra.id, proteinGrams(extra), true)] : []), ...aromaticLines(aromatics), ...style.lines,
    ...(fat ? [L(fat.id, 8)] : []), ...seasoning(ctx),
  ]
  const styleMinutes = { tomato: 5, curry: 4, asian: 2 }[style.style as 'tomato' | 'curry' | 'asian'] ?? 1
  const cook = (aromatics.length ? 3 : 0) + stages.minutes + (main && !rawMain ? 2 : 0) + (extra ? 2 : 0) + styleMinutes + 2
  const carbPath = carb ? 5 + cookTime(carb, 'boil') + 2 : 0
  const minutes = roundUp(Math.max(carbPath, prepTime([main, ...veg, ...aromatics, extra]) + cook))
  const headItem = main ?? carb ?? veg[0]
  const tail = [...veg.slice(0, 2), ...(carb ? [carb] : []), ...(extra ? [extra] : [])].filter((item) => item.id !== headItem.id).slice(0, 3)
  return {
    format: 'skillet', style: style.style, title: withTitle(headItem.nom, tail), subtitle: styleSubtitle[style.style],
    minutes, equipment: equipmentList('pan', Boolean(carb) && 'pot'), lines, steps, tips: proteinTip(rawMain),
    picks: { protein: main ? [main.id] : [], veg: veg.map((item) => item.id), carb: carb ? [carb.id] : [], extra: extra ? [extra.id] : [], aromatic: aromatics.map((item) => item.id), style: [style.style] },
    imageIds: [main, ...veg.slice(0, 2), carb].filter((item): item is Ingredient => Boolean(item)).map((item) => item.id),
  }
}

function bake(ctx: Ctx): Draft | null {
  const methods = [ctx.equipment.has('airfryer') && 'air', ctx.equipment.has('oven') && 'oven'].filter((item): item is 'air' | 'oven' => Boolean(item))
  if (!methods.length) return null
  const fixed = ctx.picks?.method?.[0]
  const method = methods.find((item) => item === fixed) ?? methods[(ctx.variant + (ctx.prefs.minutes <= 30 ? 0 : 1)) % methods.length]
  const raw = ctx.pool((item) => isRawProtein(item) && item.category !== 'legume' && cookTime(item, method) > 0)
  const vegPool = ctx.pool((item) => isMainVeg(item) && !saladOnly.has(item.id) && cookTime(item, method) > 0)
  const main = ctx.choose('protein', raw, 1, true)[0]
  const veg = ctx.choose('veg', vegPool, 3, true)
  if (!main && veg.length < 2) return null
  if (!veg.length) return null
  const extra = !main ? ctx.choose('extra', ctx.pool(isTopping), 1, true)[0] : undefined
  const aromatics = ctx.choose('aromatic', ctx.pool((item) => item.id === 'garlic' || item.id === 'onion'), 1)
  const style = pickStyle(ctx, ['herb', 'asian', 'mustard', 'lemon', 'creamy', 'curry', 'pesto'])
  const items = [main, ...veg].filter((item): item is Ingredient => Boolean(item))
  const longest = Math.max(...items.map((item) => cookTime(item, method)))
  const temperature = method === 'oven' ? 200 : main?.category === 'fish' ? 180 : 190
  const preheat = method === 'oven' ? 10 : 3
  const steps: string[] = []
  steps.push(method === 'oven' ? 'Rozgrzej piekarnik do 200 °C (termoobieg) i wyłóż blachę papierem do pieczenia.' : `Rozgrzej air fryer do ${temperature} °C (ok. 3 min).`)
  const prep = prepStep([main, ...veg, ...aromatics])
  if (prep) steps.push(prep)
  const fat = fatFor(ctx)
  const oil = `odrobiną ${fat ? fat.gen : 'oleju'}`
  const salt = ctx.prefs.staples ? ['solą', 'pieprzem'] : []
  const styleParts = style.style === 'lemon' ? ['sokiem z cytryny'] : style.lines.map((line) => get(line.id).ins)
  const herbs = style.style === 'herb' && ctx.prefs.staples ? ['papryką słodką', 'ziołami'] : []
  const coating = joinList([...styleParts, oil, ...salt, ...herbs, ...aromatics.map((item) => item.ins)])
  if (main) {
    steps.push(`W misce wymieszaj ${main.acc} z ${coating}.`)
    steps.push(`Warzywa wymieszaj z ${joinList([oil, ...salt])}.`)
  } else steps.push(`W misce wymieszaj ${joinList(veg.map((item) => item.acc))} z ${coating}.`)
  const timeline = [...veg.map((item) => ({ item, time: cookTime(item, method), protein: false })), ...(main ? [{ item: main, time: cookTime(main, method), protein: true }] : [])]
    .sort((a, b) => b.time - a.time || a.item.id.localeCompare(b.item.id))
  const groups: { start: number; time: number; members: typeof timeline }[] = []
  for (const entry of timeline) {
    const last = groups.at(-1)
    const tolerance = entry.protein || last?.members.some((member) => member.protein) ? 1 : 2
    if (last && last.time - entry.time <= tolerance) last.members.push(entry)
    else groups.push({ start: longest - entry.time, time: entry.time, members: [entry] })
  }
  const vessel = method === 'oven' ? 'na blasze w jednej warstwie' : 'do koszyka w jednej warstwie'
  const shake = method === 'oven' ? ' (w połowie czasu obróć)' : ' (w połowie wstrząśnij koszykiem)'
  groups.forEach((group, index) => {
    const names = joinList(group.members.map((entry) => entry.item.acc))
    const done = group.members.find((entry) => entry.protein)?.item.done
    steps.push(index === 0
      ? `Włóż ${names} ${vessel} i piecz ${groups.length > 1 ? 'łącznie ' : ''}${longest} min${shake}${done ? `, ${done}` : ''}.`
      : `Po ${group.start} min dodaj ${names} i piecz dalej do końca czasu${done ? `, ${done}` : ''}.`)
  })
  if (extra) steps.push(`Pod koniec dodaj ${extra.acc} i piecz jeszcze 2 min, aż lekko się roztopi lub podgrzeje.`)
  steps.push(seasonText(ctx))
  steps.push('Podawaj od razu, dopóki jest gorące.')
  const lines: DraftLine[] = [
    ...(main ? [L(main.id, proteinGrams(main), true)] : []), ...vegLines(veg, 220), ...(extra ? [L(extra.id, proteinGrams(extra), true)] : []),
    ...aromaticLines(aromatics), ...style.lines, ...(fat ? [L(fat.id, 8)] : []), ...seasoning(ctx),
  ]
  const minutes = roundUp(Math.max(preheat, prepTime(items)) + longest + 2)
  const label = method === 'oven' ? 'Pieczone' : 'Z air fryera'
  const head = main ? `${label}: ${main.nom}` : `${label}: warzywa`
  return {
    format: 'bake', style: style.style, title: withTitle(head, [...veg.slice(0, 2), ...(extra ? [extra] : [])]), subtitle: styleSubtitle[style.style],
    minutes, equipment: [method === 'oven' ? 'oven' : 'airfryer'], lines, steps, tips: ['Nie przepełniaj koszyka ani blachy — składniki powinny się rumienić, a nie dusić.'],
    picks: { protein: main ? [main.id] : [], veg: veg.map((item) => item.id), extra: extra ? [extra.id] : [], aromatic: aromatics.map((item) => item.id), style: [style.style], method: [method] },
    imageIds: [main, ...veg.slice(0, 2), extra].filter((item): item is Ingredient => Boolean(item)).map((item) => item.id),
  }
}

const waterFor: Record<string, number> = { 'rice-white': 160, 'rice-brown': 190, pasta: 190, couscous: 70, buckwheat: 150, millet: 170, quinoa: 150, 'lentils-red': 210, 'lentils-green': 220, 'rice-noodles': 200 }

function onepot(ctx: Ctx): Draft | null {
  const vessel: Equipment | null = ctx.equipment.has('pot') ? 'pot' : ctx.equipment.has('pan') ? 'pan' : null
  if (!vessel) return null
  const base = ctx.choose('base', ctx.pool((item) => isGrain(item) && item.id !== 'couscous'), 1, true)[0]
  if (!base) return null
  const veg = ctx.choose('veg', ctx.pool((item) => isMainVeg(item) && !saladOnly.has(item.id) && !starch.has(item.id) && cookTime(item, 'pan') > 0), 3, true)
  const raw = ctx.pool((item) => isRawProtein(item) && item.category !== 'fish' && cookTime(item, 'pan') > 0)
  const main = ctx.choose('protein', raw.length ? raw : ctx.pool(isReadyProtein), 1, true)[0]
  if (!main && !veg.length) return null
  const aromatics = ctx.choose('aromatic', ctx.pool((item) => item.id === 'onion' || item.id === 'garlic'), 2)
  const style = pickStyle(ctx, ['tomato', 'curry', 'creamy', 'herb', 'asian', 'lemon'])
  const rawMain = main && isRawProtein(main) ? main : undefined
  const boil = cookTime(base, 'boil')
  const fat = fatFor(ctx)
  const saucy = style.lines.reduce((sum, line) => sum + (['passata', 'canned-tomatoes', 'coconut-milk', 'water'].includes(line.id) ? line.grams : 0), 0)
  const liquidGrams = Math.max(60, (waterFor[base.id] ?? 160) - Math.round(saucy * 0.8))
  const broth = ctx.owned.has('broth')
  const soft = veg.filter((item) => cookTime(item, 'pan') <= 6)
  const hard = veg.filter((item) => !soft.includes(item))
  const steps: string[] = []
  const prep = prepStep([main, ...veg, ...aromatics])
  if (prep) steps.push(prep)
  steps.push(heatStep(ctx, vessel === 'pot' ? 'garnek' : 'głęboką patelnię'))
  const aromatic = aromaticStep(aromatics)
  if (aromatic) steps.push(aromatic)
  if (rawMain) steps.push(`Dodaj ${rawMain.acc} i smaż ok. 5 min, mieszając — dokończy się podczas duszenia w sosie, aż ${rawMain.done?.replace(/^aż\s+/, '') ?? 'będzie całkiem ugotowany'}.`)
  if (style.style === 'curry' || style.style === 'tomato') steps.push(...styleSteps(style).slice(0, 1))
  steps.push(`Dodaj ${base.acc}${hard.length ? ` oraz ${joinList(hard.map((item) => item.acc))}` : ''}, wlej ${broth ? 'bulion' : 'gorącą wodę'} (ilość podana w składnikach), wymieszaj i zagotuj.`)
  const asRice = ['rice-white', 'rice-brown', 'buckwheat', 'millet', 'quinoa'].includes(base.id)
  steps.push(base.id === 'pasta' || base.id === 'rice-noodles'
    ? `Gotuj bez przykrycia ok. ${boil} min, często mieszając, aż makaron będzie al dente, a sos zgęstnieje.`
    : `Zmniejsz ogień, przykryj i gotuj ok. ${boil} min, od czasu do czasu mieszając, aż ${base.id.startsWith('lentils') ? 'soczewica będzie miękka' : 'wszystko wchłonie płyn'}.`)
  if (soft.length) steps.push(`Na ostatnie ${Math.min(5, Math.max(2, Math.round(boil / 3)))} min dodaj ${joinList(soft.map((item) => item.acc))}.`)
  if (main && !rawMain) steps.push(readyStep(main))
  if (style.style === 'creamy' || style.style === 'lemon' || style.style === 'asian') steps.push(...styleSteps(style, false))
  if (asRice) steps.push('Odstaw pod przykryciem na 5 min, a potem rozluźnij widelcem.')
  steps.push(seasonText(ctx))
  steps.push('Podawaj gorące.')
  const lines: DraftLine[] = [
    ...(main ? [L(main.id, proteinGrams(main), true)] : []), L(base.id, 70, true), ...vegLines(veg, 180), ...aromaticLines(aromatics),
    ...style.lines.filter((line) => line.id !== 'water'), L(broth ? 'broth' : 'water', liquidGrams), ...(fat ? [L(fat.id, 8)] : []), ...seasoning(ctx),
  ]
  const minutes = roundUp(prepTime([rawMain, ...veg, ...aromatics]) + (aromatics.length ? 3 : 1) + (rawMain ? 5 : 0) + boil + (asRice ? 5 : 2))
  const withs = [...(main ? [main] : []), ...veg.slice(0, 2)].slice(0, 3)
  const where = vessel === 'pot' ? 'z jednego garnka' : 'z jednej patelni'
  const title = style.style === 'curry'
    ? `Curry z ${joinList([base, ...(veg.slice(0, 2))].map((item) => item.gen))}`
    : `${withTitle(base.nom, withs)} (${where})`
  return {
    format: 'onepot', style: style.style, title: title.length > 80 ? `${withTitle(base.nom, withs.slice(0, 1))} (${where})` : title, subtitle: styleSubtitle[style.style],
    minutes, equipment: [vessel], lines, steps, tips: [...proteinTip(rawMain), 'Zostaw trochę płynu — danie dojdzie na talerzu i będzie bardziej soczyste.'],
    picks: { base: [base.id], veg: veg.map((item) => item.id), protein: main ? [main.id] : [], aromatic: aromatics.map((item) => item.id), style: [style.style] },
    imageIds: [base, main, ...veg.slice(0, 2)].filter((item): item is Ingredient => Boolean(item)).map((item) => item.id),
  }
}

function eggs(ctx: Ctx): Draft | null {
  const egg = ctx.pool((item) => item.id === 'egg')[0]
  if (!egg) return null
  const pan = ctx.equipment.has('pan')
  const microwave = ctx.equipment.has('microwave')
  if (!pan && !microwave) return null
  const picked = ctx.choose('veg', ctx.pool((item) => isMainVeg(item) && !saladOnly.has(item.id) && !starch.has(item.id) && cookTime(item, 'pan') > 0), 2, true)
  const extra = ctx.choose('extra', ctx.pool(isTopping), 1, true)[0]
  const tomatoBase = ['canned-tomatoes', 'passata'].map((id) => ctx.pool((item) => item.id === id)[0]).find(Boolean) ?? (picked.find((item) => item.id === 'tomato'))
  const kinds = [pan && tomatoBase && 'shakshuka', pan && (picked.length || extra) && 'omelette', pan && 'scramble', microwave && 'mug'].filter((item): item is string => Boolean(item))
  const kind = ctx.picks?.kind?.[0] ?? kinds[ctx.variant % kinds.length]
  const veg = kind === 'mug' ? picked.filter((item) => item.ready || cookTime(item, 'pan') <= 5) : picked
  const aromatics = ctx.choose('aromatic', ctx.pool((item) => item.id === 'onion' || item.id === 'garlic'), kind === 'shakshuka' ? 2 : 1)
  const fat = fatFor(ctx)
  const milk = ctx.owned.has('milk') ? get('milk') : null
  const pieces = ctx.prefs.size === 'large' ? 3 : 2
  const steps: string[] = []
  const prep = prepStep([...veg, ...aromatics.filter(() => kind !== 'mug'), extra])
  if (prep) steps.push(prep)
  let minutes = prepTime([...veg, extra])
  let title: string
  let equipment: Equipment[] = ['pan']
  const filler = [...veg, ...(extra ? [extra] : [])]
  const whisk = joinList([...(milk ? [milk.ins] : []), ...(ctx.prefs.staples ? ['solą', 'pieprzem'] : [])])
  const whiskText = whisk ? ` z ${whisk}` : ''
  if (kind === 'shakshuka' && tomatoBase) {
    steps.push(heatStep(ctx, 'głęboką patelnię'))
    const aromatic = aromaticStep(aromatics)
    if (aromatic) steps.push(aromatic)
    const stages = panStages(veg.filter((item) => item.id !== tomatoBase.id), false)
    steps.push(...stages.steps)
    steps.push(`Dodaj ${tomatoBase.acc}${ctx.prefs.staples ? ', paprykę słodką i sól' : ''}, wymieszaj i duś pod przykryciem ok. 6 min, aż sos zgęstnieje.`)
    steps.push(`Zrób w sosie wgłębienia i wbij ${egg.acc}. Przykryj i gotuj na małym ogniu 5–6 min, aż białko całkiem się zetnie.`)
    if (extra) steps.push(`Posyp ${extra.ins} i od razu podawaj.`)
    minutes += (aromatics.length ? 3 : 0) + stages.minutes + 6 + 6
    title = withTitle('szakszuka', veg.filter((item) => item.id !== tomatoBase.id).slice(0, 2))
  } else if (kind === 'omelette') {
    steps.push(`W misce roztrzep ${egg.acc}${whiskText}.`)
    steps.push(heatStep(ctx, 'patelnię'))
    const aromatic = aromaticStep(aromatics)
    if (aromatic) steps.push(aromatic)
    const stages = panStages(veg, false)
    steps.push(...stages.steps)
    steps.push('Zmniejsz ogień, wlej jajka na patelnię i smaż pod przykryciem ok. 3 min, aż masa całkiem się zetnie.')
    steps.push(`${extra ? `Posyp ${extra.ins}, złóż` : 'Złóż'} omlet na pół i smaż jeszcze minutę.`)
    minutes += (aromatics.length ? 3 : 0) + stages.minutes + 4
    title = withTitle('omlet', filler.slice(0, 3))
  } else if (kind === 'scramble') {
    steps.push(`W misce roztrzep ${egg.acc}${whiskText}.`)
    steps.push(heatStep(ctx, 'patelnię'))
    const aromatic = aromaticStep(aromatics)
    if (aromatic) steps.push(aromatic)
    const stages = panStages(veg, false)
    steps.push(...stages.steps)
    if (extra && extra.category === 'meat') steps.push(`Dodaj ${extra.acc} i smaż 1–2 min.`)
    steps.push('Wlej jajka na patelnię i mieszaj na małym ogniu 2–3 min, aż się zetną, ale zostaną kremowe.')
    if (extra && extra.category === 'cheese') steps.push(`Zdejmij z ognia i wmieszaj ${extra.acc}.`)
    minutes += (aromatics.length ? 3 : 0) + stages.minutes + (extra?.category === 'meat' ? 2 : 0) + 4
    title = withTitle('jajecznica', filler.slice(0, 3))
  } else {
    equipment = ['microwave']
    steps.push(`W dużym kubku lub miseczce roztrzep ${egg.acc}${whiskText}.`)
    steps.push(`Wmieszaj drobno pokrojone ${filler.length ? joinList(filler.map((item) => item.acc)) : 'ulubione dodatki'}.`)
    steps.push('Podgrzewaj w mikrofalówce 1 min 30 s, w połowie przerwij i zamieszaj. Jeśli jajka są jeszcze płynne, dogrzewaj po 15 sekund, aż całkiem się zetną.')
    minutes += 3
    title = withTitle('jajka w kubku', filler.slice(0, 3))
  }
  steps.push(seasonText(ctx))
  const lines: DraftLine[] = [
    L(egg.id, pieces * (egg.piece ?? 55), true), ...vegLines(veg, 120), ...(extra ? [L(extra.id, extra.category === 'meat' ? 40 : 30, true)] : []),
    ...aromaticLines(aromatics.filter(() => kind !== 'mug')), ...(tomatoBase && kind === 'shakshuka' && !veg.some((item) => item.id === tomatoBase.id) ? [L(tomatoBase.id, 150, true)] : []),
    ...(milk ? [L('milk', 30)] : []), ...(kind !== 'mug' && fat ? [L(fat.id, 6)] : []), ...seasoning(ctx),
  ]
  return {
    format: 'eggs', style: 'herb', title, subtitle: kind === 'mug' ? 'Z mikrofalówki' : 'Szybko i sycąco', minutes: roundUp(minutes), equipment, lines, steps,
    tips: ['Jajka są gotowe, gdy całkiem się zetną — białko i żółtko nie mogą być płynne.'],
    picks: { veg: veg.map((item) => item.id), extra: extra ? [extra.id] : [], aromatic: aromatics.map((item) => item.id), kind: [kind ?? 'scramble'] },
    imageIds: [egg, ...filler.slice(0, 3)].map((item) => item.id),
  }
}

function soup(ctx: Ctx): Draft | null {
  if (!ctx.equipment.has('pot')) return null
  const veg = ctx.choose('veg', ctx.pool((item) => isMainVeg(item) && !saladOnly.has(item.id) && (cookTime(item, 'boil') > 0 || cookTime(item, 'pan') > 0)), 3, true)
  if (veg.length < 2 && !(veg.length === 1 && starch.has(veg[0].id))) return null
  const aromatics = ctx.choose('aromatic', ctx.pool((item) => item.id === 'onion' || item.id === 'garlic'), 2)
  const finish = ctx.choose('finish', ctx.pool((item) => ['cream', 'cream-heavy', 'yogurt-greek', 'yogurt-natural', 'cream-cheese', 'coconut-milk'].includes(item.id)), 1, true)[0]
  const topping = ctx.choose('top', ctx.pool(isTopping), 1, true)[0]
  const blender = ctx.equipment.has('blender')
  const broth = ctx.owned.has('broth')
  const simmer = Math.max(...veg.map((item) => cookTime(item, 'boil') || cookTime(item, 'pan') + 4))
  const fat = fatFor(ctx)
  const steps: string[] = []
  const prep = prepStep([...veg, ...aromatics])
  if (prep) steps.push(prep)
  steps.push(heatStep(ctx, 'garnek'))
  const aromatic = aromaticStep(aromatics)
  if (aromatic) steps.push(aromatic)
  steps.push(`Dodaj ${joinList(veg.map((item) => item.acc))} i smaż 2 min. Wlej ${broth ? 'bulion' : 'gorącą wodę'} (ilość podana w składnikach), zagotuj, przykryj i gotuj ok. ${simmer} min, aż warzywa będą bardzo miękkie.`)
  steps.push(blender
    ? 'Zdejmij garnek z ognia i zblenduj zupę na gładki krem (blenderuj porcjami, napełniając naczynie najwyżej do połowy — gorąca zupa pryska).'
    : 'Rozgnieć część warzyw tłuczkiem lub widelcem wprost w garnku, aby zagęścić zupę — będzie rustykalna, z kawałkami.')
  if (finish) steps.push(`Wmieszaj ${finish.acc} i podgrzej, nie doprowadzając do wrzenia.`)
  steps.push(seasonText(ctx))
  if (topping) steps.push(topping.prep
    ? `Przed podaniem ${fill(topping.prep, topping).replace(/\.$/, '').replace(/^./, (letter) => letter.toLowerCase())} i dodaj do zupy.`
    : `Przed podaniem dodaj ${topping.acc}.`)
  const lines: DraftLine[] = [
    ...vegLines(veg, 260), ...aromaticLines(aromatics), L(broth ? 'broth' : 'water', 300), ...(finish ? [L(finish.id, finish.id === 'coconut-milk' ? 60 : 30)] : []),
    ...(topping ? [L(topping.id, proteinGrams(topping) > 40 ? 30 : proteinGrams(topping), true)] : []), ...(fat ? [L(fat.id, 8)] : []), ...seasoning(ctx),
  ]
  const head = blender ? 'krem' : 'zupa'
  const parts = veg.slice(0, 2).map((item) => item.gen)
  return {
    format: 'soup', style: 'herb', title: `${cap(head)} z ${joinList(parts)}`, subtitle: blender ? 'Aksamitny krem' : 'Rustykalna zupa',
    minutes: roundUp(prepTime([...veg, ...aromatics]) + 4 + simmer + 4), equipment: equipmentList('pot', blender && 'blender'), lines, steps,
    tips: ['Resztę zupy możesz zamrozić w porcjach — po rozmrożeniu smakuje tak samo.'],
    picks: { veg: veg.map((item) => item.id), aromatic: aromatics.map((item) => item.id), finish: finish ? [finish.id] : [], top: topping ? [topping.id] : [] },
    imageIds: veg.slice(0, 3).map((item) => item.id),
  }
}

function salad(ctx: Ctx): Draft | null {
  const veg = ctx.choose('veg', ctx.pool(isSaladVeg), 4, true)
  if (veg.length < 2) return null
  const rawPool = ctx.equipment.has('pan') ? ctx.pool((item) => isRawProtein(item) && item.category !== 'legume' && cookTime(item, 'pan') > 0 && !item.id.startsWith('minced')) : []
  const eggPool = ctx.equipment.has('pot') ? ctx.pool((item) => item.id === 'egg') : []
  const readyPool = ctx.pool(isReadyProtein)
  const proteins = [...readyPool, ...eggPool, ...rawPool]
  const main = ctx.choose('protein', proteins, 1, true)[0]
  const grainPool = ctx.equipment.has('pot') ? ctx.pool((item) => isGrain(item) && item.id !== 'lentils-red' && item.id !== 'lentils-green') : []
  const carb = ctx.choose('carb', ctx.prefs.mood === 'light' ? [] : grainPool, 1, true)[0]
  const dressing = ctx.owned.has('yogurt-greek') ? 'yogurt-greek' : ctx.owned.has('yogurt-natural') ? 'yogurt-natural' : null
  const oil = ctx.owned.has('olive-oil') ? get('olive-oil') : ctx.has('rapeseed-oil') ? get('rapeseed-oil') : null
  const acid = ctx.owned.has('lemon') ? get('lemon') : ctx.owned.has('balsamic-vinegar') ? get('balsamic-vinegar') : null
  const mustard = ctx.owned.has('mustard')
  const herbs = ctx.pool((item) => ['dill', 'parsley', 'chives', 'basil-dried'].includes(item.id))[0]
  const steps: string[] = []
  let cooked = 0
  if (carb) { steps.push(carbStep(carb)); cooked = 5 + cookTime(carb, 'boil') }
  if (main?.id === 'egg') { steps.push(`Ugotuj ${main.acc} na twardo (ok. 9 min we wrzącej wodzie), zalej zimną wodą, obierz i pokrój w ćwiartki.`); cooked = Math.max(cooked, 14) }
  else if (main && isRawProtein(main)) {
    steps.push(`${heatStep(ctx, 'patelnię')} ${searStep(main)} Odstaw na chwilę, a potem pokrój w paski.`)
    cooked = Math.max(cooked, cookTime(main, 'pan') + 4)
  }
  const prep = prepStep([...veg, main && main.id !== 'egg' && isReadyProtein(main) ? main : undefined, herbs])
  if (prep) steps.push(prep)
  const staples = ctx.prefs.staples ? ['solą', 'pieprzem'] : []
  const sauceBase = dressing ? get(dressing).acc : oil ? oil.acc : 'oliwę'
  const sauceWith = (dressing
    ? [herbs?.ins, acid ? `odrobiną ${acid.gen}` : undefined, ...staples]
    : [acid?.ins, mustard ? 'musztardą' : undefined, ...staples]).filter((part): part is string => Boolean(part))
  steps.push(`Sos: w małej miseczce wymieszaj ${sauceBase}${sauceWith.length ? ` z ${joinList(sauceWith)}` : ''}.`)
  steps.push(`Wymieszaj warzywa${carb ? ` z ${carb.ins}` : ''} w misce, dodaj ${main ? main.acc : 'ulubione dodatki'}, polej sosem i delikatnie wymieszaj. Podawaj od razu.`)
  const lines: DraftLine[] = [
    ...vegLines(veg, 220), ...(main ? [L(main.id, main.id === 'egg' ? 110 : proteinGrams(main), true)] : []), ...(carb ? [L(carb.id, 60, true)] : []),
    ...(dressing ? [L(dressing, 50)] : oil ? [L(oil.id, 10)] : []), ...(acid ? [L(acid.id, acid.id === 'lemon' ? 25 : 8)] : []), ...(mustard ? [L('mustard', 8)] : []),
    ...(herbs ? [L(herbs.id, 3, false, true)] : []), ...seasoning(ctx).slice(0, 2),
  ]
  const minutes = roundUp(prepTime(veg) + 3 + cooked)
  const head = carb ? 'miska' : 'sałatka'
  return {
    format: 'salad', style: acid?.id === 'lemon' ? 'lemon' : 'herb', title: withTitle(head, [...(main ? [main] : []), ...veg.slice(0, 2)]), subtitle: carb ? 'Sycąca miska' : 'Lekko i świeżo',
    minutes, equipment: equipmentList(Boolean(main && (isRawProtein(main))) && 'pan', Boolean(carb || main?.id === 'egg') && 'pot'), lines, steps,
    tips: ['Sosem polej sałatkę tuż przed jedzeniem — warzywa zostaną chrupiące.'],
    picks: { veg: veg.map((item) => item.id), protein: main ? [main.id] : [], carb: carb ? [carb.id] : [] },
    imageIds: [main, ...veg.slice(0, 3)].filter((item): item is Ingredient => Boolean(item)).map((item) => item.id),
  }
}

function wrap(ctx: Ctx): Draft | null {
  const base = ctx.choose('base', ctx.pool((item) => item.category === 'bread'), 1, true)[0]
  if (!base) return null
  const proteins = ctx.pool((item) => (isReadyProtein(item) && item.category !== 'legume') || item.id === 'hummus')
  const main = ctx.choose('protein', proteins, 1, true)[0]
  const veg = ctx.choose('veg', ctx.pool(isSaladVeg), 2, true)
  if (!main || (!veg.length && !ctx.pool((item) => item.category === 'cheese').length)) return null
  const sauce = ctx.choose('sauce', ctx.pool((item) => ['yogurt-greek', 'yogurt-natural', 'mayonnaise', 'mustard', 'ketchup', 'pesto', 'cream-cheese', 'hummus'].includes(item.id) && item.id !== main.id), 1, true)[0]
  const melters = ctx.pool((item) => ['mozzarella', 'cheese-yellow'].includes(item.id))
  const meltable = ['mozzarella', 'cheese-yellow'].includes(main.id) ? main : melters[0]
  const toast = Boolean(meltable) && (ctx.equipment.has('pan') || ctx.equipment.has('airfryer') || ctx.equipment.has('oven'))
  const addedCheese = toast && meltable && meltable.id !== main.id ? meltable : undefined
  const heat = toast ? (ctx.equipment.has('airfryer') ? 'airfryer' : ctx.equipment.has('oven') ? 'oven' : 'pan') : null
  const word = base.id === 'tortilla' ? 'wrap' : toast ? 'tost' : 'kanapka'
  const steps: string[] = []
  if (heat === 'oven') steps.push('Rozgrzej piekarnik do 200 °C.')
  const prep = prepStep([main, ...veg, addedCheese])
  if (prep) steps.push(prep)
  const surface = base.id === 'tortilla' ? 'tortilli' : base.id === 'bread-roll' ? 'przekrojonej bułce' : `kromkach ${base.gen}`
  if (sauce) steps.push(`Rozsmaruj ${sauce.acc} na ${surface}.`)
  steps.push(`Ułóż ${joinList([main, ...veg, ...(addedCheese ? [addedCheese] : [])].map((item) => item.acc))} ${sauce ? 'na wierzchu' : `na ${surface}`}.`)
  let minutes = prepTime([main, ...veg, addedCheese]) + 2
  let equipment: Equipment[] = []
  if (heat === 'airfryer') { steps.push('Złóż i podpiecz w air fryerze 4 min w 180 °C, aż ser się roztopi, a pieczywo lekko się zarumieni.'); equipment = ['airfryer']; minutes += 6 }
  else if (heat === 'oven') { steps.push('Złóż i zapiekaj w piekarniku ok. 8 min, aż ser się roztopi.'); equipment = ['oven']; minutes += 12 }
  else if (heat === 'pan') { steps.push('Złóż i opiekaj na suchej patelni po 2 min z każdej strony, aż ser się roztopi, a pieczywo się zarumieni.'); equipment = ['pan']; minutes += 6 }
  else steps.push(base.id === 'tortilla' ? 'Zwiń szczelnie, przekrój na pół i od razu podawaj.' : base.id === 'bread-roll' ? 'Przykryj drugą połówką bułki i od razu podawaj.' : 'Przykryj drugą kromką, przekrój na pół i od razu podawaj.')
  const slices = base.id === 'tortilla' ? (ctx.prefs.size === 'large' ? 2 : 1) : base.id === 'bread-roll' ? 1 : ctx.prefs.size === 'large' ? 3 : 2
  const lines: DraftLine[] = [
    L(base.id, slices * (base.piece ?? 35), true), L(main.id, main.id === 'hummus' ? 40 : proteinGrams(main), true), ...vegLines(veg, 100),
    ...(addedCheese ? [L(addedCheese.id, 30, true)] : []), ...(sauce ? [L(sauce.id, sauce.id === 'mustard' ? 8 : 20)] : []), ...(ctx.prefs.staples ? [L('pepper', 0.5, false, true)] : []),
  ]
  return {
    format: 'wrap', style: 'herb', title: withTitle(word, [main, ...veg.slice(0, 2)]), subtitle: toast ? 'Na ciepło, z roztopionym serem' : 'Bez gotowania',
    minutes: roundUp(minutes), equipment, lines, steps, tips: [], picks: { base: [base.id], protein: [main.id], veg: veg.map((item) => item.id), sauce: sauce ? [sauce.id] : [] },
    imageIds: [base, main, ...veg.slice(0, 2)].map((item) => item.id),
  }
}

function oats(ctx: Ctx): Draft | null {
  const flakes = ctx.pool((item) => item.id === 'oats')[0]
  if (!flakes) return null
  const method = ctx.equipment.has('microwave') ? 'microwave' : ctx.equipment.has('pot') ? 'pot' : null
  if (!method) return null
  const liquid = ['milk', 'kefir', 'yogurt-natural', 'yogurt-greek', 'skyr'].map((id) => ctx.pool((item) => item.id === id)[0]).filter(Boolean)
  const dairy = ctx.choose('dairy', liquid, 1, true)[0]
  const fruit = ctx.choose('fruit', ctx.pool((item) => item.category === 'fruit' && item.id !== 'lemon'), 2, true)
  const topping = ctx.choose('topping', ctx.pool((item) => ['peanut-butter', 'walnuts', 'almonds', 'sunflower-seeds', 'chia'].includes(item.id)), 1, true)[0]
  const sweet = ctx.choose('sweet', ctx.pool((item) => ['honey', 'jam', 'cinnamon', 'cocoa'].includes(item.id)), 2, true)
  if (!fruit.length && !topping && !sweet.length) return null
  const thick = Boolean(dairy && ['yogurt-natural', 'yogurt-greek', 'skyr'].includes(dairy.id))
  const steps: string[] = []
  const prep = prepStep(fruit)
  if (prep) steps.push(prep)
  const cooked = !dairy || thick
  steps.push(method === 'microwave'
    ? `W dużej misce wymieszaj ${flakes.acc} z ${cooked ? 'wodą' : dairy?.ins} (ilości w składnikach). Podgrzewaj w mikrofalówce 2–3 min, w połowie zamieszaj, i odstaw na minutę.`
    : `W garnku zagotuj ${cooked ? 'wodę' : dairy?.acc}, wsyp ${flakes.acc} i gotuj ok. 5 min na małym ogniu, często mieszając.`)
  if (thick && dairy) steps.push(`Lekko przestudź owsiankę i wmieszaj ${dairy.acc} — ciepła, ale nie wrząca, nie zważy się.`)
  steps.push(`Dodaj ${joinList([...fruit, ...(topping ? [topping] : []), ...sweet].map((item) => item.acc))} i od razu podawaj.`)
  const lines: DraftLine[] = [
    L(flakes.id, 50, true), ...(dairy ? [L(dairy.id, thick ? 100 : 180, true)] : []), ...(cooked ? [L('water', 200)] : []),
    ...fruit.map((item) => L(item.id, item.piece ?? 100, true)), ...(topping ? [L(topping.id, topping.id === 'peanut-butter' ? 15 : 15)] : []),
    ...sweet.map((item) => L(item.id, item.id === 'cinnamon' ? 1 : item.id === 'cocoa' ? 5 : 10, false, item.id === 'cinnamon')),
  ]
  const minutes = roundUp(prepTime(fruit) + (method === 'microwave' ? 4 : 8))
  return {
    format: 'oats', style: 'herb', title: withTitle('owsianka', [...fruit, ...(topping ? [topping] : [])].slice(0, 3)), subtitle: 'Ciepłe, słodkie śniadanie', minutes,
    equipment: [method], lines, steps, tips: ['Wieczorem możesz zalać płatki mlekiem lub jogurtem i zjeść rano na zimno.'],
    picks: { dairy: dairy ? [dairy.id] : [], fruit: fruit.map((item) => item.id), topping: topping ? [topping.id] : [], sweet: sweet.map((item) => item.id) },
    imageIds: [flakes, ...fruit, topping].filter((item): item is Ingredient => Boolean(item)).map((item) => item.id),
  }
}

function smoothie(ctx: Ctx): Draft | null {
  if (!ctx.equipment.has('blender')) return null
  const fruit = ctx.choose('fruit', ctx.pool((item) => item.category === 'fruit' && !['lemon', 'orange'].includes(item.id) || item.id === 'orange'), 2, true)
  if (!fruit.length) return null
  const base = ctx.choose('dairy', ctx.pool((item) => ['yogurt-natural', 'yogurt-greek', 'kefir', 'milk', 'skyr'].includes(item.id)), 1, true)[0]
  const boost = ctx.choose('boost', ctx.pool((item) => ['spinach', 'oats', 'peanut-butter', 'chia', 'honey', 'cocoa'].includes(item.id)), 2, true)
  const steps: string[] = []
  const prep = prepStep([...fruit, ...boost.filter((item) => item.id === 'spinach')])
  if (prep) steps.push(prep)
  steps.push(`Wrzuć do blendera ${joinList([...fruit, ...(base ? [base] : []), ...boost].map((item) => item.acc))}${base ? '' : ' i dolej szklankę wody'}.`)
  steps.push('Blenduj 40–60 sekund na gładko. Jeśli koktajl jest za gęsty, dolej odrobinę wody lub mleka. Podawaj od razu.')
  const lines: DraftLine[] = [
    ...fruit.map((item) => L(item.id, item.piece ?? 100, true)), ...(base ? [L(base.id, 150, true)] : [L('water', 200)]),
    ...boost.map((item) => L(item.id, item.id === 'spinach' ? 30 : item.id === 'oats' ? 25 : item.id === 'honey' ? 10 : item.id === 'cocoa' ? 5 : 15, item.id === 'oats')),
  ]
  return {
    format: 'smoothie', style: 'herb', title: withTitle('koktajl', [...fruit, ...(base ? [base] : [])].slice(0, 3)), subtitle: 'Gotowy w 5 minut', minutes: roundUp(prepTime(fruit) + 2),
    equipment: ['blender'], lines, steps, tips: ['Mrożone owoce zagęszczą koktajl i zastąpią lód.'],
    picks: { fruit: fruit.map((item) => item.id), dairy: base ? [base.id] : [], boost: boost.map((item) => item.id) },
    imageIds: [...fruit, base].filter((item): item is Ingredient => Boolean(item)).map((item) => item.id),
  }
}

function pancakes(ctx: Ctx): Draft | null {
  if (!ctx.equipment.has('pan')) return null
  const egg = ctx.pool((item) => item.id === 'egg')[0]
  const banana = ctx.pool((item) => item.id === 'banana')[0]
  const flour = ctx.pool((item) => item.id === 'oats' || item.id === 'flour-wheat')[0]
  if (!egg || !banana || !flour) return null
  const topping = ctx.choose('topping', ctx.pool((item) => ['yogurt-greek', 'yogurt-natural', 'skyr', 'honey', 'jam', 'strawberries', 'blueberries', 'raspberries', 'peanut-butter'].includes(item.id)), 2, true)
  const fat = fatFor(ctx)
  const steps = [
    `Obierz ${banana.acc} i rozgnieć widelcem na gładką masę. Wymieszaj z ${egg.ins} i ${flour.ins}${ctx.equipment.has('blender') ? ' (możesz też zblendować wszystko na gładkie ciasto)' : ''}. Odstaw na 5 min.`,
    `${heatStep(ctx, 'patelnię').replace('na średnim ogniu', 'na małym ogniu')}`,
    'Nakładaj ciasto łyżką i smaż placuszki po 2–3 min z każdej strony, aż się zarumienią i będą ścięte w środku.',
    topping.length ? `Podawaj z ${joinList(topping.map((item) => item.ins))}.` : 'Podawaj ciepłe.',
  ]
  const lines: DraftLine[] = [
    L(banana.id, 120, true), L(egg.id, 55, true), L(flour.id, 40, true), ...topping.map((item) => L(item.id, ['honey', 'jam'].includes(item.id) ? 10 : 60)), ...(fat ? [L(fat.id, 5)] : []),
  ]
  return {
    format: 'pancakes', style: 'herb', title: `Placuszki bananowe${topping.length ? ` z ${joinList(topping.map((item) => item.ins))}` : ''}`, subtitle: 'Bez cukru, na patelni',
    minutes: roundUp(prepTime([banana]) + 5 + 8), equipment: ['pan'], lines, steps, tips: ['Smaż na małym ogniu — placuszki z bananem łatwo się przypalają.'],
    picks: { topping: topping.map((item) => item.id) }, imageIds: [banana, egg, ...topping].map((item) => item.id),
  }
}

export type FormatDefinition = { id: DishFormat; sweet: boolean; moods: readonly Mood[]; share: number; compose: (ctx: Ctx) => Draft | null }

export const formats: readonly FormatDefinition[] = [
  { id: 'skillet', sweet: false, moods: ['any', 'protein', 'warm'], share: 1, compose: skillet },
  { id: 'bake', sweet: false, moods: ['warm', 'protein', 'any'], share: 1, compose: bake },
  { id: 'onepot', sweet: false, moods: ['warm', 'any'], share: 1, compose: onepot },
  { id: 'eggs', sweet: false, moods: ['protein', 'light', 'any'], share: 0.85, compose: eggs },
  { id: 'soup', sweet: false, moods: ['warm', 'light'], share: 0.8, compose: soup },
  { id: 'salad', sweet: false, moods: ['light', 'protein'], share: 0.85, compose: salad },
  { id: 'wrap', sweet: false, moods: ['light', 'protein', 'any'], share: 0.9, compose: wrap },
  { id: 'oats', sweet: true, moods: ['sweet'], share: 0.8, compose: oats },
  { id: 'smoothie', sweet: true, moods: ['sweet', 'light'], share: 0.6, compose: smoothie },
  { id: 'pancakes', sweet: true, moods: ['sweet'], share: 0.8, compose: pancakes },
]
