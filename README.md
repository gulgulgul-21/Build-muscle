# Form — Personal Calisthenics

A Thai-first, single-user calisthenics PWA. React + strict TypeScript + Vite, Tailwind, Lucide, HashRouter, Dexie/IndexedDB, Zod, Recharts and date-fns. No accounts, network database, analytics, runtime secrets, or paid services. Fonts use the device's font stack; no external font request.

The interface supports Thai and English. Use the language selector in the header or Settings; Thai is the default. Your choice is stored in IndexedDB, included in backups, and available offline. UI labels, dates, exercise instructions, safety guidance, confirmations and charts follow the selected language. Exercise names and your own notes/profile entries stay as entered. Database version 2 adds the preference without deleting version 1 data; older backups default to Thai when the preference is missing.

## Run locally

Install Node.js 24 LTS (includes npm), then:

```sh
npm ci
npm run dev
```

Open the printed localhost URL. For production caching/PWA testing:

```sh
npm run build
npm run preview
```

PWA service workers require HTTPS or localhost. Development mode intentionally does not register one. Install from Chrome's menu → Install app / Add to Home screen. Wait for the app's “พร้อมใช้งานออฟไลน์บนอุปกรณ์นี้” notice before relying on offline use. Updates are offered in a banner; finish your workout before applying one.

## Commands

| Command                           | Purpose                                             |
| --------------------------------- | --------------------------------------------------- |
| `npm run lint`                    | ESLint and React hook checks                        |
| `npm run typecheck`               | Strict TypeScript check                             |
| `npm run test`                    | Vitest domain/repository/component tests            |
| `npm run build`                   | Typecheck, production bundle, manifest and precache |
| `npx playwright install chromium` | One-time browser installation                       |
| `npm run test:e2e`                | Chromium flows against the built preview            |
| `npm run format`                  | Prettier source formatting                          |

Build before E2E tests. On Linux CI, use `npx playwright install --with-deps chromium`. Test output and browser traces are ignored by Git. Tests use isolated browser contexts and temporary fake IndexedDB; they do not change your everyday browser's logs.

## Deploy to your GitHub Pages

No repository or account name is hardcoded, and no GitHub repository was provided with this workspace. Deployment is prepared, not published.

1. Create your own empty GitHub repository, then initialize and push this directory to its `main` branch. Replace the placeholder URL below with your real repository URL:

   This workspace is initialized on `main`. If Git asks for an author identity on another machine, configure your repository-local identity before committing (do not use the placeholder values literally):

   ```sh
   git config user.name "YOUR_NAME"
   git config user.email "YOUR_EMAIL"
   ```

   ```sh
   git init -b main
   git add .
   git commit -m "Build personal calisthenics PWA"
   git remote add origin <YOUR_GITHUB_REPOSITORY_URL>
   git push -u origin main
   ```

2. In GitHub, open the repository's **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. Open **Actions → Verify and deploy to GitHub Pages**. Run it manually if the initial push happened before enabling Pages. Subsequent pushes to `main` run automatically.
4. The workflow runs lockfile installation, lint, typecheck, unit/component tests, production build, Chromium E2E tests, official Pages artifact upload, and official Pages deployment. The resulting URL appears in the `github-pages` environment and workflow output. Pull requests run checks without deployment.

The workflow derives `/<repository-name>/` for project Pages and `/` for repositories ending in `.github.io`. For a custom domain or another path, set **Settings → Secrets and variables → Actions → Variables → `VITE_BASE_PATH`** to `/` or `/your-path/` (always with leading/trailing slash). Vite assets, service-worker scope, start URL and navigation fallback all use this value. HashRouter keeps routes such as `/your-path/#/workout/active` refreshable on static hosting. No client GitHub token is needed; Actions uses its scoped built-in permissions.

To verify a project subpath locally in PowerShell:

```powershell
$env:VITE_BASE_PATH='/pages-test/'
npm run build
npm run test:e2e
Remove-Item Env:VITE_BASE_PATH
```

Use a fresh preview process after changing base paths. Browsers may retain the previous origin's service worker; use a separate test browser context or unregister it in developer tools when changing development paths.

## What works

