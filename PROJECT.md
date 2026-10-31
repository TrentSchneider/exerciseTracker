# Workout Tracker PWA — Project Guide

Instruction base for any chat session working on this project. Read fully before changing code.

## Overview
Offline-first workout tracker (React + TypeScript + Vite PWA). All data lives in IndexedDB; there is no backend. Deployed to GitHub Pages at `/exerciseTracker/`.

Features: landing page at `/` with onboarding guidance and calls to action; recovery dashboard at `/recovery`; custom workout builder, equipment registry with optional available-weight lists, ~90 seeded exercises + custom ones, rep/weight/bodyweight/effort logging, muscle fatigue + 0–100% recovery on a front/back SVG body diagram (dark blue → red), suggested workouts (fatigue, target muscles, regular/superset/HIIT mix, time limit), planner (single workouts and routines), weight/rep/time recommendations per set type, rest and exercise timers, searchable history with summaries, per-exercise progress graphs, pre-workout overview with adjust/swap, skippable exercises, export/import with overwrite warnings.

## Commands
| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | `tsc --noEmit && vite build` (outputs `dist/`, service worker) |
| `npm run preview` | Serve build on :4173 |
| `npm run typecheck` | Type check only |
| `npm test` | Vitest (unit + component/UI tests) |
| `npm run e2e` | Playwright (desktop + Pixel 7); needs `npx playwright install chromium` once |

Always run `npm test`, `npm run typecheck` before finishing work; run `npm run e2e` for UI/routing changes.

## Architecture
- `src/types.ts` — all shared types, `MUSCLES`, `MUSCLE_LABELS`.
- `src/data/seed.ts` — seed equipment/exercises. Add exercises here; `initDb` adds missing seed rows on every load and never overwrites existing rows.
- `src/domain/` — pure logic, no React/DB: `fatigue`, `recommend`, `generator`, `session`, `planner`, `stats`, `units`, `workout`.
- `src/db/db.ts` — IndexedDB via `idb`. DB `workout-tracker` v1; stores `settings` (keyPath `key`), `equipment`, `exercises`, `workouts`, `routines`, `plans`, `sessions` (keyPath `id`). Settings keys: `settings`, `activeSession` (resume in-progress workout).
- `src/db/exportImport.ts` — JSON backup `{app:'workout-tracker-pwa', schemaVersion:1, exportedAt, data}`; modes merge (imported wins on same id) or replace (wipe first); computes overwrite counts for warnings.
- `src/ui/AppContext.tsx` — global state/mutators (`useApp()`).
- `src/ui/components/` — BodyDiagram, Timer, LineChart, Modal, Fields, MuscleStatsPanel.
- `src/ui/pages/` — Landing, Home (recovery), Workouts, Suggest, Build, Preview, ActiveWorkout, Plan, History (+SessionDetail), Exercises (+ExerciseDetail), Equipment, Settings.
- `src/App.tsx` — HashRouter, nav (side nav ≥800px, bottom nav on mobile).

