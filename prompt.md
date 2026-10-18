# Personal Calisthenics — Coding Agent Master Prompt

> Build a production-ready, single-user, local-first Calisthenics progressive web app. This document is both the **System Architecture Specification** and **UX/UI Design Specification**, including implementation requirements and acceptance criteria.

## 0. Role and delivery contract

Act as a senior software architect, senior React/TypeScript engineer, product designer, and QA engineer. Implement a complete, maintainable application rather than a static mockup. Prioritize data correctness, straightforward architecture, mobile usability, and accessibility. Do not add authentication, hosted databases, subscriptions, paid APIs, social features, or an AI service. Avoid overengineering. When choices are not specified, make reasonable decisions and document them in `README.md`.

Deliver a working repository with source code, tests, scripts, GitHub Actions deployment, and clear setup/deployment instructions. Never claim a feature is implemented unless it works.

## 1. Product context

- **Audience:** exactly one person; single profile, no multi-user administration.
- **Primary device:** Android phone; also responsive on desktop.
- **Language:** Thai interface by default, English exercise names acceptable.
- **Hosting:** GitHub Pages from the user's own GitHub repository.
- **Data:** local-only IndexedDB in the active browser/device. No automatic cross-device synchronization.
- **Modes:** installable PWA, offline after a successful initial visit/cache installation.
- **Goal:** build muscle and calisthenics skills, log workouts fast, objectively track progress.

### Starting baseline (editable in Settings)

| Metric                 |             Initial value |
| ---------------------- | ------------------------: |
| Push-up continuous max |                   15 reps |
| Pull-up continuous max |                    3 reps |
| Dip continuous max     |                   10 reps |
| Bodyweight             |                     70 kg |
| Height                 |                    173 cm |
| Dumbbells              |                  2 × 5 kg |
| Other equipment        |     Pull-up bar, dip bars |
| Training days          | Monday, Wednesday, Friday |
| Goals                  |      Hypertrophy + skills |
| Explicitly excluded    |          **Dumbbell Row** |

Do not include Dumbbell Row in the default program or automatic recommendations. Do not assume dip bars support inverted rows or any other unsupported setup.

Previous mentions of elbow and lower-back discomfort warrant conservative safety-aware substitutions, not medical diagnosis.

## 2. Scope and priorities

### Phase 1 — required MVP

1. Dashboard with today's plan, training schedule, quick start, weekly completion, and personal records.
2. Active workout screen: target/previous performance, reps or seconds, set completion, RIR, editable sets, rest timer, skip exercise, finish and resume unfinished sessions.
3. Editable 4-week training plan, exercise library, workout history, PR tracking, and basic progress charts.
4. Pain/discomfort logging and safe skip/modify workflow.
5. Editable profile/equipment/preferences.
6. IndexedDB persistence, robust JSON backup/restore, CSV export.
7. PWA caching, responsive layout, accessible interactions.
8. Automated tests and GitHub Pages deployment.

### Phase 2 — optional after the MVP works

- Rule-based progression recommendations, skill roadmap, protein target tracker, better recovery insights.
- No AI API required. No photos in MVP.

### Explicitly out of scope

Login, account management, cloud backend, GitHub API used as a database, cloud sync, push-notification guarantees, social feed, leaderboards, gamification, and analytics trackers.

## 3. Technical architecture

### Required stack

- React + TypeScript (strict mode) + Vite.
- Tailwind CSS; shadcn/ui where useful; Lucide icons.
- React Router **HashRouter** for reliable GitHub Pages subpath refresh/navigation.
- Dexie.js on IndexedDB for structured persisted app data.
- Zod for import/config validation.
- Recharts for minimal charts; date-fns for date calculations.
- vite-plugin-pwa for offline app shell and assets.
- Vitest + React Testing Library + Playwright for tests.
- ESLint and Prettier; committed lockfile.

Use stable compatible package versions available at implementation time. Do not use experimental platform APIs when a standard alternative exists.

### Suggested source structure

```text
src/
  app/                 # app entry, providers, routes, layout
  components/          # shared minimal UI elements
  features/
    dashboard/
    workout/
    programs/
    exercises/
    progress/
    recovery/
    settings/
    backup/
  db/                  # Dexie schema, migrations, repositories, seed
  domain/              # types, validation, metrics, progression rules
  hooks/
  lib/                 # dates, formatting, PWA utilities
  styles/
  test/
public/
.github/workflows/deploy.yml
```

