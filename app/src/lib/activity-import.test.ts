import { describe, expect, it } from 'vitest'
import { parseActivityXML } from './activity-import'

const segment = (latitude: number, time: string) => `<trkseg>
  <trkpt lat="${latitude}" lon="21"><ele>10</ele><time>2026-10-06T${time}:00Z</time></trkpt>
  <trkpt lat="${latitude + .01}" lon="21"><ele>20</ele><time>2026-10-06T${Number(time.slice(0, 2))}:10:00Z</time></trkpt>
</trkseg>`
const gpx = `<gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Bieg</name>${segment(52, '10:00')}</trk></gpx>`

describe('activity import', () => {
  it('reads GPX time, distance, and elevation without inventing calories', () => {
    const workout = parseActivityXML(gpx)
    expect(workout.minutes).toBe(10)
    expect(workout.distanceKm).toBeCloseTo(1.112, 2)
    expect(workout.elevationM).toBe(10)
    expect(workout.calories).toBeNull()
  })
  it('does not draw distance across distinct track segments', () => {
    const workout = parseActivityXML(`<gpx><trk>${segment(52, '10:00')}${segment(53, '11:00')}</trk></gpx>`)
    expect(workout.distanceKm).toBeCloseTo(2.224, 2)
    expect(workout.minutes).toBe(20)
  })
  it('does not guess a sport or use point distance as a missing TCX lap total', () => {
    expect(parseActivityXML(gpx).kind).toBe('other')
    expect(parseActivityXML(gpx.replace('<name>Bieg</name>', '<name>Bieg</name><type>running</type>')).kind).toBe('run')
    const activity = `<TrainingCenterDatabase><Activities><Activity Sport="Running"><Lap StartTime="2026-10-06T10:00:00Z">
      <TotalTimeSeconds>120</TotalTimeSeconds><Track><Trackpoint><DistanceMeters>10</DistanceMeters></Trackpoint></Track>
    </Lap></Activity></Activities></TrainingCenterDatabase>`
    expect(parseActivityXML(activity).distanceKm).toBeNull()
  })
  it('does not silently normalize invalid dates or guess a missing timezone', () => {
    expect(() => parseActivityXML(gpx.replaceAll('2026-10-06', '2026-02-30'))).toThrow('niepoprawny czas')
    expect(() => parseActivityXML(gpx.replaceAll('00Z', '00'))).toThrow('strefy czasowej')
    expect(parseActivityXML(gpx.replaceAll('Z', '+02:00')).minutes).toBe(10)
  })
  it('rejects overlapping segments and treats incomplete elevation as unknown', () => {
    expect(() => parseActivityXML(`<gpx><trk>${segment(52, '10:00')}${segment(53, '10:00')}</trk></gpx>`)).toThrow('nakładający')
    expect(parseActivityXML(gpx.replace('<ele>20</ele>', '')).elevationM).toBeNull()
  })
  it('reads TCX laps and preserves missing calories', () => {
    const workout = parseActivityXML(`<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="Biking"><Id>2026-10-06T10:00:00Z</Id>
      <Lap StartTime="2026-10-06T10:00:00Z"><TotalTimeSeconds>1800</TotalTimeSeconds><DistanceMeters>10000</DistanceMeters></Lap>
    </Activity></Activities></TrainingCenterDatabase>`)
    expect(workout.kind).toBe('ride')
    expect(workout.minutes).toBe(30)
    expect(workout.distanceKm).toBe(10)
    expect(workout.calories).toBeNull()
  })
  it('rejects malformed XML, unsafe entities, coordinates, and untimed routes', () => {
    for (const text of [
      '<gpx><broken>',
      '<!DOCTYPE gpx [<!ENTITY secret SYSTEM "file:///private">]><gpx/>',
      gpx.replace('lat="52"', 'lat="152"'),
      gpx.replace(/<time>.*?<\/time>/g, ''),
      '<gpx><rte><rtept lat="1" lon="1"/></rte></gpx>',
    ]) expect(() => parseActivityXML(text)).toThrow()
  })
})
