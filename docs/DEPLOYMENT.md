# Wdrożenie Flexa

Projekt ma dwa niezależne frontendowe artefakty:
`app/dist` (aplikacja z kontami, Cloudflare Pages) oraz `dist-site`
(landing/dokumentacja i lokalne demo, GitHub Pages).
Nie publikuj całej aplikacji z logowaniem i dziennikami na GitHub Pages.

## Bieżące środowisko

Środowisko uruchomione 7 października 2026, rozszerzone o cele i cykle:

- Aplikacja: `https://flexa-click.pages.dev`, Cloudflare Pages z gałęzi `main`,
  Node 24, `npm run build`, katalog wynikowy `app/dist`.
- Osobny projekt Supabase `Flexa`: Frankfurt (`eu-central-1`), migracje
  migracje w `supabase/migrations` aż do `202610100001_goal_cycles.sql`,
  RLS i funkcje
  `food-search` oraz `account-delete`.
- Rejestracja e-mail z potwierdzeniem adresu, minimum hasła 10 znaków,
  redirecty tylko do działającej aplikacji i jej `/reset-password`.
- SMTP Brevo z osobnym kluczem Flexa oraz polskimi szablonami potwierdzenia
  i odzyskiwania hasła. Konfiguracja pozostaje po stronie Supabase.
- `FLEXA_APP_URL` kieruje landing GitHub Pages do aplikacji z kontami.
  Osobne demo nadal zapisuje dane lokalnie.

Brevo Free udostępnia 300 wiadomości dziennie na całe konto. Supabase ma
ustawiony limit 300/h; nie jest to dodatkowa pula maili ani dzienny limit
gwarantowany samej Flexa. Nie włączono nowego hooka ani limitu 50/dzień.
Własne domeny `flexa.click` i `app.flexa.click` wymagają osobnego potwierdzenia
własności i konfiguracji DNS.

## Lokalny start i demo

Wymagany Node.js >= 24.

```powershell
npm ci
npm run dev
```

Otwórz `http://127.0.0.1:5173`. „Wypróbuj demo” działa bez zewnętrznego projektu.
Rejestracja bez konfiguracji nie udaje, że zapisuje konto.
Jeśli npm 12 blokuje postinstall Deno, sprawdź `npm install-scripts ls` i zatwierdź
wyłącznie zadeklarowany pakiet `deno`; reguła jest w package.json.

```powershell
Copy-Item app\.env.example app\.env
```

Uzupełnij publiczny URL i klucz **publishable/anon**, nie service_role.
`VITE_PRIVACY_OPERATOR` i `VITE_PRIVACY_CONTACT` są wymagane do rejestracji.
Po zmianach `.env` uruchom ponownie Vite. Nie dodawaj `.env` do Git.

## Supabase: baza i konta

1. Utwórz projekt Free w wybranym regionie; dla użytkowników z Polski rozważ UE.
2. W SQL Editor wykonaj po kolei wszystkie pliki z `supabase\migrations`
   aż do `202610100001_goal_cycles.sql` albo przez CLI `supabase db push`
   po połączeniu z projektem. Zrób kopię bazy przed migracją. Najpierw zastosuj
   i zweryfikuj migrację cykli w Supabase, dopiero potem opublikuj frontend:
   aplikacja odczytuje `goal_cycles` i `profiles.goals_setup_done_at` oraz używa
   `start_goal_cycle`, `save_flexa_profile` i `restore_goal_cycle_history`.
   Wcześniejsze migracje tworzą `training_plans` i `consume_kitchen_ai`.
3. Zostaw email confirmations włączone. Ustaw minimum hasła na 10 znaków.
4. Auth > URL Configuration: Site URL = faktyczny URL aplikacji; do allowlisty
   dodaj ten URL i `/reset-password` (oraz tylko potrzebne lokalne adresy).
   Nie używaj wildcardu wszystkich produkcyjnych preview domen.
