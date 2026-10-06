# Phase 8.5 — Orbit Design Refresh

## Delivered

- Purpose-built Orbit Day and Orbit Night tokens: warm Day surfaces, neutral Night surfaces, readable secondary text, restrained violet accents, shared borders, controls, radii and motion.
- Quieter sidebar with the existing navigation, profile, semester selector and appearance preferences preserved.
- Calendar remains the dominant Home surface. Larger day/date headers, subtle gridlines, filled course blocks, outlined task markers and distinct assessment markers preserve non-color distinctions.
- Eight paired course identities: Lavender, Sky, Aqua, Mint, Butter, Peach, Rose and Coral. The palette supports keyboard selection. Existing hex values remain stored unchanged unless explicitly edited; known legacy values map to their corresponding identity, and other legacy colors map to the nearest palette pair.
- Existing one-time events open compact anchored desktop editors. Native dialog focus/escape behavior is retained; narrow layouts and larger recurrence workflows use centered dialogs.
- Four concise Home summaries: semester progress, remaining tasks, next assessment and completed Focus today. The existing active-session control remains available.
- Combined Next Up for events/classes, tasks and assessments, preserving date-only deadlines. Current-week Weekly Focus shows completed intervals split over profile-local Sunday–Saturday boundaries. Task progress shows completed and remaining counts.
- Shared styling reaches Courses, Grades, To-do, Focus, Notes, Settings, semester management, authentication and dialogs. Notes remains writing-focused; Focus retains its existing controls and timestamp behavior.
- Keyboard focus within the calendar grid, Day text contrast and Safari form-select sizing were checked and refined.
- A task UI race found during regression testing was fixed: task rows wait for the post-save refresh before reopening or toggling, avoiding reuse of an old revision immediately after a successful save. Database stale-edit rejection remains intact.

## Scope and compatibility

No schema, migration, RLS policy, stored course-color conversion, new dependency or production configuration change is required. Existing migrations 001–008 remain the prerequisites. The new Focus report reads existing owner-protected tables using the signed-in user's client.

Production Supabase was not accessed or changed. Nothing was deployed. Phase 9 and Last Week Summary were not implemented.

## Verification

Verified locally on October 5, 2026, against the final code.

| Check | Result |
| --- | --- |
| `npm run lint` | Passed; zero warnings |
| `npm run typecheck` | Passed |
| Unit tests | 38 passed |
| Database integration tests | 42 passed |
| Chrome browser scenarios | 33 passed |
| WebKit browser scenarios | 33 passed |
| `npx supabase db lint --local` | Passed; no schema errors |
| Generated database types | Exact match with local schema |
| `npm run build` | Passed |

The complete run used `caffeinate -i env ORBIT_WEBKIT=1 PLAYWRIGHT_CHROME=1 npm test`: 80 Vitest tests and 66 browser scenarios, with no retries. This covers Phase 2–8 authentication, profiles, semester selection/history, ownership/RLS, course/event CRUD, recurrence and exceptions, drag/resize rollback, tasks and due times, grade arithmetic and stale edits, Focus restoration/accounting, and Notes persistence/draft/navigation protection.

New checks cover profile-local weekly overlap and DST, report ownership/semester isolation and exclusion of active sessions, course-palette contrast and legacy mapping, combined deadline ordering, palette keyboard use and persistence, anchored editor resizing, reduced-motion styles and page overflow. Axe checks passed in both themes. Both themes were visually inspected on Home, Calendar, Grades, Focus and Notes, plus narrow Home and the event editor.

### Regression findings and corrections

- **WebKit drag failure was a test interaction issue.** Diagnostics showed the pointer starting at approximately y=953 and moving to y=1013 outside a 1000-pixel viewport. Hover made the source visible but did not leave room for the drop. The test now waits for calendar readiness and settled scroll centering, re-hovers the resize handle, and asserts that the entire gesture stays inside the visible schedule. Fault injection targets the event mutation rather than unrelated background POSTs. All persistence, geometry rollback and stale-draft assertions remain. Six consecutive runs per browser passed (12 total) before the clean full run.
- The task reopen-after-save race was an application issue. Task row controls now remain disabled during the confirmed post-save refresh. The unchanged due-time workflow passed three consecutive runs per browser, then passed in the final full suite.
- Intentional presentation assertions now expect paired palette colors; existing raw legacy-value persistence checks remain. No functional assertions were removed.
- Day muted-text contrast, calendar grid keyboard focus, Safari select sizing and anchored-editor viewport clamping were corrected during visual/accessibility review.

## Apply and preview

1. Keep the existing production Supabase project, migrations 001–008, Auth settings and environment variables unchanged. There is **no SQL to apply** for Phase 8.5.
2. Stop the running Orbit development process and restart it with `npm run dev` from this repository. Open `http://127.0.0.1:3000`.
3. If using production-mode preview instead, stop the old process, run `npm run build`, then `npm start`. Installing a fresh checkout still requires `npm ci`.
4. Review Orbit Day/Night, your existing course colors, Home summaries and calendar edits. No deployment or production write was performed as part of verification.

## Visual review artifacts

Synthetic local records only. Both themes were visually inspected for Home, Calendar, Grades, Focus and Notes. Desktop screenshots use a 1440 × 1000 viewport; narrow Home uses 820 × 1000. Additional existing regression scenarios cover small screens and archived states.

All paths below are relative to this repository:

- `.orbit/screenshots/refresh-chromium-Light-home.png`
- `.orbit/screenshots/refresh-chromium-Dark-home.png`
- `.orbit/screenshots/refresh-chromium-Light-calendar.png`
- `.orbit/screenshots/refresh-chromium-Dark-calendar.png`
- `.orbit/screenshots/refresh-chromium-Light-editor.png`
- `.orbit/screenshots/refresh-chromium-Dark-editor.png`
- `.orbit/screenshots/refresh-chromium-Light-grades.png`
- `.orbit/screenshots/refresh-chromium-Dark-grades.png`
- `.orbit/screenshots/refresh-chromium-Light-focus.png`
- `.orbit/screenshots/refresh-chromium-Dark-focus.png`
- `.orbit/screenshots/refresh-chromium-Light-notes.png`
- `.orbit/screenshots/refresh-chromium-Dark-notes.png`
- `.orbit/screenshots/refresh-chromium-Light-narrow.png`
- `.orbit/screenshots/refresh-chromium-Dark-narrow.png`

Equivalent `refresh-webkit-…` screenshots are also available. Screenshots are local ignored artifacts, not production data.

## Limits

- Safari-engine verification uses Playwright WebKit, not the installed Safari app.
- The full week grid scrolls inside its surface on very small windows; Month and Day remain available. Complex recurrence editors remain dialogs.
- The weekly chart covers the current week and completed sessions only. It is not a live active-session chart or the future Last Week Summary.
- Historical arbitrary colors are approximated visually by the curated palette; their original database values are retained.
- The app remains online-first with the previously documented Notes conflict/offline limitations.

Stop here for visual review before Phase 9.