## Key rules / algorithms
- Weights stored in **kg**; converted for display (`units.ts`). Default lb.
- `Equipment.weightOptionsKg` is an optional sorted list of available loads for that piece of equipment. The Equipment page accepts comma-separated values in the user's display units and persists them as kg. Exercise recommendations use the first configured weight list among the exercise's required equipment; suggested loads snap to an available value. When a progression calls for more load but no heavier option exists, load stays at the equipment maximum and reps (or duration for a timed exercise) progress instead. Adding a heavier option lets the next recommendation use it and return reps/time to the lower end of the range.
- Fatigue and exercise stats are **derived from saved sessions**, never stored separately. Skipped exercises are excluded everywhere (an exercise with no logged sets is saved `skipped: true`; partial sets before skipping are kept).
- Set load = 18 × (0.4 + 0.6·effort/10) × setTypeFactor (regular 1, superset 1.15, hiit 1.3) × units; timed units = duration/45s; cardio ×0.5. Muscle weight 1 (primary, ≥0.6) or 0.4 (secondary). Exponential decay with per-muscle half-life 16–32h. recovery = 100 − min(100, fatigue). `computeMuscleStatus` ignores sets with `at > now`, so callers must pass a current `now`.
- Recommendations (`recommend.ts`): history kept per exercise **and set type**; missing types borrow from others scaled regular 1 / superset 0.9 / hiit 0.8. Double progression (effort ≥9.5 or below min reps → −5% weight; top of range with effort <9 → +5%; effort ≤8.5 → +1 rep), constrained by equipment weight options when configured. If no heavier equipment option exists, increase reps (or timed duration) instead of inventing a weight. Layoff >21d −10%, >42d −20%. Bodyweight progresses by reps then +2.5kg. Timed ±10% duration by effort. `PlanItem.manual` stops auto-refresh from overwriting user edits.
- Generator: filters by owned equipment (bodyweight always allowed), target primary muscles, recovery ≥40, set-type support; fills time budget (default 45 min ±8%); superset pairs prefer antagonists; HIIT = 3 exercises × 3 rounds 40s/20s; order regular → superset → hiit; optional cardio warm-up first. `swapCandidates` requires same primary muscle, owned equipment, set-type support, workout criteria, time budget, not already present.
- Rest model: **rest belongs to a set/round, not an exercise.** `PlanItem.restSec` = rest between sets (regular) or between rounds (superset/HIIT); all items in a block share one value (`blockRest`, `setBlockRest`, `syncBlockRest` in `workout.ts`; `restEdited` stops recommendations overwriting it). Supersets/HIIT have **no rest between exercises in a round**. The rest between exercises/blocks is `transitionSec` on the last item of a block (default 30s, `blockTransition`). `buildSteps` emits `restAfter` + `restKind` (`'set'` | `'exercise'`); the active workout reads live values from `items` so edits apply immediately. Defaults: HIIT 20s, superset ≤75s, regular per exercise, scaled by `restScale`.
- `WorkoutOverview` (`ui/components/WorkoutOverview.tsx`) renders every full-workout overview (Preview and Active): one card per block (bracket for superset/HIIT), the set/round rest editor to the RIGHT of the card, and the editable between-exercise rest between cards. Reuse it for any new overview.
- Target muscles: **Full body** (first chip) is represented by an empty `targetMuscles` list (= all muscles) so saved data stays compatible; selecting a muscle clears Full body and deselecting the last one restores it.
- Exercise guidance (`data/guidance.ts`): description + how-to steps + pose key per seed exercise (a test enforces full coverage); custom exercises get generic fallback text. `ExerciseGuide` shows them with inline SVG stick-figure start/finish poses and a read-only muscle diagram (`BodyDiagram readOnly`); used in the preview exercise modal and the exercise detail page. New seed exercises need an entry in `guidance.ts`.
- Timed exercises get an editable exercise timer.

## GitHub Pages constraints
- Static hosting only: no server, no SPA rewrites → **HashRouter**.
- Vite `base: '/exerciseTracker/'` (change in `vite.config.ts` and `playwright.config.ts` if the repo name differs).
- Service worker via vite-plugin-pwa (`generateSW`, navigateFallback); icons in `public/` (iOS needs the PNG `apple-touch-icon.png` linked in index.html; SVG icons are ignored by iOS, so regenerate the PNGs if icon.svg changes).
- Deployment: `.github/workflows/deploy.yml` (on push to `main`: `npm ci`, `npm test`, `npm run build`, deploy-pages). Enable Pages → Source: GitHub Actions.

## Testing
- Vitest + jsdom + Testing Library + `fake-indexeddb` (`src/test/setup.ts` gives each test a fresh IDBFactory). Helpers: `src/test/helpers.ts` (`session()`, `log()`, `seeded()`), `src/test/ui.tsx` (`renderApp`, `go`, `ownEquipment`).
- Domain tests `src/domain/*.test.ts`, db tests `src/db/db.test.ts`, component tests `src/ui/components.test.tsx`, full-flow UI tests `src/ui/app.test.tsx`, overview/rest/guide tests `src/ui/overview.test.tsx`, e2e `tests/e2e/`.
- Testing gotchas: number inputs need `tripleClick` + `keyboard` rather than `clear`; Playwright `check()` fails on controlled checkboxes that update after an async DB write — use `click()` then `toBeChecked()`.
- Add tests with every feature or fix.

