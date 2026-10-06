# Flexa: research i źródła

Zweryfikowano 6 października 2026 w źródłach oficjalnych.
„Strive” z pierwotnego briefu potraktowano jako Stravę, zgodnie z zaakceptowanym planem.
Flexa jest niezależnym projektem, nie kopią interfejsu ani baz konkurentów.

## Co robią pierwowzory

[Fitatu](https://www.fitatu.com/) jest dziennikiem żywieniowym: produkty, kody,
porcje, kalorie/makro, woda, cele i pomiary. Oficjalna strona wymienia w Premium
m.in. brak reklam, wszystkie przepisy, dostęp przez komputer, post przerywany
i synchronizacje; Premium+AI dodaje szacowanie posiłków ze zdjęcia/nazwy.
Skanera kodów **nie przedstawiamy jako funkcji płatnej Fitatu**.

[Strava](https://www.strava.com/features) to rejestrowanie aktywności, trasy,
społeczność, segmenty i treningi. Subskrypcja obejmuje m.in. rozbudowane analizy,
cele, planowanie tras i rankingi. Flexa udostępnia własne analizy dziennika,
tempa i subiektywnego obciążenia, nie dane, algorytmy ani rankingi Stravy.

| Obszar | W Flexa bez paywalla | Granica tej wersji |
| --- | --- | --- |
| Kalorie/makro, kody, własne cele | Tak | Dane nie są gwarantowane ani medycznie zweryfikowane |
| Korzystanie przez komputer i konta | Tak, po konfiguracji | Hosting i SMTP mają limity |
| Raporty, historia pomiarów, eksport | Tak | Brak prognoz medycznych |
| Treningi, tempo, minuty × RPE | Tak | To nie Strava Relative Effort / Fitness & Freshness |
| Import własnych GPX/TCX | Tak | Nie importujemy FIT/ZIP ani plików wielu aktywności |
| Rozpoznawanie posiłków AI | Nie | Brak wiarygodnej, nielimitowanej darmowej usługi |
| Społeczność, segmenty, trasy, Health APIs | Nie | Wymagają osobnego rozwoju i często dostępu natywnego |

## Jak zdobyć produkty najtaniej

**Open Food Facts jako podstawowe źródło**:
[API](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/),
[eksporty](https://world.openfoodfacts.org/data).
Międzynarodowy, bezpłatny katalog zawiera EAN/UPC i składniki odżywcze.
Nie obiecujemy konkretnej liczby polskich produktów ani pełnego pokrycia sklepów.
API v3 służy do pojedynczych produktów; obecnie full-text nadal wymaga legacy
`cgi/search.pl` albo osobnej integracji Search-a-licious. Dlatego nie używamy
fikcyjnego `/api/v3/search`.

Dokumentacja podaje 15 odczytów produktu/min/IP i 10 wyszukiwań/min/IP.
Backend używa odpowiednio 14 i 8 oraz pamięciowego cache 5 minut.
Należy zgłosić wykorzystanie API i podać prawdziwy kontakt w User-Agent.
Przy większej skali pobrać eksport, nie skanować API ani zwiększać arbitralnie
limitów. Wspólne adresy IP usług serverless mogą dodatkowo ograniczać dostęp.

**USDA FoodData Central jako opcjonalne uzupełnienie**:
[API i licencja](https://fdc.nal.usda.gov/api-guide/),
[darmowy klucz](https://fdc.nal.usda.gov/api-key-signup/),
[eksporty](https://fdc.nal.usda.gov/download-datasets/).
Dane CC0, szczególnie użyteczne dla produktów z USA i podstawowych składników.
Domyślnie 1000 żądań/h/IP. Demo key ma tylko 30/h i 50/dzień — nie używamy go
w produkcji. Klucz ma pozostać na serwerze. Wyniki wyszukiwania GTIN są filtrowane
do dokładnego odpowiednika kodu, także z zerami wiodącymi.

**Własne etykiety** wypełniają pozostałe luki. Są prywatne. Nie publikujemy
osobistych dzienników jako bazy produktów. Przyszły publiczny katalog danych
pochodnych OFF musi mieć oddzielny model licencyjny i eksport zgodny z ODbL.

## Licencje i jakość

OFF: baza ODbL, treści DbCL, zdjęcia CC BY-SA. Atrybucja jest w wyszukiwaniu,
szczegółach produktu i źródłach aplikacji. Nie pobieramy zdjęć produktów.
ODbL obejmuje share-alike publicznie używanej adaptowanej bazy — „darmowe” nie
znaczy „bez warunków”. USDA: domena publiczna/CC0 z zalecaną atrybucją.
Nie kopiować baz Fitatu, baz GS1 ani katalogów sklepów bez uprawnień.

Brakujące wartości są `null`, nie zero. Wartości na 100 g i 100 ml nie są
traktowane jako zamienne: użytkownik potwierdza podstawę etykiety.
Snapshot produktu w dzienniku nie zmienia się wraz z późniejszą edycją katalogu.

## Pozostałe potrzebne zasoby

| Potrzeba | Źródło | Koszt/limit na start |
| --- | --- | --- |
| Publiczny landing | [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) | Bezpłatny w odpowiednim planie; statyczny, nie hosting komercyjnego SaaS ani wrażliwych transakcji |
| Frontend aplikacji | [Cloudflare Pages](https://developers.cloudflare.com/pages/platform/limits/) | Free: 500 buildów/mies., 20 000 plików, 25 MiB/plik |
| Auth, Postgres, funkcje | [Supabase Free](https://supabase.com/pricing) | 500 MB DB, 50 000 MAU, 1 GB Storage, 5 GB egress; pauza po tygodniu bezczynności |
| E-maile rejestracji/resetu | [Resend SMTP](https://resend.com/pricing), [integracja](https://resend.com/docs/send-with-supabase-smtp) | 3000/mies., 100/dzień; zweryfikowana domena. Alternatywa: własny SMTP/Brevo |
| TLS/DNS | GitHub / Cloudflare / rejestrator | TLS i DNS mogą być darmowe; samą domenę trzeba kupić/odnawiać |
| Skaner | [BarcodeDetector](https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector), [ZXing browser](https://github.com/zxing-js/browser) | Lokalnie, biblioteka open source; kamera wymaga HTTPS i zgody |
| Kopie danych | Supabase CLI / pg_dump + bezpieczne własne storage | Free nie daje automatycznych backupów; eksport użytkownika nie zastępuje backupu DB |
| Monitorowanie | Panele Cloudflare/Supabase i alerty limitów | Na początek bez dodatkowego SDK śledzącego |
| Przyszłe mapy | MapLibre + dostawca kafelków | Dane OSM są otwarte, serwery nie są nielimitowanym CDN; [polityka OSM](https://operations.osmfoundation.org/policies/tiles/) zabrania bulk/offline prefetch |

Wbudowany [SMTP Supabase](https://supabase.com/docs/guides/auth/auth-smtp)
obsługuje wyłącznie adresy zespołu i ma obecnie limit 2 wiadomości/h.
**Własny SMTP jest warunkiem publicznej rejestracji**. Nie wyłączać potwierdzania
adresu, by ukryć brak działającej poczty.

## Dlaczego Strava API nie jest włączone

[Regulamin](https://www.strava.com/legal/api) wprost zabrania aplikacji
konkurujących lub odtwarzających funkcje Stravy. Dane użytkownika z API wolno
pokazywać wyłącznie temu użytkownikowi. [Limity](https://developers.strava.com/docs/rate-limits/)
i liczba sportowców dodatkowo ograniczają integrację; nowa aplikacja zaczyna
z jednym sportowcem, a większy dostęp wymaga przeglądu.

Zamiast omijać ograniczenie dostarczamy import plików użytkownika. Uruchomienie
OAuth wymaga odrębnej oceny i akceptacji Stravy. Nie kupujemy ani nie scrapujemy
dostępu do jej płatnych rankingów i tras. Apple Health / Health Connect wymagają
osobnej aplikacji natywnej, nie działają przez sam statyczny frontend.

## Bezpłatność nie jest obietnicą darmowej infrastruktury na zawsze

Flexa nie ma płatnego planu. Darmowy start jest realny dla małej instalacji, ale
nie gwarantuje SLA, nieograniczonego ruchu, darmowej domeny ani niezmiennych
regulaminów dostawców. Monitoruj bazę, transfer, funkcje, pocztę i koszty
odnowienia domeny; planuj migrację lub finansowanie zanim przekroczysz limity.
