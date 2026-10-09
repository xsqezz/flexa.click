import { Share2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Brand, Button } from '../components/ui'
import { useFeedback } from '../components/Feedback'
import { changelog } from '../lib/changelog'
import { InstallButton } from '../components/InstallButton'
import { ANDROID_APK_URL, androidAppVersion } from '../lib/native'
import { privacyContact } from '../lib/supabase'

/** „O Flexa”: czym jest aplikacja, jak się po niej poruszać, zasady i kontakt. */
const SITE_URL = 'https://xsqezz.github.io/flexa.click/'

function ShareFlexa() {
  const feedback = useFeedback()
  async function share() {
    const data = { title: 'Flexa', text: 'Flexa — darmowy polski dziennik jedzenia, treningów i postępów.', url: SITE_URL }
    try {
      if (typeof navigator.share === 'function') await navigator.share(data)
      else { await navigator.clipboard.writeText(SITE_URL); feedback('Link do Flexa skopiowany do schowka.') }
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === 'AbortError')) feedback('Nie udało się udostępnić linku.', { tone: 'error' })
    }
  }
  return <Button variant="secondary" onClick={() => { void share() }}><Share2 size={17} aria-hidden="true" />Poleć Flexa znajomym</Button>
}

export function AboutPage() {
  const androidVersion = androidAppVersion()
  return <main className="information-page">
    <header><Brand /><Link className="text-link" to="/">Wróć do aplikacji</Link></header>
    <h1>O Flexa</h1>
    <p>Flexa to darmowy, polski dziennik jedzenia, treningów i postępów. Jedno miejsce na posiłki, wodę, plan treningowy, przepisy z tego, co masz w domu, i spokojne spojrzenie na cały tydzień. Bez abonamentu, reklam i rankingów.</p>

    <h2>Jak się poruszać</h2>
    <ul>
      <li><strong>Cele</strong> — ekran startowy: zatwierdzone kalorie, makroskładniki i woda, bieżąca i docelowa masa, historia dziennych zapisów oraz cykli. Fazy zmieniasz wyłącznie samodzielnie.</li>
      <li><strong>Posiłki</strong> — pasek dni tygodnia, wpisy według pory dnia, kopiowanie posiłków i zestawy. Przycisk „Skanuj posiłek ze zdjęcia” zamienia zdjęcie tacy lub talerza w listę pozycji z kaloriami w zakresie, którą poprawiasz i zatwierdzasz.</li>
      <li><strong>Kuchnia</strong> — Smart Kuchnia układa przepis z produktów, które masz.</li>
      <li><strong>Treningi</strong> — plan prowadzi przez trening krok po kroku.</li>
      <li><strong>Ruch</strong> — zapisane aktywności, historia ćwiczeń i import GPX/TCX.</li>
      <li><strong>Postępy</strong> — wykresy pomiarów, trendu wagi i odczuwalnego obciążenia.</li>
      <li><strong>Dodaj</strong> (przycisk „+”) — posiłek, skan kodu, woda, trening albo pomiar z każdego ekranu.</li>
      <li><strong>Konto</strong> (w prawym górnym rogu) — ustawienia profilu, eksport danych, przypomnienia w aplikacji na Androida i usunięcie konta.</li>
    </ul>
    <p>Na telefonie przesuń palcem w lewo lub w prawo na ekranach „Cele” i „Posiłki”, żeby zmienić dzień. Usunięty wpis możesz przywrócić przyciskiem „Cofnij” w komunikacie, który pojawia się na kilka sekund.</p>

    <h2>Skróty klawiszowe</h2>
    <div className="table-scroll"><table>
      <caption className="sr-only">Skróty klawiszowe</caption>
      <thead><tr><th scope="col">Klawisze</th><th scope="col">Działanie</th></tr></thead>
      <tbody>
        <tr><td><kbd>Ctrl</kbd> + <kbd>K</kbd> albo <kbd>/</kbd></td><td>Szukaj stron, akcji i wpisów</td></tr>
        <tr><td><kbd>←</kbd> <kbd>→</kbd></td><td>Poprzedni i następny dzień</td></tr>
        <tr><td><kbd>T</kbd></td><td>Wróć do dzisiaj</td></tr>
        <tr><td><kbd>Esc</kbd></td><td>Zamknij panel lub okno</td></tr>
      </tbody>
    </table></div>

    <h2>Na telefonie</h2>
    <p>Na Androidzie zainstaluj <a href={ANDROID_APK_URL} rel="noopener">aplikację Flexa (APK)</a> — sama proponuje aktualizacje. Na iPhonie otwórz Flexa w Safari i wybierz „Udostępnij”, a potem „Do ekranu początkowego”. Na komputerze w Chrome lub Edge możesz zainstalować Flexa z paska adresu.
      {androidVersion && <> Korzystasz teraz z aplikacji na Androida w wersji {androidVersion}.</>}</p>
    <InstallButton className="button button-secondary" />

    <ShareFlexa />

    <h2>Co nowego</h2>
    <div className="changelog">{changelog.map((entry) => <section key={entry.title}>
      <h3>{entry.title} <small>{new Date(`${entry.date}T12:00:00`).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}</small></h3>
      <ul>{entry.points.map((point) => <li key={point}>{point}</li>)}</ul>
    </section>)}</div>

    <h2>Zasady</h2>
    <ul>
      <li>Zapisywanie ma być proste, a nie stać się kolejnym obowiązkiem.</li>
      <li>Twoje wpisy są prywatne i przenośne: eksport JSON i CSV, przywracanie kopii i usunięcie konta są zawsze dostępne.</li>
      <li>Pokazujemy źródło i ograniczenia danych o produktach. Brakującej wartości nie zamieniamy w zero.</li>
      <li>Nie mylimy szacunków, danych demo ani niepełnej konfiguracji z rzeczywistością.</li>
      <li>Flexa nie daje porad medycznych. Cele i plany to ogólne wskazówki.</li>
    </ul>

    <h2>Kontakt i kod</h2>
    <p>{privacyContact ? <>Pytania i uwagi: <a href={`mailto:${privacyContact}`}>{privacyContact}</a>. </> : null}
      Kod, instrukcje i zgłoszenia: <a href="https://github.com/xsqezz/flexa.click" target="_blank" rel="noreferrer">github.com/xsqezz/flexa.click</a>. Strona projektu: <a href="https://xsqezz.github.io/flexa.click/" target="_blank" rel="noreferrer">xsqezz.github.io/flexa.click</a>.</p>
    <footer><Link to="/privacy">Polityka prywatności</Link> · <Link to="/sources">Źródła danych i licencje</Link></footer>
  </main>
}
