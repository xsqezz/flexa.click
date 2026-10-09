import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { dishGroup, spreadOf } from './groups.mjs'

/**
 * Builds the plate catalogue the app ships: USDA records with Polish names, official menu items of three chains in Poland,
 * and a hand-curated list of Polish and international dishes.
 *
 * usage: node scripts/plate-catalog/assemble.mjs <work dir with draft-fdc.json, chains/, translate/out/>
 * writes: shared/meal-scan/data/catalog.json and shared/meal-scan/anchors.ts
 */
const [, , work] = process.argv
if (!work) throw new Error('usage: assemble.mjs <work dir>')

const readTsv = (dir, filter) => {
  const map = new Map()
  for (const file of readdirSync(dir).filter(filter).sort()) {
    for (const line of readFileSync(`${dir}/${file}`, 'utf8').split(/\r?\n/)) {
      const at = line.indexOf('\t')
      if (at > 0) map.set(line.slice(0, at), line.slice(at + 1).trim())
    }
  }
  return map
}

const round = (value, digits = 0) => Math.round(value * 10 ** digits) / 10 ** digits
const clampPieces = (grams) => Math.min(8, Math.max(2, Math.round(100 / grams)))

function sizesFrom(medium, given) {
  let [s, m, l] = given ?? [medium * 0.7, medium, medium * 1.4]
  s = Math.max(1, round(s)); m = Math.max(s + 1, round(m)); l = Math.max(m + 1, round(l))
  return [s, m, l]
}

const rows = []
const problems = []
const ids = new Set()
const add = (row) => {
  if (ids.has(row.i)) return problems.push(`duplicate id ${row.i}`)
  const [kcal, protein, carbs, fat, fiber] = row.p
  const atwater = 4 * protein + 4 * carbs + 9 * fat - 2 * fiber + (row.alc ? 7 * row.alc : 0)
  if (!row.alc && Math.abs(kcal - atwater) > Math.max(30, 0.2 * kcal)) return problems.push(`dropped atwater ${row.i} ${row.n}: ${kcal} vs ${round(atwater)}`)
  ids.add(row.i)
  rows.push(row)
}

// 1. Official menus of McDonald's, Burger King and KFC in Poland.
const chains = JSON.parse(readFileSync(`${work}/chains/chains.ids.json`, 'utf8'))
const english = readTsv(`${work}/translate/out`, (file) => file === 'chains-en.tsv')
const anchors = {}
for (const record of chains) {
  const aliases = (english.get(record.id) ?? '').split('|').map((part) => part.trim()).filter(Boolean)
  if (!aliases.length) problems.push(`no english alias for ${record.id}`)
  const group = dishGroup(`${record.name} ${aliases.join(' ')}`)
  const drink = group === 'drink'
  add({
    i: record.id, n: record.name, e: aliases.join('|'), g: group, u: drink ? 'ml' : 'g',
    p: [record.per100.kcal, record.per100.protein, record.per100.carbs, record.per100.fat, record.per100.fiber],
    s: [record.grams, record.grams, record.grams], sp: 'tight', b: record.chain, r: 'PL', f: 1,
  })
  ;(anchors[record.chain] ??= []).push(aliases[0] ?? record.name)
}

// 2. USDA records.
const translations = readTsv(`${work}/translate/out`, (file) => /^fdc-\d+[a-z]?\.tsv$/.test(file))
const fdc = JSON.parse(readFileSync(`${work}/fdc/draft-fdc.json`, 'utf8'))
let untranslated = 0
for (const record of fdc) {
  const name = translations.get(record.id)
  if (!name) { untranslated += 1; continue }
  const group = record.alcohol >= 1 ? 'alcohol' : record.group
  const drink = group === 'drink' || group === 'alcohol'
  let grams = record.portion.grams
  let piece = null
  if (record.portion.piece) {
    piece = [grams, 'szt.']
    if (grams < 45) grams = grams * clampPieces(grams)
  }
  const row = {
    i: record.id, n: name, e: record.name, g: group, u: drink ? 'ml' : 'g', p: record.per100,
    s: sizesFrom(grams, record.portion.sizes && !piece ? record.portion.sizes : null), sp: spreadOf[group] ?? 'normal',
  }
  if (piece) row.pc = piece
  if (record.brand) { row.b = record.brand; row.r = record.region; row.sp = 'normal' }
  if (record.alcohol) row.alc = record.alcohol
  add(row)
}
if (untranslated) problems.push(`${untranslated} FDC records have no translation`)

// 3. Hand-curated Polish and international dishes.
const dishNames = []
const curatedFiles = existsSync(`${work}/translate/out`) ? readdirSync(`${work}/translate/out`).filter((file) => /^polish-dishes.*\.json$/.test(file)) : []
for (const file of curatedFiles) {
  for (const dish of JSON.parse(readFileSync(`${work}/translate/out/${file}`, 'utf8'))) {
    const english = (dish.en ?? []).filter((name) => /hot ?dog/i.test(dish.name) || !/^hot ?dogs?$/i.test(name))
    const row = { i: dish.id, n: dish.name, e: english.join('|'), g: dish.group, u: dish.unit ?? 'g', p: dish.per100, s: dish.sizes, sp: dish.spread ?? 'normal' }
    if (dish.piece) row.pc = dish.piece
    add(row)
    if (ids.has(row.i) && english[0]) dishNames.push(english[0])
  }
}

const output = 'shared/meal-scan/data/catalog.json'
mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, JSON.stringify({ version: 1, rows }))

const names = Object.entries(anchors).map(([brand, list]) => `  ${JSON.stringify(brand)}: ${JSON.stringify(list)},`).join('\n')
writeFileSync('shared/meal-scan/anchors.ts', `/** Generated by scripts/plate-catalog/assemble.mjs: menu names of the chains with official data and common dish names the photo model should prefer. */\nexport const chainMenuNames: Readonly<Record<string, readonly string[]>> = {\n${names}\n}\n\nexport const commonDishNames: readonly string[] = ${JSON.stringify([...new Set(dishNames)], null, 1).replace(/\n\s*/g, ' ')}\n`)

const byGroup = {}
for (const row of rows) byGroup[row.g] = (byGroup[row.g] ?? 0) + 1
console.log(rows.length, 'items', byGroup)
console.log(problems.length, 'problems')
console.log(problems.slice(0, 40).join('\n'))
