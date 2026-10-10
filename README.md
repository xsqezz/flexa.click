# Flexa

Darmowy, polski dziennik jedzenia, treningów i postępów. Niezależny projekt
inspirowany funkcjonalnie Fitatu i Stravą — bez kopiowania ich kodu czy baz.
Domena: [flexa.best](https://flexa.best/) (landing, GitHub Pages) i [app.flexa.best](https://app.flexa.best/) (aplikacja, Cloudflare Pages). Starsze adresy (`flexa-click.pages.dev`, `xsqezz.github.io/flexa.click`) nadal działają.

Aplikacja z kontami: [Flexa](https://app.flexa.best/),
[rejestracja](https://app.flexa.best/signup). Korzysta z osobnego projektu
Supabase w regionie Frankfurt i z poczty weryfikacyjnej Brevo.

Publikacja GitHub Pages: [Flexa](https://xsqezz.github.io/flexa.click/),
[pełne demo aplikacji](https://xsqezz.github.io/flexa.click/app/#/demo).
Demo zapisuje zmiany lokalnie; nie tworzy kont ani synchronizacji.
Skaner i wyszukiwanie także w tej wersji korzystają z prawdziwego katalogu
Open Food Facts przez publiczne API, nie z kilkunastu przykładowych produktów.
Internet jest potrzebny do pobrania nowych produktów; własne produkty są lokalne.
Katalog startowy obejmuje wszystkie 150 wymaganych typów produktów w sześciu
kategoriach oraz tysiące rzeczywistych wariantów z kodami. Jest dostępny do
[pobrania na licencji ODbL](app/public/data/polish-products.json);
[opis źródeł i aktualizacji](docs/CATALOG.md).

**Zaimplementowane:** konta Supabase, zatwierdzane cele kalorii/makro i wody, cykle żywieniowe, dziennik posiłków,
produkty własne, wyszukiwanie Open Food Facts + opcjonalnie USDA, kamera
BarcodeDetector/ZXing, treningi, import własnych GPX/TCX, tempo i minuty × RPE,
analizy 7/30/90 dni, pomiary, eksport JSON, usunięcie konta i synchronizacja.
Oddzielne demo zapisuje wyłącznie przykładowe dane na urządzeniu.

**Plan treningowy:** po założeniu konta ankieta „Zanim zaczniesz” pyta krok po
kroku o wiek, płeć, cel, siłownię lub dom ze sprzętem, doświadczenie, dni
i długość treningu oraz zdrowie. Zakładka Plan pokazuje tydzień z rozgrzewką,
seriami, powtórzeniami, przerwami, tempem, wskazówkami techniki i oddechu,
zamiennikami i rozciąganiem; odpowiedzi można zmienić w każdej chwili.
Plan układa w przeglądarce deterministyczny generator reguł z biblioteką ok. 190
ćwiczeń (`app/src/lib/training`) — bez AI i kluczy API. Ćwiczenia omijają zgłoszone
dolegliwości, a informacje o zdrowiu trafiają do bazy tylko z osobną zgodą.
Po wejściu w dzień treningowy aplikacja prowadzi krok po kroku: jedno ćwiczenie lub
seria naraz z przyciskiem „Skończone”, stoper przerwy („Chwila przerwy”, +15 s,
pominięcie, sygnał dźwiękowy), odliczanie ćwiczeń na czas, lista kroków, wznawianie
po odświeżeniu i zapis do dziennika. Filmy instruktażowe z YouTube ładują się dopiero
po kliknięciu (youtube-nocookie.com); ID filmów sprawdzamy przez oEmbed, a dla ćwiczeń
bez sprawdzonego filmu jest link do wyszukiwania.

**Cele i cykle:** po ankiecie (także jeśli pominiesz plan) możesz zapisać masę
początkową, docelową, rodzaj i daty cyklu. Wiek/płeć z planu pomagają policzyć
orientacyjną propozycję; wzrost i aktywność służą tylko do obliczenia. Własne
kcal, makro i wodę zatwierdzasz przed zapisem. Faza redukcji, utrzymania lub
budowy mięśni nigdy nie zmienia kalorii sama: po końcu cyklu cel pozostaje bez
zmian, a następny cykl wymaga potwierdzenia. W Celach widać spożycie dla dnia,
bieżącą i docelową masę oraz historię kalorii i cykli. Demo dla 16–17-latków
oferuje tylko cele ręczne, bez kalkulatora i propozycji faz.

**Same kcal i powtórz dzień:** zakładka „Same kcal” w oknie dodawania posiłku zapisuje wpis z samymi kaloriami (`app/src/lib/quick-kcal.ts`: id `kcal-…`, wartości na 100 g × porcja 100/200 g, żeby suma równała się wpisanej; w dzienniku „wpis kcal”, nieznane makro zostaje puste). Na pustym dniu w Posiłkach `RepeatDay` kopiuje jeden z 14 ostatnich dni z wpisami (`meal.addMany`).

**Szybki wpis:** `/meals/quick` (Posiłki, „Dodaj”, Ctrl+K) rozkłada zdanie („dwa jajka, 200 g ryżu i szklanka mleka”) na pozycje lokalnie: `shared/meal-scan/phrase.ts` (ilości, jednostki, rozmiary, polskie odmiany) i `app/src/lib/scan/quick.ts` (dopasowanie do katalogu Skanu). Bez AI, bez limitu dziennego i bez wysyłania tekstu; niepewne i nieznane słowa są zgłaszane. Zapis jako produkt „szybki wpis”. Opcjonalne dyktowanie używa Web Speech API przeglądarki (poza WebView).

**Skan posiłku:** w Posiłkach (oraz z przycisku „Dodaj” i wyszukiwarki) zrobisz zdjęcie tacy lub talerza — np. z fast foodu.
Po zalogowaniu i wyrażeniu zgody model wizyjny Cloudflare Workers AI tylko **nazywa widoczne pozycje** (angielskie nazwy z menu, marka
sieci, rozmiar, liczba sztuk) — kalorii ani wag nie podaje. Aplikacja dopasowuje te nazwy do własnej bazy (ponad 8 tys. pozycji, w tym
oficjalne menu McDonald's, Burger King i KFC w Polsce, dane USDA FoodData Central oraz ręcznie opracowane polskie potrawy;
`shared/meal-scan/data/catalog.json`, dopasowanie: `shared/meal-scan/match.ts`). Gdy marka jest rozpoznana, wartości pochodzą z oficjalnej
tabeli sieci i zakres jest wąski; w pozostałych przypadkach jest to **zakres**, bo zdjęcie nie ujawnia wagi, oleju ani sosu w środku dania.
Niepewne dopasowania są oznaczone do sprawdzenia i można je zmienić jednym kliknięciem. Użytkownik poprawia rozmiar, liczbę sztuk lub wagę,
może wpisać dokładne wartości z menu, aplikacji sieci albo etykiety (zastępują tabelę) i dopiero potwierdzony wynik zapisuje w Posiłkach
(każda pozycja jako produkt „skan”, wartość środkowa). Zdjęć nie zapisujemy; limit dzienny dzieli się ze Smart Kuchnią (`aiLimits.vision`).
W demo ten sam ekran działa po ręcznym złożeniu talerza. Endpoint: `functions/api/meal/[action].ts` (`POST /api/meal/plate`).
Bazę odbudowują skrypty z `scripts/plate-catalog/` (opis w `docs/DEPLOYMENT.md`).

**Smart Kuchnia:** zakładka „Kuchnia” układa przepis z tego, co masz w domu. Wybierasz produkty
(lub — po zalogowaniu — robisz zdjęcie lodówki i zatwierdzasz rozpoznaną listę), odpowiadasz na trzy
pytania (czas, sprzęt, czego nie lubisz/alergie/ochota, a także liczba osób i wielkość porcji) i dostajesz
przepis: nazwę, czas i sprzęt, listę składników z gramaturą, kroki dopasowane do patelni, garnka,
piekarnika, air fryera, mikrofalówki czy blendera, oraz makroskładniki na porcję (kcal, białko, tłuszcze,
węglowodany). Składnik można zamienić, a przepis zapisać w dzienniku jako posiłek. Przepisy i makro
układa deterministyczny silnik w przeglądarce (`app/src/lib/kitchen`, baza ponad 140 składników w
`shared/kitchen`), więc działa bez kluczy i także w demo. Tylko rozpoznanie produktów ze zdjęcia i
poglądowy obraz potrawy używają Cloudflare Workers AI przez funkcję Pages (`functions/api/kitchen`);
wymagają konta, zgody na wysłanie zdjęcia i mają dzienne limity na konto (migracja
`202610080001_kitchen_ai_quota.sql`). Zdjęć nie zapisujemy; AI nigdy nie pisze przepisu ani nie
liczy makro.

**Nawigacja i wygoda:** siedem pozycji: Cele · Posiłki · Kuchnia · Dodaj · Treningi · Ruch · Postępy (jedzenie po lewej, ruch po prawej). Cele to ekran startowy: bilans, historia energii i „Zacznij tu”; Posiłki służą wpisywaniu jedzenia, Treningi prowadzą plan, Ruch zbiera zapisane aktywności, a Postępy pokazują długoterminowe pomiary i aktywność. Przycisk „Dodaj”
na każdym ekranie (posiłek, skan kodu, woda, trening, pomiar), wyszukiwarka Ctrl+K (strony, akcje, wpisy), zmiana dnia przesunięciem
palca, strzałkami lub paskiem tygodnia, „Cofnij” po usunięciu wpisu, lista „Zacznij tu” dla nowych kont, strona „O Flexa” ze
skrótami klawiszowymi, jeden, jasny motyw i instalacja jako aplikacja (PWA) z działaniem offline.

**Planowanie i trend:** Cele pokazują podsumowanie cyklu (zmiana masy, średnie kcal, dni z wpisami) i, gdy trend wagi z ostatnich 14 dni odbiega od założeń cyklu, *propozycję* małej korekty kalorii (`app/src/lib/adaptive.ts`: regresja liniowa wagi, krok 100–200 kcal, dolny limit 1200/1500 kcal, bez osób poniżej 18 lat, zatwierdzana przez użytkownika jako nowy cykl). Plan tygodnia (`/meals/plan`) układa się z zapisanych zestawów, a lista zakupów (`/kitchen/shopping`) zbiera brakujące składniki z przepisów; obie funkcje oraz zapamiętane porcje Skanu zostają w `localStorage` urządzenia, osobno dla konta. Częste produkty są na górze listy dodawania posiłku, a historia ćwiczeń pokazuje rekordy i spokojne podpowiedzi progresji.

**Dziennik i dane:** kopiowanie posiłków z wczoraj, zestawy posiłków, „Moje treningi” (własne treningi zapisane z dziennika i dodawane jednym dotknięciem), zapis przepisu jako własnego produktu, kalkulator orientacyjnego
zapotrzebowania (nowe dane użyte do obliczenia nie są trwale zapisywane), przywracanie kopii JSON (domyślnie tylko brakujące wpisy; opcjonalnie profil, plan i zakończone cykle), eksport CSV,
serie i ciężary w treningach z historią ćwiczeń, tygodniowy cel ruchu, trend wagi z 7 dni oraz opcjonalne obwody talii i bioder.
Kolejne migracje: `202610090001_meal_templates.sql`, `202610090002_training_details.sql`, `202610100001_goal_cycles.sql` i `202610100002_workout_templates.sql`.

**Aplikacja na Androida:** `android/` to powłoka Kotlin z `WebView`, która otwiera działającą stronę (zmiany
w aplikacji są więc widoczne od razu) i sama proponuje aktualizację, gdy w GitHub Releases pojawi się nowszy APK:
okno „Zaktualizuj”, pobranie, weryfikacja SHA-256 i podpisu, systemowe potwierdzenie instalacji. Pobranie:
[flexa.apk](https://github.com/xsqezz/flexa.click/releases/latest/download/flexa.apk). Nową wersję wydaje się poleceniem
`npm run android:release -- 1.0.1 --notes "Zmiana 1|Zmiana 2"`; APK buduje i podpisuje GitHub Actions.
Szczegóły oraz ostrzeżenie o kopii zapasowej klucza podpisującego: [docs/ANDROID.md](docs/ANDROID.md).

**Podłączone środowisko:** Cloudflare Pages, Supabase Auth/Postgres/Edge Functions
i SMTP Brevo. Rejestracja wymaga potwierdzenia adresu, a hasło ma co najmniej
10 znaków. Plan Brevo Free ma 300 maili dziennie, wspólnie dla aplikacji
korzystających z tego konta; nie ma osobnego limitu 50 maili dla Flexa.
W Supabase ustawiono 300 maili na godzinę, aby domyślny limit 2/h nie ograniczał
wysyłki wcześniej niż Brevo. Limity per adres i IP nadal obowiązują.

**Odtworzenie wdrożenia:** własne projekty Supabase/Cloudflare, SMTP i DNS
trzeba podłączyć zgodnie z instrukcją; sekrety nie są zapisane w repozytorium.
GitHub Pages hostuje landing oraz całą aplikację w osobnym, lokalnym trybie demo.
Konta i synchronizację hostujemy poza Pages; publiczny build nie dopuszcza kluczy backendu.
Bez zmiennych środowiskowych konta nie udają działania; dostępne jest demo.

```powershell
npm ci
npm run dev
```

Otwórz `http://127.0.0.1:5173`. Wymagany Node.js >= 24.
`app\.env.example` zawiera konfigurację publiczną; tajne klucze są wyłącznie
po stronie funkcji Supabase.

| Katalog | Zawartość |
| --- | --- |
| `app` | React / TypeScript / Vite, prywatna aplikacja |
| `shared` | Walidowane modele żywienia, aktywności, planu treningowego oraz baza i logika AI Smart Kuchni |
| `functions` | Cloudflare Pages Functions (rozpoznawanie zdjęć i obraz potrawy w Workers AI) |
| `supabase` | Migracje, RLS, auth profile, limity API, funkcje |
| `site` | Statyczny landing i publiczne informacje wdrożeniowe |
| `android` | Aplikacja na Androida: powłoka WebView z samoaktualizacją (Kotlin, Gradle) |
| `docs` | Research, źródła, koszty, instrukcja konfiguracji |

Instrukcje: [wdrożenie](docs/DEPLOYMENT.md), [aplikacja na Androida](docs/ANDROID.md),
[research i zasoby](docs/RESEARCH.md).
GitHub Actions publikuje landing i demo (`npm run build:pages`); aplikację z kontami buduje integracja
Cloudflare Pages z tego samego repozytorium.

```powershell
npm run lint
npm run build
npm run build:site
npm run check:edge
npm test
npm run test:e2e
npm run test:android-scripts
```

API Stravy jest wyłączone z uwagi na jego aktualny regulamin. Skan posiłku nie obiecuje dokładnej liczby kalorii ze zdjęcia —
pokazuje zakres i prosi o potwierdzenie. Nie ma też
rankingów, map ani natywnego Apple Health / Health Connect w tej wersji.
„Darmowe funkcje” nie oznacza darmowej domeny, nieograniczonej infrastruktury
ani gwarantowanej kompletności danych produktów. Flexa nie daje porad medycznych.
