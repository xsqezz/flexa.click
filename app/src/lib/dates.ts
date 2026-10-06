export function today(): string {
  return dateKey(new Date())
}

export function dateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

export function shiftDate(value: string, offset: number): string {
  const date = new Date(`${value}T12:00:00`)
  date.setDate(date.getDate() + offset)
  return dateKey(date)
}

export function dateLabel(value: string, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('pl-PL', options ?? {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(`${value}T12:00:00`))
}

export function daysEndingAt(end: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => shiftDate(end, index - count + 1))
}

export function weekStart(value: string): string {
  const day = new Date(`${value}T12:00:00`).getDay()
  return shiftDate(value, -((day + 6) % 7))
}