## Conventions
- Keep domain logic pure and tested; UI calls it via `useApp()`.
- Mobile-first CSS in `src/styles.css`; accessible labels/roles (tests rely on them).
- Never write directly to IndexedDB from components; use AppContext mutators / `db.ts`.
- Schema changes: bump DB version with an upgrade path and `schemaVersion` in export, keep importing older exports.

## Pause, HIIT timing, exercise info modal

- **Pause**: `ActiveSession.pausedAt`/`pausedMs`; `pauseSession`/`resumeSession`/`activeSeconds` in `src/domain/session.ts`. Paused time is excluded from elapsed and saved duration. `Timer` has a `paused` prop (freezes and resumes the countdown). `ActiveWorkoutPage` wraps the workout body in `<fieldset className="plain" disabled={paused}>`; Finish/Discard stay outside. Timers restart from full duration after a page reload.
- **HIIT is time-only**: one shared work time per block (`blockWork`, `setBlockWork`, kept in sync by `syncBlockRest`), edited in the HIIT card in `WorkoutOverview` (`data-testid="hiit-work"`). No reps field in the active form; a nominal `reps` (the target) is logged so progression history isn't polluted.
- **ExerciseInfoModal**: opened by clicking an exercise name in the active workout (`aria-label="About <name>"`); shows the guide.
- **Sticky modal header**: `.modal header` is `position: sticky; top: -1rem` (offset by modal padding) so name and close button stay visible.

## Info modals while paused, cardio rules, HIIT auto-advance

- Exercise names in the active workout are `InfoLink` (`role="button"` span, not a native button) so they stay usable inside the disabled paused fieldset; the modal renders outside it.
- Cardio rules (`isMachineCardio` / `isFreeCardio` in `generator.ts`): machine cardio (equipment treadmill/bike/rower) is used only as the optional cardio warm-up (and swapped only with other machines); free cardio (jumping jacks, jump rope, high knees, ...) is used only in HIIT sets. Neither is used in regular/superset sets, and `BuildPage` hides all cardio.
- `Settings.hiitAutoAdvance` (Settings page checkbox, default off): when on, finishing a HIIT work timer in `SetForm` calls `submit(item.durationSec)`, logging the exercise with the current effort value and advancing. When off, the user taps Complete set.

## Target tiers (full body > region > muscle)

- `src/domain/targets.ts` owns the tree: `REGIONS`/`REGION_MUSCLES` (in `types.ts`), `exerciseCapacity` (max exercises from time, set types, cardio warm-up), `allocate` (even split of capacity across selected regions, then across selections within a region; `fits` is false if any selection would get 0), and the toggle rules (`toggleRegion`, `toggleMuscle`, `selectFullBody`, `trimToCapacity`).
- `Criteria.targetRegions` (and `RoutineDay.targetRegions`) hold tier 2; `targetMuscles` holds tier 3; both empty = full body (split evenly over upper/lower/core). Selecting a region clears its muscles; selecting a muscle clears its region; either clears full body.
- `generateWorkout` turns the allocation into slots (`remaining` per leaf) and `pickFor` always fills the slot with the most exercises owed, so no selected area is skipped. Supersets/HIIT may overshoot a quota by one to complete a block.
- `CriteriaForm` order: Time available, Set types, Cardio warm-up (+ fatigue), then Target muscles. Targets that would not fit the capacity are disabled; changing time/set types/warm-up trims the selection to fit.
- Capacity constants (seconds per block, exercises per block) are in `targets.ts`; recalibrate if default rests change.

## Custom workout builder

- `BuildPage` has a "Maximum time" select (15–90 min or "No maximum"; stored as `criteria.maxMinutes` on the draft) and a live estimate (`estimateItemsSeconds` in `workout.ts`, which syncs block rests like the preview does).
- The Add exercise modal has a Set type (regular / superset / HIIT) and, for superset/HIIT, an "Add to group" choice (new or existing group, max 2 per superset, 4 per HIIT). Exercises that would push the estimate over the limit are disabled, as are set types with no room left; the per-row set-type select disables options that would exceed it. If the total is over the limit anyway (e.g. after lowering it) a warning shows. Groups with a single exercise get a warning. Cardio exercises are never listed.

