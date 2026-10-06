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

export function LineChart({ points, label }: { points: ChartPoint[]; label: string }) {
  const known = points.filter((point): point is ChartPoint & { value: number } => point.value !== null)
  if (!known.length) return <p className="source-credit">Dodaj pomiar, aby zobaczyć wykres.</p>
  const min = Math.min(...known.map((point) => point.value)) - .5
  const max = Math.max(...known.map((point) => point.value)) + .5
  const start = new Date(`${known[0].date}T12:00:00`).getTime()
  const duration = Math.max(86_400_000, new Date(`${known.at(-1)?.date}T12:00:00`).getTime() - start)
  const y = (value: number) => 170 - (value - min) / (max - min) * 140
  return <>
    <ChartFrame description={`${label}: ${known.length} pomiarów. Ostatni: ${numberFormat.format(known.at(-1)?.value ?? 0)} kg.`}>
      {(viewport) => {
        const right = viewport - 18
        const x = (point: ChartPoint) => 50 + (new Date(`${point.date}T12:00:00`).getTime() - start) / duration * (right - 50)
        const coordinates = known.map((point) => `${x(point)},${y(point.value)}`).join(' ')
        return <>
          {[min, (min + max) / 2, max].map((value) => <g key={value}>
            <line x1="50" x2={right} y1={y(value)} y2={y(value)} stroke="#e4eae5" />
            <text x="40" y={y(value) + 4} textAnchor="end">{numberFormat.format(value)}</text>
          </g>)}
          <polyline points={coordinates} fill="none" stroke="#326b49" strokeWidth="2.5" />
          {known.map((point) => <circle key={point.date} cx={x(point)} cy={y(point.value)} r="4" fill="#326b49"><title>{dateLabel(point.date)}: {numberFormat.format(point.value)} kg</title></circle>)}
          <text x="50" y="196">{dateLabel(known[0].date, { day: 'numeric', month: 'short' })}</text>
          {known.length > 1 && <text x={right} y="196" textAnchor="end">{dateLabel(known.at(-1)?.date ?? known[0].date, { day: 'numeric', month: 'short' })}</text>}
        </>
      }}
    </ChartFrame><ChartTable points={points} label={label} unit="kg" />
  </>
}

function ChartTable({ points, label, unit }: { points: ChartPoint[]; label: string; unit: string }) {
  return <details><summary>Dane wykresu — {label.toLocaleLowerCase('pl-PL')}</summary>
    <div className="table-scroll"><table><caption className="sr-only">{label}</caption><thead><tr><th scope="col">Data</th><th scope="col">Wartość ({unit})</th></tr></thead>
      <tbody>{points.map((point) => <tr key={point.date}><td>{dateLabel(point.date)}</td><td>{point.value === null ? 'Brak zapisu' : numberFormat.format(point.value)}</td></tr>)}</tbody>
    </table></div>
  </details>
}
