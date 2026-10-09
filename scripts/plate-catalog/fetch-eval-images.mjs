import { mkdirSync, writeFileSync } from 'node:fs'

/**
 * Downloads one freely licensed photo per search from Wikimedia Commons for the vision evaluation.
 * usage: node scripts/plate-catalog/fetch-eval-images.mjs <out dir>
 */
const [, , outDir] = process.argv
if (!outDir) throw new Error('usage: fetch-eval-images.mjs <out dir>')
mkdirSync(outDir, { recursive: true })

const searches = [
  ['bigmac', 'Big Mac burger McDonald\'s'], ['whopper', 'Whopper Burger King burger'], ['kfc-bucket', 'KFC bucket fried chicken'], ['mcd-fries', 'McDonald\'s french fries carton'],
  ['mcd-meal', 'McDonald\'s meal burger fries drink tray'], ['pierogi', 'pierogi ruskie plate'], ['bigos', 'bigos Polish stew'], ['schabowy', 'kotlet schabowy z ziemniakami i surówką'],
  ['zurek', 'żurek z jajkiem i kiełbasą'], ['pizza', 'pizza margherita'], ['kebab', 'doner kebab sandwich'], ['sushi', 'sushi platter'], ['ramen', 'ramen bowl'],
  ['bolognese', 'spaghetti bolognese plate'], ['caesar', 'caesar salad with chicken'], ['english-breakfast', 'full English breakfast plate'], ['pancakes', 'pancakes with syrup plate'],
  ['nuggets', 'chicken nuggets McDonald\'s'], ['hotdog', 'hot dog with mustard'], ['burrito', 'burrito plate'], ['padthai', 'pad thai'], ['cheeseburger', 'cheeseburger and french fries'],
  ['doughnuts', 'doughnuts box'], ['wings', 'chicken wings plate'], ['salmon', 'grilled salmon with vegetables plate'], ['fishchips', 'fish and chips'], ['bk-meal', 'Burger King meal tray'],
  ['gołąbki', 'gołąbki w sosie pomidorowym'],
]

const headers = { 'user-agent': 'FlexaEval/1.0 (https://flexa-click.pages.dev; nutrition app evaluation)' }
const rows = []
for (const [slug, query] of searches) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=12&gsrsearch=${encodeURIComponent(`${query} filetype:bitmap`)}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1024`
  const result = await (await fetch(url, { headers })).json()
  const pages = Object.values(result.query?.pages ?? {}).sort((a, b) => a.index - b.index)
  const pick = pages.find((page) => { const info = page.imageinfo?.[0]; return info?.mime === 'image/jpeg' && info.width >= 700 && info.height >= 500 })
  if (!pick) { console.log('no image for', slug); continue }
  const info = pick.imageinfo[0]
  const bytes = Buffer.from(await (await fetch(info.thumburl ?? info.url, { headers })).arrayBuffer())
  writeFileSync(`${outDir}/${slug}.jpg`, bytes)
  rows.push({ slug, title: pick.title, license: info.extmetadata?.LicenseShortName?.value ?? '', bytes: bytes.length })
  console.log(slug, pick.title, bytes.length)
  await new Promise((resolve) => setTimeout(resolve, 600))
}
writeFileSync(`${outDir}/index.json`, JSON.stringify(rows, null, 1))
