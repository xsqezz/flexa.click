import { readFileSync, writeFileSync } from 'node:fs'

/**
 * Parses official Polish nutrition tables of three chains (text extracted from their published PDFs with pdf.js) into plate records.
 * Values are per 100 g plus the weight of one portion, exactly as the chain publishes them.
 *
 * usage: node scripts/plate-catalog/parse-chains.mjs <dir with mcd.txt bk.txt kfc.txt> <out.json>
 */
const [, , dir, outFile] = process.argv
if (!dir || !outFile) throw new Error('usage: parse-chains.mjs <dir> <out.json>')

const num = (text) => Number(String(text).replace(',', '.').replace(/[^\d.\-]/g, ''))
const isNum = (text) => /^-?\d+(?:[.,]\d+)?%?$/.test(text.trim())
const clean = (name) => name.replace(/[®™©]/g, '').replace(/\s+/g, ' ').trim()
const round = (value, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits

const records = []
const push = (chain, name, category, grams, per100, source) => {
  const [kcal, fat, sat, carbs, sugar, protein, salt, fiber] = per100
  if (![kcal, fat, carbs, protein].every((value) => Number.isFinite(value)) || !(grams > 0)) return
  records.push({
    chain, name: clean(name), category, grams: round(grams, 0), source,
    per100: { kcal: round(kcal, 0), protein: round(protein), carbs: round(carbs), fat: round(fat), fiber: round(fiber ?? 0), sugar: round(sugar ?? 0), sat: round(sat ?? 0), salt: round(salt ?? 0, 2) },
  })
}

// --- McDonald's Polska: 27 numbers per product: kJ, kcal, fat, saturated, carbs, sugars, fibre, protein, salt, each as 100 g / portion / %RI.
{
  const lines = readFileSync(`${dir}/mcd.txt`, 'utf8').split(/\r?\n/)
  let category = ''
  let pending = ''
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('###')) continue
    const cells = line.split(' ; ')
    const name = cells[0]
    const rest = cells.slice(1).join(' ').split(/[\s;]+/).filter(Boolean)
    const numbers = rest.filter(isNum)
    if (!isNum(name) && numbers.length === 0 && rest.length === 0) {
      if (/^[A-ZĄĆĘŁŃÓŚŹŻ0-9 &\-]{4,}$/.test(name) && !/^(RI|ENERGIA|TABELA)/.test(name)) category = name
      else pending = pending ? `${pending} ${name}` : name
      continue
    }
    if (numbers.length < 24 || isNum(name)) continue
    const label = pending ? `${pending} ${name}` : name
    pending = ''
    const n = numbers.map(num)
    // Fibre has no %RI in some rows, so protein and salt are read from the end of the row.
    const per = { kcal: n[3], fat: n[6], sat: n[9], carbs: n[12], sugar: n[15], fiber: n[18], protein: n[n.length - 6], salt: n[n.length - 3] }
    const portionKcal = n[4]
    if (!(per.kcal > 0) && !(portionKcal > 0)) continue
    const grams = per.kcal > 0 ? portionKcal / per.kcal * 100 : null
    if (!grams || !Number.isFinite(grams)) continue
    push("McDonald's", label, category, grams, [per.kcal, per.fat, per.sat, per.carbs, per.sugar, per.protein, per.salt, per.fiber], 'mcdonalds.pl nutrition table (PDF)')
  }
}

// --- Burger King Polska: name; portion; kJ; kcal; fat; sat; carbs; sugars; protein; salt (per portion), then a "na 100g" row.
{
  const text = readFileSync(`${dir}/bk.txt`, 'utf8')
  const tokens = text.split(/\r?\n/).flatMap((line) => line.split(' ; ')).map((token) => token.trim()).filter(Boolean)
  let category = ''
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]
    if (isNum(token) || /^(X|\?|na 100g|PRODUKT|###.*)$/i.test(token)) continue
    const values = []
    let j = i + 1
    while (j < tokens.length && isNum(tokens[j]) && values.length < 9) values.push(num(tokens[j++]))
    if (values.length < 9) {
      if (/^[A-ZĄĆĘŁŃÓŚŹŻ ]{4,}$/.test(token)) category = token
      continue
    }
    // The table interleaves two columns, so the "na 100g" rows cannot be paired reliably; per-100 values are derived from the portion.
    const [grams, , kcal, fat, sat, carbs, sugar, protein, salt] = values
    const per = { kcal: kcal / grams * 100, fat: fat / grams * 100, sat: sat / grams * 100, carbs: carbs / grams * 100, sugar: sugar / grams * 100, protein: protein / grams * 100, salt: salt / grams * 100 }
    push('Burger King', token, category, grams, [per.kcal, per.fat, per.sat, per.carbs, per.sugar, per.protein, per.salt], 'burgerking.pl nutrition table (PDF)')
    i = j - 1
  }
}

