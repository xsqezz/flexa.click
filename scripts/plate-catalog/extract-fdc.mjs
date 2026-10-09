import { writeFileSync } from 'node:fs'
import { eachRow } from './csv.mjs'
import { chainOf, dishGroup, srGroup, wweiaGroup } from './groups.mjs'

/**
 * Reads the USDA FoodData Central "Survey (FNDDS)" and "SR Legacy" CSV exports (public domain) and writes the plate records
 * that are worth recognising: prepared dishes, fast food, restaurant food, common cooked and ready-to-eat foods.
 *
 * usage: node scripts/plate-catalog/extract-fdc.mjs <survey dir> <sr legacy dir> <out.json>
 */
const [, , surveyDir, srDir, outFile] = process.argv
if (!surveyDir || !srDir || !outFile) throw new Error('usage: extract-fdc.mjs <survey dir> <sr legacy dir> <out.json>')

const nutrientIds = {
  1008: 'kcal', 2047: 'kcal2', 1003: 'protein', 1005: 'carbs', 1004: 'fat', 1079: 'fiber', 1018: 'alcohol',
  // The survey export refers to nutrients by their old numbers.
  208: 'kcal', 957: 'kcal2', 203: 'protein', 205: 'carbs', 204: 'fat', 291: 'fiber', 221: 'alcohol',
}
const ignoredUnits = /\b(fl oz|oz|ounce|tablespoon|teaspoon|tbsp|tsp|pound|lb|gram|quart|pint|cubic|dash|pinch|liter|litre|ml)\b/i
const pieceNouns = /\b(sandwich|burger|burrito|taco|slice|piece|patty|nugget|fillet|cookie|doughnut|donut|pancake|waffle|egg|roll|bun|bagel|muffin|biscuit|link|strip|wing|drumstick|stick|bar|cake|pie|pretzel|cracker|dumpling|meatball|sausage|tortilla|taquito|croissant|pastry|brownie|cupcake|slider|wrap|enchilada|tamale|egg roll|pizza)\b/i

async function readNutrients(dir, ids) {
  const map = new Map()
  await eachRow(`${dir}/food_nutrient.csv`, (row) => {
    const key = nutrientIds[row.nutrient_id]
    if (!key || !ids.has(row.fdc_id)) return
    const entry = map.get(row.fdc_id) ?? {}
    entry[key] = Number(row.amount)
    map.set(row.fdc_id, entry)
  })
  return map
}

async function readPortions(dir, ids, units) {
  const map = new Map()
  await eachRow(`${dir}/food_portion.csv`, (row) => {
    if (!ids.has(row.fdc_id)) return
    const grams = Number(row.gram_weight)
    if (!(grams > 0)) return
    const amount = Number(row.amount) > 0 ? Number(row.amount) : 1
    const unit = units.get(row.measure_unit_id) ?? ''
    const text = [row.portion_description, unit === 'undetermined' ? '' : unit, row.modifier].filter((part) => part && !/^\d+$/.test(part)).join(' ').trim()
    if (/not specified|nfs/i.test(text) || ignoredUnits.test(text)) return
    const list = map.get(row.fdc_id) ?? []
    list.push({ seq: Number(row.seq_num) || 99, grams: grams / amount, text: text || 'serving' })
    map.set(row.fdc_id, list)
  })
  for (const list of map.values()) list.sort((a, b) => a.seq - b.seq)
  return map
}

const units = new Map()
await eachRow(`${surveyDir}/measure_unit.csv`, (row) => units.set(row.id, row.name))

