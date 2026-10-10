# Flexa

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Active people who want to track food, workouts, and progress in one place.
The first interface is in Polish and is designed for everyday use on a phone
as well as a desktop.

## Product Purpose

A free nutrition and activity journal with accounts, persistent data,
cross-device synchronization, and useful progress analysis.

## Positioning

One view of a person's day connects nutrition, activity, hydration, and goals.
Useful analysis and data export are not subscription features. Flexa is an
independent product, not affiliated with Fitatu or Strava.

## Operating Context

Users enter portions, scan packaged-food barcodes, log workouts, import their
own activity files, and review their progress. Camera access is opt-in.
Cloud storage requires a configured Supabase project and an authenticated
account. An explicitly labeled local demonstration is available without an
account; it is never presented as synchronized cloud data.

## Capabilities and Constraints

- Responsive application, authentication, profiles, calorie and macro goals,
  meal journal, water, measurements, manual workouts, and progress charts.
- A first-run "Zanim zaczniesz" questionnaire and a Plan tab create a weekly
  training plan for gym or home equipment, ages 16+ in the demo and 18+ with
  an account. A deterministic in-browser rule engine and exercise library
  produce warm-ups, sets, reps, rest, technique cues, alternatives, and
  cool-downs; no AI service receives the answers. Health limitations are only
  stored with separate explicit consent, and the plan is general guidance,
  not medical advice.
- A guided workout mode shows one drill or set at a time with a "Skończone"
  action, automatic rest countdowns, timers for timed work, resumable local
  progress, and click-to-load YouTube technique videos (privacy-enhanced embed,
  IDs verified through oEmbed) with a search link where no video is curated yet.
- "Smart Kuchnia" cooks from what the user has: chosen products (or, with an
  account and explicit consent, a fridge photo whose recognised product list the
  user confirms), three short questions (time, equipment, dislikes/allergies/mood),
  then a recipe with ingredients, equipment-aware steps and per-serving macros,
  ingredient swaps and a one-tap diary entry. A deterministic in-browser engine
  and ingredient database write every recipe and compute every macro; Cloudflare
  Workers AI only lists products visible in a photo and draws an illustrative dish
  picture, within per-account daily limits. Photos are not stored, nutrition is an
  estimate, and the feature works without AI in the local demo.
- Open Food Facts is the primary packaged-food source; USDA FoodData Central
  is an optional fallback. Missing nutrient values are not invented.
- "Szybki wpis" (under Posiłki and Dodaj) turns a typed or dictated Polish sentence into
  the same editable plate list, using a local deterministic parser and the Skan library;
  no AI, no quota, nothing sent. Unknown words are reported, never dropped silently.
- "Skan posiłku" (under Posiłki, also from Dodaj and search) turns a photo of a tray or
  plate into an editable list of components. With an account and explicit consent, a
  vision model on Cloudflare Workers AI only names the visible items (English menu names,
  restaurant brand, size, count) and never estimates calories; the app matches them to its
  own library of over 8,000 items (official McDonald's, Burger King and KFC Poland menus,
  USDA FoodData Central, hand-made Polish dishes). A recognised chain item uses the chain's
  published values; everything else is computed by a deterministic in-app
  estimator from table values and always
  shows a range, because a photo cannot reveal weight, oil or sauce inside a dish. Uncertain
  matches are flagged for review and swapped in one tap. The
  user corrects size, number of pieces or weight, may type exact values from a menu,
  receipt or package (which replace the table), and confirms before anything is saved
  to Posiłki. Photos are not stored. The demo offers the same flow built by hand.
- Navigation has seven phone positions (Cele, Posiłki, Kuchnia, Dodaj, Treningi,
  Ruch, Postępy); Dodaj opens a quick-add sheet from every screen. Cele is the
  landing screen and owns approved nutrition targets and their history, Posiłki own
  meal entries, Treningi the plan and workout player, Ruch logged activity, and Postępy own longer-term
  measurements and movement. A command palette (Ctrl+K) finds pages, actions and diary entries,
  day navigation by swipe, arrow keys and a week strip, and undo toasts instead of
  confirmation dialogs for removing entries. The interface follows the system
  light or dark setting and can be installed as an offline-capable web app (PWA).
- Planning aids stay advisory and local: Cele show a cycle recap and may propose a small calorie
  change when the 14-day weight trend leaves the phase band (user confirms it as a new cycle;
  never for under-18s, never below 1200/1500 kcal); the weekly meal plan, shopping list and
  remembered Skan portions live in the browser per account; exercise history shows personal
  records and gentle progression hints without rankings, streaks or badges. "Moje treningi" are
  user-named workouts saved from the diary (kind, usual minutes, optional sets) and logged again with one tap.
- After the training questionnaire (including skip), adults may propose calorie,
  macro and water goals using Mifflin–St Jeor and confirm them or set them manually.
  Each dated nutrition cycle stores an approved snapshot, start and target weight.
  The latest measurement is current weight; ending a cycle never changes calories
  automatically. Demo users aged 16–17 can set manual goals only, without phase
  or calorie suggestions. Age and sex already stored in a training plan may be
  reused; calculator-only height/activity inputs are not persisted.
- Diary extras: copy a meal from yesterday, saved meal templates, recipes saved as
  products, optional workout sets with load and an exercise history, a 7-day
  weight trend, optional waist and hip measurements, JSON backup restore
  (historical cycles only on explicit opt-in into an empty history) and CSV export.
- GitHub Pages hosts the public landing and setup documentation. Cloudflare
  Pages hosts the application; Supabase provides Postgres, Auth, and functions.
- An Android app (`android/`, installed from GitHub Releases, not Google Play) is a
  thin WebView shell around the live application, so web releases reach it
  instantly; it adds a native updater that offers newer APKs with a one-tap
  "Zaktualizuj", verifying the checksum and the signing certificate before the
  system installer confirms. It also offers opt-in, local-only reminders for
  training days and water as Android notifications. It adds no analytics, ads, or
  push servers.
- All application features are free for users. Infrastructure free tiers,
  external APIs, and domain registration still have costs or quotas.
- Accounts and all private records are isolated by database authorization.
  API secrets never belong in the client build.
- Export, deletion, source attribution, and transparent error states are
  part of the product, not optional extras.
- Strava API use is conditional on its agreement and explicit approval.
  It is disabled by default; own GPX/TCX files are the independent import path.
- Social feeds, leaderboards, medical advice, a claim of exact calories from a photo
  (the scan always shows a range and asks for confirmation), live GPS
  background recording, and native Apple Health / Health Connect integrations
  are not part of this first version.

## Brand Commitments

Name: Flexa. Public domain: `flexa.best`; application subdomain:
`app.flexa.best`. Friendly, direct Polish copy without guilt, invented health
promises, or claims of affiliation with competing products.

## Evidence on Hand

The repository initially contained only README.md and no existing UI,
brand assets, testimonials, users, or measured performance claims.
Demonstration entries are synthetic and must be labeled accordingly.
Research and setup prerequisites are documented with links to primary sources.

## Product Principles

1. Food and activity should be easy to record, not another daily obligation.
2. The user's records remain private and portable.
3. Show the provenance and limitations of external food data.
4. Never confuse estimates, incomplete configuration, or demo data with reality.
5. A free application does not justify hidden infrastructure costs or paywalls.

## Accessibility & Inclusion

Target WCAG 2.2 AA for the web interface: keyboard operation, visible focus,
readable contrast, reduced-motion support, chart text summaries, and usable
touch controls. Calorie and weight displays are neutral, not judgmental.