// --- KFC Polska: name; portion weight; kJ/100 g; kJ/portion; kcal/100 g; kcal/portion; RI; fat 100/portion/RI; saturated; carbs; sugars; protein; salt.
{
  const lines = readFileSync(`${dir}/kfc.txt`, 'utf8').split(/\r?\n/)
  let category = ''
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('###')) continue
    const cells = line.split(' ; ')
    const name = cells[0]
    const numbers = cells.slice(1).filter((cell) => isNum(cell))
    const isRow = !isNum(name) && cells.length > 12 && numbers.length >= 22
    if (!isRow) {
      if (cells.length === 1 && !isNum(name) && name.length > 3 && !/^(Średnia|waga|porcji|Wartość|Energy|soja|weight|of|porcja|portion|\(g\)|\[|Averag|e$|\[g\])/.test(name)) category = clean(name.replace(/\/.*$/, ''))
      continue
    }
    const n = numbers.map(num)
    const [grams, , , kcal100, , , fat100, , , sat100, , , carb100, , , sugar100, , , protein100, , , salt100] = n
    push('KFC', name.replace(/^([^/]+)\/.*$/, '$1'), category, grams, [kcal100, fat100, sat100, carb100, sugar100, protein100, salt100], 'kfc.pl nutrition table 2026-09-29 (PDF)')
  }
}

const dropName = /^(DESERY|PRZEGRYZKI|Cebula|Pomidor|Pikle|Papryczki|Rukola|Sałata lodowa|Ser cheddar|Jajko sadzone|Bekon$|Mięso wieprzowe|Burger wołowy|Kurczak panierowany|Musztarda$|Sos majonezowy|Sos pikantny z zielonym|Sos musztardowo|Sos pomidorowy z cebulą|Sos Honey|Sos Sesame|Syrop|Grzanki|Kukurydza|Jalapeno|Cebulka|Czerwona cebulka|Ser$|Avokado|Doritos$|Topping|Sos czekoladowy|Sos truskawkowy|Sos karmelowy|Sos żurawinowy|Chocolate sauce|churros$|bazie|marshmallow|czekoladowym|karmelowym|truskawkowym|bitą śmietaną|i bitą|Pancakes \(\d)/i

function finalize(list) {
  const kept = []
  const seen = new Set()
  let kfcChicken = 0
  for (const record of list) {
    let name = record.name.replace(/^.*RI \(%\)\s*/, '').replace(/\*+$/, '').trim()
    const { kcal, protein, carbs, fat } = record.per100
    const mismatch = Math.abs(kcal - (4 * protein + 4 * carbs + 9 * fat)) > Math.max(25, 0.18 * kcal)
    if (mismatch || /\d{3,}/.test(name) || /^[a-ząćęłńóśźż(]/.test(name) || dropName.test(name) || name.length < 3) continue
    if (record.chain === 'KFC' && record.category.toLowerCase() === 'chicken' && /^(Nóżka|Pierś|Żebro|Udko|Skrzydło|Skrzydełko)$/.test(name)) {
      name = `Kurczak ${kfcChicken < 5 ? 'Kentucky' : 'Hot & Spicy'} – ${name.toLowerCase()}`
      kfcChicken += 1
    }
    if (record.chain === 'KFC' && /^Duże Frytki$/.test(name)) name = 'Frytki duże'
    const key = `${record.chain}|${name}|${record.grams}`
    if (seen.has(key)) continue
    seen.add(key)
    kept.push({ ...record, name })
  }
  return kept
}

const finalRecords = finalize(records)
writeFileSync(outFile, JSON.stringify(finalRecords, null, 1))
const by = {}
for (const record of finalRecords) by[record.chain] = (by[record.chain] ?? 0) + 1
console.log(by, 'dropped', records.length - finalRecords.length)
