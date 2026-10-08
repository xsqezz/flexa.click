import { shiftDate } from './dates'

export type DatedValue = { date: string; value: number }

/**
 * Trailing moving average over calendar days: for each measured day the mean of all measurements
 * from that day and the previous `days - 1` days. Gaps simply mean fewer values in the window,
 * so a lone measurement averages to itself and missing days are never treated as zero.
 */
export function movingAverage(points: DatedValue[], days = 7): DatedValue[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  return sorted.map((point) => {
    const from = shiftDate(point.date, -(days - 1))
    const window = sorted.filter((item) => item.date >= from && item.date <= point.date)
    return { date: point.date, value: window.reduce((sum, item) => sum + item.value, 0) / window.length }
  })
}
