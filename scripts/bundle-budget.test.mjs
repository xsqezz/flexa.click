import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { gzipSync } from 'node:zlib'

const assets = join(import.meta.dirname, '..', 'app', 'dist', 'assets')
const built = existsSync(assets)

// Gzipped ceilings with some headroom over the current build; raise them deliberately, not by accident.
const budgets = [
  { name: 'entry script', pattern: /^index-.*\.js$/, maxKb: 300 },
  { name: 'stylesheet', pattern: /^index-.*\.css$/, maxKb: 30 },
  { name: 'lazy food catalogue', pattern: /^catalog-.*\.js$/, maxKb: 340 },
  { name: 'Smart Kuchnia', pattern: /^KitchenPage-.*\.js$/, maxKb: 40 },
  { name: 'Skan posiłku', pattern: /^ScanPage-.*\.js$/, maxKb: 30 },
]

for (const { name, pattern, maxKb } of budgets) {
  test(`${name} stays under ${maxKb} kB gzipped`, { skip: !built && 'run npm run build first' }, () => {
    const files = readdirSync(assets).filter((file) => pattern.test(file))
    assert.ok(files.length > 0, `no built file matches ${pattern}`)
    for (const file of files) {
      const kb = gzipSync(readFileSync(join(assets, file))).length / 1024
      assert.ok(kb <= maxKb, `${file} is ${kb.toFixed(1)} kB gzipped, over the ${maxKb} kB budget`)
    }
  })
}
