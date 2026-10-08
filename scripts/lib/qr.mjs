// Small QR Code Model 2 encoder (byte mode, versions 1-40, all masks) used at build time.
// Follows ISO/IEC 18004; the structure mirrors the well-known reference algorithm by Project Nayuki.

const LEVELS = { L: { index: 0, format: 1 }, M: { index: 1, format: 0 }, Q: { index: 2, format: 3 }, H: { index: 3, format: 2 } }

const ECC_CODEWORDS_PER_BLOCK = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
]
const NUM_ERROR_CORRECTION_BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
]

const bit = (value, index) => ((value >>> index) & 1) !== 0

function rawDataModules(version) {
  let result = (16 * version + 128) * version + 64
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2
    result -= (25 * align - 10) * align - 55
    if (version >= 7) result -= 36
  }
  return result
}

function dataCodewords(version, level) {
  return Math.floor(rawDataModules(version) / 8)
    - ECC_CODEWORDS_PER_BLOCK[level.index][version] * NUM_ERROR_CORRECTION_BLOCKS[level.index][version]
}

function gfMultiply(x, y) {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }
  return z
}

function reedSolomonDivisor(degree) {
  const result = new Array(degree).fill(0)
  result[degree - 1] = 1
  let root = 1
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMultiply(result[j], root)
      if (j + 1 < degree) result[j] ^= result[j + 1]
    }
    root = gfMultiply(root, 0x02)
  }
  return result
}

function reedSolomonRemainder(data, divisor) {
  const result = new Array(divisor.length).fill(0)
  for (const byte of data) {
    const factor = byte ^ result.shift()
    result.push(0)
    divisor.forEach((coefficient, i) => { result[i] ^= gfMultiply(coefficient, factor) })
  }
  return result
}

function alignmentPositions(version) {
  if (version === 1) return []
  const count = Math.floor(version / 7) + 2
  const step = Math.floor((version * 8 + count * 3 + 5) / (count * 4 - 4)) * 2
  const result = [6]
  for (let position = version * 4 + 17 - 7; result.length < count; position -= step) result.splice(1, 0, position)
  return result
}

function addErrorCorrection(data, version, level) {
  const blockCount = NUM_ERROR_CORRECTION_BLOCKS[level.index][version]
  const eccLength = ECC_CODEWORDS_PER_BLOCK[level.index][version]
  const raw = Math.floor(rawDataModules(version) / 8)
  const shortBlocks = blockCount - (raw % blockCount)
  const shortLength = Math.floor(raw / blockCount)
  const divisor = reedSolomonDivisor(eccLength)
  const blocks = []
  for (let i = 0, k = 0; i < blockCount; i++) {
    const block = data.slice(k, k + shortLength - eccLength + (i < shortBlocks ? 0 : 1))
    k += block.length
    const ecc = reedSolomonRemainder(block, divisor)
    if (i < shortBlocks) block.push(0)
    blocks.push(block.concat(ecc))
  }
  const result = []
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortLength - eccLength || j >= shortBlocks) result.push(block[i])
    })
  }
  return result
}

class Matrix {
  constructor(version) {
    this.size = version * 4 + 17
    this.modules = Array.from({ length: this.size }, () => new Array(this.size).fill(false))
    this.reserved = Array.from({ length: this.size }, () => new Array(this.size).fill(false))
  }

  set(x, y, dark) {
    this.modules[y][x] = dark
    this.reserved[y][x] = true
  }
}

function drawFormatBits(matrix, level, mask) {
  const data = (level.format << 3) | mask
  let remainder = data
  for (let i = 0; i < 10; i++) remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537)
  const bits = ((data << 10) | remainder) ^ 0x5412
  const { size } = matrix
  for (let i = 0; i <= 5; i++) matrix.set(8, i, bit(bits, i))
  matrix.set(8, 7, bit(bits, 6))
  matrix.set(8, 8, bit(bits, 7))
  matrix.set(7, 8, bit(bits, 8))
  for (let i = 9; i < 15; i++) matrix.set(14 - i, 8, bit(bits, i))
  for (let i = 0; i < 8; i++) matrix.set(size - 1 - i, 8, bit(bits, i))
  for (let i = 8; i < 15; i++) matrix.set(8, size - 15 + i, bit(bits, i))
  matrix.set(8, size - 8, true)
}

function drawFunctionPatterns(matrix, version, level) {
  const { size } = matrix
  for (let i = 0; i < size; i++) {
    matrix.set(6, i, i % 2 === 0)
    matrix.set(i, 6, i % 2 === 0)
  }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy))
        const x = cx + dx
        const y = cy + dy
        if (x >= 0 && x < size && y >= 0 && y < size) matrix.set(x, y, distance !== 2 && distance !== 4)
      }
    }
  }
  const positions = alignmentPositions(version)
  const last = positions.length - 1
  positions.forEach((px, i) => positions.forEach((py, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) matrix.set(px + dx, py + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
    }
  }))
  drawFormatBits(matrix, level, 0)
  if (version >= 7) {
    let remainder = version
    for (let i = 0; i < 12; i++) remainder = (remainder << 1) ^ ((remainder >>> 11) * 0x1f25)
    const bits = (version << 12) | remainder
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3)
      const b = Math.floor(i / 3)
      matrix.set(a, b, bit(bits, i))
      matrix.set(b, a, bit(bits, i))
    }
  }
}

