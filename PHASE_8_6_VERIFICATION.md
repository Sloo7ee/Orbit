# Phase 8.6 verification

Completed October 6, 2026. Ready for review; stop before Phase 9.

## Changes

- Calendar cards use their actual rendered height to select density. Short blocks put title/time on one compact line; larger blocks progressively show room and course code. Narrow overlapping blocks reserve space for wrapping times before revealing metadata. Month cards stay compact. No duration, slot sizing, recurrence, drag, resize, timezone or persistence rules changed.
- Softened all eight Night course colors. Day pastels are unchanged. Old palette values remain identity aliases, without rewriting stored colors. Automated contrast checks cover every Day/Night pair.
- Added a small shared action-confirmation stack at the right viewport edge. Cards slide/fade in with a restrained settle, remain about 2.9 seconds, then slide/fade out. Up to three appear at once; additional confirmations queue. Removal collapses stack space smoothly. Hover and keyboard focus pause dismissal; reduced motion uses a short fade. Cards never take focus or change page layout.
- Form actions announce useful add/update/delete labels and available course/task/assessment context once, after successful persistence. Calendar gestures, task completion, Focus confirmations, semester switching and explicit note deletion use the same system. Removed duplicate parent success banners.
- Form errors, retry controls, password-recovery instructions, persistent warnings and quiet Notes autosave status remain in context. No timed error dismissal was added.
- No dependency, backend, schema or Supabase configuration changes.

## Verification

- `npm run lint` — passed, no warnings.
- `npm run typecheck` — passed.
- `npm run test:unit` — 38 tests passed.
- Focused Playwright verification — 38 unique scenarios passed: 19 Chrome and 19 WebKit. The first affected run passed 30 scenarios; the final targeted recheck passed all 14 selected scenarios, including all initially failing cases. No retries configured. The full Phase 8.5 suite was not repeated.
- New polish checks cover 15-minute, 60-minute and three-hour recurring cards, metadata visibility and text bounds, Month/Week/Day, task/assessment markers, both themes, notifications for add/update/complete/delete, stacking, dismissal, pointer/focus pauses, reduced motion, no focus theft, error persistence/retry and no layout shift.
- Existing focused workflows cover course/calendar CRUD, drag and resize persistence, failed-gesture rollback, recurring scope/exception edits, stale edits, task/grade CRUD, semester/history access, profile/password-recovery forms, Focus restoration and Notes autosave/draft recovery.
- Two card CSS issues discovered during review were fixed: short-block padding and the selector specificity for revealing the second metadata line.
- Test fixes preserved behavior assertions: wait for previous confirmations before checking a new gesture acknowledgement; wait for the Focus heading instead of auditing its transient loading boundary; use app navigation for Grades to avoid a WebKit document-navigation race after sign-in. The new test's local fixture cleanup uses its admin fixture client and explicitly scopes deletion to its synthetic owner.

Run logs: `/tmp/orbit86-affected.log`, `/tmp/orbit86-recheck.log`, `/tmp/orbit86-unit.log`.

## Visual evidence

Screenshots under `.orbit/screenshots/`:

- `polish-chromium-Light-calendar.png`
- `polish-chromium-Dark-calendar.png`
- `polish-webkit-Light-calendar.png`
- `polish-webkit-Dark-calendar.png`
- `polish-chromium-Light-notification.png`
- `polish-chromium-Dark-notification.png`
- `polish-webkit-Light-notification.png`
- `polish-webkit-Dark-notification.png`

Calendar card and notification screenshots reviewed in both themes. Notification checks include an accessibility audit; the calendar audit targets the changed event cards. An initial whole-Month audit also identified low contrast in the pre-existing dimmed adjacent-month date numbers. Those date-header styles are outside this pass and remain unchanged. No existing accessibility assertion was removed.

## Production

No migration, environment variable, Supabase configuration or data conversion is required. Production Supabase was not accessed or changed. No deployment performed. Phase 9 has not started.
