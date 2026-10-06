# Phase 6 — Grades

Production Supabase has not been accessed or changed. Phase 7 remains out of scope.

## Delivered

- Selected-semester Grades overview and per-course detail, with assessment creation, editing, confirmed deletion, scoring later and clearing a score.
- Weighted assessment items only. Current Grade normalizes over scored weight; Graded Coverage shows scored weight; Earned Course Points shows contributions toward the final 100 points. Ungraded items count only toward configured weight. Zero is a graded score.
- Decimal inputs support up to four places. Exact rational arithmetic accumulates contributions, with half-up rounding only at the two-decimal display boundary. Scores may have any positive possible value up to 1,000,000,000; extra credit is not supported.
- Database transactions serialize assessment mutations per course, enforce total weight no greater than 100%, validate references and numeric bounds, and check revisions. Request receipts make retries idempotent. RLS restricts reads to the owner; ordinary clients cannot write tables directly or read receipts.
- Optional date, time and notes. Separate assessment records produce diamond-labeled calendar markers in Home and Calendar. Date-only items remain date-only; timed items follow the profile timezone. Click a marker to edit; assessments do not use event drag/resize.
- Course and semester switching, archived read-only details, error/draft retention, and persistence across sessions. Courses with assessments cannot be deleted; archive the semester to retain history. No new Home dashboard cards.
- Both themes, shared keyboard/focus and reduced-motion behavior, responsive layouts. Existing Phase 2–5 workflows preserved.

## Verification

Verified October 4, 2026. Tests use isolated local Supabase accounts; they do not connect to production.

- Lint: passed with zero warnings.
- Typecheck: passed.
- Unit tests: **27 passed**.
- Database integration tests: **27 passed**, including ownership isolation, concurrent weight protection, stale revisions, receipts, numeric validation, archive protection, course deletion protection and session persistence.
- Complete Phase 2–6 regression command: `ORBIT_WEBKIT=1 PLAYWRIGHT_CHROME=1 npm test` — **54 Vitest tests and 42 browser scenarios passed**, with two workers and no retries (21 Chrome + 21 WebKit).
- Local database lint: no schema errors. Migration ledger contains 001–006, both new tables have RLS, and regenerating database types produced identical output.
- Production build: passed.
- Grades detail and assessment editor visually inspected in both themes; accessibility checks passed for both. Existing responsive/reduced-motion, authentication/recovery, semester, course/calendar, recurrence and task suites pass.

Verification fixes: stale course-detail URLs return to Grades overview when switching semesters; assessment help-text spacing uses the compact form layout; success notices use the shared message styling. Browser selectors were scoped to visible content. Tests now use sidebar navigation after saves, avoiding a race between full document navigation and pending workspace refreshes. Earlier parallel/serial attempts exposed navigation and timing failures; the final complete two-worker run passed without increasing timeouts or enabling retries. Next.js still logs canceled response streams during some rapid test navigation; final assertions pass.

## Production migration: exact order

Prerequisite: existing migrations 001–005 are already applied.

1. `supabase/migrations/202610040006_assessments.sql`

This is the only new Phase 6 migration.

### Apply to the existing project

1. Save a current database backup/export using the method available for your Supabase project.
2. Open your **existing Orbit Supabase project → SQL Editor → New query**.
3. Put `BEGIN;` on the first line. Paste the **entire contents** of `supabase/migrations/202610040006_assessments.sql`, then append `COMMIT;` on the last line.
4. Run the complete query once. Do not select and execute only a fragment. Do not rerun migrations 001–005, reset the database, or replace existing tables. If the transaction fails, resolve the error before proceeding; do not treat a failed transaction as applied.
5. Verify the new tables and RLS:

   ```sql
   select relname, relrowsecurity
   from pg_class
   where relnamespace = 'public'::regnamespace
     and relname in ('assessments', 'assessment_operations');
   ```

   Both rows must report `true`. `assessments` has an authenticated owner-only read policy. `assessment_operations` intentionally has no client grants or policies. Writes go through `change_assessment`; do not add public policies or disable RLS.
6. **Keep existing production configuration unchanged:** no environment variables, keys, Auth settings, recovery URLs/templates, services or extensions need changing.
7. Restart `npm run dev`. For production-mode local preview, stop the old server, run `npm run build`, then `npm start`.
8. Smoke-test Grades with your account: add a 20%-weight assessment scored 18/20 and a 10%-weight assessment scored 8/10. Expect **86.67% Current Grade, 30.00% Graded Coverage, 26.00 Earned Course Points**. Add an ungraded item and confirm these values stay unchanged. Edit/clear a score, change/remove a due time, check Calendar, sign out/in, switch semesters and inspect archived history.

If you later use linked CLI migrations after applying SQL manually, reconcile the migration ledger first. Only after successful SQL application, and after confirming the intended project is linked, the ledger-only command is:

```sh
npx supabase migration repair 202610040006 --status applied --linked
```

Do not use `db push` with unreconciled SQL Editor history. No production command has been executed by this task.

## Limitations

- Four decimal places for entered weights/scores; calculations display two. Excess precision is rejected rather than silently rounded.
- Views load up to 1,000 assessments per semester/range, then show an explicit error; pagination is not included.
- Online-first. Failed saves keep the open draft and leave saved totals unchanged; a full reload discards unsaved entries. No optimistic grade totals are shown.
- Due dates may fall outside semester dates. Deadline wall times follow the current profile timezone. Invalid DST-gap times are rejected on save; an existing time made invalid by changing timezone shifts forward for display, preserving its stored wall time. Asia/Riyadh has no DST.
- A course with assessments is protected from deletion. Archived semesters remain read-only until explicitly restored through the existing workflow.
- Assessment completion tracking for the later weekly summary is not inferred from scores and is not implemented here.
- Safari-engine checks use Playwright WebKit. Production application and cloud smoke testing remain manual.
