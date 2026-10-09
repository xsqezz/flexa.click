# Flexa na Androida

Aplikacja na Androida to cienka powłoka (Kotlin, `WebView`), która otwiera działającą stronę
`https://app.flexa.best`, plus własny mechanizm aktualizacji. Dzięki temu:

- **zmiany w samej aplikacji (ekrany, przepisy, plan treningowy, poprawki) są widoczne od razu** po wdrożeniu
  strony, bez nowego APK i bez instalowania czegokolwiek;
- **nowa wersja powłoki** (np. zmiana uprawnień, ikony, obsługi plików) trafia do użytkowników przez
  okno „Dostępna aktualizacja Flexa”: jedno dotknięcie „Zaktualizuj”, pobranie, weryfikacja i systemowe potwierdzenie.

Aplikacja nie jest w Google Play. Plik `flexa.apk` i opis wydania `update.json` leżą w
[GitHub Releases](https://github.com/xsqezz/flexa.click/releases) i są budowane wyłącznie przez GitHub Actions.

## Instalacja (użytkownik)

1. Otwórz <https://github.com/xsqezz/flexa.click/releases/latest/download/flexa.apk> w telefonie
   (ten sam przycisk jest na stronie głównej i w Ustawieniach, w „Aplikacja na Androida”).
2. Gdy Android zapyta, zezwól przeglądarce na instalację z tego źródła (jednorazowo).
3. Otwórz pobrany plik i dotknij „Zainstaluj”. Google Play Protect może poprosić o dodatkowe potwierdzenie,
   bo aplikacja nie pochodzi ze sklepu.

Wymagany jest Android 8.0 lub nowszy (`minSdk 26`). Przy pierwszej aktualizacji Android poprosi jeszcze raz o zgodę
(„Zezwól na instalację” dla samej Flexa); aplikacja sama wraca do pobierania po jej udzieleniu.

## Jak działa aktualizacja

1. Po załadowaniu strony (i po powrocie do aplikacji, najwyżej co 30 minut) aplikacja pobiera
   `https://github.com/xsqezz/flexa.click/releases/latest/download/update.json`
   (`versionName`, `versionCode`, `minSupportedVersionCode`, `minSdk`, `apkUrl`, `sha256`, `sizeBytes`, `notes`).
2. Gdy `versionCode` jest większy od zainstalowanego, pokazuje okno z opisem zmian i rozmiarem.
   „Później” ukrywa je do następnego uruchomienia aplikacji.
3. „Zaktualizuj” pobiera APK, a przed instalacją sprawdza: adres zaczyna się od
   `https://github.com/xsqezz/flexa.click/releases/download/`, rozmiar (do 150 MB), sumę SHA-256, nazwę pakietu,
   wyższy `versionCode` oraz **ten sam certyfikat podpisu co zainstalowana wersja**.
4. Instalację wykonuje systemowy `PackageInstaller`. Android zawsze prosi wtedy o potwierdzenie
   („Czy zaktualizować tę aplikację?”): aplikacja spoza sklepu nie może zainstalować się po cichu.
   Po potwierdzeniu Android zamyka starą wersję (nie da się zastąpić działającej aplikacji), więc Flexa trzeba
   otworzyć ponownie z ekranu głównego; jest już w nowej wersji i potwierdza to krótkim komunikatem
   („Flexa została zaktualizowana do wersji X”). Okno w aplikacji przypomina o ponownym otwarciu już podczas potwierdzania.
5. Gdy zainstalowany `versionCode` jest mniejszy od `minSupportedVersionCode`, okno nie ma przycisku „Później”
   (jest „Zamknij aplikację”) i aplikacja nie działa do czasu aktualizacji. Tak działa wydanie z `--force`.

Ręczne sprawdzenie: **Ustawienia → Aplikacja na Androida → Sprawdź aktualizacje** (pokazuje też wersję aplikacji).
Prawdziwą ochroną jest ciągłość podpisu: Android odrzuci APK podpisane innym kluczem, więc podmieniony plik
nie zaktualizuje aplikacji.

## Wydanie nowej wersji

Aktualizacja samej strony nie wymaga wydania. Wydanie jest potrzebne tylko po zmianie w katalogu `android/`.

```powershell
npm run android:release -- 1.0.1 --notes "Co się zmieniło|Druga zmiana"
```

Skrypt (z czystego drzewa, najlepiej na `main`): podbija `android/version.properties` (kod wersji
`X*1000000 + Y*1000 + Z`), zapisuje `android/release-notes.txt`, robi commit „Release Android X.Y.Z”,
tag `android-vX.Y.Z` i wypycha oba. Dodatkowe opcje: `--force` (wymusza aktualizację),
`--dry-run` (tylko pokazuje plan), `--no-push`.

Workflow `.github/workflows/android.yml` po wypchnięciu taga: uruchamia testy i lint, buduje podpisany APK
(R8), sprawdza podpis (`apksigner`, schematy v2 i v3) i porównuje odcisk certyfikatu z `android/signing-fingerprint.txt`,
tworzy `update.json`, publikuje wydanie z plikami `flexa.apk` i `update.json` jako najnowsze, a na końcu pobiera
opublikowane pliki i sprawdza ich sumę kontrolną. Postęp: <https://github.com/xsqezz/flexa.click/actions>.

Android nie pozwala instalować starszej wersji nad nowszą, więc błędne wydanie naprawia się kolejnym, wyższym.
Usunięcie wydania z GitHuba sprawia, że „najnowszym” staje się poprzednie, ale nie cofa już zainstalowanych aplikacji.

## Klucz podpisujący (najważniejszy element)

Aktualizacja zadziała tylko wtedy, gdy każda wersja jest podpisana tym samym kluczem.

- Klucz: `~/.flexa/android-signing/flexa-release.jks` (PKCS12, RSA 4096, ważny 100 lat, alias `flexa`),
  hasła w `signing.properties` w tym samym katalogu. Katalog **nie jest w repozytorium**.
- **Zrób kopię zapasową całego katalogu** (menedżer haseł, pendrive). GitHub nie pozwala odczytać sekretów
  z powrotem. Bez klucza nie da się opublikować aktualizacji: użytkownicy musieliby odinstalować aplikację
  i zainstalować nową.
- W GitHub Actions są cztery sekrety: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
  `ANDROID_KEY_PASSWORD`. Ustawia je `npm run android:signing -- github`. Nowy klucz: `npm run android:signing -- create`
  (nie nadpisuje istniejącego), a potem zaktualizuj `android/signing-fingerprint.txt`, `app/public/.well-known/assetlinks.json`
  i `ANDROID_CERT_SHA256` w `app/src/lib/native.ts` (test w `native.test.ts` pilnuje, żeby wszystkie trzy były zgodne).
- Odcisk SHA-256 certyfikatu: `6E:48:98:1B:51:24:BC:BD:F8:BC:F2:4C:A7:18:FA:94:21:DC:EE:5B:6E:0B:7D:E9:05:43:69:92:1B:CE:1B:70`
  (`npm run android:signing -- fingerprint`; jest też na stronie „Źródła i licencje”).

## Budowanie i testy lokalnie

Potrzebne: JDK 21, Android SDK z platformą `android-37.0` i `build-tools;36.0.0` (`ANDROID_HOME`), Node 24.
Na komputerze z kilkoma JDK ustaw `JAVA_HOME` na 21.

```powershell
cd android
.\gradlew.bat :app:assembleDebug                          # click.flexa.app.debug, podpis debug
.\gradlew.bat :app:testDebugUnitTest :app:lintDebug       # testy jednostkowe i lint
.\gradlew.bat :app:assembleRelease                        # klucz z ~/.flexa albo zmienne FLEXA_KEYSTORE_*
.\gradlew.bat :app:assembleRelease "-Pflexa.allowDebugSigning=true"   # bez klucza (np. PR), tylko do sprawdzenia budowania
npm run test:android-scripts                              # testy skryptów wydawniczych (z katalogu głównego)
```

Parametry do testów (`-P...`): `flexa.appUrl` (domyślnie `https://app.flexa.best`; do wersji 1.1.0 był to `flexa-click.pages.dev`), `flexa.updateManifestUrl`,
`flexa.updateUrlPrefix`, `flexa.versionName`, `flexa.versionCode`, `flexa.repository`.
Wersja `debug` instaluje się obok produkcyjnej i dopuszcza nieszyfrowany ruch HTTP wyłącznie do `10.0.2.2` i `localhost`.

### Test aktualizacji na emulatorze

Pełna droga bez publikowania wydania:

```powershell
$u = "-Pflexa.updateManifestUrl=http://10.0.2.2:8099/update.json"; $p = "-Pflexa.updateUrlPrefix=http://10.0.2.2:8099/"
cd android
.\gradlew.bat :app:assembleDebug $u $p                       # „stara” wersja 1.0.0-debug
adb install -r app\build\outputs\apk\debug\app-debug.apk
.\gradlew.bat :app:assembleDebug $u $p "-Pflexa.versionName=1.0.1" "-Pflexa.versionCode=1000001"
copy app\build\outputs\apk\debug\app-debug.apk ..\new.apk
cd ..
node scripts/android-update-server.mjs new.apk --version 1.0.1 --notes "Nowość|Poprawka"   # dodaj --force, by sprawdzić wymuszoną aktualizację
```

Uruchom aplikację na emulatorze: po chwili pojawi się okno aktualizacji, a po zatwierdzeniu systemowego
okna zainstaluje się wersja 1.0.1 (`adb shell dumpsys package click.flexa.app.debug | findstr versionName`).

## Co jest w powłoce

- Ładuje tylko adres aplikacji (ten sam origin); inne linki `http(s)`, `mailto:`, `tel:` otwiera w przeglądarce
  lub aplikacji systemowej, a pozostałe schematy blokuje. Ramki (np. odtwarzacz YouTube) tylko po `https`.
- Kamera: skaner kodów kreskowych, zdjęcie lodówki (Smart Kuchnia) i zdjęcie tacy lub talerza (Skan posiłku); Android prosi o zgodę w chwili użycia.
  Strona dostaje wyłącznie wideo i tylko z adresu aplikacji.
- Wybór plików (import GPX/TCX, zdjęcia) przez systemowy wybierak; zdjęcia z aparatu przez `FileProvider`.
- Eksport danych przez okno „Zapisz jako” (kanał `window.flexaNative`, dostępny tylko dla adresu aplikacji;
  komunikaty `save-file` i `check-update`). Typy plików: JSON (`application/json`, `.json`) i od wersji 1.1.0
  CSV (`text/csv`, `.csv`); nazwa jest oczyszczana i zawsze dostaje rozszerzenie zgodne z typem. Strona rozpoznaje
  aplikację po `FlexaAndroid/<wersja>` w User-Agent (zob. `app/src/lib/native.ts`: `canSaveNatively`, `saveFileNatively`).
- Przypomnienia (od 1.1.0, opisane niżej).
- Brak sieci: ekran „Brak połączenia z internetem” z przyciskiem i automatycznym wczytaniem po powrocie sieci.
- Przycisk „Wstecz” cofa historię strony; na jej początku zamyka aplikację.
- Uprawnienia: `INTERNET`, `ACCESS_NETWORK_STATE`, `CAMERA`, `VIBRATE` (sygnał końca treningu),
  `REQUEST_INSTALL_PACKAGES` (instalacja aktualizacji), `POST_NOTIFICATIONS` (przypomnienia; Android 13+ pyta
  o zgodę dopiero, gdy włączysz przypomnienie), `RECEIVE_BOOT_COMPLETED` (przywrócenie przypomnień po restarcie
  telefonu). Bez reklam, analityki i zewnętrznych bibliotek śledzących;
  kopie zapasowe Androida są wyłączone (`allowBackup=false`). Szczegóły: strona „Prywatność” w aplikacji.

## Przypomnienia o posiłkach i skróty (od wersji 1.2.0)

- Trzeci rodzaj przypomnień: `meals` (`{ "enabled": true, "times": ["08:30", "13:30", "19:00"] }`, od 1 do 6 godzin, ściśle rosnąco).
  Powiadomienie „Posiłki” otwiera `/meals`; kanał „Przypomnienia o posiłkach”. Pole `meals` jest opcjonalne w `reminders.set`
  i `reminders.state`: aplikacje do 1.1.0 odrzucają nieznane pola, dlatego strona wysyła je tylko do wersji 1.2.0+ (`mealRemindersSupported`).
- Skróty na ikonie (długie przytrzymanie): „Skan posiłku” (`/meals/scan`), „Posiłki” (`/meals`) i „Trening” (`/plan`), zdefiniowane w
  `res/xml/shortcuts.xml`; nazwa pakietu wariantu debug jest podstawiana przez `resValue shortcut_package`.
- Adres aplikacji to `https://app.flexa.best` (wcześniej `flexa-click.pages.dev`). Inny origin oznacza osobny zapis WebView,
  więc po aktualizacji z 1.1.0 trzeba zalogować się ponownie; konta i dane w chmurze zostają. Dane trybu demo z 1.1.0 zostają
  pod starym adresem — wyeksportuj je przed aktualizacją, jeśli są ważne.

## Przypomnienia (od wersji 1.1.0)

Dobrowolne, domyślnie wyłączone powiadomienia, bez liczenia serii i bez upominania:

- **trening** — w dni treningowe z planu (albo w dni wybrane ręcznie, gdy nie ma planu), o wybranej godzinie:
  „Dziś w planie trening: Dzień 1: Całe ciało A · ok. 45 min” (bez nazwy: „Dziś dzień treningowy w Twoim planie”).
  Dotknięcie otwiera `/plan`. Powiadomienie znika samo o północy.
- **woda** — co 1–4 godziny w wybranym przedziale (np. 9:00–21:00, przypomnienia o 9, 11, …, 21).
  Dotknięcie otwiera stronę główną. Kolejne przypomnienie zastępuje poprzednie, a niezauważone znika po N godzinach.

Ustawienia są w **Ustawienia → Przypomnienia** (tylko w aplikacji; starsza wersja pokazuje „Zaktualizuj aplikację,
aby włączyć przypomnienia”). Kanały powiadomień: „Przypomnienia o treningu” i „Przypomnienia o wodzie” — każdy
można wyciszyć lub wyłączyć w ustawieniach Androida. Gdy powiadomienia są zablokowane, strona to pokazuje
i otwiera systemowe ustawienia powiadomień Flexa.

**Prywatność:** ustawienia przypomnień (godziny, dni, nazwy treningów z planu) są zapisane wyłącznie w telefonie
(`SharedPreferences`, bez kopii zapasowej) i nie trafiają na serwer. Aplikacja nie wie, czy trening się odbył:
przypomnienie pojawia się w dzień treningowy niezależnie od wpisów.

**Planowanie:** `AlarmManager` z alarmami niedokładnymi, bez uprawnienia `SCHEDULE_EXACT_ALARM`. Każdy termin ma dwa
alarmy na tę samą godzinę: `setWindow` (okno 15 min, punktualny, gdy telefon jest w użyciu) i `setAndAllowWhileIdle`
(dociera także w trybie Doze, czasem z opóźnieniem; na Androidzie 14+ najwyżej ok. godzinę). Pierwszy, który zadzwoni, pokazuje powiadomienie
i planuje kolejny termin; duplikaty i przypomnienia spóźnione o ponad 90 min są pomijane. Wybraliśmy `AlarmManager`
zamiast WorkManagera, bo potrzebujemy konkretnej godziny zegarowej (WorkManager nie gwarantuje pory i dokłada
zależność), a tylko jednego alarmu na rodzaj przypomnienia. Godziny są liczone w strefie czasowej telefonu i trzymają
się zegara przy zmianie czasu (godzina z „dziury” wiosennej przesuwa się o godzinę, podwójna jesienna dzwoni raz).
Alarmy są odtwarzane po `BOOT_COMPLETED`, `TIMEZONE_CHANGED`, `TIME_SET`, `MY_PACKAGE_REPLACED` i przy każdym
uruchomieniu aplikacji (np. po wymuszonym zatrzymaniu). Logika terminów: `reminders/ReminderSchedule.kt` (testy JVM).

**Protokół** (`window.flexaNative`, tylko główna ramka adresu aplikacji). Strona wysyła:

```jsonc
{ "type": "reminders.get", "id": "r-1" }
{ "type": "reminders.set", "id": "r-2",
  "training": { "enabled": true, "time": "18:00", "weekdays": [0, 2, 4],          // 0 = poniedziałek … 6 = niedziela
                "title": "opcjonalnie", "sessions": [{ "weekday": 0, "name": "Dzień 1: Całe ciało A", "minutes": 45 }] },
  "water": { "enabled": true, "from": "09:00", "to": "21:00", "everyHours": 2 } }
{ "type": "reminders.open-settings" }
```

Aplikacja odpowiada przez `JavaScriptReplyProxy` zdarzeniem `message` na `window.flexaNative`
(`addEventListener('message', …)` albo `onmessage`) z tym samym `id`:
`{ "type": "reminders.state", "id", "training", "water", "permission": "granted" | "denied" | "default", "supported": true }`
albo `{ "type": "reminders.error", "id", "reason": "invalid" }`. Walidacja jest ścisła po obu stronach (nieznane pola,
zły format godziny, dni spoza 0–6, powtórzenia, `everyHours` spoza 1–4, `from` ≥ `to`, teksty ponad 120 znaków
odrzucają całość). `permission: "default"` oznacza Androida 13+ przed pierwszym pytaniem; `denied` — odmowę,
wyłączone powiadomienia aplikacji albo wyłączony potrzebny kanał. Strona: `getReminders`, `setReminders`,
`remindersSupported`, `openNotificationSettings` w `app/src/lib/native.ts` (limity czasu: 5 s odczyt, 2 min zapis,
bo zapis może czekać na systemowe pytanie o zgodę).

Ręczny test na emulatorze: zbuduj wersję debug z `-Pflexa.appUrl=http://localhost:4190`, uruchom podgląd strony
(`npm run preview --workspace app -- --port 4190 --strictPort`), `adb reverse tcp:4190 tcp:4190`, włącz przypomnienie
na godzinę za 1–2 minuty i sprawdź alarmy: `adb shell dumpsys alarm | findstr flexa`.

## Ograniczenia

- **Linki z e-maila** (potwierdzenie konta, reset hasła) otwierają się w przeglądarce, nie w aplikacji, bo ich
  pierwszy adres należy do Supabase. Po potwierdzeniu wróć do aplikacji i zaloguj się. Plik
  `app/public/.well-known/assetlinks.json` przygotowuje weryfikację App Links dla adresu strony.
- **Weryfikacja deweloperów Google.** Od 30 września 2026 Google wymaga rejestracji aplikacji dla sklepów w Brazylii,
  Indonezji, Singapurze i Tajlandii, a w 2027 roku ma objąć wszystkie certyfikowane urządzenia. Aplikacje
  niezarejestrowane da się wtedy instalować tylko „zaawansowanym trybem” (kilka dodatkowych kroków) albo przez adb.
  Zanim zasada obejmie Polskę, zarejestruj `click.flexa.app` i odcisk certyfikatu w Android Developer Console
  (<https://developer.android.com/developer-verification>).
- Brak powiadomień push z serwera, Health Connect i Apple Health (tak jak w wersji przeglądarkowej); przypomnienia są
  wyłącznie lokalne, planowane w telefonie. Brak wersji na iPhone'a.

## Gdzie co jest

| Ścieżka | Zawartość |
| --- | --- |
| `android/app/src/main/kotlin/click/flexa/app/MainActivity.kt` | okno z `WebView`, marginesy systemowe, tryb offline |
| `.../web/` | polityka nawigacji, kanał strona→aplikacja, wybór plików, kamera, zapis plików |
| `.../reminders/` | przypomnienia: ustawienia i walidacja, terminy, alarmy, powiadomienia, zgoda na powiadomienia |
| `.../update/` | sprawdzanie `update.json`, pobieranie, instalacja, okna aktualizacji |
| `android/version.properties`, `release-notes.txt`, `signing-fingerprint.txt` | wersja, opis zmian, odcisk klucza |
| `scripts/android-*.mjs`, `scripts/lib/android-version.mjs` | wydanie, `update.json`, klucz, serwer testowy (testy: `scripts/android.test.mjs`) |
| `.github/workflows/android.yml` | testy, budowanie i publikacja wydania |
