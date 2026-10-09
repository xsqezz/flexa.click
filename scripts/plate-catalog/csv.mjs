import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'

/** Splits one CSV record (quotes, doubled quotes) into fields. */
export function splitCsv(line) {
  const out = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i]
    if (quoted) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i += 1 } else quoted = false } else cur += c
    } else if (c === '"') quoted = true
    else if (c === ',') { out.push(cur); cur = '' } else cur += c
  }
  out.push(cur)
  return out
}

/** Streams a CSV as objects keyed by header; records with embedded newlines are re-joined. */
export async function eachRow(file, onRow) {
  const rl = createInterface({ input: createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity })
  let header = null
  let pending = ''
  for await (const raw of rl) {
    const line = pending ? `${pending}\n${raw}` : raw
    if ((line.match(/"/g) ?? []).length % 2) { pending = line; continue }
    pending = ''
    const cells = splitCsv(line)
    if (!header) { header = cells; continue }
    const row = {}
    for (let i = 0; i < header.length; i += 1) row[header[i]] = cells[i] ?? ''
    if ((await onRow(row)) === false) { rl.close(); break }
  }
}