## Planner recurrence & calendar
- `Routine` has `frequency` (`daily`|`weekly`, default weekly), `startDate`, optional `endDate` (absent = no end). `RoutineDay.weekdays` holds several weekdays (legacy `weekday` is a fallback). Daily routines include every training day on every date in range.
- `src/domain/planner.ts`: `routineCovers`, `agendaForDate`, `agenda` (14-day list), `monthGrid` (Sunday-first).
- `PlanPage` has a List ("Next 14 days") / Calendar toggle saved as `settings.plannerView`. Calendar marks dates with workouts (dot); selecting a date shows its workouts and the add-workout form for that date.
- `RoutineEditor` has a `recurrence` fieldset (Repeats, Start date, End date, "No end date") and weekday chips for weekly days.
- Rotation: weekly routines have `rotate` ("Rotate target groups"). A day set to Full body rotates upper, core, lower; a day with 2–3 tier-2 regions (no individual muscles) rotates through them. `resolveDay`/`occurrenceIndex` in `planner.ts` pick the group from how many times the day has occurred since `startDate` (fixed anchor if none), continuing across weeks; the agenda shows the resolved day (label suffixed with the group).

## Active exercises
- `Exercise.inactive?: boolean` (absent = active, so old data/imports stay active). The Exercises page has an Active checkbox per row (and on the detail page) plus an Active/Inactive status filter. `generateWorkout` skips inactive exercises; the custom builder, swaps and history still see all exercises.

## Icons
- No emoji or symbol glyphs in the UI: use `<Icon name="…" />` from `src/ui/components/Icon.tsx` (inline SVG, `currentColor`, decorative `aria-hidden`). Add new icons to its `PATHS` map. Icon-only buttons keep their `aria-label`.

## Appearance (iOS style, light/dark)
- `Settings.theme?: 'auto'|'light'|'dark'` (absent = auto), set in Settings > Appearance. `src/ui/theme.ts` (`useTheme`, called in `AppProvider`) sets `data-theme` on `<html>` (removed for Auto) and updates the `theme-color` meta; Auto follows `prefers-color-scheme` through CSS.
- All colours come from CSS variables at the top of `styles.css` (light defaults; the dark block is duplicated for the media query and `[data-theme="dark"]`, so keep the two in sync). Don't hard-code colours in CSS/TSX; SVGs use `style={{ fill: 'var(--…)' }}`. The "iOS-style appearance" block at the end of `styles.css` holds the overrides (system font, grouped cards, translucent tab bar/sidebar, switch-style checkboxes, segmented controls, sheet modals) and must stay last.

## Exercise visuals
- Stick figures are built by `ui/components/poseRig.ts`: each pose gives pelvis, torso lean and foot/wrist targets, and knees/elbows are solved with two-bone IK (fixed bone lengths; knees bend toward the front of the body, elbows toward the back; `flip` for prone, `front` for front-view poses). Author new poses as targets, never raw joint coordinates; `poseRig.test.ts` checks lengths and bend directions.
- `ExerciseGuide` shows Start/Finish **photos** when `EXERCISE_PHOTO_IDS` (`src/data/exerciseImages.ts`) contains the exercise id, otherwise (custom exercises, or an image load error) the drawn stick figures. Photos live in `public/exercise-images/<id>/{0,1}.jpg` (~9 MB, from Free Exercise DB, public domain / Unlicense; ~75 of the 100 built-ins). They are not precached; a Workbox `CacheFirst` runtime route (`exercise-photos`) caches them on first view for offline use. To add one, drop the two JPGs in a new folder and add the id to the set (a test checks the files exist).
- The "muscles worked" body diagram colours primary muscles (weight ≥ 0.6) with `--muscle-primary`, secondary with `--muscle-secondary`, others neutral, and lists them in the caption. `BodyDiagram` accepts an optional `fills` map for explicit colours.