Keep calculations and business rules in pure, unit-tested functions. UI components should not directly manipulate database internals. Repository/data access should be separated from screens. Do not introduce a global state library unless clear complexity justifies it.

### Storage model

Provide durable IDs (UUID), schema versions, explicit timestamps, and IndexedDB indexes. At minimum:

- `profile`: user values, goals, equipment, exclusion list.
- `exercises`: name, category, instructions, equipment, precautions, easier/harder variants, exercise modality (reps/hold/weighted).
- `programs`: program identity, start date, duration, active state, template version.
- `programDays` / `programExercises`: day, order, exercise ID, target sets, rep range/hold target, rest duration, optional variations.
- `sessions`: scheduled day, started/completed timestamps, in-progress/completed/abandoned state, program reference, notes, **snapshot of planned exercise targets**.
- `sets`: session/exercise link, ordinal, performed reps/duration, external weight, RIR, completion timestamp, modification flags.
- `painLogs`: session, exercise, location, intensity 0–10, note.
- `measurements`: measurement date, kg, optional waist cm.
- `personalRecords`: exercise, metric, value, occurredAt, provenance/source set or test.
- `settings`: theme, rest timer, units, reminder preferences, backup metadata.

Program edits MUST NOT retroactively rewrite completed workout history. Transactions should make related writes atomic where necessary. Prevent repeated button taps from producing duplicate sets. Validate data boundaries; numeric inputs must reject invalid/negative values. Schema migrations must preserve past records. Seed data exactly once without overwriting personalized edits.

### Metric semantics

- PR for consecutive push-ups/pull-ups/dips = **max valid reps in one uninterrupted set**, never sum of several sets.
- Bodyweight work: total performed reps/sets; do not label this as kilogram training volume.
- External weighted work: sum of reps × external kg where appropriate, with clear metric labels.
- Isometrics: total hold duration in seconds.
- Completion rate: completed scheduled sessions / scheduled sessions in a defined period, clearly handling missed/rescheduled days.
- Distinguish manually recorded baseline PRs from logged workout results.
- Dates follow device-local timezone; avoid UTC date-shift bugs.

### Offline/data integrity

- Log a completed set to IndexedDB immediately; do not require network.
- Unfinished session must be recoverable after refresh, browser restart, and navigation.
- Rest countdown should use an absolute end timestamp (not solely a decrementing interval), so background throttling does not corrupt time.
- Use an installable PWA and cache only app assets as needed; do not claim offline operation before successful service-worker caching.
- Show an unobtrusive update-available notice rather than force reload during a workout.
- Warn plainly that browser storage can be cleared and does not sync between devices.
- JSON backups: schema version, export timestamp, app version, all user-owned data. Validate entire payload with Zod before writing; preview merge-vs-replace behavior; require confirmation; prevent partial destructive import with transactions or prevalidated staging. Add CSV workout-history export.
- Never commit personal workout logs to the repository, embed them in the public bundle, or silently send them to servers.

### Hosting and CI/CD

- Build into `dist/` and deploy with GitHub Actions + official Pages artifact/deployment actions.
- Workflow on push to `main`: install via lockfile, lint, typecheck, unit tests, production build, deploy.
- Configure Vite `base` for `/<REPO_NAME>/` on a project page; document optional user/organization pages case and how to set this without hardcoded usernames. Respect PWA scope and manifest start URL under the same base path.
- Use HashRouter and verify URLs work on hard refresh.
- No runtime GitHub token, backend credentials, or secrets exposed to client.
- Document GitHub Pages access: normal Pages sites are publicly accessible; local browser data remains local, but do not market the app URL as private.
- Explain that users must export/import to migrate between browser/device, and can back up manually.

## 4. Exercise program: editable seed content

Training frequency: Monday A / Wednesday B / Friday C. Tuesday/Thursday recovery, Saturday optional gentle skill/mobility, Sunday rest. Each session: 5–10 minutes warmup; main multi-joint sets rest 2–3 minutes; accessories 60–120 seconds; default train with ~1–3 reps in reserve. Never demand failure on every set.

### Monday — A: Pull + Push

| Exercise               | Prescription |
| ---------------------- | ------------ |
| Pull-up                | 5 × 1–2      |
| Assisted Pull-up       | 3 × 5–8      |
| Push-up                | 3 × 8–12     |
| Dumbbell Lateral Raise | 3 × 12–15    |
| Dead Bug               | 3 × 10/side  |

### Wednesday — B: Legs + Shoulders + Core

