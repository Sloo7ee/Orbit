# Phase 3: Courses + Basic Calendar

## Implemented

- Courses belong to the selected semester and authenticated owner: code, name, optional instructor, color; create, edit and confirmed delete.
- Home and Calendar share a real FullCalendar Standard calendar styled with Orbit's existing tokens. Week is the default; month/day views, Today, previous/next period, mini calendar navigation and Next Up use real data.
- One-time timed event creation, editing, confirmed deletion, optional course link and color. Choosing a course defaults the event color; saved event colors remain independent of later course color changes.
- Dragging and time resizing persist; failed writes revert the gesture. The editor supplies the keyboard/form alternative. Start/end support overnight events and use the profile timezone.
- Loading/error/retry/success states, revision conflict detection and preserved drafts. Calendar reads refresh on focus/every 30 seconds while idle, with no refresh during a gesture or open editor.
- Archived semesters remain readable and reject academic writes in the database until restored. Deleting a course detaches its events and preserves their colors; it never deletes events.
- Additive migrations, generated types, owner RLS for reads, and tightly scoped authenticated mutation functions. Functions check owner and semester explicitly, enforce revisions and use database constraints for linked courses. Parent semester locks protect against concurrent archiving. No service-role credential is used by the application.

No recurrence, grades, tasks, notes, timers, weekly statistics or AI were added. No deployment or production database writes were performed. Existing production environment settings are unchanged.

## Verification

Verification uses local Supabase only. Browser tests build a separate production-mode app in `.next-test` on port 3001 with local settings supplied to that process. They do not modify `.env.local`, use the running production-connected preview, or create cloud test accounts. `ORBIT_TEST_DEV=1` optionally uses the development server instead.

Commands:

```sh
npx supabase migration up --local
npx supabase db lint --local
npm run lint
npm run typecheck
ORBIT_WEBKIT=1 PLAYWRIGHT_CHROME=1 npm test
npm run build
```

The suite covers course/event CRUD and fresh-session persistence; month/week/day; real pointer dragging/resizing and aborted-request rollback; course color defaults and rendering; stale course/event drafts; semester isolation; archived read-only history; two-user database/RPC isolation; forbidden raw writes; invalid intervals/course references; create retries; safe course deletion; administrative account cleanup; and all Phase 2 authentication/profile/semester/recovery regressions. Dark/light desktop screenshots and automated accessibility checks cover the calendar, with a small-screen overflow check.

Final verified results (October 3, 2026):

| Check | Result |
| --- | --- |
| Local migrations | 001, 002 and 003 applied; original Phase 2 data preserved |
| Supabase schema lint | No schema errors |
| ESLint | Passed, zero warnings |
| TypeScript | Passed |
| Unit tests | 8 passed |
| Real database integration tests | 11 passed |
| Chrome browser tests | 11 passed |
| WebKit 26.6 browser tests | 11 passed |
| Production build | Passed; authenticated pages dynamically rendered |

**41 tests passed, zero failures or skipped tests.** Both browser projects tested the production build against local Supabase. Browser failures found during development were fixed and the complete suite was rerun successfully. The suite produces occasional expected request-abort/prefetch messages during forced network failures or browser teardown; no test failures remain.

Notable fixes from verification: initial calendar mount timing; keeping saved revisions current between consecutive gestures; avoiding event refetch during gestures; administrative account-deletion cascade; event-text contrast for arbitrary colors; and rendering linked course codes.

## Production upgrade: apply these two migrations manually

Your existing identity/semester migration and production connection are already working. **Do not rerun `202610030001_identity_semesters.sql`, reset the database, or recreate Term 261.**

1. Open your existing Orbit project in Supabase Dashboard. Confirm this is the project used by your current `.env.local`.
2. Open **SQL Editor → New query**. Put `BEGIN;` at the top, paste the complete contents of `supabase/migrations/202610030002_courses_events.sql`, then put `COMMIT;` at the bottom. Run once and confirm success. This adds the two academic tables, their indexes/constraints/RLS and mutation functions.
3. Open another query. Wrap the complete contents of `supabase/migrations/202610030003_academic_lifecycle.sql` in `BEGIN;` / `COMMIT;` and run once. This preserves Supabase's administrative account-deletion cascade while maintaining archived-semester protection.
4. Confirm **courses** and **calendar_events** appear in Table Editor with RLS enabled. Do not add public policies or grant direct client writes. You can verify RLS with:

   ```sql
   select tablename, rowsecurity
   from pg_tables
   where schemaname = 'public'
     and tablename in ('courses', 'calendar_events');
   ```

   Both rows must show `rowsecurity = true`.
5. Keep the existing environment variables, email provider, user account and Auth URL settings. No new configuration, keys, SMTP changes or services are needed. The updated local recovery template supports the test server; your working production recovery template can remain unchanged.
6. Restart Orbit: `npm run dev`, or `npm run build` then `npm start` for a production-mode local preview. Open `http://127.0.0.1:3000`.
7. Sign in, select Term 261, add a course and linked event, refresh, then sign out/in to confirm the cloud records persist. Local verification does not substitute for this production smoke check.

If you use CLI migration management later, first record SQL Editor migrations as applied only after verifying their success. For an already linked project, the ledger commands are:

```sh
npx supabase migration repair 202610030002 --status applied --linked
npx supabase migration repair 202610030003 --status applied --linked
```

The original migration must likewise already be recorded before `db push` (see SUPABASE_SETUP.md). Do not run `db push` against an unreconciled migration ledger, or it will attempt to recreate existing tables.

## Limits

- Timed, one-time events only. No all-day events or recurrence in Phase 3.
- Calendar requests cover at most 62 days. A range reaching 1,000 events shows an explicit error requiring a narrower view rather than silently omitting records.
- Color is copied when selecting a course; later course color edits do not recolor already saved events.
- Nonexistent DST wall times are rejected; repeated wall times use the earlier offset. One-time events persist absolute instants.
- WebKit coverage is Safari-engine coverage, not an automated run of the installed Safari application.
- Cloud migrations and the post-migration cloud smoke check remain manual. No Phase 4 work has started.
