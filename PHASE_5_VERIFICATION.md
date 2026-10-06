# Phase 5: Tasks / To-do

Phase 4 is approved with production smoke testing passed. Phase 5 adds tasks only, plus the approved weekday-selector styling. Stop before Phase 6. Production Supabase and credentials have not been modified.

## Delivered

- Compact horizontal Sun–Sat pills in the weekly schedule modal, violet selection, keyboard focus and wrapping on narrow screens. Native checkbox semantics and all recurrence calculations remain intact.
- Separate `tasks` records with title, optional description, optional due date/time/course, low/medium/high priority, creation/completion timestamps, semester/owner and revision. Completion status derives from the completion timestamp, preventing inconsistent status/time combinations.
- To-do sections: Overdue, Today, Upcoming, No due date and Completed; course/status filters; task creation, editing, confirmed deletion, completion and reopening.
- A compact Home list of up to three incomplete tasks, ordered by attention needed, deadline and priority. Archived Home shows a history link instead of active task controls.
- Distinct dashed calendar due markers with a task label/checkmark. Date-only tasks use the Due row; timed tasks appear at their due time. Editing/completing updates the representation; clearing the due date removes it. Tasks stay separate from calendar events and do not support calendar drag/resize; click to edit their deadline.
- Optimistic completion with rollback on failure. Editor drafts survive failed requests and stale saves. Background refresh follows the existing 30-second/focus policy.
- Ownership-protected transactional RPCs, RLS and composite references; immutable ownership; revision checks; private request receipts prevent repeated writes on retries. Completion edits preserve the original completion timestamp, reopening clears it, and later completion records a new one.
- Archived tasks are read-only and visible in history. Course deletion detaches task links without deleting tasks or completion history.

## Local verification

Final verification completed October 4, 2026:

- `npm run lint`: passed, zero warnings.
- `npm run typecheck`: passed.
- `npm run test:unit`: 23 passed.
- `npm run test:integration`: 23 passed against local Supabase.
- `npx supabase db lint --local`: no schema errors. Local migration ledger contains 001–005; both new tables have RLS enabled.
- Chrome/WebKit: all 34 browser scenarios verified (17 per browser), including successful affected-test reruns after fixes. The full browser rerun passed 33 scenarios and exposed one navigation-selector race with hidden streamed markup. After scoping that assertion to the main heading, all four affected appearance/navigation cases passed across both browsers.
- `npm run build`: passed after the fixes.

Final verification fixed a light-mode task-marker text contrast issue and the navigation test selector. No features were added. Visual inspection covered both task/calendar themes and the compact weekday selector. Recurrence tests verify horizontal pills, narrow-screen wrapping, schedule creation, exceptions, future splits, drag/resize, stale writes and persistence; recurring behavior remains unchanged.

Task coverage includes CRUD, completion/reopening, optional due dates/times/course links, priorities and course/status filters, Home and calendar representations, semester switching, archived history, course deletion, persistence, stale writes, optimistic rollback and two-user RLS isolation. Phase 2 identity/recovery and Phase 3 calendar/course regressions also pass. All database/browser tests use isolated local Supabase users and leave production unchanged.

## Production upgrade: exact order

Prerequisite: migrations 001–004 are already applied to the existing production project.

1. `supabase/migrations/202610040005_tasks.sql`

There are no other new migrations for Phase 5.

### Apply through SQL Editor

1. Save a current database backup/export using the backup method available for your Supabase project.
2. Open the **existing Orbit project → SQL Editor → New query**.
3. Enter `BEGIN;`, paste the entire contents of `202610040005_tasks.sql`, then append `COMMIT;`. Run the complete query once. Do not execute a selected fragment or rerun migrations 001–004.
4. Confirm success. Verify `tasks` and `task_operations` exist with RLS enabled. `tasks` permits owner-scoped reads; writes go through the authenticated function. `task_operations` deliberately has no client policy or client grants. Do not add public policies or disable RLS.
5. Leave `.env.local`, keys, Auth providers, redirect URLs and recovery configuration unchanged. No new secrets, services or extensions are required.
6. Restart `npm run dev`, or stop the existing server and run `npm run build` followed by `npm start` for production-mode local preview.
7. Smoke-test: create an unassigned/undated task and a course-linked dated task; complete/reopen; edit a deadline from Calendar; sign out/in; confirm persistence. Switch semesters and inspect archived task history. Confirm weekly schedule pills select the expected days.

If the SQL transaction fails, do not proceed as though it succeeded. Resolve the error and rerun the complete transaction. Never reset the production database.

If you later use linked CLI migrations after SQL Editor application, reconcile the existing ledger first. Only after successful application, the ledger-only command for this migration is `npx supabase migration repair 202610040005 --status applied --linked`. Confirm the intended project is linked. Do not use `db push` with unreconciled SQL Editor history.

## Rules and limitations

- Due dates/times follow the current profile timezone. Date-only deadlines become overdue at the next local midnight; timed deadlines become overdue after the due time. There is no due time without a date. Due dates may fall outside semester dates; ownership still stays with the selected semester.
- Invalid DST-gap times are rejected when saving. Repeated times use the earlier offset. If a profile timezone change makes an existing due time invalid, it shifts forward by the DST gap for display/overdue calculation; the saved wall-clock value is unchanged. Asia/Riyadh has no DST transitions.
- Views load up to 1,000 tasks per semester; exceeding that produces an explicit error rather than silently hiding data. Pagination is not included in this personal-app phase.
- Online-first; unsaved editor drafts are not an offline database and may be lost on a full reload. No reminders, recurring tasks, tags, subtasks, projects, attachments or notifications.
- Safari-engine verification uses Playwright WebKit, not the installed Safari app. Production migration application and cloud smoke testing remain manual.

## Post-smoke-test fix: task due-time editing

The task editor now uses an explicit optional 24-hour `HH:mm` text field, with a Remove due time button. The field becomes available after choosing a date. Date/time drafts are controlled together; clearing the date clears the time, and reselecting a date does not restore an old time automatically. The existing server validation, timezone conversion, RPC, revision checks and RLS remain unchanged. No new production migration or configuration is required; migration 005 already supports nullable due times.

Verification: lint, typecheck and production build passed; 23 unit and 23 database integration tests passed. All eight task browser tests passed across Chrome and WebKit, including normal keyboard entry on creation, time changes after creation, sign-out/sign-in persistence, explicit and keyboard clearing, midnight, date-only calendar representation, Riyadh timed-calendar placement, stale edits and rollback. Both editor themes were visually reviewed. Production Supabase was not accessed or modified.