| Exercise              | Prescription  |
| --------------------- | ------------- |
| Goblet Squat          | 3 × 12–20     |
| Bulgarian Split Squat | 3 × 8–12/side |
| Pike Push-up          | 3 × 5–8       |
| Glute Bridge          | 3 × 15        |
| Calf Raise            | 3 × 20        |
| Hollow Hold           | 3 × 20–30 sec |

### Friday — C: Full Body + Skills

| Exercise         | Prescription             |
| ---------------- | ------------------------ |
| Pull-up          | 4 × 1–2                  |
| Negative Pull-up | 2 × 2–3 (only pain-free) |
| Dip              | 3 × 5–8                  |
| Push-up          | 2 × 10                   |
| Reverse Lunge    | 3 × 10/side              |
| Tuck L-sit       | 4 × 5–10 sec             |

Users may modify exercise order, targets, dates, and skip movements. Show alternatives without automatically inserting an exercise the user excluded.

### Week-by-week guidance (suggested, not imposed)

- **Week 1:** baseline and form; complete 3 sessions.
- **Week 2:** cautiously increase total quality reps if effort/recovery allow.
- **Week 3:** progress reps or a variation only after achieving the top of the range with good technique.
- **Week 4:** decrease early-week volume around 20–30% and test fresh at the end; record single-set max for Push-up, Pull-up and Dip.

Four-week _aspirational_ outcomes: push-up 18–22; pull-up 4–5; dip 12–15; hollow hold 30 s; tuck L-sit 5–10 s. Never promise results or automatically raise targets solely because a week changed.

### Safety workflows

- Easy pain check during/after each movement: none / elbow / lower back / shoulder / other, severity 0–10.
- If pain is reported, visibly discourage progression, suggest skipping the provoking exercise and offer optional alternatives: pull-up → pain-free assisted/adjusted pulling or pause; dip → shallower range or incline push-up if pain-free; hollow hold → dead bug; challenging lower-body movement → supported squat/sit-to-stand if pain-free.
- Avoid definitive diagnoses. Recommend professional evaluation for persistent symptoms, inability to move the joint fully, radiating pain, numbness, or weakness.
- Never push negative pull-ups or dips if elbow pain is active.

### Later phase skills

Foundation: push-up 20+, pull-up 5+, dip 15+. Intermediate prep: pull-up 8+, controlled pike push-up, tuck L-sit and wall handstand readiness. Later: L-sit, high pull-up, handstand, eventually muscle-up preparation when strength/joint tolerance support it. These are readiness-based goals, not guaranteed dates.

## 5. UX/UI: clean and minimal — mandatory

### Experience principles

The app must feel like a quiet, refined personal utility, **not a commercial fitness platform**. First-run flow should be short; launching a scheduled session from Home requires one tap; entering a completed set requires minimal taps. Prioritize content over decoration.

### Visual tokens

- Default **light theme**.
- Page background: `#FFFFFF`.
- Subtle surface: `#F7F7F5`.
- Main text: `#171717`.
- Secondary text: `#737373`.
- Muted sage accent: `#536C59`.
- Hairline border: `#EAEAEA`.
- Font: Inter or Geist with system-font fallback.
- 8px spacing rhythm; generous whitespace.
- 12–16px card radius; no bulky shadows.
- One clear primary CTA per screen.
- No gradients, neon, glassmorphism, confetti, XP points, excessive badges, oversized ornamental icons, or needless decorative cards.
- Use type scale and whitespace to establish hierarchy, not layers of nested card containers.
- Animation 150–200 ms max, and respect `prefers-reduced-motion`.
- Minimum 44 × 44px practical tap targets, accessible contrast/focus rings.
- Thai action text, English exercise names; dates/numbers readable on mobile.

### Navigation — only 4 bottom tabs

1. **Home** — next workout, weekly status, brief personal bests.
2. **Workout** — current session, training plan, exercise library, edit program, skill roadmap later.
3. **Progress** — exercise trends, history, records, bodyweight.
4. **Settings** — profile, equipment, backup/restore, theme, preferences.

Do **not** create a separate top-level Program or Nutrition tab. Place program editor inside Workout. Nutrition (Phase 2) can live inside Progress/Settings or a nested screen.

### Screen specifications

**Home:** small date, calm heading, upcoming session title, one prominent `เริ่มฝึก` button, last max for Push-up/Pull-up/Dip, simple three-day weekly completion display. Show recovery action instead when no training scheduled. No distracting dashboard overload.

**Active Workout:** current exercise at top, exercise number/sets, last workout comparison, clearly editable count with `− / +`, RIR optional, giant `บันทึกเซต` CTA. One set at a time; lightweight expand for all sets; skip/swap accessible; timer prominent after save; next exercise uncomplicated. Autosave and resume.

