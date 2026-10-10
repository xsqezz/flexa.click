import { useEffect, useRef, useState } from 'react'
import { Camera, ImagePlus, ShieldCheck, Sparkles, Trash2 } from 'lucide-react'
import { useAuth } from '../lib/Auth'
import { KitchenAiError, kitchenAiAvailable, preparePhoto, type PreparedPhoto } from '../lib/kitchen/ai-client'
import { readLabel, type LabelReading } from '../lib/scan/label-client'
import { rememberScanConsent, scanConsentGiven } from '../lib/scan/client'
import { Button, Notice, errorMessage } from './ui'

/** Reads a nutrition table from a photo and hands the numbers to the custom-product form, which the user still checks and saves. */
export function LabelReader({ onRead }: { onRead: (reading: LabelReading) => void }) {
  const auth = useAuth()
  const token = auth.session?.access_token ?? null
  const [available, setAvailable] = useState<boolean | null>(null)
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null)
  const [remembered, setRemembered] = useState(scanConsentGiven)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState<'preparing' | 'working' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)
  const preview = useRef<string | null>(null)
  preview.current = photo?.preview ?? null
  useEffect(() => { if (auth.mode === 'cloud') void kitchenAiAvailable().then(setAvailable) }, [auth.mode])
  useEffect(() => () => { if (preview.current) URL.revokeObjectURL(preview.current) }, [])

  if (auth.mode !== 'cloud' || available !== true) return null

  function clear() {
    if (photo) URL.revokeObjectURL(photo.preview)
    setPhoto(null)
  }

  async function choose(file: File | undefined) {
    if (!file) return
    setError(null); setBusy('preparing')
    try {
      const prepared = await preparePhoto(file, { crops: false, sharp: true })
      clear(); setPhoto(prepared)
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(null) }
  }

  async function read() {
    if (!photo || !token) return
    if (!remembered && !consent) { setError('Zaznacz zgodę na wysłanie zdjęcia do odczytu.'); return }
    rememberScanConsent(true); setRemembered(true)
    setError(null); setBusy('working')
    try {
      onRead(await readLabel(photo.images[0], token))
      clear()
    } catch (cause) { setError(cause instanceof KitchenAiError ? cause.message : errorMessage(cause)) }
    finally { setBusy(null) }
  }

  return <section className="label-reader" aria-labelledby="label-reader-title">
    <h3 id="label-reader-title"><Sparkles size={17} aria-hidden="true" />Odczytaj z etykiety</h3>
    <p className="source-credit">Zrób zdjęcie tabeli wartości odżywczych z bliska i równo. Przepiszemy liczby z „na 100 g / 100 ml” do formularza — Ty sprawdzasz je i zapisujesz.</p>
    <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(event) => { void choose(event.target.files?.[0]); event.target.value = '' }} />
    <input ref={gallery} type="file" accept="image/*" hidden onChange={(event) => { void choose(event.target.files?.[0]); event.target.value = '' }} />
    <div className="button-row">
      <Button type="button" onClick={() => camera.current?.click()} disabled={busy !== null}><Camera size={17} aria-hidden="true" />Zrób zdjęcie</Button>
      <Button type="button" variant="secondary" onClick={() => gallery.current?.click()} disabled={busy !== null}><ImagePlus size={17} aria-hidden="true" />Z galerii</Button>
    </div>
    {busy === 'preparing' && <p className="scan-lead" role="status">Przygotowuję zdjęcie…</p>}
    {photo && <div className="scan-previews">
      <ul><li>
        <img src={photo.preview} alt="Podgląd zdjęcia etykiety" />
        <button type="button" className="icon-button" aria-label="Usuń zdjęcie etykiety" onClick={clear} disabled={busy === 'working'}><Trash2 size={16} aria-hidden="true" /></button>
      </li></ul>
      {remembered
        ? <p className="scan-lead">Zgoda na wysyłanie zdjęć do analizy jest zapisana na tym urządzeniu. <button type="button" className="text-link" onClick={() => { rememberScanConsent(false); setRemembered(false); setConsent(false) }}>Cofnij zgodę</button></p>
        : <label className="checkbox-label"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
          <span>Rozumiem, że zdjęcie zostanie pomniejszone, pozbawione danych EXIF (np. lokalizacji) i wysłane do Cloudflare Workers AI wyłącznie po to, by odczytać liczby z etykiety. Flexa go nie zapisuje.</span></label>}
      <div className="button-row"><Button type="button" onClick={() => { void read() }} busy={busy === 'working'}><Sparkles size={17} aria-hidden="true" />Odczytaj wartości</Button></div>
      {busy === 'working' && <p className="scan-lead" role="status">Czytam etykietę — zwykle kilka sekund.</p>}
    </div>}
    {error && <Notice tone="error">{error}</Notice>}
    <p className="scan-lead"><ShieldCheck size={15} aria-hidden="true" /> Dzienny limit zdjęć jest wspólny ze Skanem posiłku i Smart Kuchnią. Zdjęcie nie jest nigdzie zapisywane.</p>
  </section>
}
