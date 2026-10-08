import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { dateLabel } from '../lib/dates'
import { integerFormat, numberFormat } from '../lib/nutrition'

export type ChartPoint = { date: string; value: number | null }

function ChartFrame({ description, children }: { description: string; children: (width: number) => ReactNode }) {
  const id = useId()
  const ref = useRef<SVGSVGElement>(null)
  const [width, setWidth] = useState(640)
  useLayoutEffect(() => {
    const svg = ref.current
    if (!svg) return
    const update = () => setWidth(Math.max(1, svg.getBoundingClientRect().width))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(svg)
    return () => observer.disconnect()
  }, [])
  return <svg ref={ref} className="chart-svg" viewBox={`0 0 ${width} 210`} role="img" aria-labelledby={id}>
    <title id={id}>{description}</title>
    {children(width)}
  </svg>
}

export function BarChart({ points, label, unit, goal }: { points: ChartPoint[]; label: string; unit: string; goal?: number }) {
  const max = Math.max(1, goal ?? 0, ...points.map((point) => point.value ?? 0)) * 1.12
  const left = 50
  const height = 145
  const recorded = points.filter((point) => point.value !== null)
  return <>
    <ChartFrame description={`${label}. ${recorded.length} dni z danymi. Brak zapisu nie oznacza wartości zero.`}>
      {(viewport) => {
        const right = viewport - 18
        const step = (right - left) / Math.max(points.length, 1)
        return <>
          {[0, .5, 1].map((part) => <g key={part}>
            <line x1={left} x2={right} y1={170 - part * height} y2={170 - part * height} stroke="#e4eae5" />
            <text x={left - 10} y={174 - part * height} textAnchor="end">{integerFormat.format(part * max)}</text>
          </g>)}
          {goal !== undefined && <line x1={left} x2={right} y1={170 - goal / max * height} y2={170 - goal / max * height} stroke="#7a9566" strokeDasharray="5 5" />}
          {points.map((point, index) => <g key={point.date}>
            {point.value !== null && <rect x={left + index * step + step * .2} y={170 - point.value / max * height} width={step * .6} height={point.value / max * height} fill="#729263" rx={Math.min(3, step * .1)}>
              <title>{dateLabel(point.date)}: {numberFormat.format(point.value)} {unit}</title>
            </rect>}
            {(index === 0 || index === points.length - 1 || (points.length <= 14 && step >= 42 && index % 2 === 0)) && <text
              x={left + (index + .5) * step} y="195" textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}>
              {dateLabel(point.date, { day: 'numeric', month: 'short' })}
            </text>}
          </g>)}
        </>
      }}
    </ChartFrame>
    <ChartTable points={points} label={label} unit={unit} />
  </>
}

export function LineChart({ points, label, unit = 'kg', average, averageLabel = 'Średnia z 7 dni', empty = 'Dodaj pomiar, aby zobaczyć wykres.' }:
  { points: ChartPoint[]; label: string; unit?: string; average?: ChartPoint[]; averageLabel?: string; empty?: string }) {
  const known = points.filter((point): point is ChartPoint & { value: number } => point.value !== null)
  if (!known.length) return <p className="source-credit">{empty}</p>
  const trend = (average ?? []).filter((point): point is ChartPoint & { value: number } => point.value !== null)
  const values = [...known, ...trend].map((point) => point.value)
  const low = Math.min(...values)
  const high = Math.max(...values)
  const pad = Math.max(.5, (high - low) * .1, high >= 200 ? high * .05 : 0)
  const min = low - pad
  const max = high + pad
  const start = new Date(`${known[0].date}T12:00:00`).getTime()
  const duration = Math.max(86_400_000, new Date(`${known.at(-1)?.date}T12:00:00`).getTime() - start)
  const y = (value: number) => 170 - (value - min) / (max - min) * 140
  const format = (value: number) => (Math.abs(value) >= 1000 ? integerFormat : numberFormat).format(value)
  return <>
    {trend.length > 0 && <p className="chart-legend">
      <span><span className="chart-key chart-key-raw" aria-hidden="true" />{label}</span>
      <span><span className="chart-key chart-key-average" aria-hidden="true" />{averageLabel}</span>
    </p>}
    <ChartFrame description={`${label}: ${known.length} ${known.length === 1 ? 'punkt' : 'punktów'}. Ostatni: ${format(known.at(-1)?.value ?? 0)} ${unit}.${trend.length ? ` ${averageLabel}: ${format(trend.at(-1)?.value ?? 0)} ${unit}.` : ''}`}>
      {(viewport) => {
        const right = viewport - 18
        const x = (point: ChartPoint) => 50 + (new Date(`${point.date}T12:00:00`).getTime() - start) / duration * (right - 50)
        const coordinates = known.map((point) => `${x(point)},${y(point.value)}`).join(' ')
        return <>
          {[min, (min + max) / 2, max].map((value) => <g key={value}>
            <line x1="50" x2={right} y1={y(value)} y2={y(value)} stroke="#e4eae5" />
            <text x="40" y={y(value) + 4} textAnchor="end">{format(value)}</text>
          </g>)}
          <polyline points={coordinates} fill="none" stroke="#326b49" strokeWidth="2.5" />
          {trend.length > 1 && <polyline className="chart-line-average" points={trend.map((point) => `${x(point)},${y(point.value)}`).join(' ')} fill="none" />}
          {known.map((point) => <circle key={point.date} cx={x(point)} cy={y(point.value)} r="4" fill="#326b49"><title>{dateLabel(point.date)}: {format(point.value)} {unit}</title></circle>)}
          <text x="50" y="196">{dateLabel(known[0].date, { day: 'numeric', month: 'short' })}</text>
          {known.length > 1 && <text x={right} y="196" textAnchor="end">{dateLabel(known.at(-1)?.date ?? known[0].date, { day: 'numeric', month: 'short' })}</text>}
        </>
      }}
    </ChartFrame><ChartTable points={points} label={label} unit={unit} average={average} averageLabel={averageLabel} />
  </>
}

/** A tiny decorative trend line; the values it shows must also be written out next to it. */
export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const low = Math.min(...values)
  const high = Math.max(...values)
  const coordinates = values.map((value, index) => `${2 + index / (values.length - 1) * 96},${high === low ? 14 : 26 - (value - low) / (high - low) * 24}`).join(' ')
  return <svg className="sparkline" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <polyline points={coordinates} fill="none" vectorEffect="non-scaling-stroke" />
  </svg>
}

function ChartTable({ points, label, unit, average, averageLabel }: { points: ChartPoint[]; label: string; unit: string; average?: ChartPoint[]; averageLabel?: string }) {
  const trend = new Map((average ?? []).map((point) => [point.date, point.value]))
  return <details><summary>Dane wykresu — {label.toLocaleLowerCase('pl-PL')}</summary>
    <div className="table-scroll" tabIndex={0} role="region" aria-label={`Tabela: ${label.toLocaleLowerCase('pl-PL')}`}><table><caption className="sr-only">{label}</caption><thead><tr><th scope="col">Data</th><th scope="col">Wartość ({unit})</th>
      {average && <th scope="col">{averageLabel} ({unit})</th>}</tr></thead>
      <tbody>{points.map((point) => <tr key={point.date}><td>{dateLabel(point.date)}</td><td>{point.value === null ? 'Brak zapisu' : numberFormat.format(point.value)}</td>
        {average && <td>{trend.get(point.date) == null ? '—' : numberFormat.format(trend.get(point.date) ?? 0)}</td>}</tr>)}</tbody>
    </table></div>
  </details>
}