function drawCodewords(matrix, codewords) {
  const { size } = matrix
  let i = 0
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vertical = 0; vertical < size; vertical++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j
        const upward = ((right + 1) & 2) === 0
        const y = upward ? size - 1 - vertical : vertical
        if (!matrix.reserved[y][x] && i < codewords.length * 8) {
          matrix.modules[y][x] = bit(codewords[i >>> 3], 7 - (i & 7))
          i++
        }
      }
    }
  }
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
]

function applyMask(matrix, mask) {
  const test = MASKS[mask]
  for (let y = 0; y < matrix.size; y++) {
    for (let x = 0; x < matrix.size; x++) {
      if (!matrix.reserved[y][x] && test(x, y)) matrix.modules[y][x] = !matrix.modules[y][x]
    }
  }
}

function penalty(modules) {
  const size = modules.length
  const lines = []
  for (let i = 0; i < size; i++) {
    lines.push(modules[i])
    lines.push(modules.map((row) => row[i]))
  }
  let score = 0
  const finderLike = [true, false, true, true, true, false, true]
  for (const line of lines) {
    let run = 1
    for (let i = 1; i <= size; i++) {
      if (i < size && line[i] === line[i - 1]) run++
      else {
        if (run >= 5) score += 3 + run - 5
        run = 1
      }
    }
    for (let i = 0; i + 7 <= size; i++) {
      if (!finderLike.every((value, k) => line[i + k] === value)) continue
      const lightBefore = [1, 2, 3, 4].every((k) => i - k < 0 || !line[i - k])
      const lightAfter = [0, 1, 2, 3].every((k) => i + 7 + k >= size || !line[i + 7 + k])
      if (lightBefore) score += 40
      if (lightAfter) score += 40
    }
  }
  let dark = 0
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules[y][x]) dark++
      if (x + 1 < size && y + 1 < size) {
        const color = modules[y][x]
        if (color === modules[y][x + 1] && color === modules[y + 1][x] && color === modules[y + 1][x + 1]) score += 3
      }
    }
  }
  const total = size * size
  score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10
  return score
}

/**
 * Encodes text (UTF-8, byte mode) into a QR matrix.
 * @returns {{ version: number, size: number, mask: number, modules: boolean[][] }}
 */
export function encodeQr(text, { level: levelName = 'M', minVersion = 1, maxVersion = 40 } = {}) {
  const level = LEVELS[levelName]
  if (!level) throw new Error(`Unknown QR error correction level: ${levelName}`)
  const bytes = [...new TextEncoder().encode(text)]
  let version = minVersion
  let capacity = 0
  for (; ; version++) {
    if (version > maxVersion) throw new Error('Text is too long for a QR code.')
    capacity = dataCodewords(version, level) * 8
    const used = 4 + (version <= 9 ? 8 : 16) + bytes.length * 8
    if (used <= capacity) break
  }
  const bits = []
  const append = (value, length) => { for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1) }
  append(0b0100, 4)
  append(bytes.length, version <= 9 ? 8 : 16)
  for (const byte of bytes) append(byte, 8)
  append(0, Math.min(4, capacity - bits.length))
  append(0, (8 - (bits.length % 8)) % 8)
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) append(pad, 8)
  const data = []
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((byte, value) => (byte << 1) | value, 0))

  const matrix = new Matrix(version)
  drawFunctionPatterns(matrix, version, level)
  drawCodewords(matrix, addErrorCorrection(data, version, level))
  let best = 0
  let bestScore = Infinity
  for (let mask = 0; mask < 8; mask++) {
    applyMask(matrix, mask)
    drawFormatBits(matrix, level, mask)
    const score = penalty(matrix.modules)
    if (score < bestScore) {
      best = mask
      bestScore = score
    }
    applyMask(matrix, mask)
  }
  applyMask(matrix, best)
  drawFormatBits(matrix, level, best)
  return { version, size: matrix.size, mask: best, modules: matrix.modules }
}

const escapeXml = (value) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

/** Renders a QR matrix as a self-contained, accessible inline SVG (dark modules on a white quiet zone). */
export function qrSvg(text, { level = 'M', border = 4, label = text, className = 'qr-code', id = 'qr-title' } = {}) {
  const { size, modules } = encodeQr(text, { level })
  const dimension = size + border * 2
  let path = ''
  modules.forEach((row, y) => {
    for (let x = 0; x < size; x++) {
      if (!row[x]) continue
      let end = x
      while (end + 1 < size && row[end + 1]) end++
      path += `M${x + border} ${y + border}h${end - x + 1}v1h-${end - x + 1}z`
      x = end
    }
  })
  // QR readers need dark-on-light regardless of the page theme, so these colors are intentionally fixed.
  return `<svg class="${escapeXml(className)}" viewBox="0 0 ${dimension} ${dimension}" role="img" aria-labelledby="${escapeXml(id)}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">`
    + `<title id="${escapeXml(id)}">${escapeXml(label)}</title>`
    + `<rect width="${dimension}" height="${dimension}" fill="#ffffff"/><path fill="#14281d" d="${path}"/></svg>`
}
