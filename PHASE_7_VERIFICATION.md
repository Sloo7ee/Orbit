# Phase 7 — Focus

Production Supabase has not been accessed or modified. Phase 8 remains out of scope.

## Delivered

- Free Focus stopwatch and Pomodoro, with start, pause, resume, finish and confirmed discard. Pomodoro defaults to 25/5 minutes and supports simple custom whole-minute durations. Breaks can be skipped; starting the next focus interval is explicit.
- Persisted session timestamps and actual focus intervals. Browser rendering reads timestamps rather than incrementing a counter. Navigation, refresh, reopened tabs, background throttling and sleep preserve the logical timer. No per-second database writes.
- Pomodoro caps focus credit at its planned boundary. A break follows that boundary; after the break the session waits for the next explicit focus start. Returning hours later does not invent additional study cycles.
- One active session per owner across semesters/tabs/devices, enforced by a partial unique database index. Transactional RPCs use ownership checks, revisions and retry receipts. Failed actions retain the last confirmed state and show an error; lost responses can be safely retried or refreshed.
- Optional course/task association before or during a session, applied to the whole session. A course-linked task determines the course. Focus completion never completes a task. Label snapshots preserve historical context when courses/tasks are renamed or deleted.
- Compact recent history with confirmed deletion. Archived history is read-only. An active session must be finished or discarded before its semester can be archived.
- Focused Today totals and session counts use completed intervals overlapping the current profile-local day, scoped to the viewed semester. Pauses, breaks and discarded sessions do not contribute. Intervals crossing midnight are clipped by actual overlap, including Asia/Riyadh boundaries.
- A compact Home summary and active-session header link preserve the calendar-first shell. Both themes, reduced motion, keyboard controls and narrow layouts are supported.
- Long stopwatch intervals (one hour or more) receive an elapsed-time review before pause/finish: keep the full interval, retain fewer minutes from its beginning, or close the review without saving. Changing association does not bypass this review.

## Verification

Verified October 4, 2026. All database/browser fixtures target local Supabase only.

- `npm run lint`: passed, zero warnings.
- `npm run typecheck`: passed.
- Unit tests: **30 passed**.
- Database integration tests: **37 passed**.
- Complete Phase 2–7 command `ORBIT_WEBKIT=1 PLAYWRIGHT_CHROME=1 npm test`: **67 Vitest tests and 54 browser scenarios passed**, with two workers and no retries (27 Chrome + 27 WebKit).
- `npx supabase db lint --local`: no schema errors. Local migration ledger contains 001–007. All three Focus tables have RLS enabled. Regenerating database types produced identical output.
- `npm run build`: passed after final changes.
- Visual inspection: Focus and compact Home integration in Light/Dark, plus a 390px layout. Accessibility and reduced-motion checks passed.

Coverage includes pause/resume and discard, custom Pomodoro boundaries and skip-break, suspended rendering, long background gaps, navigation/reload restoration, competing tabs and stale writes, lost-response recovery, confirmed-state retention after failed actions, associations, history persistence/deletion, Riyadh midnight overlap, semester isolation, archive/start races, and two-user RLS. Course/task deletion preserves both completed and active sessions. Association changes preserve the original stopwatch anchor so long intervals can still be reviewed/trimmed. Earlier phases retain their full regression coverage.

Verification corrected ambiguous test selectors and strengthened recovery/scoping: background reads stay scoped to the viewed semester, older snapshots cannot rewind the timer clock, and a recovered start response does not reuse a completed session ID. Browser tests use normal sidebar navigation after saves. Next.js emits some canceled-stream diagnostics during rapid test navigation; the final suite passes without retries or relaxed timeouts.

## Production migration — exact order

Prerequisite: migrations 001–006 are already applied to the existing Orbit production project.

1. `supabase/migrations/202610040007_focus.sql`

This is the only new Phase 7 migration. It adds Focus tables, ownership-protected functions, an active-session uniqueness constraint, and an archive guard. Existing academic records are preserved.

### Apply in the existing Supabase project

1. Save a current database backup/export using the method available for your project.
2. Open your **existing Orbit project → SQL Editor → New query**.
3. Enter `BEGIN;` on the first line, paste the **entire contents** of `supabase/migrations/202610040007_focus.sql`, then append `COMMIT;` on the last line.
4. Run the complete query once. Do not execute only a selected fragment, rerun migrations 001–006, or reset the database. If the transaction fails, resolve the reported error before proceeding; a failed transaction is not an applied migration.
5. Verify the new tables and Row Level Security:

   ```sql
   select relname, relrowsecurity
   from pg_class
   where relnamespace = 'public'::regnamespace
     and relname in ('focus_sessions', 'focus_intervals', 'focus_operations');
   ```

   All three rows must report `true`. Sessions and intervals allow owner-only authenticated reads. `focus_operations` intentionally has no client grants or policies. All ordinary writes go through `change_focus`. Do not disable RLS or add public write policies.
6. **No existing configuration changes are required:** keep environment variables, keys, Auth settings, recovery configuration and services unchanged. No Realtime enablement, scheduled jobs, extensions, SMTP changes or new secrets are needed.
7. Restart `npm run dev`. For production-mode preview, stop the old server, run `npm run build`, then `npm start`.
8. Smoke-test: start a stopwatch, navigate away/back, pause/resume, refresh, associate a task and finish. Confirm history persists after sign-out/in and the task remains incomplete. Try a 1-minute focus / 1-minute break Pomodoro, verify break time is excluded, skip a break and finish. Open another tab and confirm it resumes the same active session. Switch semesters and inspect archived history. Delete an accidental completed session and verify its time leaves Today totals.

If you later switch from SQL Editor to linked CLI migrations, reconcile the ledger first. Only after successfully applying the SQL and confirming the intended project is linked, the ledger-only command is:

```sh
npx supabase migration repair 202610040007 --status applied --linked
```

Do not use `db push` with unreconciled SQL Editor history. This task has not executed any production command.

## Rules and limitations

- Online confirmation is required for timer controls. During a connection failure the last confirmed timer continues logically; failed pauses are not silently queued. Unsaved configuration/association drafts are not an offline database.
- Stopwatch time includes time while away. Orbit does not infer whether studying actually occurred. The elapsed-time review handles long intervals; an accidentally saved session can be deleted.
- Pomodoro uses 1–180 whole focus minutes and 1–60 whole break minutes. It has no automatic next-focus start, long-break cycles, sounds or notifications. Durations are chosen before starting a session.
- The timer refreshes its display each second, reads saved state every 15 seconds while visible, and refreshes on window/tab focus. Other devices converge on that cadence; stale writes are rejected immediately by the database. Persisted milliseconds are authoritative; displayed seconds/minutes are shortened for readability.
- History displays the latest 20 completed sessions in the selected semester. Older records remain stored and contribute to applicable Today totals. There is no analytics or full-history pagination in this phase.
- Today counts only completed sessions with actual focus overlapping the local day. A session spanning midnight contributes only its overlapping focus time to each day; active study appears after completion.
- Course/task label snapshots describe the association when chosen. Later renaming/deletion does not rewrite completed history. Association changes apply to the whole active session, not separate parts of it.
- Safari-engine verification uses Playwright WebKit. Production migration application and cloud smoke testing remain manual.
