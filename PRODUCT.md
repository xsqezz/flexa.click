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
- Open Food Facts is the primary packaged-food source; USDA FoodData Central
  is an optional fallback. Missing nutrient values are not invented.
- GitHub Pages hosts the public landing and setup documentation. Cloudflare
  Pages hosts the application; Supabase provides Postgres, Auth, and functions.
- All application features are free for users. Infrastructure free tiers,
  external APIs, and domain registration still have costs or quotas.
- Accounts and all private records are isolated by database authorization.
  API secrets never belong in the client build.
- Export, deletion, source attribution, and transparent error states are
  part of the product, not optional extras.
- Strava API use is conditional on its agreement and explicit approval.
  It is disabled by default; own GPX/TCX files are the independent import path.
- Social feeds, leaderboards, medical advice, photo-calorie AI, live GPS
  background recording, and native Apple Health / Health Connect integrations
  are not part of this first version.

## Brand Commitments

Name: Flexa. Target public domain: `flexa.click`; target application subdomain:
`app.flexa.click`. Friendly, direct Polish copy without guilt, invented health
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
