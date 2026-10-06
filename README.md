# Orbit

A private academic workspace for daily use on a Mac. Phases 1–8.5 are approved. **Phase 8.6: Calendar Cards and Action Feedback** is ready for review. Stop before Phase 9. See [PHASE_8_6_VERIFICATION.md](PHASE_8_6_VERIFICATION.md).

## Run and preview

If cloud Supabase is already connected through Phase 8, no new migration or configuration is needed for this refresh. Restart `npm run dev` to preview. Keep `.env.local` unchanged. The following local setup is only for a separate local workspace:

Use Node.js 24 (`.nvmrc`), npm, and Docker Desktop for local Supabase:

```sh
npm ci
npm run db:start
npm run local:setup
npm run dev
```

Open http://127.0.0.1:3000. Local preview credentials are in `.orbit/local-account.txt` (ignored by Git). Complete the short profile setup and create your own semester. No fabricated academic records are seeded.

For cloud setup, follow **[SUPABASE_SETUP.md](SUPABASE_SETUP.md)**. Without configuration, Orbit shows a connection setup screen. Neither mode uses localStorage as a database. The only localStorage preference is appearance.

## Implemented

- Email/password sign-in, sign-out, password recovery and password update through Supabase Auth.
- Cookie-based SSR sessions, verified users, protected routes/actions, and private uncached responses.
- Profile onboarding and editing: display name, timezone, and first-name greeting.
- Semester creation, persistent selection, compact progress, archive/history and restore.
- Database migrations, constraints, RLS, owner-safe selection, revision conflict detection, transactional writes and retry-safe creation.
- Loading, validation, error, retry, and success states; drafts survive a failed request. Active views refresh on focus/every 30 seconds unless a form is dirty or a dialog is open.
- Preserved desktop shell, responsive navigation, reusable UI, accessible interactions, and subtle motion. Dark is the default for a fresh browser; existing appearance preferences are preserved. Light surfaces have slightly stronger separation.

- Semester-scoped course creation, editing and deletion (code, name, optional instructor, color).
- Shared real calendar on Home and Calendar: month/week/day, standalone timed events, course links, drag/drop and resizing, mini calendar navigation and Next Up.
- Archived academic history is read-only. Deleting a course preserves its events and their saved colors.

- Multiple weekly course schedules, sparse occurrence exceptions, scoped edits/deletes, future splits, and scoped drag/resize. Course deletion also preserves recurring history.

- Semester-scoped tasks with optional deadlines/course links, priorities, completion history, course/status filters, a compact Home list and distinct calendar due markers. Failed completion actions roll back; stale drafts remain visible.
- Compact violet weekday pills preserve the existing recurring schedule behavior.

- Per-course weighted assessments, decimal scores, separate current grade/coverage/earned points, and distinct calendar deadlines. Courses with assessments are protected from deletion to preserve history.

- Timestamp-based stopwatch/Pomodoro, persisted active state, focus history and profile-timezone Today totals. Home stays calendar-first.

- Restricted rich-text Notes with optional course association, title search/filter, debounced autosave, retained drafts, navigation safety and stale-edit protection.

- Orbit Day/Night themes, eight paired course colors with legacy compatibility, compact event editors, and refreshed shared controls.
- Home summaries, combined Next Up, current-week completed Focus time, and simple task progress. Last Week Summary remains outside the current phase.

## Verification

Start the local database and apply migrations with `npx supabase migration up --local`. Keep your production `.env.local` unchanged. Browser tests build and run a separate app on port 3001 in `.next-test`, injecting only local Supabase settings into that process. Tests provision isolated local users and remove them afterward. They never target a cloud project.

```sh
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npx playwright install chromium
npm run test:e2e
npm run build
```

On this Mac, installed Google Chrome can be used without a Chromium download:

```sh
PLAYWRIGHT_CHROME=1 npm run test:e2e
```

`npm test` runs unit, integration, and browser tests together. For optional Safari-engine coverage, install WebKit with `npx playwright install webkit`, then run `ORBIT_WEBKIT=1 npm run test:e2e`. This is not the same as testing installed Safari. Browser traces are disabled because auth flows contain passwords and session tokens.

- Unit tests: inclusive dates, leap days, DST, timezone midnight, validation, first-name greetings.
- Integration tests against local Supabase: authentication, independent sessions, RLS reads/writes, forged ownership, cross-owner references, invalid data, conflicts, retry safety, archive/restore, disabled public registration.
- Browser tests: sign-in errors and protection, onboarding, persistence, switching/history, recovery email links, failed-save retry, themes, accessibility, responsive/reduced-motion behavior.

For a production-mode local preview: `npm run build && npm start`. Stop the existing development server first. No deployment has been performed.

## Structure

- `src/app/(auth)/`: sign-in, recovery, password reset, onboarding.
- `src/app/(workspace)/`: protected shell, Home and feature destinations.
- `src/lib/actions/`: authenticated/validated server mutations.
- `src/lib/domain/`: pure validation and date/progress calculations.
- `src/lib/supabase/`: server client, configuration, database types.
- `src/components/`: shared UI, shell, forms, semesters, and remaining static previews.
- `supabase/migrations/`: database schema and ownership policies.
- `supabase/templates/`: recovery email template.
- `tests/`: unit, local integration, and browser tests.

`npm run db:types` regenerates types from the migrated local database. `npm run db:stop` stops local Supabase without discarding its data. Keep `.env.local` and `.orbit/` private.

The full dependency audit currently reports an advisory chain in development-only Next.js ESLint dependencies (`braces`). A forced downgrade of Next.js lint tooling is not applied. Recheck supported upstream fixes before release.

## Phase 6: Grades

Grades now provides per-course weighted assessments, optional scores and deadlines, exact decimal calculations, and distinct calendar due markers. Apply migration 006 before using this version against an existing cloud project. See [PHASE_6_VERIFICATION.md](PHASE_6_VERIFICATION.md) for the upgrade and verification report. Production application remains manual.

## Phase 7: Focus

Apply migration 007 after existing migrations 001–006 before running this version against the cloud project. See [PHASE_7_VERIFICATION.md](PHASE_7_VERIFICATION.md) for timer semantics, verification and manual production steps. No existing production configuration changes are required.

## Phase 8: Notes

Apply migration 008 after existing migrations 001–007. See [PHASE_8_VERIFICATION.md](PHASE_8_VERIFICATION.md) for verification, autosave semantics, limits and exact production instructions. No existing production configuration changes are required.
