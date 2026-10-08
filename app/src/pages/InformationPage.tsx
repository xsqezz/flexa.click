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
        Wersja zgody: 6 października 2026. Informację o poczcie, planie treningowym i filmach instruktażowych uzupełniono 7 października 2026, a o Smart Kuchni — 8 października 2026.</p>
      <h2>Co zapisujemy i dlaczego</h2>
      <p>Adres e-mail i dane uwierzytelnienia obsługuje Supabase Auth. Profil, wybrane cele, posiłki, własne produkty, wodę, aktywności, pomiary oraz — jeśli go utworzysz — plan treningowy przechowujemy, aby prowadzić Twój prywatny dziennik i synchronizować go między urządzeniami.
        Dane o zdrowiu mogą należeć do szczególnych kategorii danych. Rejestracja wymaga wyraźnej zgody na ich przetwarzanie w tym celu i potwierdzenia pełnoletności.</p>
      <h2>Plan treningowy</h2>
      <p>Ankieta „Zanim zaczniesz” i plan są opcjonalne. Plan układa aplikacja w Twojej przeglądarce według stałych reguł treningowych — bez AI i bez wysyłania odpowiedzi do zewnętrznych usług. Na koncie zapisujemy odpowiedzi z ankiety (wiek, płeć, cel, miejsce i sprzęt, doświadczenie, dni i długość treningu) oraz gotowy plan, aby był dostępny na każdym urządzeniu.</p>
      <p>Informacje o zdrowiu z ankiety, czyli zgłoszone dolegliwości i łagodny start po konsultacji z lekarzem, zapisujemy tylko po zaznaczeniu osobnej zgody w ankiecie. Bez niej baza odrzuca te informacje, a przy zgodzie zapisuje czas jej udzielenia. Zgodę wycofasz, usuwając plan w zakładce Plan albo zapisując odpowiedzi bez informacji o zdrowiu. Usunięcie planu kasuje też odpowiedzi; treningi zapisane w dzienniku zostają. Plan to ogólne wskazówki treningowe, a nie porada medyczna.</p>
      <h2>Prowadzony trening i filmy instruktażowe</h2>
      <p>Postęp rozpoczętego treningu (numer kroku, wykonane i pominięte ćwiczenia, czas przerwy) zapisujemy tylko w pamięci tego urządzenia, aby można było go wznowić; po 12 godzinach przestaje być używany. Do bazy trafia jedynie trening, który sam zapiszesz w dzienniku.</p>
      <p>Przy ćwiczeniach możesz obejrzeć film z YouTube. Odtwarzacz ładuje się dopiero po kliknięciu „Odtwórz film” i działa w trybie rozszerzonej prywatności (youtube-nocookie.com). Od tej chwili Google otrzymuje adres IP i dane techniczne przeglądarki, a po odtworzeniu może zapisywać dane w przeglądarce według własnej polityki prywatności. Wybór zapamiętujemy lokalnie, aby kolejne filmy ładowały się bez pytania; cofniesz go przyciskiem „Nie ładuj filmów automatycznie”.</p>
      <h2>Usługi zewnętrzne</h2>
      <p>Cloudflare dostarcza aplikację. Supabase przechowuje dane w regionie wybranym przez administratora projektu. Wyszukiwanie wysyła do Open Food Facts i opcjonalnie USDA jedynie tekst zapytania lub kod produktu, nie cały dziennik, wagę czy profil. Dostawcy mają własne polityki prywatności i mogą zapisywać techniczne logi żądań.</p>
      <p>Wiadomości potwierdzające adres e-mail i umożliwiające odzyskanie hasła wysyła Brevo. Supabase przekazuje mu adres odbiorcy i treść wiadomości, w tym link weryfikacyjny. Nie przekazujemy Brevo Twojego hasła ani treści dziennika. Dostawca może zapisywać dane dostarczenia wiadomości i kliknięć w linki; w obecnej konfiguracji SMTP linki są przekierowywane przez jego usługę śledzenia.</p>
      <p>Do działania kont używamy niezbędnego zapisu sesji w przeglądarce. W samej aplikacji nie dodaliśmy reklam, narzędzi analitycznych ani śledzących plików cookie. Hosting i backend mogą prowadzić techniczne logi, a ich zakres administrator musi ocenić przed publicznym uruchomieniem.</p>
      <h2>Smart Kuchnia</h2>
      <p>Wybrane produkty, preferencje (czas, sprzęt, alergie i produkty, których nie lubisz) oraz przepisy zostają w przeglądarce tego urządzenia; przepisy układa aplikacja według stałych reguł, a wartości odżywcze są szacunkami liczonymi ze składników. Na konto trafia tylko to, co sam dodasz do dziennika jako posiłek.</p>
      <p>Zdjęcie lodówki jest opcjonalne i działa po zalogowaniu. Dopiero po zaznaczeniu zgody pomniejszamy je w przeglądarce, usuwamy dane EXIF (np. lokalizację) i wysyłamy przez funkcję Flexa do modelu Cloudflare Workers AI, który wypisuje widoczne produkty. Nie zapisujemy zdjęcia ani jego treści. Podglądowe zdjęcie potrawy generuje drugi model na podstawie samych nazw składników i rodzaju dania — nie wysyłamy do niego Twojego zdjęcia ani danych z konta. Zliczamy dzienne użycie na konto (kilka zdjęć i obrazów dziennie), aby mieścić się w darmowym limicie. Cloudflare może zapisywać techniczne logi żądań. Wygenerowane obrazy są poglądowe i mogą odbiegać od prawdziwego dania. Zgodę na zdjęcia cofniesz w panelu zdjęcia w Smart Kuchni przyciskiem „Cofnij zgodę”.</p>
      <h2>Kamera i pliki aktywności</h2>
      <p>Skaner prosi o zgodę na kamerę. Obraz jest odczytywany lokalnie i kamera zostaje zatrzymana po skanie lub zamknięciu panelu. Import GPX/TCX również odbywa się lokalnie. Do bazy trafiają tylko zatwierdzone podsumowania, nie współrzędne ani oryginalny plik.</p>
      <h2>Eksport, poprawianie i usunięcie</h2>
      <p>W ustawieniach możesz pobrać eksport JSON (zawiera także plan treningowy z odpowiedziami), zmienić cele oraz usunąć konto. Odpowiedzi z ankiety zmienisz w zakładce Plan. Pomyłkę w zapisie posiłku lub treningu poprawisz przez usunięcie wpisu i dodanie prawidłowego. Pomiar zapisany ponownie w tym samym dniu zastępuje poprzedni.</p>
      <p>Usunięcie konta usuwa powiązane rekordy z aktywnej bazy. Techniczne logi i ewentualne kopie dostawcy wygasają według jego zasad retencji; administrator musi podać obowiązujący zakres przed publicznym startem. Nie obiecujemy natychmiastowego usunięcia z każdej kopii infrastruktury.</p>
      <p>Dane przechowujemy podczas korzystania z konta do jego usunięcia. Możesz wycofać zgodę, żądać dostępu, sprostowania, ograniczenia przetwarzania lub usunięcia przez kontakt z administratorem oraz złożyć skargę do właściwego organu ochrony danych, w Polsce UODO.</p>
      <h2>Osobny tryb demonstracyjny</h2>
      <p>Początkowe dane demo są przykładowe. Dziennik pozostaje w lokalnej pamięci urządzenia, nie tworzy konta i nie ma synchronizacji. Wyszukiwanie i skanowanie korzystają z rzeczywistego Open Food Facts: dostawca otrzymuje zapytanie lub kod oraz techniczne dane połączenia, w tym adres IP, ale nie cały dziennik. „Wyzeruj demo” usuwa lokalny zapis; wyjście z demo samo go nie kasuje.</p>
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
      <h2>Filmy instruktażowe</h2>
      <p>Do ćwiczeń w planie dołączamy publicznie dostępne filmy z YouTube, osadzane oficjalnym odtwarzaczem dopiero po kliknięciu. Prawa do nagrań mają ich autorzy; przy filmie pokazujemy tytuł i kanał. Nie kopiujemy ani nie hostujemy nagrań, a dostępność każdego filmu sprawdzamy przez oficjalny interfejs oEmbed. Gdy filmu brakuje, aplikacja proponuje wyszukanie ćwiczenia na YouTube.</p>
      <h2>Smart Kuchnia</h2>
      <p>Wartości odżywcze około 170 składników to zaokrąglone, przybliżone średnie z ogólnodostępnych tablic składu żywności (m.in. USDA FoodData Central i polskich tabel); konkretny produkt może się różnić, więc sprawdzaj etykietę. Przepisy powstają z reguł zapisanych w aplikacji, a nie z kopiowania serwisów kulinarnych. Rozpoznawanie produktów na zdjęciu i podglądowe obrazy potraw korzystają z modeli dostępnych w Cloudflare Workers AI (m.in. Meta Llama 4 Scout oraz FLUX.1 schnell od Black Forest Labs) na licencjach ich autorów.</p>
      <h2>Czego obecnie nie obiecujemy</h2>
      <p>API Stravy zabrania aplikacji konkurujących z jej funkcjami; integracja jest wyłączona do uzyskania akceptacji.
        Nie ma dostępu do jej segmentów czy rankingów. Apple Health i Health Connect nie są dostępne bez natywnej integracji. Szacowanie kalorii gotowych posiłków ze zdjęcia talerza, społeczność i mapy tras nie są częścią tej wersji; zdjęcie w Smart Kuchni służy wyłącznie do rozpoznania produktów.</p>
      <h2>Bezpłatność i zdrowie</h2>
      <p>Funkcje Flexa nie mają paywalla. Domena, utrzymanie i limity dostawców nadal mogą wiązać się z kosztami. Wartości kalorii i obciążenia to dane lub szacunki, nie diagnoza ani indywidualne zalecenia zdrowotne.</p>
      <p>Kod i instrukcje wdrożenia: <a href="https://github.com/xsqezz/flexa.click" target="_blank" rel="noreferrer">xsqezz/flexa.click</a>.</p>
    </>}
    <footer><Link to={kind === 'privacy' ? '/sources' : '/privacy'}>{kind === 'privacy' ? 'Źródła danych i licencje' : 'Polityka prywatności'}</Link></footer>
  </main>
}
