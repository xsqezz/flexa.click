import { readFileSync } from 'node:fs'
import { describePhoto } from '../../shared/kitchen/ai.ts'
import { parsePlateText, platePrompt } from '../../shared/meal-scan/ai.ts'
import { registerCatalogRows } from '../../shared/meal-scan/library.ts'
import { matchDescriptor } from '../../shared/meal-scan/match.ts'

/**
 * Runs the plate prompt on real photos with the same Workers AI models the app uses and checks that the catalogue lookup
 * finds the expected items. Needs CF_ACCOUNT_ID and CF_API_TOKEN (Workers AI) in the environment.
 *
 * usage: node scripts/plate-catalog/eval-vision.mjs <image dir> [slug ...]
 */
const [, , dir, ...only] = process.argv
const account = process.env.CF_ACCOUNT_ID
const token = process.env.CF_API_TOKEN
if (!dir || !account || !token) throw new Error('usage: CF_ACCOUNT_ID=… CF_API_TOKEN=… node eval-vision.mjs <image dir> [slug ...]')

registerCatalogRows(JSON.parse(readFileSync('shared/meal-scan/data/catalog.json', 'utf8')).rows)

const ai = {
  async run(model, input) {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`, {
      method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(input),
    })
    const body = await response.json()
    if (!body.success) throw new Error(JSON.stringify(body.errors))
    return body.result
  },
}

const cases = {
  bigmac: [/Big Mac/],
  whopper: [/Whopper/],
  'kfc-bucket': [/(Kentucky|panierce|Kurczak)/i],
  'mcd-meal': [/(McMuffin|Sausage|Hamburger|Burger)/i, /(Frytki|fries)/i, /(cola|napój|Coca|soda)/i],
  pierogi: [/Pierogi/],
  bigos: [/Bigos/],
  schabowy: [/schabowy/i, /(ziemniak|Puree)/i, /(Surówka|sałat|kapust|marchew)/i],
  zurek: [/Żurek/],
  pizza: [/(pizza|margherita)/i],
  kebab: [/Kebab/],
  sushi: [/Sushi/],
  ramen: [/Ramen/],
  bolognese: [/(Spaghetti|Makaron)/i],
  caesar: [/(Fettuccine|Alfredo|Makaron)/i],
  'english-breakfast': [/(Jajk|Jajec)/i, /(Bekon|Boczek)/i, /(Kiełbas|Parówk)/i, /(Fasol|fasol)/i, /(Tost|Chleb)/i],
  pancakes: [/(Naleśnik|pancake)/i],
  nuggets: [/McNuggets/],
  hotdog: [/Hot dog/i],
  burrito: [/Burrito/],
  padthai: [/Pad thai/i],
  cheeseburger: [/(Cheeseburger|burger)/i, /Frytki/i, /(ogórek|pikle|Ogórki)/i],
  doughnuts: [/(Pączek|Donut)/i],
  wings: [/Skrzyd/i],
  salmon: [/Łosoś/i, /(dyni|Warzywa)/i],
  fishchips: [/(Ryba|Fish)/i, /Frytki/i, /(groszek|Groch)/i],
  'bk-meal': [/(burger|Burger)/],
  gołąbki: [/Gołąbki/i],
}

let hit = 0
let total = 0
let found = 0
let listed = 0
for (const [slug, expected] of Object.entries(cases)) {
  if (only.length && !only.includes(slug)) continue
  let file
  try { file = readFileSync(`${dir}/${slug}.jpg`) } catch { continue }
  const url = `data:image/jpeg;base64,${file.toString('base64')}`
  let text
  try { text = await describePhoto(ai, url, platePrompt(), 700) } catch (error) { console.log(`\n## ${slug}: model failed ${error.message}`); continue }
  const findings = parsePlateText(text)
  const resolved = findings.map((finding) => ({ finding, match: matchDescriptor(finding, 3) }))
  const names = resolved.flatMap(({ match }) => match.candidates.slice(0, 3).map((candidate) => `${candidate.item.name} ${candidate.item.brand ?? ''} ${(candidate.item.en ?? []).join(' ')}`))
  console.log(`\n## ${slug}`)
  for (const { finding, match } of resolved) {
    const top = match.candidates[0]
    console.log(`  ${finding.name}${finding.brand ? ` @${finding.brand}` : ''}${finding.size ? ` ${finding.size}` : ''}${finding.count ? ` x${finding.count}` : ''}  =>  [${match.confidence}] ${top ? `${top.item.name}${top.item.brand ? ` (${top.item.brand})` : ''} ${top.score.toFixed(2)}` : '—'}`)
  }
  const topOnly = resolved.map(({ match }) => match.candidates[0] ? `${match.candidates[0].item.name} ${match.candidates[0].item.brand ?? ''} ${(match.candidates[0].item.en ?? []).join(' ')}` : '')
  for (const pattern of expected) {
    total += 1
    const top1 = topOnly.some((value) => pattern.test(value))
    const top3 = names.some((value) => pattern.test(value))
    if (top1) hit += 1
    if (top3) found += 1
    console.log(`  expect ${pattern}: ${top1 ? 'TOP-1' : top3 ? 'in top-3' : 'MISSING'}`)
  }
  listed += findings.length
}
console.log(`\nexpected items: ${total}, top-1 ${hit} (${Math.round(100 * hit / total)}%), top-3 ${found} (${Math.round(100 * found / total)}%); items listed by the model: ${listed}`)
