# GymSim

A gamified fitness tracker built around a **living body model**. Your body is
18 sub-areas across 6 systems. Logged workouts feed the specific areas they
train, every area decays daily, and pinned priority areas (e.g. back rehab)
get their own weekly targets. Built from PRD v0.1.

It's an installable web app (PWA): open it on your phone, then **Add to Home
Screen**. It works offline, and all data stays on the device.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173 — also on your LAN, so open it on your phone
npm test           # scoring-engine tests
npm run build      # production build in dist/ (static files, host anywhere)
```

**Live app:** https://jamesfitz1.github.io/GymSim/. Every push to `main` is
tested, built and deployed by `.github/workflows/deploy.yml`.

To install it on your phone, open the link and:
- **iPhone (Safari):** Share → Add to Home Screen
- **Android (Chrome):** ⋮ → Install app

## What's in v0.1 (PRD §12-G walking skeleton, plus a little more)

- **Onboarding** with the medical-safety disclaimer (§9), and an optional choice of priority areas.
- **Body dashboard:** a rotating avatar (drag it, or tap Front/Back) with muscles coloured by health and a beating heart for Cardio, system bars that
  expand into sub-areas, "declining" flags, streak, coins, and areas trained this week.
- **Log a workout:** sets × reps (× weight) or minutes, with a live preview of
  the points each area will get. You can backdate up to 6 days and delete entries.
- **Exercise library:** 30 seed exercises plus 4 coin-unlockable ones, each with
  its area weightings shown. You can add **custom exercises** with your own mappings.
- **Priority areas:** pin any sub-area to give it a weekly points target, a
  dashboard slot and faster decay.
- **Coins:** earned from consistency only. Spend them on colour themes and exercise unlocks.
- **Your data:** export/import a JSON backup, or erase everything.

## Decisions made to close the PRD's open items

All the numbers live in [`src/domain/config.ts`](src/domain/config.ts), so they're easy to retune.

| PRD item | Decision |
|---|---|
| **D. Body model / Q4 sixth system** | 6 systems. **Back health** is its own headline (lower-back strength, spinal stabilisers, back mobility). Lats stay in Upper body. |
| **A. Data model** | Only facts are stored: logs, custom exercises, pins, purchases and settings. Levels, streaks and coins are **recomputed by replaying history day by day** (`src/domain/engine.ts`), so deleting a log or changing decay stays consistent. Types are in `src/domain/types.ts`. |
| **B. Seed mapping table** | `src/domain/exercises.ts`. A test enforces that each exercise's weights sum to 1 and every area is trainable. |
| **C / Q3. Normalisation** | Each exercise defines a **standard session** in its own units (reps or minutes). Hitting it gives the main area **+20** and secondary areas a proportional share. More volume has diminishing returns (`ratio^0.7`, capped at 2.5×). Weight gives up to a 1.5× multiplier. An area can gain at most **+35 per day**. |
| **C / Q1. Decay** | Each area loses a **percentage** of its level each untrained day, set by a half-life: strength 21 days, mobility 16, cardio 12. Focus areas fade 1.5× faster. Gains shrink as an area gets stronger (`gain × (1 − level/120)`), so levels **settle** at a point that reflects training frequency (a strength area trained 1×/week ≈ 50–60, 3×/week ≈ 85) instead of drifting to 100 or 0. Fade speed (Gentle / Standard / Tough) is adjustable in the app. |
| **C / Q2. Cap vs prestige** | Capped at 100, which in practice needs near-daily training. No prestige mechanic. |
| **Starting levels** | A 14-question health check (`src/domain/assessment.ts`): activity and training-frequency answers give an estimate per area that matches where it would settle, then quick self-tests (push-ups, pull-ups, sit-to-stand, single-leg calf raises, plank, toe touch, shoulder reach, hips, walking) are blended in at 60%. Every area has a test. Starting levels range from 10 to 85. |
| **E. Stack** | Vite + React + TypeScript PWA, local-only (`localStorage`). No account or backend, so no health data leaves the phone. |
| **§6.5 Coins** | +5 per training day, streak bonuses at 3/7/14/30/60/100 days, +20 per weekly priority target hit. Intensity never earns coins. |
| **H. Name** | **GymSim**. Set in `APP_NAME` (`config.ts`), `index.html` and `public/manifest.webmanifest`. Still worth a trademark and app-store availability check before launch. |
| **I. Safety copy** | Shown in onboarding (it must be accepted), on the Priorities screen and on the You screen. The app suggests no exercises; it only tracks them. |

## Injuries

Log an injury from the **Injuries** tab (region, side, severity, start date, affected areas, notes). On its start day each affected
area drops **10 points**, then it **stops fading** until you mark it recovered, so resting isn't counted as neglect (logged rehab still
raises it). Injured parts pulse red on the body, exercises that load them show a warning, and you can log a 0–10 pain score each
day to see the trend. GymSim never gives medical or exercise advice; it's a log to take to your clinician.

## Not in v1 (per PRD §7)

No social features, no programme or medical guidance, no wearable or Health
integrations, no cloud sync. Because data is local, back it up from **You →
Export backup** before you change phones.

## Code map

```
src/domain/config.ts     body model, tuning numbers, coins, themes
src/domain/exercises.ts  seed exercise → area mapping table
src/domain/engine.ts     scoring + day-by-day replay (levels, decay, streaks, coins)
src/domain/engine.test.ts
src/store.ts             localStorage persistence + actions
src/screens/             Dashboard, Workout, Injuries, More (You), Profiles, FocusAreas
src/components/          bodyModel (sculpted 3D body), Body3D (3D view), BodyFigure (2D fallback), ExercisePicker, UI pieces
public/                  manifest, icons, service worker (offline)
```
