import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dishGroup } from './groups.mjs'

/**
 * Splits the extracted records into small files for translation: FDC names (English to Polish) and
 * chain product names (Polish to the English names a vision model would use).
 *
 * usage: node scripts/plate-catalog/prepare-translation.mjs <draft-fdc.json> <chains.json> <out dir> [chunk size]
 */
const [, , fdcFile, chainsFile, outDir, size = '500'] = process.argv
if (!fdcFile || !chainsFile || !outDir) throw new Error('usage: prepare-translation.mjs <draft-fdc.json> <chains.json> <out dir> [chunk size]')
mkdirSync(outDir, { recursive: true })

const slug = (text) => text.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const fdc = JSON.parse(readFileSync(fdcFile, 'utf8'))
const lines = fdc.map((record) => `${record.id}\t${record.brand ? `[${record.brand}] ` : ''}${record.name}`)
const chunk = Number(size)
let index = 0
for (let start = 0; start < lines.length; start += chunk) {
  writeFileSync(`${outDir}/fdc-${String(index).padStart(2, '0')}.tsv`, `${lines.slice(start, start + chunk).join('\n')}\n`)
  index += 1
}

const prefix = { "McDonald's": 'mcd', 'Burger King': 'bk', KFC: 'kfc' }
const chains = JSON.parse(readFileSync(chainsFile, 'utf8'))
const chainLines = []
const seen = new Set()
for (const record of chains) {
  let id = `${prefix[record.chain]}-${slug(record.name)}`
  while (seen.has(id)) id += '-2'
  seen.add(id)
  record.id = id
  chainLines.push(`${id}\t${record.chain}\t${record.name}\t${dishGroup(record.name)}`)
}
writeFileSync(`${outDir}/chains.tsv`, `${chainLines.join('\n')}\n`)
writeFileSync(chainsFile.replace(/\.json$/, '.ids.json'), JSON.stringify(chains))
console.log(`${fdc.length} FDC names in ${index} files, ${chains.length} chain names`)
