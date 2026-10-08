import { describe, expect, it } from 'vitest'
import { movingAverage } from './trend'

describe('7-day moving average', () => {
  it('averages the measurements of the trailing seven calendar days', () => {
    const result = movingAverage([
      { date: '2026-10-08', value: 74 },
      { date: '2026-10-01', value: 76 },
      { date: '2026-10-05', value: 75 },
      { date: '2026-10-02', value: 75 },
    ])
    expect(result.map((point) => point.date)).toEqual(['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-08'])
    expect(result.map((point) => point.value)).toEqual([76, 75.5, (76 + 75 + 75) / 3, (75 + 75 + 74) / 3])
  })
  it('handles gaps without treating missing days as zero', () => {
    expect(movingAverage([{ date: '2026-09-01', value: 80 }, { date: '2026-10-01', value: 78 }]))
      .toEqual([{ date: '2026-09-01', value: 80 }, { date: '2026-10-01', value: 78 }])
    expect(movingAverage([])).toEqual([])
  })
})