5. Skonfiguruj własny SMTP, np. Resend: [instrukcja](https://resend.com/docs/send-with-supabase-smtp).
   Zweryfikuj domenę nadawcy i DKIM/SPF/DMARC. Wbudowany SMTP Supabase to nie
   działająca publiczna poczta: tylko adresy zespołu, obecnie 2 wiadomości/h.
6. Sprawdź szablony potwierdzenia i recovery, limity wysyłki oraz politykę retencji.
   PKCE wymaga otwarcia linku w tej samej przeglądarce, która rozpoczęła flow.
7. Rejestracja wymaga metadata zgody i pełnoletności; trigger tworzy profil.
   Zewnętrzni dostawcy OAuth nie są w tej wersji obsługiwani.

Tabele mają RLS i filtrowanie `auth.uid()`. Użytkownik nie może przepisać pól
audytu zgody. Usunięcie auth.users usuwa wszystkie powiązane dane przez CASCADE.
Publiczne API nie ma dostępu do prywatnego budżetu zapytań dostawców.
`training_plans` przyjmuje dolegliwości i łagodny start tylko z `healthConsent`;
trigger zapisuje `health_consent_at`, a ograniczenie bazy odrzuca dane zdrowotne bez zgody.
Istniejącym profilom migracja oznacza konfigurację celów jako ukończoną;
nowe konta przechodzą z ankiety do ustawienia celów (mogą pominąć krok).
`goal_cycles` ma RLS i tylko odczyt dla zalogowanego właściciela. Komendy
zatwierdzania cyklu, edycji bieżącego profilu i przywracania historycznych
cykli są transakcyjnymi funkcjami: import przyjmuje wyłącznie zakończone
cykle do konta bez historii, nie uruchamia fazy ani nie zmienia profilu.
Sprawdź granty/RLS, brak odczytu anonimowego i to, że błędny pomiar startowy
nie powoduje częściowego zapisu, zanim wdrożysz frontend.

## Supabase: funkcje

CLI może wymagać Docker do lokalnego serwowania; w tym repo testy bazy korzystają
z osadzonego Postgresa/PGlite, a nie z zewnętrznej bazy.

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
Copy-Item supabase\.env.example supabase\.env
```

Uzupełnij plik `supabase\.env`:

- `ALLOWED_ORIGINS`: dokładne originy, np. `https://app.flexa.click`.
- `OFF_CONTACT`: prawdziwy kontakt właściciela aplikacji do User-Agent.
- `OFF_BASE_URL`: produkcja `https://world.openfoodfacts.org`; testy
  `https://world.openfoodfacts.net`. Staging ma udokumentowane Basic Auth off/off.
- `USDA_API_KEY`: opcjonalny darmowy klucz [data.gov](https://fdc.nal.usda.gov/api-key-signup/).
  Nigdy zmienna VITE. Bez klucza USDA nie jest aktywne.

```powershell
npx supabase secrets set --env-file supabase\.env
npx supabase functions deploy food-search
npx supabase functions deploy account-delete
```

Hosted Supabase udostępnia URL, anon key i service_role w środowisku funkcji.
`verify_jwt=false` jest celowe: **każda funkcja sama weryfikuje bearer JWT przez
Supabase Auth getUser**, zamiast zależeć od starej walidacji gatewaya.
To nie publiczny anonimowy proxy. Konto usuwa się dopiero po ponownym sprawdzeniu
hasła i tekstu potwierdzającego; serwer nie loguje haseł, kluczy, zapytań ani plików.

Wyszukiwanie nie jest typeaheadem. Funkcja respektuje budżety OFF, cache
5 min w pamięci instancji i prywatne atomowe limity Postgresa. Limity globalne
lub współdzielone egress IP mogą nadal powodować 429 — aplikacja to pokazuje.
Pamięciowy cache znika przy restarcie i nie jest bazą wymagającą publikacji
prywatnych dzienników.

Zgłoś wykorzystanie OFF zgodnie z ich [dokumentacją](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/).
Nie zwiększaj budżetów bez uzgodnienia; duże katalogi pobieraj z eksportów.

## Aplikacja: Cloudflare Pages

Workers & Pages > Create > Pages > Import existing Git repository.

| Ustawienie | Wartość |
| --- | --- |
| Repo | xsqezz/flexa.click |
| Root directory | repozytorium (nie app) |
| Production branch | main |
| Build command | npm run build |
| Output directory | app/dist |
| Node | 24 |

Zmienne build: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
`VITE_PRIVACY_OPERATOR`, `VITE_PRIVACY_CONTACT`.
Powtórz potrzebne zmienne dla preview, ale nie kieruj testów produkcyjnymi
kontami ani plikami. Build nie wymaga USDA ani service_role.

Cloudflare domyślnie obsługuje fallback SPA, gdy nie ma root 404.html.
Sprawdź bezpośrednie wejścia na `/goals`, `/meals`, `/progress`, `/reset-password`.
Stary adres `/journal` przekierowuje do `/meals`, także w demo na GitHub Pages.
Plik `_headers` obejmuje CSP i uprawnienia kamery. Przy niestandardowej domenie
API Supabase zmień `connect-src` na jej faktyczny origin; nie rozszerzaj CSP do `*`.

### Smart Kuchnia: Workers AI

Rozpoznawanie produktów ze zdjęcia i poglądowy obraz potrawy działają w funkcji Pages
`functions/api/kitchen/[action].ts` (Pages Functions są wdrażane razem z aplikacją, gdy katalog
główny projektu to repozytorium). Reszta Smart Kuchni — przepisy, makro, zamienniki — działa
w przeglądarce i nie wymaga żadnej konfiguracji.

1. Cloudflare Pages > projekt > Settings > Bindings > Add > **Workers AI**, nazwa zmiennej `AI`
   (dla Production, a jeśli testujesz też Preview, osobno dla niego). Zmiana wymaga ponownego wdrożenia.
2. Funkcja korzysta z tych samych zmiennych co build (`VITE_SUPABASE_URL`,
   `VITE_SUPABASE_PUBLISHABLE_KEY`) odczytanych w czasie działania — ustaw je jako zmienne
   środowiska Pages dla Production (nie jako „build only”). Nie używa klucza service_role:
   tożsamość i dzienny limit sprawdza funkcja `consume_kitchen_ai` z tokenem zalogowanego użytkownika.
3. Modele: rozpoznawanie używa `@cf/google/gemma-4-26b-a4b-it` (tryb „thinking” wyłączony, bo
   bez tego odpowiedź trwa kilkadziesiąt sekund), awaryjnie `@cf/meta/llama-4-scout-17b-16e-instruct`;
   obraz potrawy — `@cf/black-forest-labs/flux-1-schnell`, awaryjnie SDXL Lightning. Aplikacja wysyła
   zdjęcie jako przegląd plus cztery powiększone wycinki (małe produkty na zatłoczonych półkach
   inaczej giną), czyli ok. 5 równoległych wywołań i ok. 30 neuronów na jedno zdjęcie. Modele
   „Paid access required” (np. GLM 5.3 Flash) nie działają na planie Free.
4. Workers AI ma na planie Workers Free 10 000 neuronów dziennie bez rozliczania nadwyżki; po
   przekroczeniu żądania kończą się błędem, a aplikacja wraca do ręcznego wyboru produktów i
   ilustracji składników. Limity per konto (12 zdjęć i 30 obrazów dziennie) ustawia `aiLimits`
   w `shared/kitchen/ai.ts`. Nie przechodź na plan płatny bez uzgodnienia.
5. Weryfikacja: `GET /api/kitchen/status` zwraca `{"available":true,...}`; bez bindingu lub zmiennych
   `available` jest `false` i interfejs ukrywa przesyłanie zdjęć. Obraz i zdjęcie są zwracane
   użytkownikowi, nie zapisywane.
6. **Skan posiłku** (`POST /api/meal/plate`, `functions/api/meal/[action].ts`) używa tego samego
   bindingu `AI`, tych samych modeli wizyjnych i tego samego dziennego budżetu `vision`
   (12 zdjęć na konto, wspólnie ze zdjęciem lodówki) — nie wymaga nowej migracji ani konfiguracji.
   Jedno żądanie to najwyżej dwa zdjęcia (całość i drugie ujęcie; bez wycinków), czyli 1–2 wywołania modelu.
   Model dostaje zamknięty katalog `shared/meal-scan/catalog.ts` i zwraca wyłącznie identyfikatory pozycji,
   rozmiar i liczbę sztuk; kalorie liczy `shared/meal-scan/estimate.ts` w przeglądarce. Wartości katalogu
   to uśrednione dane tabelaryczne — przy dodawaniu pozycji zachowaj spójność energii z makroskładnikami
   (pilnuje tego test w `app/src/lib/scan/scan.test.ts`).

## Landing i pełne demo: GitHub Pages

Settings > Pages > Source = GitHub Actions.
Workflow `.github/workflows/pages.yml` publikuje `dist-site`, wraz z aplikacją
demonstracyjną w `app/`. Build `npm run build:pages` używa względnych assetów
i HashRouter, więc działa zarówno pod ścieżką repozytorium, jak i po odświeżeniu.
Uruchamia się po zmianach aplikacji lub landingu na main albo ręcznie.
Konta, hasła i backend nie są częścią publicznego demo. Build odrzuca konfigurację
Supabase, aby nie opublikować wariantu z kontami na Pages.
Wyszukiwanie i skanowanie w tym wariancie odczytuje publiczny Open Food Facts
bez klucza i bez Supabase. Cache działa przez 5 minut; limity po stronie klienta
wynoszą 14 odczytów produktu i 8 wyszukiwań na minutę. Nie ma wyszukiwania
z każdym wpisanym znakiem. USDA pozostaje opcjonalne tylko w backendzie kont,
ponieważ jego klucza nie można publikować w statycznej aplikacji.

Zmienne repozytorium:

- `FLEXA_APP_URL`: faktyczny origin działającej aplikacji Cloudflare; bez ścieżki.
  Bez niego CTA otwiera dołączone demo, nie fikcyjne działające konto.
- `FLEXA_SITE_DOMAIN`: opcjonalnie `flexa.click`, **dopiero po potwierdzeniu
  własności i poprawnym DNS**. Bez niego nie generujemy CNAME.

```powershell
$env:FLEXA_APP_URL = 'https://app.flexa.click'
npm run build:pages
```

Zmiany samych repo variables wymagają ręcznego ponownego workflow.
Nie dodawaj sekretów ani danych użytkowników do statycznego landingu.

## Aplikacja na Androida

Szczegóły i procedury: [ANDROID.md](ANDROID.md). Aplikacja to powłoka `WebView` otwierająca adres z
`android/app/build.gradle.kts` (domyślnie `https://flexa-click.pages.dev`, nadpisanie `-Pflexa.appUrl=...`),
więc wdrożenie strony jest od razu widoczne w aplikacji. Nowy APK jest potrzebny tylko po zmianie w `android/`.

- Wydanie: `npm run android:release -- X.Y.Z --notes "Zmiana 1|Zmiana 2"`. Tag `android-vX.Y.Z` uruchamia
  `.github/workflows/android.yml`: testy i lint, podpisany APK, `update.json` i GitHub Release oznaczony jako najnowszy.
  Aplikacje czytają `releases/latest/download/update.json`, więc to wydanie musi pozostać „latest”.
- Sekrety repozytorium: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
  `ANDROID_KEY_PASSWORD` (ustawia je `npm run android:signing -- github`). Klucz leży poza repozytorium w
  `~/.flexa/android-signing/`; jego utrata uniemożliwia aktualizacje zainstalowanych aplikacji, więc zrób kopię zapasową.
- Aplikacja Cloudflare publikuje `/.well-known/assetlinks.json` z odciskiem klucza. Landing i Ustawienia linkują do
  `releases/latest/download/flexa.apk`; adres przycisku na landingu można zmienić zmienną `FLEXA_ANDROID_URL` (https).
- Adres aplikacji jest zapisany w APK: przeniesienie na `app.flexa.click` wymaga nowego wydania Androida z nowym `appUrl`.
  Starsze aplikacje nadal otwierają `flexa-click.pages.dev`, dopóki ten adres działa.

## flexa.click i app.flexa.click

Zakup/odnowienie domeny nie jest darmowe i nie zostało wykonane przez ten kod.
Najpierw zweryfikuj jej własność TXT zgodnie z GitHub/Cloudflare, żeby unikać
przejęcia niezajętej konfiguracji.

- Apex `flexa.click`: GitHub Pages, rekordy A/AAAA według
  [aktualnej dokumentacji GitHub](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).
- `app.flexa.click`: dodaj jako Custom Domain projektu Cloudflare Pages
  i zastosuj wskazany rekord CNAME. Nie wpisuj wymyślonego pages.dev.
- Włącz HTTPS po propagacji DNS; nigdy nie obchodź ostrzeżeń certyfikatu.
- Zaktualizuj redirecty Auth, ALLOWED_ORIGINS, SMTP oraz link aplikacji w landingu.
- Zaktualizuj `appUrl` w aplikacji na Androida i wydaj nową wersję (zob. „Aplikacja na Androida”).
- Custom Domain Supabase nie jest wymagany; jego płatnego add-onu nie potrzebujemy.

## Walidacja i start publiczny

```powershell
npm run lint
npm run build
npm run build:site
npm run check:edge
npm test
npx playwright install chromium
npm run test:e2e
```

Testy jednostkowe używają fixture'ów, a RLS jest testowane w Postgres/PGlite.
Testy przeglądarkowe nie potrzebują zewnętrznych kont. Nie są potwierdzeniem
wdrożenia SMTP lub funkcji w Twoim produkcyjnym projekcie.

Przed startem sprawdź dwoma kontami: brak wglądu do cudzych rekordów, zapis
i ponowne odczytanie posiłku, odświeżenie na drugim urządzeniu, wyszukiwanie,
odmowę kamery, import, recovery, eksport wszystkich stron i usunięcie konta.
Sprawdź błędy CORS/429/offline i usypianie projektu Free.
Odczyty bazy mają limit 15 sekund i jedną ponowną próbę zarządzaną przez
QueryClient; nie nakładamy na to dodatkowych retry SDK. Zapisy nie są ponawiane
automatycznie, aby nie powielać posiłków po utracie potwierdzenia.
Publiczna konfiguracja jest sprawdzana również przed kompilacją Vite:
klucz `sb_secret_`/`service_role` lub niepoprawny URL zatrzymuje build,
zanim powstanie plik JS. Sam komunikat w przeglądarce nie chroniłby
tajnego klucza przed osadzeniem przez bundler.

Uzupełnij region danych, tożsamość administratora, umowy dostawców i faktyczne
okresy retencji w informacji prywatności. Rejestracja w interfejsie jest
zablokowana, dopóki brakuje operatora/kontaktu. Sam tekst nie potwierdza zgodności
z RODO. Zaplanuj bezpieczne backupy, monitorowanie limitów i migrację przy wzroście.
Na Free eksport użytkownika nie zastępuje pełnej kopii bazy.
