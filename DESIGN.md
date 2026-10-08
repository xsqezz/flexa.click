---
name: Flexa
description: A light, practical planning board for food, movement and progress.
colors:
  pine: "#276043"
  pine-dark: "#1d4933"
  ink: "#20352b"
  muted: "#617068"
  paper: "#f5f7f6"
  landing-paper: "#f7f9f6"
  surface: "#ffffff"
  line: "#e2e8e4"
  active: "#edf4eb"
  protein: "#336fac"
  carbs: "#9c641d"
  fat: "#775798"
  danger: "#a63a35"
typography:
  body:
    fontFamily: '"Segoe UI", -apple-system, BlinkMacSystemFont, Arial, sans-serif'
    fontWeight: 400
    lineHeight: 1.65
  app-headline:
    fontSize: "1.9rem"
    fontWeight: 650
    lineHeight: 1.22
    letterSpacing: "-0.035em"
  landing-display:
    fontSize: "4.8rem"
    fontWeight: 650
    lineHeight: 1.02
    letterSpacing: "-0.04em"
  title:
    fontSize: "1.08rem"
    fontWeight: 650
    letterSpacing: "-0.02em"
  control:
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
rounded:
  control: "9px"
  panel: "16px"
  mobile-panel: "13px"
spacing:
  control-inline: "16px"
  control-block: "10px"
  panel-inline: "25px"
  panel-block: "23px"
  group: "22px"
components:
  button-primary:
    backgroundColor: "{colors.pine}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
    height: "43px"
  button-primary-hover:
    backgroundColor: "{colors.pine-dark}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "23px 25px"
---

# Design System: Flexa

## Overview

**Creative North Star: "The daily sports-club planning board"**

A clear, light working surface for reading a personal diary in daylight or
between workouts. Food, movement and measurements share a practical visual
language without turning daily values into scores or competitive rankings.

The application prioritizes familiar controls and readable records. The public
landing uses the same identity at a larger scale; its illustrative diary is
explicitly labeled as synthetic. Product and deployment truth belongs in
PRODUCT.md and the deployment guide, not decorative marketing claims.

**Key Characteristics:**
- Cool light paper, pine ink and functional green actions.
- One system sans family with tabular numeric values.
- Separate blue, ochre and lilac nutrient roles.
- Flat record divisions, native controls and restrained state transitions.

## Colors

Pine is the action and identity color; neutral layers do most of the structural
work. White panels sit on cool paper with thin pale separators. Muted text must
remain readable, including captions and placeholders.

Protein, carbohydrates and fat have distinct functional colors, always accompanied
by names and numeric values. Red belongs to destructive actions and error states,
not diet judgments. The landing has a slightly lighter paper background and
larger green-tinted sections without changing the app's semantic palette.

**The Named Values Rule.** Never make color the only way to distinguish a nutrient,
selected state, missing value or error.

## Typography

Use the system stack recorded above, not a remotely loaded display font. Headings
use restrained weight and tight tracking; data totals use tabular numerals.
App headings reduce to 1.6rem on phones. Landing typography follows its own
breakpoints and does not become the scale for working forms.

Controls are 0.875rem; section headings are 1.08rem. Help and attribution copy is
smaller but remains readable. SVG chart axes render at a physical 12px: adapt the
plot width rather than shrinking all lettering inside a fixed desktop viewBox.

## Layout

Desktop uses a 225px utility rail, a 78px topbar and a centered working region
with up to 1370px content width. Related groups usually have 22px separation.
Panels use 23px by 25px padding with smaller responsive horizontal padding.

App breakpoints are 700px, 980px, 1190px and 1550px. Under 980px the dashboard
columns stack; under 700px the rail disappears, task groups stretch to the
available width and a bottom navigation bar replaces desktop navigation.
Reserve bottom space for that fixed bar and safe-area insets.

Landing containers reach 1290px; its content ledger reaches 1210px. Its 700px,
950px and 1290px breakpoints reshape the offer and illustrative board. Setup
documentation uses a 920px reading container and horizontally scrollable tables.

## Elevation & Depth

App surfaces are flat at rest, distinguished by white fill, thin borders and
spacing. Small selection shadows are limited to segmented controls. The landing's
illustrative board uses a soft offset shadow and slight rotation; this is a
demonstration treatment, not the default for every app panel.

Native dialogs use a subdued dark backdrop, not blur or glass. Keep transitions
short and state-driven; honor reduced-motion preferences.

## Shapes

Controls use 9px corners; panels use 16px, reducing to 13px on phones. Record
groups use straight thin separators instead of individual nested cards.
Small line icons accompany named actions. Rounded avatars and the leaf
illustration are accents, not a replacement for actual diary content.

## Components

**Buttons.** Pine primary, white bordered secondary, pale-green ghost and red
destructive variants share one control grammar. Loading disables repeat actions.
Focus uses a visible 3px blue outline; disabled controls are visibly subdued.

**Fields.** Explicit labels are associated with the native input or select.
Hints use `aria-describedby`. Inputs have a white fill, thin neutral border and
at least 44px height. Preserve units, required-state validation and error messages.

