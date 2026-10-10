import { fold } from './match.ts'
import type { PlateSize } from './catalog.ts'

/**
 * Turns a sentence such as "dwa jajka i 2 kromki chleba z masłem, kawa 200 ml" into separate items with their quantities.
 * It only splits the text and reads the amounts; a separate step looks each item up in the catalogue and counts calories.
 */
export type PhrasePart = {
  /** The words the user wrote for this item, as typed. */
  raw: string
  /** What is left after the amounts are removed, folded to ASCII; this is what is searched for. */
  query: string
  /** Number of pieces or portions ("dwa jajka", "3 nuggetsy"); may be 0.5 or 1.5. */
  count: number | null
  /** Amount in g or ml, from "200 g", "0,5 l", "2 kromki", "szklanka". */
  grams: number | null
  size: PlateSize | null
}

export const maxPhraseChars = 400
export const maxPhraseParts = 12

const numberWords: Record<string, number> = {
  jeden: 1, jedna: 1, jedno: 1, dwa: 2, dwie: 2, dwoch: 2, dwoje: 2, trzy: 3, trzech: 3, cztery: 4, czterech: 4,
  piec: 5, pieciu: 5, szesc: 6, sesciu: 6, siedem: 7, osiem: 8, dziewiec: 9, dziesiec: 10, pol: 0.5, poltora: 1.5, cwierc: 0.25,
}

/** Grams or millilitres in one unit. Household measures are typical values, not exact ones. */
const units: Record<string, number> = {
  g: 1, gr: 1, gram: 1, gramy: 1, gramow: 1, grama: 1, dag: 10, dkg: 10, dekagram: 10, dekagramy: 10, kg: 1000, kilogram: 1000, kilogramy: 1000,
  ml: 1, mililitr: 1, mililitry: 1, mililitrow: 1, l: 1000, litr: 1000, litry: 1000, litra: 1000,
  szklanka: 250, szklanki: 250, szklanke: 250, szklanek: 250, kubek: 300, kubki: 300, kubka: 300, filizanka: 150, filizanki: 150, filizanke: 150,
  lyzka: 15, lyzki: 15, lyzke: 15, lyzek: 15, lyzeczka: 5, lyzeczki: 5, lyzeczke: 5, garsc: 30, garsci: 30,
  kromka: 35, kromki: 35, kromke: 35, kromek: 35, plasterek: 20, plasterki: 20, plasterkow: 20, plaster: 20, plastry: 20,
  miska: 250, miski: 250, miske: 250,
}
const exactUnits = new Set(['g', 'gr', 'gram', 'gramy', 'gramow', 'grama', 'dag', 'dkg', 'dekagram', 'dekagramy', 'kg', 'kilogram', 'kilogramy',
  'ml', 'mililitr', 'mililitry', 'mililitrow', 'l', 'litr', 'litry', 'litra'])

const sizeWords: Record<string, PlateSize> = {
  maly: 'S', mala: 'S', male: 'S', mini: 'S', sredni: 'M', srednia: 'M', srednie: 'M', duzy: 'L', duza: 'L', duze: 'L', wielki: 'L', wielka: 'L',
}

const filler = new Set(['porcja', 'porcje', 'porcji', 'sztuka', 'sztuki', 'sztuk', 'szt', 'troche', 'kilka', 'ok', 'okolo', 'jakies', 'jakis', 'jakas', 'zjadlem', 'zjadlam', 'wypilem', 'wypilam', 'jadlem', 'jadlam', 'mialem', 'mialam', 'na', 'sniadanie', 'obiad', 'kolacje', 'przekaske'])

const separators = /\s*(?:,|;|\n|\+|&|\s+i\s+|\s+oraz\s+|\s+plus\s+|\s+a\s+takze\s+)\s*/i

function numberOf(token: string): number | null {
  if (/^\d+(?:d\d+)?$/.test(token)) return Number(token.replace('d', '.'))
  return Object.hasOwn(numberWords, token) ? numberWords[token]! : null
}

function parsePart(raw: string): PhrasePart | null {
  const prepared = raw.toLocaleLowerCase('pl-PL').replace(/(\d)(\p{L})/gu, '$1 $2').replace(/(\d)[.,](\d)/g, '$1d$2')
  const tokens = fold(prepared).split(' ').filter(Boolean)
  let count: number | null = null
  let grams: number | null = null
  let size: PlateSize | null = null
  const rest: string[] = []
  for (let at = 0; at < tokens.length; at++) {
    const token = tokens[at]!
    const amount = numberOf(token)
    const next = tokens[at + 1]
    if (amount !== null && next !== undefined && Object.hasOwn(units, next) && grams === null) {
      grams = amount * units[next]!
      at++
      continue
    }
    if (amount !== null && count === null && grams === null) { count = amount; continue }
    if (Object.hasOwn(units, token) && !exactUnits.has(token) && grams === null) { grams = units[token]!; continue }
    if (Object.hasOwn(sizeWords, token) && size === null) { size = sizeWords[token]!; rest.push(token); continue }
    if (filler.has(token)) continue
    rest.push(token)
  }
  const query = rest.join(' ').trim()
  if (!query) return null
  if (grams !== null && (grams <= 0 || grams > 5000)) grams = null
  if (count !== null && (count <= 0 || count > 60)) count = null
  // Pieces and an exact weight together ("2 jajka 120 g"): the weight is what the user knows, the count is dropped.
  if (grams !== null) count = null
  return { raw: raw.trim(), query, count, grams, size }
}

export function parseMealPhrase(input: string): PhrasePart[] {
  const text = input.replace(/(\d),(\d)/g, '$1.$2').replace(/\s+/g, ' ').trim().slice(0, maxPhraseChars)
  if (!text) return []
  const parts: PhrasePart[] = []
  for (const piece of text.split(separators)) {
    if (!piece.trim()) continue
    const part = parsePart(piece)
    // A lone size word ("pizza, duża") belongs to the previous item.
    if (part && parts.length && part.count === null && part.grams === null && part.size !== null
      && part.query.split(' ').every((word) => Object.hasOwn(sizeWords, word))) {
      const previous = parts[parts.length - 1]!
      previous.size ??= part.size
      continue
    }
    if (part) parts.push(part)
    if (parts.length >= maxPhraseParts) break
  }
  return parts
}

/** "owsianka z bananem" can be one dish or two; this offers the two-item reading ("owsianka" + "bananem"). */
export function splitAtWith(query: string): [string, string] | null {
  const match = /^(.+?)\s+(?:z|ze)\s+(.+)$/.exec(query)
  return match ? [match[1]!, match[2]!] : null
}

/**
 * Polish inflection changes word endings ("ryżu", "jajka", "kawę"), while the catalogue holds the basic form.
 * These readings undo the most common endings so each word can still find its entry; the best-scoring one wins.
 */
export function queryVariants(query: string): string[] {
  const map = (rules: readonly (readonly [RegExp, string])[]) => query.split(' ').map((word) => {
    if (word.length < 4) return word
    for (const [pattern, replacement] of rules) if (pattern.test(word)) return word.replace(pattern, replacement)
    return word
  }).join(' ')
  const variants = [
    query,
    map([[/(?:ow|ami|ach|om|em|iem)$/, ''], [/[uya]$/, ''], [/i$/, '']]),
    map([[/(?:em|ie)$/, 'o'], [/[ua]$/, 'o']]),
    map([[/[yie]$/, 'a'], [/[ea]$/, 'a']]),
  ]
  return [...new Set(variants)]
}
