import { z } from 'zod'
import { workoutSchema, type Workout } from '../../../shared/domain'
import { dateKey } from './dates'

export const MAX_ACTIVITY_BYTES = 5 * 1024 * 1024
const MAX_POINTS = 20_000
const timeSchema = z.iso.datetime({ offset: true })
type ImportedWorkout = Omit<Workout, 'id' | 'importHash'>
type Point = { lat: number; lon: number; elevation: number | null; time: number | null }

function descendants(element: Document | Element, name: string): Element[] {
  return Array.from(element.getElementsByTagNameNS('*', name))
}

function childText(element: Element, name: string): string | null | undefined {
  return Array.from(element.children).find((child) => child.localName === name)?.textContent
}

function numeric(value: string | null | undefined, required = false): number | null {
  if (value === null || value === undefined || !value.trim()) {
    if (required) throw new Error('W pliku brakuje wymaganych wartości liczbowych.')
    return null
  }
  const number = Number(value)
  if (!Number.isFinite(number)) throw new Error('Plik zawiera niepoprawną wartość liczbową.')
  return number
}

function timestamp(value: string | null | undefined): number | null {
  if (!value?.trim()) return null
  const parsed = timeSchema.safeParse(value.trim())
  if (!parsed.success) throw new Error('Plik zawiera niepoprawny czas lub brakuje strefy czasowej.')
  const number = Date.parse(parsed.data)
  if (!Number.isFinite(number)) throw new Error('Plik zawiera niepoprawną datę lub czas.')
  return number
}

function haversine(a: Point, b: Point): number {
  const rad = Math.PI / 180
  const latitude = (b.lat - a.lat) * rad
  const longitude = (b.lon - a.lon) * rad
  const value = Math.sin(latitude / 2) ** 2
    + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(longitude / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(Math.min(1, value)), Math.sqrt(Math.max(0, 1 - value)))
}

function gpx(document: Document): ImportedWorkout {
  const tracks = descendants(document, 'trk')
  if (tracks.length !== 1) throw new Error('Wybierz GPX z jedną aktywnością. Pliki tras bez czasu i pliki z wieloma treningami nie są obsługiwane.')
  const segments = descendants(tracks[0], 'trkseg')
  if (!segments.length) throw new Error('Plik GPX nie zawiera zarejestrowanych punktów treningu.')
  let count = 0
  let distance = 0
  let duration = 0
  let elevation = 0
  let hasElevation = true
  let start: number | null = null
  let previousEnd: number | null = null
  for (const segment of segments) {
    const points = descendants(segment, 'trkpt').map((element): Point => {
      count++
      if (count > MAX_POINTS) throw new Error('Plik ma więcej niż 20 000 punktów. Uprość zapis przed importem.')
      const lat = numeric(element.getAttribute('lat'), true)
      const lon = numeric(element.getAttribute('lon'), true)
      if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        throw new Error('Plik zawiera niepoprawne współrzędne.')
      }
      return {
        lat, lon,
        elevation: numeric(descendants(element, 'ele')[0]?.textContent),
        time: timestamp(descendants(element, 'time')[0]?.textContent),
      }
    })
    if (points.length < 2) throw new Error('Każdy segment GPX musi mieć przynajmniej dwa punkty.')
    const firstTime = points[0].time
    const lastTime = points.at(-1)?.time
    if (firstTime === null || lastTime === null || lastTime === undefined || lastTime <= firstTime) {
      throw new Error('GPX nie ma poprawnego czasu początku i końca. Tę aktywność dodaj ręcznie.')
    }
    if (previousEnd !== null && firstTime < previousEnd) throw new Error('Segmenty GPX mają nakładający się lub niechronologiczny czas.')
    previousEnd = lastTime
    if (start === null) start = firstTime
    duration += (lastTime - firstTime) / 60000
    let previousTime = firstTime
    for (let index = 1; index < points.length; index++) {
      const a = points[index - 1]
      const b = points[index]
      if (b.time !== null) {
        if (b.time < previousTime) throw new Error('Czas punktów GPX nie jest chronologiczny.')
        previousTime = b.time
      }
      distance += haversine(a, b)
      if (a.elevation !== null && b.elevation !== null) {
        elevation += Math.max(0, b.elevation - a.elevation)
      } else hasElevation = false
    }
  }
  if (start === null) throw new Error('Plik nie zawiera czasu aktywności.')
  const type = childText(tracks[0], 'type')?.toLowerCase()
  return {
    date: dateKey(new Date(start)),
    name: (childText(tracks[0], 'name')?.trim() || 'Import GPX').slice(0, 120),
    kind: type?.includes('cycl') || type?.includes('bik') ? 'ride' : type?.includes('walk') ? 'walk' : type?.includes('run') ? 'run' : 'other',
    minutes: duration, distanceKm: distance / 1000, calories: null, effort: null,
    elevationM: hasElevation ? elevation : null,
  }
}

