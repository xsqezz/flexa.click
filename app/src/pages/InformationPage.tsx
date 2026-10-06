import { Link } from 'react-router-dom'
import { Brand, Notice } from '../components/ui'
import { privacyContact, privacyOperator } from '../lib/supabase'

export function InformationPage({ kind }: { kind: 'privacy' | 'sources' }) {
  return <main className="information-page">
    <header><Brand /><Link className="text-link" to="/">Wróć do aplikacji</Link></header>
    {kind === 'privacy' ? <>
      <h1>Twój dziennik. Twoja prywatność.</h1>
      {(!privacyOperator || !privacyContact) && <Notice>Informacje o administratorze nie są jeszcze skonfigurowane. Publiczna rejestracja pozostaje wyłączona. Demo nie wysyła dziennika do chmury.</Notice>}
      <p>Administrator: {privacyOperator || 'do uzupełnienia przed uruchomieniem kont'}. Kontakt: {privacyContact ? <a href={`mailto:${privacyContact}`}>{privacyContact}</a> : 'do uzupełnienia'}.
        Wersja informacji i zgody: 6 października 2026.</p>
      <h2>Co zapisujemy i dlaczego</h2>
      <p>Adres e-mail i dane uwierzytelnienia obsługuje Supabase Auth. Profil, wybrane cele, posiłki, własne produkty, wodę, aktywności oraz pomiary przechowujemy, aby prowadzić Twój prywatny dziennik i synchronizować go między urządzeniami.
        Dane o zdrowiu mogą należeć do szczególnych kategorii danych. Rejestracja wymaga wyraźnej zgody na ich przetwarzanie w tym celu i potwierdzenia pełnoletności.</p>
      <h2>Usługi zewnętrzne</h2>
      <p>Cloudflare dostarcza aplikację. Supabase przechowuje dane w regionie wybranym przez administratora projektu. Wyszukiwanie wysyła do Open Food Facts i opcjonalnie USDA jedynie tekst zapytania lub kod produktu, nie cały dziennik, wagę czy profil. Dostawcy mają własne polityki prywatności i mogą zapisywać techniczne logi żądań.</p>
      <p>Do działania kont używamy niezbędnego zapisu sesji w przeglądarce. Nie dodaliśmy reklam, narzędzi analitycznych ani śledzących plików cookie. Hosting i backend mogą prowadzić techniczne logi, a ich zakres administrator musi ocenić przed publicznym uruchomieniem.</p>
      <h2>Kamera i pliki aktywności</h2>
      <p>Skaner prosi o zgodę na kamerę. Obraz jest odczytywany lokalnie i kamera zostaje zatrzymana po skanie lub zamknięciu panelu. Import GPX/TCX również odbywa się lokalnie. Do bazy trafiają tylko zatwierdzone podsumowania, nie współrzędne ani oryginalny plik.</p>
      <h2>Eksport, poprawianie i usunięcie</h2>
      <p>W ustawieniach możesz pobrać eksport JSON, zmienić cele oraz usunąć konto. Pomyłkę w zapisie posiłku lub treningu poprawisz przez usunięcie wpisu i dodanie prawidłowego. Pomiar zapisany ponownie w tym samym dniu zastępuje poprzedni.</p>
      <p>Usunięcie konta usuwa powiązane rekordy z aktywnej bazy. Techniczne logi i ewentualne kopie dostawcy wygasają według jego zasad retencji; administrator musi podać obowiązujący zakres przed publicznym startem. Nie obiecujemy natychmiastowego usunięcia z każdej kopii infrastruktury.</p>
      <p>Dane przechowujemy podczas korzystania z konta do jego usunięcia. Możesz wycofać zgodę, żądać dostępu, sprostowania, ograniczenia przetwarzania lub usunięcia przez kontakt z administratorem oraz złożyć skargę do właściwego organu ochrony danych, w Polsce UODO.</p>
      <h2>Osobny tryb demonstracyjny</h2>
      <p>Dane demo są przykładowe. Pozostają w lokalnej pamięci urządzenia, nie tworzą konta i nie mają synchronizacji. „Wyzeruj demo” usuwa ten lokalny zapis; wyjście z demo samo go nie kasuje.</p>
      <h2>Przed publicznym uruchomieniem</h2>
      <p>Administrator powinien uzupełnić tożsamość i kontakt, faktyczny region przetwarzania, okresy retencji oraz umowy z dostawcami i ocenić zgodność z RODO. Ten tekst opisuje implementację, nie jest certyfikatem zgodności ani poradą prawną.</p>
    </> : <>
      <h1>Dobre dane mają swoje źródło.</h1>
      <p>Flexa to niezależny, darmowy dziennik jedzenia i ruchu. Inspiracją funkcjonalną są narzędzia do żywienia i aktywności, ale nie kopiujemy ich kodu, bazy produktów, marki ani chronionych materiałów.</p>
      <h2>Open Food Facts</h2>
      <p>Zawiera dane produktów z kodami EAN/UPC. Jest tworzone społecznościowo — kompletność i poprawność nie są gwarantowane.
        Korzystamy z <a href="https://world.openfoodfacts.org/data" target="_blank" rel="noreferrer">Open Food Facts</a>, dostępnego na licencji <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">Open Database License</a> (ODbL).
        Treści bazy są na DbCL; zdjęcia na CC BY-SA. W tej wersji nie pobieramy zdjęć produktów ani nie publikujemy połączonej bazy.</p>
      <p>Wyszukiwanie odbywa się po zatwierdzeniu zapytania, nie z każdym znakiem. Krótki cache jest pamięciowy. Prywatny dziennik jest osobny od katalogu; rozwój publicznego katalogu wymaga zachowania atrybucji i share-alike.</p>
      <h2>USDA FoodData Central</h2>
      <p>Opcjonalne drugie źródło: <a href="https://fdc.nal.usda.gov/api-guide/" target="_blank" rel="noreferrer">U.S. Department of Agriculture, Agricultural Research Service. FoodData Central</a>.
        Dane są w domenie publicznej (CC0). Darmowy klucz API pozostaje na serwerze. Produkty z USA nie gwarantują pokrycia polskich sklepów, a wynik po kodzie wymaga dokładnego dopasowania.</p>
      <h2>Twoje produkty i aktywności</h2>
      <p>Własne produkty są prywatne. Brakującego makro nie zamieniamy w zero. Podstawę 100 g lub 100 ml potwierdzasz z etykiety.
        Ręczne treningi i własne GPX/TCX nie wymagają integracji z producentem urządzenia. Dystans GPX jest wyliczany z geometrii punktów i może zależeć od jakości GPS; czas sumuje czas segmentów, nie jest automatycznym „czasem ruchu”.</p>
      <h2>Czego obecnie nie obiecujemy</h2>
      <p>API Stravy zabrania aplikacji konkurujących z jej funkcjami; integracja jest wyłączona do uzyskania akceptacji.
        Nie ma dostępu do jej segmentów czy rankingów. Apple Health i Health Connect nie są dostępne bez natywnej integracji. Zdjęciowe szacowanie posiłków, społeczność i mapy tras nie są częścią tej wersji.</p>
      <h2>Bezpłatność i zdrowie</h2>
      <p>Funkcje Flexa nie mają paywalla. Domena, utrzymanie i limity dostawców nadal mogą wiązać się z kosztami. Wartości kalorii i obciążenia to dane lub szacunki, nie diagnoza ani indywidualne zalecenia zdrowotne.</p>
      <p>Kod i instrukcje wdrożenia: <a href="https://github.com/xsqezz/flexa.click" target="_blank" rel="noreferrer">xsqezz/flexa.click</a>.</p>
    </>}
    <footer><Link to={kind === 'privacy' ? '/sources' : '/privacy'}>{kind === 'privacy' ? 'Źródła danych i licencje' : 'Polityka prywatności'}</Link></footer>
  </main>
}
