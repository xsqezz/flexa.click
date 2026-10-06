# Flexa

Darmowy, polski dziennik jedzenia, treningów i postępów. Niezależny projekt
inspirowany funkcjonalnie Fitatu i Stravą — bez kopiowania ich kodu czy baz.
Docelowo: `flexa.click` (landing), `app.flexa.click` (aplikacja).

**Zaimplementowane:** konta Supabase, cele kalorii/makro i wody, dziennik posiłków,
produkty własne, wyszukiwanie Open Food Facts + opcjonalnie USDA, kamera
BarcodeDetector/ZXing, treningi, import własnych GPX/TCX, tempo i minuty × RPE,
analizy 7/30/90 dni, pomiary, eksport JSON, usunięcie konta i synchronizacja.
Oddzielne demo zapisuje wyłącznie przykładowe dane na urządzeniu.

**Przygotowane do wdrożenia, nie skonfigurowane automatycznie:** projekty
Supabase/Cloudflare, SMTP i DNS trzeba podłączyć zgodnie z instrukcją.
GitHub Pages hostuje publiczny landing, nie aplikację z wrażliwymi danymi.
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
GitHub Actions publikuje landing i uruchamia kontrole; aplikację buduje integracja
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