function tcx(document: Document): ImportedWorkout {
  const activities = descendants(document, 'Activity')
  if (activities.length !== 1) throw new Error('Wybierz plik TCX z dokładnie jedną aktywnością.')
  const activity = activities[0]
  const laps = descendants(activity, 'Lap')
  if (!laps.length) throw new Error('TCX nie zawiera czasu treningu.')
  const start = timestamp(laps[0].getAttribute('StartTime') ?? descendants(activity, 'Id')[0]?.textContent)
  if (start === null) throw new Error('W pliku TCX brakuje daty początku aktywności.')
  let minutes = 0
  let distance = 0
  let calories = 0
  let hasDistance = true
  let hasCalories = true
  for (const lap of laps) {
    const seconds = numeric(childText(lap, 'TotalTimeSeconds'), true)
    if (seconds === null || seconds <= 0) throw new Error('Czas okrążenia TCX musi być dodatni.')
    minutes += seconds / 60
    const meters = numeric(childText(lap, 'DistanceMeters'))
    const energy = numeric(childText(lap, 'Calories'))
    if (meters === null) hasDistance = false
    else if (meters < 0) throw new Error('Dystans nie może być ujemny.')
    else distance += meters
    if (energy === null) hasCalories = false
    else if (energy < 0) throw new Error('Energia nie może być ujemna.')
    else calories += energy
  }
  const sport = activity.getAttribute('Sport')
  return {
    date: dateKey(new Date(start)), name: 'Import TCX',
    kind: sport === 'Running' ? 'run' : sport === 'Biking' ? 'ride' : 'other',
    minutes, distanceKm: hasDistance ? distance / 1000 : null,
    calories: hasCalories ? calories : null, effort: null, elevationM: null,
  }
}

export function parseActivityXML(xml: string): ImportedWorkout {
  if (xml.length > MAX_ACTIVITY_BYTES) throw new Error('Plik jest większy niż 5 MB.')
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Pliki z deklaracjami DTD lub encji nie są obsługiwane.')
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  if (descendants(document, 'parsererror').length) throw new Error('Plik XML jest uszkodzony.')
  const root = document.documentElement.localName
  const draft = root === 'gpx' ? gpx(document)
    : root === 'TrainingCenterDatabase' ? tcx(document) : null
  if (!draft) throw new Error('Obsługujemy tylko GPX oraz TCX, nie pliki FIT ani ZIP.')
  const parsed = workoutSchema.omit({ id: true, importHash: true }).safeParse(draft)
  if (!parsed.success) throw new Error('Parametry treningu są poza obsługiwanym zakresem. Sprawdź plik lub dodaj aktywność ręcznie.')
  return parsed.data
}

export async function importActivityFile(file: File): Promise<Omit<Workout, 'id'>> {
  if (file.size > MAX_ACTIVITY_BYTES) throw new Error('Plik jest większy niż 5 MB.')
  if (!/\.(gpx|tcx)$/i.test(file.name)) throw new Error('Wybierz plik z rozszerzeniem GPX lub TCX.')
  const bytes = await file.arrayBuffer()
  const parsed = parseActivityXML(new TextDecoder().decode(bytes))
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  const importHash = [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, '0')).join('')
  return { ...parsed, importHash }
}