**Navigation.** Named line-icon links use muted ink at rest and pale green with
pine text when active. Five destinations (Dzisiaj, Dziennik, Kuchnia, Trening,
Postępy) share the rail and the phone's bottom bar. "Trening" covers two views, Plan
and Historia, switched by a segmented control at the top of both pages. On phones
a round pine "Dodaj" button sits in the middle of the bottom bar and opens the
quick-add sheet; on desktop the same sheet opens from "Dodaj" in the top bar. Bottom
bar labels are at least 11px. Account settings stay reachable from the labelled
"Konto" link (44px avatar plus text) in the top bar, and "Szukaj" (Ctrl+K) opens the
command palette beside it.

**Quick add and search.** "Dodaj" is a bottom sheet on phones and a right-hand drawer
on desktop: two-column grid of 64px action rows (posiłek, skan, woda, trening, pomiar,
przepis, dzisiejszy trening). The command palette is a centered dialog (640px) with a
combobox, a listbox of pages, actions and diary entries, and visible key hints.

**Day navigation.** A seven-day strip (day, number, kcal, dot for days with entries)
sits under the date control in the Dziennik; arrow keys, T and horizontal swipes on
Dzisiaj and Dziennik move between days.

**Undo.** Removing a diary entry hides it at once and shows a toast with "Cofnij" for
8 seconds; the deletion is written only when the toast goes away. Confirmation
drawers are reserved for destructive account-level actions.

**Dark theme.** Follows the system setting. `app/src/theme-dark.css` is generated from
`styles.css` by `scripts/build-dark-theme.mjs` (OKLab: light fills darken, dark text
lightens, hue stays); regenerate it after changing colors. Pine becomes `#7cc59a` for
text and borders, while filled buttons use `#2f7650` so white text keeps 4.5:1.

**Smart Kuchnia.** A flat panel under the page header with a three-step strip
(Produkty, Preferencje, Przepis) whose current step is pale green with a pine
numeral. Products are 44px toggle chips with emoji; selection adds a pine double
border and a check, never color alone, and groups collapse as native disclosures.
The optional photo area is a quiet tinted block with an explicit consent checkbox
before the first upload. The recipe is a two-column layout on desktop (picture, four
macro tiles and ingredients beside numbered steps) that stacks on phones. The dish
picture is always labelled as an AI illustration; without one, an emoji plate stands in.
Swaps and "Dodaj do dziennika" open in the standard right-hand drawer.

**Questionnaire.** The first-run "Zanim zaczniesz" flow and plan editing use a
standalone centered card (740px max) with the brand, a thin progress track and
"Krok N z M" in the header. One question group per step; the step heading
receives focus. Choices are flat bordered lists with thin separators and native
radios or checkboxes; the selected row turns pale green. Short options are 44px
chips whose selected state adds a pine double border, never color alone.
Back and next actions sit under a separator and stay sticky on phones.

**Training plan.** A seven-day strip shows numbered training days in pale green
and dashed rest days; today is outlined and underlined. Each session is a native
disclosure panel with a day badge, warm-up and cool-down ledgers, lettered
exercise blocks (A, B1, B2) with dose, cues, breathing, safety and alternatives.

**Workout player.** Entering a training day opens a focused standalone view
(760px column, no app navigation): exit, session title with elapsed time, sound
toggle and step list in the header; a thin progress track with the part and
"krok N z M". Each step shows only the current drill or set: tag and exercise
name, a large dose, effort notes, an optional countdown for timed work, the video
area and technique. "Wstecz" and a 56px "Skończone" stay sticky at the bottom.
Rest replaces the step with a dark pine surface: "Chwila przerwy", a very large
tabular countdown, a draining bar, the next exercise, "+15 s" and "Pomiń
przerwę"; it advances on its own with a short signal. Videos are click-to-load
facades on the same pine surface, never autoplaying third-party content first.

**Panels and ledgers.** White, thin-bordered surfaces group related tasks;
horizontal rows carry the actual records. Do not substitute an ornamental metric
for the food entries or the activity details it summarizes.

**Dialogs.** Right-hand native modal drawers become full-width on phones.
They protect focused editing, contain their heading and close action, support
Escape and restore focus to the initiating control.

**Charts.** Responsive native plotting dimensions preserve 12px axis text,
with fewer date labels when space is limited. Keep unknown days distinct from
zero, and retain the accessible table disclosure for every plotted dataset.

## Do's and Don'ts

### Do:
- **Do** preserve named units, visible source attribution and explicit unknowns.
- **Do** keep saved goals distinct from informational activity energy.
- **Do** use the same form, focus and action patterns across routes.
- **Do** preserve readable axes, full-width mobile task groups and reduced motion.

### Don't:
- **Don't** present synthetic data or unconfigured services as real user activity.
- **Don't** use guilt, rankings or alarm colors to judge a diary entry.
- **Don't** add decorative gradients, glowing surfaces or display fonts to forms.
- **Don't** shrink a desktop chart wholesale or rely on color alone.
