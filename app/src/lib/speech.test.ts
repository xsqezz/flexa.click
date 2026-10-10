import { describe, expect, it } from 'vitest'
import { joinSpoken } from './speech'

describe('joinSpoken', () => {
  it('appends speech to what was typed and trims the limit', () => {
    expect(joinSpoken(' jajka ', 'ryż i kurczak', 100)).toBe('jajka, ryż i kurczak')
    expect(joinSpoken('', 'ryż', 100)).toBe('ryż')
    expect(joinSpoken('abc', 'defghi', 6)).toBe('abc, d')
  })
})
