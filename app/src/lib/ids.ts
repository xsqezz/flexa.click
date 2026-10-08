const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: string): boolean {
  return uuidPattern.test(value)
}

/**
 * Deterministic RFC 9562 version-8 UUID derived from text (four seeded 32-bit FNV-1a/murmur-style mixes).
 * Not cryptographic: it only gives the same input a stable database-compatible identifier.
 */
export function stableUuid(text: string): string {
  const seeds = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b]
  const words = seeds.map((seed, round) => {
    let hash = seed ^ round
    for (let index = 0; index < text.length; index++) {
      hash ^= text.charCodeAt(index)
      hash = Math.imul(hash, 0x01000193 + round * 2)
      hash ^= hash >>> 15
    }
    hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b)
    hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35)
    return (hash ^ (hash >>> 16)) >>> 0
  })
  const hex = words.map((word) => word.toString(16).padStart(8, '0')).join('')
  const variant = (8 + (parseInt(hex[16], 16) & 3)).toString(16)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}
