import { Download, RefreshCw, Smartphone } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ANDROID_APK_URL, androidAppVersion, checkAppUpdate } from '../lib/native'
import { Button } from './ui'

/** In the Android app: current version and a manual update check. In a browser: how to install the app. */
export function AndroidAppPanel() {
  const version = androidAppVersion()
  if (version) {
    return <section className="panel"><h2>Aplikacja na Androida</h2>
      <p><Smartphone size={17} aria-hidden="true" /> Korzystasz z aplikacji Flexa na Androida, wersja {version}.</p>
      <p>Aplikacja sprawdza aktualizacje przy każdym uruchomieniu i sama proponuje instalację. Zmiany w samym dzienniku widać od razu, bez instalowania.</p>
      <div className="button-row"><Button variant="secondary" onClick={() => { checkAppUpdate() }}><RefreshCw size={17} aria-hidden="true" />Sprawdź aktualizacje</Button></div>
    </section>
  }
  return <section className="panel"><h2>Aplikacja na Androida</h2>
    <p>Zainstaluj Flexa na telefonie jak zwykłą aplikację. Aktualizuje się sama: gdy pojawi się nowa wersja, zobaczysz propozycję instalacji.</p>
    <ol className="app-steps">
      <li>Pobierz plik APK.</li>
      <li>Gdy Android zapyta, zezwól przeglądarce na instalację z tego źródła.</li>
      <li>Otwórz pobrany plik i dotknij „Zainstaluj”.</li>
    </ol>
    <div className="button-row"><a className="button button-secondary" href={ANDROID_APK_URL} rel="noopener"><Download size={17} aria-hidden="true" />Pobierz Flexa (APK)</a></div>
    <p className="source-credit">Wymaga Androida 8.0 lub nowszego. Plik jest podpisany kluczem Flexa; odcisk certyfikatu znajdziesz na stronie <Link to="/sources">Źródła i licencje</Link>.</p>
  </section>
}