- Four navigation tabs: Home, Workout, Progress, Settings; mobile layouts down to 320px and centered desktop content.
- Today/recovery view, one-tap scheduled workout, weekly scheduled completion, single-set personal bests with baseline provenance.
- Editable A/B/C four-week foundation plan; order, exercises, sets, target ranges, rest, start date and weekday schedule. The four-week guidance is suggested, never automatic target escalation. The schedule can continue after week four until you edit it.
- Reps, holds, per-side entries, external load, optional RIR, immediate set persistence, saved-set corrections, skip/swap, notes, explicit finish/abandon and history summaries.
- Resume one active session across navigation, refresh and browser restarts, including absolute rest end timestamps. Starting another plan resumes the existing active session until you finish or explicitly abandon it.
- Pain location/severity/notes with conservative alternatives. Active-session elbow pain blocks new dips and negative pull-ups. Pain suppresses progression encouragement. This is a conservative session-level guard, not diagnosis or a recovery model.
- Exercise instructions, equipment requirements and alternatives; excluded exercises are filtered from new session targets, add/swap options. No Dumbbell Row or unsupported inverted-row setup is seeded.
- Max-per-set trends, actual weekly completion counts, source-labelled records, manual full-set tests, editable baselines, bodyweight and optional waist measurements.
- Validated JSON backup, preview and confirmed transactional replace/merge; CSV set history; double-confirmed reset.
- Installable app shell and local assets cached by vite-plugin-pwa. Optional vibration gracefully degrades; there are no push reminders or guaranteed background notifications.

## Storage, architecture and metrics

`src/domain` contains schemas and pure metric/schedule/state functions. `src/db` owns schema version 2 (backup format version 1), indexes, once-only seed and transactional repository operations. `src/app` provides routing and a reactive Dexie data context. Feature screens use repository functions rather than database internals. `src/components` contains small shared controls. Progress charts load as a separate chunk; all app chunks are precached for offline navigation. No additional global state library or shadcn wrapper is needed for these native controls.

Program days embed ordered exercise prescriptions rather than needing a separate program-exercises join table. Session snapshots copy those prescriptions at start. Later plan edits never rewrite old or active snapshots. UUID primary keys, explicit timestamps and a unique session/exercise/ordinal index protect set identity. IndexedDB transactions serialize starts, keep set/record/timer writes together, and make import all-or-nothing. Future migrations must be added as new Dexie versions without clearing existing stores.

Repetition PR = the highest **single uninterrupted set**, including valid manually recorded tests. Logging `2 + 2 + 1` Pull-ups yields a logged maximum of `2`, never `5`; the seeded manual baseline of `3` remains the overall best until beaten or edited. Saved-set corrections also update the source record. Bodyweight totals are repetitions, per-side work counts both sides for aggregate totals, and holds are seconds. External weighted work is `reps × total external kg`, labelled `kg·reps`, not estimated bodyweight tonnage. Enter the combined dumbbell load when using two dumbbells.

Calendar dates use local device dates, not UTC slicing. Weekly dashboard completion counts distinct scheduled day/date matches, including make-up sessions assigned to the missed date. Uncompleted past days stay labelled; a workout on a different assigned date does not silently count toward a missed slot. The weekly bar chart counts actual completed sessions grouped by assigned dates. Charts never fabricate samples.

## Backup and moving devices

In Settings, select **สำรอง JSON** and keep the file somewhere safe. On the destination browser/device, choose that file, review counts, choose **replace** or **merge**, then confirm. Replace restores the entire dataset. Merge uses IDs and the newer `updatedAt` for conflicts; it is intended for backups descended from the same initial dataset. Unrelated seeded plans or conflicting active sessions are rejected atomically; use replace to migrate to a newly seeded device. CSV is a readable history export, not a restore format.

Backups include schema/app versions, export time, all user-owned tables and active session state. Zod validates every table before import; additional graph checks reject missing references, duplicate keys, malformed state and conflicting plans. Unsupported future versions are rejected. Keep an independent backup before replacing data.

Normal GitHub Pages URLs and source/default data are public. Your logged data stays in the current browser's IndexedDB and is never committed or uploaded. Browser storage can be cleared, devices do not synchronize, private browsing may discard storage, and shared-device users may see your data. Backups contain personal data and are unencrypted; handle them accordingly. Offline readiness does not provide protection against browser storage deletion.

## Verification limits

Automated Playwright coverage uses Chromium with Android-sized viewports, including 320px/390px, and the production service worker. Physical Android install prompts, OS process eviction, optional vibration and other browser engines need device checks. GitHub-hosted deployment itself requires your repository setup above. Phase 2 protein tracking, advanced progression automation and skill roadmap are intentionally omitted from this MVP.