const round = (value, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits

const excluded = /miniature|bite size|guideline|crumbs|packet|school|per inch|\b1\/\d|quarter|half\b|thin|skin from|\bchip\b|cracker|\bpat\b|spear|\bring\b|\bleaf\b|sprig|clove|wedge|stick of|sample|nugget, small|mini\b|piece, small|round|individual/i
const preference = [
  /\b(regular|medium)\b/i,
  /\b(sandwich|burger|burrito|taco|bowl|plate|serving|item|each|order|entree|dinner)\b/i,
  /\bcup\b/i,
  /\b(bottle|can|glass|container|carton|cone)\b/i,
  /\b(fillet|patty|piece|slice|cookie|doughnut|donut|roll|muffin|egg|wing|drumstick|link|bar|nugget|pancake|waffle)\b/i,
]

/** Typical single serving plus an optional piece weight and small/large variants when the source lists them. */
function choosePortion(list, group) {
  if (!list?.length) return null
  const usable = list.filter((entry) => !excluded.test(entry.text))
  const pool = usable.length ? usable : list
  let best = null
  for (const rule of preference) {
    best = pool.find((entry) => rule.test(entry.text))
    if (best) break
  }
  best ??= pool[0]
  if (group === 'veg' || group === 'fruit' || group === 'grain') best = pool.find((entry) => /\bcup\b/i.test(entry.text)) ?? best
  let { grams, text } = best
  const inch = /(\d*)\s*inch sub/i.test(text)
  if (inch) { grams *= 6; text = '6 inch sub' }
  const small = pool.find((entry) => /\bsmall\b/i.test(entry.text) && entry.grams < grams)
  const large = pool.find((entry) => /\blarge\b/i.test(entry.text) && entry.grams > grams)
  const piece = pieceNouns.test(text) && !/\bcup\b/i.test(text)
  return { grams, text, piece, sizes: small && large ? [small.grams, grams, large.grams] : null }
}

function toRecord({ id, source, fdc, name, group, nutrients, portions, brand, region }) {
  const kcal = nutrients?.kcal ?? nutrients?.kcal2
  if (!Number.isFinite(kcal) || kcal < 0 || kcal > 900) return null
  const protein = nutrients.protein ?? 0
  const carbs = nutrients.carbs ?? 0
  const fat = nutrients.fat ?? 0
  const fiber = nutrients.fiber ?? 0
  const alcohol = nutrients.alcohol ?? 0
  if (protein + carbs + fat + alcohol > 105) return null
  const portion = choosePortion(portions, group)
  const drink = group === 'drink' || group === 'alcohol'
  const grams = portion ? portion.grams : drink ? 240 : 100
  if (grams < 3 || grams > 1500) return null
  return {
    id, source, fdc, name, ...(brand ? { brand, region } : {}), group,
    per100: [round(kcal, 0), round(protein), round(carbs), round(fat), round(fiber)],
    ...(alcohol > 0 ? { alcohol: round(alcohol) } : {}),
    portion: { grams: round(grams, 0), text: portion?.text ?? '', piece: portion?.piece ?? false, ...(portion?.sizes ? { sizes: portion.sizes.map((value) => round(value, 0)) } : {}) },
  }
}

const records = []

/** American retail brands that mean nothing on a Polish plate; the generic record of the same food is kept instead. */
const retailBrand = /\b(pillsbury|kellogg|kraft|nabisco|pepperidge|lean pockets|hot pockets|quaker|general mills|betty crocker|hershey|nestle|campbell|progresso|heinz|jimmy dean|oscar mayer|tyson|hormel|birds eye|stouffer|marie callender|healthy choice|weight watchers|entenmann|little debbie|keebler|pringles|doritos|cheetos|fritos|ruffles|tostitos|oreo|snickers|jell-o|gatorade|powerade|starbucks|ensure|boost|slim fast|carnation|bisquick|hamburger helper|rice-a-roni|lunchables|cracker barrel|boston market|hooters|ruby tuesday|chili's|cheesecake factory|bob evans|golden corral|ponderosa)\b/i

// FNDDS: one record per survey food, grouped by WWEIA category.
const surveyIds = new Map()
await eachRow(`${surveyDir}/survey_fndds_food.csv`, (row) => surveyIds.set(row.fdc_id, row.wweia_category_number))
const surveyNames = new Map()
await eachRow(`${surveyDir}/food.csv`, (row) => { if (surveyIds.has(row.fdc_id)) surveyNames.set(row.fdc_id, row.description) })
const surveyWanted = new Set([...surveyIds].filter(([, category]) => wweiaGroup(category)).map(([id]) => id))
const surveyNutrients = await readNutrients(surveyDir, surveyWanted)
const surveyPortions = await readPortions(surveyDir, surveyWanted, units)
for (const fdc of surveyWanted) {
  const name = surveyNames.get(fdc)
  const group = wweiaGroup(surveyIds.get(fdc))
  const record = toRecord({ id: `fn-${fdc}`, source: 'fndds', fdc, name, group, nutrients: surveyNutrients.get(fdc), portions: surveyPortions.get(fdc) })
  if (record) records.push(record)
}

// SR Legacy: fast food, restaurant food and selected cooked or ready foods.
const srRows = new Map()
await eachRow(`${srDir}/food.csv`, (row) => srRows.set(row.fdc_id, row))
const srWanted = new Map()
for (const [fdc, row] of srRows) {
  const category = Number(row.food_category_id)
  const brand = chainOf(row.description)
  if (category === 21 || category === 25) {
    if (/baby|infant/i.test(row.description)) continue
    srWanted.set(fdc, { group: dishGroup(row.description), brand, fast: true })
    continue
  }
  const group = srGroup(category, row.description)
  if (group && !retailBrand.test(row.description) && !/\b[A-Z]{4,}\b/.test(row.description.replace(/\b(USDA|NFS|NS|BBQ|PEI)\b/g, ''))) srWanted.set(fdc, { group, brand: null })
}
const srIds = new Set(srWanted.keys())
const srNutrients = await readNutrients(srDir, srIds)
const srPortions = await readPortions(srDir, srIds, units)
for (const [fdc, meta] of srWanted) {
  const row = srRows.get(fdc)
  let name = row.description
  if (meta.brand) name = name.replace(/^[^,]*?(mcdonald'?s|burger king|kfc|wendy'?s|taco bell|subway|pizza hut|domino'?s|little caesars?|popeyes|chick-fil-a|arby'?s|papa john'?s|denny'?s|applebee'?s|olive garden)[^,]*,?\s*/i, '').trim() || name
  const record = toRecord({
    id: `sr-${fdc}`, source: 'sr-legacy', fdc, name, group: meta.group, nutrients: srNutrients.get(fdc), portions: srPortions.get(fdc),
    brand: meta.brand ?? undefined, region: meta.brand ? 'US' : undefined,
  })
  if (record) records.push(record)
}

writeFileSync(outFile, JSON.stringify(records))
const byGroup = {}
for (const record of records) byGroup[record.group] = (byGroup[record.group] ?? 0) + 1
console.log(records.length, 'records', byGroup, 'brand', records.filter((r) => r.brand).length)
