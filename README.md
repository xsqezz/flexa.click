# Flexa

Darmowy, polski dziennik jedzenia, treningów i postępów. Niezależny projekt
inspirowany funkcjonalnie Fitatu i Stravą — bez kopiowania ich kodu czy baz.
Docelowo: `flexa.click` (landing), `app.flexa.click` (aplikacja).

Aplikacja z kontami: [Flexa](https://flexa-click.pages.dev/),
[rejestracja](https://flexa-click.pages.dev/signup). Korzysta z osobnego projektu
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

**Zaimplementowane:** konta Supabase, cele kalorii/makro i wody, dziennik posiłków,
produkty własne, wyszukiwanie Open Food Facts + opcjonalnie USDA, kamera
BarcodeDetector/ZXing, treningi, import własnych GPX/TCX, tempo i minuty × RPE,
analizy 7/30/90 dni, pomiary, eksport JSON, usunięcie konta i synchronizacja.
Oddzielne demo zapisuje wyłącznie przykładowe dane na urządzeniu.

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
| `shared` | Walidowane modele żywienia i aktywności |
| `supabase` | Migracja, RLS, auth profile, limity API, funkcje |
| `site` | Statyczny landing i publiczne informacje wdrożeniowe |
| `docs` | Research, źródła, koszty, instrukcja konfiguracji |

Instrukcje: [wdrożenie](docs/DEPLOYMENT.md), [research i zasoby](docs/RESEARCH.md).
GitHub Actions publikuje landing i demo (`npm run build:pages`); aplikację z kontami buduje integracja
Cloudflare Pages z tego samego repozytorium.

```powershell
npm run lint
npm run build
npm run build:site
npm run check:edge
npm test
npm run test:e2e
```

API Stravy jest wyłączone z uwagi na jego aktualny regulamin. Nie ma zdjęciowego
AI, rankingów, map ani natywnego Apple Health / Health Connect w tej wersji.
„Darmowe funkcje” nie oznacza darmowej domeny, nieograniczonej infrastruktury
ani gwarantowanej kompletności danych produktów. Flexa nie daje porad medycznych.
