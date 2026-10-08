import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { canInstall, isStandalone, onInstallAvailabilityChange, promptInstall } from '../lib/pwa'

/** Przycisk „Zainstaluj Flexa” — widoczny tylko wtedy, gdy przeglądarka pozwala zainstalować aplikację. */
export function InstallButton({ className = 'text-link' }: { className?: string }) {
  const [available, setAvailable] = useState(() => canInstall() && !isStandalone())
  useEffect(() => onInstallAvailabilityChange(() => setAvailable(canInstall() && !isStandalone())), [])
  if (!available) return null
  return <button type="button" className={className} onClick={() => { void promptInstall() }}>
    <Download size={16} aria-hidden="true" />Zainstaluj Flexa
  </button>
}
