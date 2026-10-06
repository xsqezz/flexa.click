import { useEffect, useRef, useState } from 'react'
import { Camera, Square } from 'lucide-react'
import { isValidBarcode } from '../../../shared/domain'
import { Button, Notice } from './ui'

type NativeDetector = { detect: (video: HTMLVideoElement) => Promise<{ rawValue: string }[]> }
type NativeConstructor = {
  new(options: { formats: string[] }): NativeDetector
  getSupportedFormats?: () => Promise<string[]>
}
function hasDetector(value: Window): value is Window & { BarcodeDetector: NativeConstructor } {
  return 'BarcodeDetector' in value && typeof value.BarcodeDetector === 'function'
}

export function CameraScanner({ onDetected }: { onDetected: (barcode: string) => void }) {
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const callback = useRef(onDetected)
  useEffect(() => { callback.current = onDetected }, [onDetected])
  useEffect(() => {
    if (!running) return
    let cancelled = false
    let found = false
    let stream: MediaStream | undefined
    let controls: { stop: () => void } | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    const stop = () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      controls?.stop()
      stream?.getTracks().forEach((track) => track.stop())
    }
    const accept = (value: string) => {
      if (cancelled || found || !isValidBarcode(value)) return
      found = true
      stop()
      setRunning(false)
      callback.current(value)
    }
    async function start() {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          throw new Error('Kamera wymaga HTTPS i obsługiwanej przeglądarki. Wpisz kod ręcznie.')
        }
        const video = videoRef.current
        if (!video) throw new Error('Nie udało się przygotować podglądu kamery.')
        const formats = ['ean_13', 'ean_8', 'upc_a', 'itf']
        let detector: NativeDetector | undefined
        if (hasDetector(window)) {
          const supported = window.BarcodeDetector.getSupportedFormats
            ? await window.BarcodeDetector.getSupportedFormats() : formats
          const usable = formats.filter((format) => supported.includes(format))
          if (usable.length) detector = new window.BarcodeDetector({ formats: usable })
        }
        if (cancelled) return
        if (detector) {
          stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' } } })
          if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return }
          video.srcObject = stream
          await video.play()
          const activeDetector = detector
          async function scan() {
            if (cancelled) return
            try {
              if (video && video.readyState >= 2) {
                const values = await activeDetector.detect(video)
                for (const value of values) accept(value.rawValue)
              }
              if (!cancelled) timer = setTimeout(() => { void scan() }, 250)
            } catch {
              stop(); setRunning(false)
              setError('Skaner nie może odczytać obrazu. Wpisz kod ręcznie lub uruchom kamerę ponownie.')
            }
          }
          void scan()
        } else {
          const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
            import('@zxing/browser'), import('@zxing/library'),
          ])
          if (cancelled) return
          const reader = new BrowserMultiFormatReader(new Map([[DecodeHintType.POSSIBLE_FORMATS,
            [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.ITF],
          ]]))
          controls = await reader.decodeFromConstraints({
            audio: false, video: { facingMode: { ideal: 'environment' } },
          }, video, (result, frameError, scannerControls) => {
            if (result) {
              accept(result.getText())
              if (found) scannerControls.stop()
            } else if (frameError && !['NotFoundException', 'ChecksumException', 'FormatException'].includes(frameError.name)) {
              scannerControls.stop(); stop(); setRunning(false)
              setError('Błąd odczytu obrazu. Skorzystaj z ręcznego wpisywania kodu.')
            }
          })
          if (cancelled) controls.stop()
        }
      } catch (cause) {
        stop(); setRunning(false)
        const denied = cause instanceof DOMException && cause.name === 'NotAllowedError'
        setError(denied ? 'Brak zgody na kamerę. Możesz wpisać kod ręcznie lub zmienić uprawnienie przeglądarki.'
          : cause instanceof Error ? cause.message : 'Nie udało się uruchomić kamery. Wpisz kod ręcznie.')
      }
    }
    void start()
    return stop
  }, [running])
  return <div>
    {running && <video className="scanner-video" ref={videoRef} muted playsInline autoPlay aria-label="Podgląd skanera kodu kreskowego" />}
    {error && <Notice tone="error">{error}</Notice>}
    <Button variant="secondary" className="full-width" onClick={() => { setError(null); setRunning(!running) }}>
      {running ? <Square size={17} aria-hidden="true" /> : <Camera size={17} aria-hidden="true" />}
      {running ? 'Zatrzymaj kamerę' : 'Skanuj aparatem'}
    </Button>
    <p className="source-credit">Obraz jest przetwarzany na urządzeniu. Nie wysyłamy nagrania do serwera.</p>
  </div>
}