**Workout Summary:** elapsed time, completed/target sets, volume in meaningful units, PR events, simple notes and pain entry, Done CTA. Avoid fake celebrations.

**Progress:** restrained line charts for Push-up/Pull-up/Dip max reps and weekly completed sessions, explicit axes and labels; simple lists for recent sessions; empty states that guide first logging.

**Workout Plan Editor:** straightforward list of A/B/C days, expandable exercise rows, edit target sets/reps/rest, reorder, remove/add; confirm changes; preserve past session snapshots.

**Settings:** weight/height/equipment/goals, accent/theme (optional dark mode later), data export/import, local-only storage notice, destructive reset confirmation.

### Responsive design

- Primarily 360–430px viewport widths, functional at 320px.
- Bottom nav safe-area-aware; no overlap with action buttons/Android gesture area.
- Larger layouts retain centered content (max width ~640–800px for log views); charts adapt naturally.
- Avoid horizontal scrolling for core controls.
- Keyboard accessible and semantically labeled.

## 6. Detailed behavior and edge cases

- Support timed holds and per-side exercises without confusing their units.
- Number picker must distinguish 0 valid reps from missing entry and avoid accidental negative counts.
- Permit manual entry of full-set PR tests and baseline records with provenance.
- No scheduled workout on rest day; allow manual start if user chooses.
- When device date changes mid-session, preserve start date and elapsed time accurately.
- Prevent duplicate in-progress sessions unless user explicitly chooses to abandon/restart.
- Browser refresh should not restart/duplicate the current timer/session.
- Missing permissions or unsupported vibration/sound gracefully degrade.
- Charts should avoid invented samples or misleading interpolations.
- Empty/new user state should display seeded plan without pretending sessions were completed.
- Keep state transitions simple and explicit (planned → active → completed/abandoned).

## 7. Security, privacy, and limitations

No personal health information is uploaded. No trackers, telemetry, external analytics, or CDN dependency required at runtime. Data on a shared or unlocked device may be visible to other local device users. GitHub Pages website source and bundled default data are public even if one person intends to use the app. Backups must be treated as personal data; do not automatically upload them. Local browser storage is not equivalent to an encrypted cloud backup.

## 8. Quality assurance and acceptance tests

Write unit tests for PR single-set logic, total reps vs weighted volume, workout schedule/locale date logic, progression safety guard, backup Zod validation, and session state transitions. Component tests for set completion and resumed workout state. Playwright E2E flows for:

1. Open new deployment and view seeded plan.
2. Start Monday workout, log multiple sets, finish and view history.
3. Start a workout, refresh, and resume without lost or duplicate data.
4. Edit program targets; verify old completed sessions unchanged.
5. Register pain; verify no automated overload recommendation.
6. Export backup, erase in controlled test, import, recover matching data.
7. Record 2 + 2 + 1 Pull-ups and verify max consecutive PR does **not** become 5.
8. Navigate and refresh on project GitHub Pages subpath.
9. Verify touch controls/legible layout at 320px and 390px.
10. Verify offline cached PWA works after successful first load.

Definition of Done:

- `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` pass.
- GitHub Actions can deploy to GitHub Pages.
- Main workout flow works offline, on mobile, and after refresh.
- Backup/restore round trip preserves user data.
- No Dumbbell Row in seeded plans or recommendations.
- The application is visually clean and consistent, without placeholder navigation or fake interactive elements.

## 9. Implementation sequence

1. Bootstrap Vite, types, design tokens, routing, and bottom navigation.
2. Implement Dexie schema/seed/migrations and domain calculations.
3. Build Home, workout session, set logger, and rest timer.
4. Build history, PRs, progress charts, editable program.
5. Build settings, backup/restore, pain tracking.
6. Add PWA/offline behavior and GitHub Pages workflow.
7. Test mobile flows, persistence and edge cases; fix bugs.
8. Write concise README: local development, available commands, GitHub Pages setup, data ownership and backup steps.

## 10. Instructions to the coding agent

- Implement in the current repository; inspect it first to avoid destroying existing work.
- Prefer functional correctness and shippable core interactions over generating design-only screenshots.
- Do not invent a repository name or GitHub username; use configurable values.
- If something cannot be implemented due to missing credentials/permissions, leave transparent manual instructions without claiming deployment succeeded.
- At the end, report implemented features, commands/tests run, known limitations, and exact GitHub deployment setup steps.
