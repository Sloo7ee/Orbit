# Phase 8 — Notes

Production has not been accessed or modified. Stop for review before Phase 9.

## Delivered

- Semester-scoped note library and editor, with title search, optional course filter, recent-first ordering, creation and confirmed deletion. Home remains unchanged.
- Restricted Tiptap editor: paragraphs, headings 1–3, bold, italic, underline, bullet/numbered lists, blockquotes, inline code, safe links and undo/redo. No images, attachments, tables, embeds, checklists, Markdown mode or collaboration.
- Autosave waits 700 ms after typing stops. Saves are serialized and revisions advance only after confirmation. Typing during an in-flight request is saved next. A lost response retries the identical operation receipt before newer edits.
- Visible save status, retry and retained drafts on failure. Stale updates never overwrite another device. Reloading the saved copy requires explicit confirmation before discarding a draft.
- Note switching, normal app links and semester switching flush pending saves. Layout-owned drafts survive browser back/forward; a failure remains visible with a return-to-draft action. Sign-out waits for the draft to save. Refresh/closing the tab prompts only while edits are unconfirmed.
- Notes retain their content when courses are deleted. Archived notes are read-only. New remote revisions offer an explicit load-latest action; remote deletions leave the last opened content available for reference without resurrecting the deleted note.
- Database constraints validate the restricted document tree, safe link protocols and document size. Owner-only RLS reads and authenticated transactional RPC writes preserve ownership, semester compatibility, archive rules, revisions and idempotent retries.
- Dark/Light themes, reduced motion, labeled keyboard-accessible formatting controls, comfortable writing width and responsive stacked layout.

## Verification

Verified October 5, 2026. Local fixtures use only the CLI Supabase project and synthetic accounts.

- `npm run lint`: passed, zero warnings.
- `npm run typecheck`: passed.
- Unit tests: **34 passed**.
- Database integration tests: **41 passed**.
- Complete `ORBIT_WEBKIT=1 PLAYWRIGHT_CHROME=1 npm test` run: **75 Vitest tests and 62 browser scenarios passed** (31 Chrome + 31 WebKit), with two workers and no retries. The browser portion completed in 3.1 minutes.
- Final Notes recheck after completing the remotely deleted-note read-only state: **8 passed** (4 per browser), including the explicit read-only editor assertion.
- Lint, typecheck, `npx supabase db lint --local` and `npm run build` were then rerun successfully against the final code.
- Local migration ledger contains 001–008; both Notes tables have RLS enabled. Regenerated database types matched the checked-in file contents.
- Light/Dark desktop and narrow layouts were visually inspected; automated accessibility, keyboard interactions and reduced-motion checks passed.

Coverage includes all requested formatting (including numbered-list save/reload), course association changes/removal, CRUD, debounce, edits during in-flight saves, retry receipts, failed-navigation preservation, browser back, guarded sign-out, stale conflicts, title search/filter/sort, semester switching, archive history, course deletion, remote deletion and two-user isolation. Existing Phase 2–7 tests remain in the full regression run. Next.js emitted occasional canceled-stream diagnostics during rapid test navigation; the final assertions passed without retries or relaxed timeouts.

### Investigation of the six browser failures

| Failures | Classification | Resolution |
| --- | --- | --- |
| Chrome Light and Dark navigation/accessibility; WebKit Light and Dark navigation/accessibility (4) | Real Phase 8 empty-state regression | Notes omitted its page heading when no semester was selected. The Notes heading now remains present above the semester prompt. Existing tests were kept unchanged. |
| Chrome moved-recurring-meeting workflow (1) | Transient test timeout | The interrupted run recorded roughly nine minutes for simultaneous recurrence tests; the unchanged targeted rerun passed in 2.8 seconds. No recurrence code or assertion was changed. |
| WebKit Grades CRUD/history workflow (1) | Transient test timeout, not reproduced | The unchanged targeted rerun passed in 8.5 seconds. No Grades code, assertion or timeout was changed. |

All six targeted scenarios subsequently passed together. The clean full run prevents idle Mac sleep for the lifetime of the test command with `caffeinate -i`; it does not change system settings. There were no outdated-expectation failures.

Additional verification fixed Tiptap's null-prototype attribute serialization at the Server Action boundary and accepted its safe default numbered-list attribute in the strict validators. Browser tests now wait for a numbered list to save and reload it. Deleted remote notes retain a read-only reference rather than an editable cached copy. A Focus integration fixture now ages timestamps against the database clock returned by the existing snapshot RPC; its original timing assertions remain unchanged.

## Required production migration — exact order

Prerequisite: production migrations 001–007 are already applied and approved.

1. `supabase/migrations/202610050008_notes.sql`

This is the only new migration. It adds `notes`, private `note_operations` receipts, document validation and `change_note`. Existing academic records and existing RLS policies are preserved.

### Apply to the existing production Supabase project

1. Save a current database backup/export using the method available for your project.
2. Open your existing **Orbit Supabase project → SQL Editor → New query**. Confirm the project is the one already connected to Orbit.
3. Type `BEGIN;`, paste the **entire contents** of `supabase/migrations/202610050008_notes.sql`, then append `COMMIT;`.
4. Run the complete query once. Do not run a selected fragment, reset the database, or rerun migrations 001–007. A failed transaction is not an applied migration; resolve its error before proceeding.
5. Verify the tables and RLS:

   ```sql
   select relname, relrowsecurity
   from pg_class
   where relnamespace = 'public'::regnamespace
     and relname in ('notes', 'note_operations');
   ```

   Both rows must report `true`. Notes permit owner-only authenticated reads. `note_operations` deliberately has no client access policies/grants. Do not disable RLS or add direct client write grants.
6. **No existing production configuration changes are required.** Keep `.env.local`, Supabase URL/keys, Auth/recovery settings and service settings unchanged. No Realtime, cron, storage bucket, extension, SMTP or new secret is needed.
7. In the Orbit directory, run `npm ci` to install the locked Tiptap dependencies. Restart `npm run dev`; for production-mode preview, stop the old process, run `npm run build`, then `npm start`.
8. Smoke-test: create a note with and without a course; format text and add a link; wait for Saved; switch notes/semesters; refresh and sign out/in. Confirm content persists, course removal preserves it, and archived notes are read-only. Open the same note in two tabs and confirm a stale save retains its local draft instead of overwriting the newer note.

SQL Editor does not maintain the CLI migration ledger. If you later use linked CLI migrations, reconcile successfully applied SQL migrations first. Only after verifying this SQL was successfully applied and the correct project is linked, the ledger-only command for this phase is:

```sh
npx supabase migration repair 202610050008 --status applied --linked
```

Do not run `db push` against unreconciled SQL Editor history. No production command was executed for this task.

## Limits

- Requires an online connection to confirm saves. Unsaved drafts live in the open app, not an offline database; closing despite the browser warning or a browser crash can lose unconfirmed edits.
- Conflicts require reviewing/copying the local draft and explicitly reloading the saved copy. There is no automatic merge or revision history.
- Titles are limited to 160 characters. Serialized editor JSON is bounded (190 KB at the application boundary; 200 KB for PostgreSQL's representation), with nesting limited to 24 levels. Oversized/unsupported documents are rejected without discarding the draft.
- The library shows and filters the latest 1,000 notes per semester, with a visible notice at that limit. Older notes remain stored; full-history pagination is outside this initial Notes interface.
- Link addresses use `https://`, `http://` or `mailto:`. Formatting is deliberately limited to the requested list. No weekly-summary/Home-completion work was started.
- Safari-engine checks use Playwright WebKit, not the installed Safari application. Cloud migration and smoke testing remain manual.
