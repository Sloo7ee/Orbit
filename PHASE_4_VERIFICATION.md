# Phase 4: recurring course schedules

Phase 4 is implemented. Stop for user review before Phase 5. Production has not been modified.

## Delivered

- Multiple weekly blocks per course, with weekdays, times, optional location and inclusive effective dates defaulting to the semester.
- Recurring meetings in the shared Home/Calendar month, week and day views, plus Next Up, using course colors.
- Explicit single-occurrence, future and entire-series edit/delete scopes, including drag and resize. Single changes retain their original identity as sparse exceptions.
- Transactional future splits, revision conflict protection and replay-safe writes. Moved exceptions are included in their destination range without duplicate originals.
- Archived semesters remain read-only. Course deletion preserves recurring meetings, exceptions, and the course's last name/color.
- Bounded expansion in the stored schedule timezone; no pre-generated semester of event rows.

## Verification

Final local verification on October 4, 2026:

- `npm run lint`: passed, zero warnings.
- `npm run typecheck`: passed.
- `ORBIT_WEBKIT=1 PLAYWRIGHT_CHROME=1 npm test`: 62 tests passed — 17 unit, 17 database integration, 28 browser (14 Chrome, 14 WebKit).
- `npm run build`: passed.
- `npx supabase db lint --local`: no schema errors. Local migration ledger contains 001–004.

Coverage includes multiple weekly blocks, semester and timezone boundaries, moved-in exceptions, scoped edits/deletes and future splits with existing exceptions, drag/resize scope and cancellation, failed-save recovery, stale edits, persistence across authenticated sessions, course deletion, archive protection and two-user isolation. Phase 2 identity/recovery/semester tests and Phase 3 courses/calendar regressions pass. Both themes, accessibility, responsive navigation and reduced motion are covered. Visual review found and fixed short-event titles shrinking away; a browser regression assertion protects this.

All automated database/browser tests use isolated local Supabase accounts. They do not target production. WebKit coverage is Safari-engine testing, not a test of the installed Safari application.

## Apply to the existing production project

Prerequisite: the three Phase 2–3 migrations are already applied, as verified during your production smoke test. **Only one new migration is required**, in this order:

1. `supabase/migrations/202610030004_recurring_schedules.sql`

Use the existing Supabase project; do not create a new project or reset its database.

1. Save a current database backup/export using the backup method available for your project.
2. Open that project's **SQL Editor → New query**.
3. Enter `BEGIN;`, paste the **entire contents** of the migration above, then append `COMMIT;`. Run the complete query once. Do not run only a selected fragment. If it fails, resolve the reported error before retrying; do not proceed with a partial application.
4. Confirm the query succeeded. In Table Editor, confirm `course_schedules`, `schedule_exceptions` and `schedule_operations` exist with RLS enabled. `schedule_operations` deliberately has no client access policy: only the ownership-checked function manages its retry receipts. Do not add public policies or disable RLS.
5. Keep `.env.local`, publishable key, Auth settings, redirect URLs and recovery template unchanged. No additional credentials, services, extensions or configuration are required.
6. Restart `npm run dev`; or, for production-mode local preview, stop the running app and run `npm run build` followed by `npm start`.
7. Smoke-test with a course in an active semester: add two weekly blocks; inspect month/week/day; move one meeting; change this and future meetings; sign out/in and confirm persistence. Inspect an archived semester to confirm its history remains read-only.

Do not reapply migrations 001–003. If you later switch from SQL Editor to linked CLI migrations, reconcile the migration ledger first. After this SQL migration succeeds, its exact ledger-only command is `npx supabase migration repair 202610030004 --status applied --linked`. Use it only when linked to the intended project and only for an already-applied migration. Do not use `db push` with an unreconciled SQL Editor history.

## Scope behavior and limitations

- Weekly patterns only; arbitrary recurrence rules, holiday exclusions and external calendar sync are outside scope.
- Future scope is ordered by the original meeting date, even after a meeting is moved. Earlier original occurrences and their exceptions stay with the prior block.
- Future/entire-block edits explicitly ask to reset individual changes and cancellations in the affected original-date range. Exceptions are not automatically remapped. Entire series means the selected block; segments created by earlier splits are separate.
- Invalid local times during a DST gap are skipped with a notice; repeated local times use the earlier offset. Riyadh does not have DST transitions.
- Queries are bounded to 500 active blocks and 1,000 relevant exceptions; expansion is limited to 62 days and 2,000 meetings. Exceeding limits produces an error rather than silent truncation.
- Production application and cloud smoke testing remain manual. No Phase 5 work or deployment was performed.
