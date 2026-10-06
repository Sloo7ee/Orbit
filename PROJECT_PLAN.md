# Orbit project plan

Status: architecture and milestones approved with the revisions below. Phases 1–8.5 are approved; Phase 8.6 ONLY is authorized. Stop for review before Phase 9.

## 1. Product scope

Orbit is a private, English-only academic workspace for daily use on a Mac. Its main job is to make the semester easy to see and manage: calendar first, supported by courses, tasks, grades, notes, and study sessions. All personal data persists in a database and is available after signing in on another device.

V1 includes every requested core workflow. The milestones below divide implementation into reviewable pieces; Phase 1 alone is not V1. Avoid adding integrations, collaboration, AI, or complex analytics.

### Proposed defaults

- Profile name comes from onboarding; never hardcode Saleh into the interface.
- Initial timezone: Asia/Riyadh, confirmed during onboarding and editable in settings. Store an IANA timezone, not a fixed UTC offset. Travel does not silently change this preference.
- Sunday begins the calendar week. The Saturday card, labeled "Last Week Summary", covers the completed Saturday–Friday reporting week, ending at Saturday 00:00 in the profile timezone. Show the exact date range. This is deliberately a completed period, rather than a partial Saturday report.
- One selected semester drives the main workspace; previous semesters remain accessible. Overlapping semester dates are allowed. A course belongs to one semester; taking it again creates a new course record.
- No public registration in the deployed personal app. Provision the owner's account through Supabase, then offer email/password sign-in, recovery, and profile onboarding.
- Home opens with a large week calendar on desktop; month and day are available. Its last selected view can be remembered as a preference.

These defaults are proposals, not additional user requirements.

## 2. Architecture and stack

Keep complexity appropriate for one primary user. Additional architecture must protect data integrity or serve a requested feature. Use one Next.js application backed by Supabase. A separate API service, microservices, and a background job system are unnecessary for V1.

| Area                  | Recommendation                                                                         | Reason                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Application           | Next.js App Router, React, TypeScript with strict checking                             | One application for authenticated routes, server reads, and interactive screens                |
| Database and identity | Supabase PostgreSQL and Supabase Auth                                                  | Relational integrity, email/password authentication, persistent data across devices            |
| Data access           | Supabase client, generated database types, versioned SQL migrations                    | A small data layer without another ORM                                                         |
| UI                    | Tailwind CSS, CSS custom properties, accessible Radix/shadcn-style primitives          | Shared tokens and accessible dialogs, menus, and form controls                                 |
| Calendar              | FullCalendar Standard React integration; month, time-grid, and interaction modules     | Established view and drag/drop behavior; no premium scheduler features required                |
| Recurrence and dates  | Bounded weekly expansion with Luxon                       | Weekly-only rules need no arbitrary RRULE parser; keep expansion and exceptions in the domain layer |
| Notes                 | Tiptap with a deliberately restricted extension set                                    | Headings, emphasis, lists, and links without a document platform                          |
| Validation            | Zod at server input boundaries plus PostgreSQL constraints                             | Friendly errors and durable data invariants                                                    |
| Verification          | Vitest for domain logic, database integration tests, Playwright for critical workflows | Focus on recurrence, grades, ownership, persistence, and user journeys                         |
| Hosting               | Proposed: Vercel for the web app and managed Supabase for data                         | Straightforward deployment; approve environment and paid services before provisioning          |

Choose current compatible stable package versions when Phase 1 is approved and commit the lockfile. Avoid speculative dependencies. Use CSS transitions for most animation; add a motion library only if a concrete interaction needs it.

### Boundaries and data flow

1. Server components load authenticated page data. Client components handle calendar interaction, forms, notes, and timers.
2. Server actions/route handlers validate the authenticated user and request, then call feature services. Use the user's Supabase session so Row Level Security remains in force.
3. Pure domain functions handle grade calculation, recurrence expansion, reporting boundaries, and progress calculations. UI widgets never own these rules.
4. PostgreSQL stores authoritative records. Multi-record operations use transactions through carefully scoped database functions where needed.
5. Refresh data after writes, on window focus, and periodically while an active screen is visible. Two online devices should converge within 30 seconds. Immediate live collaboration is unnecessary.

Keep folders organized by features, with shared UI, domain functions, and database access clearly separated. Reuse the same calendar surface on Home and Calendar.

### Persistence, authorization, and failures

- Every personal table has an owner and explicit RLS policies for reads and writes. Never accept a client-supplied owner as authority. Test with two users even though the product is personal.
- Parent/child references must have the same owner and semester. Enforce this in database constraints or transactional validation, not only in dropdowns.
- Keep privileged Supabase keys server-only, and avoid them for ordinary user requests. Do not cache personalized responses in a shared public cache.
- Use version checks for mutable records. On a stale edit, preserve the draft and ask the user to reload/reconcile instead of silently overwriting newer data.
- Mutations show saving, saved, and failure states. A failed drag returns the event to its previous position. A failed note save keeps the current editor draft and offers retry.
- Database writes must succeed before showing a durable success state. Local storage may hold harmless UI preferences, but cannot be the main record store.
- V1 is online-first. Offline writes show an explicit unsaved state; do not build a hidden offline synchronization queue. A page refresh can lose an unsaved draft, so warn before leaving when appropriate.
- Maintain separate development/test data and production data. Document database backup and restore procedures before launch, based on the chosen hosting plan's actual capabilities.

## 3. Data model

Use UUID primary keys, ownership, created/updated timestamps, and an integer revision on editable records. Use PostgreSQL numeric for weights and scores. Actual instants use timestamptz; date-only values use date; recurring wall-clock times also retain their timezone.

| Entity          | Important fields and relationships                                                                                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth user       | Managed by Supabase; password hashes never belong in application tables                                                                                                             |
| Profile         | User ID, display name, timezone, theme preference (system/light/dark), selected semester ID                                                                                         |
| Semester        | Owner, name, start date, inclusive end date, archived timestamp                                                                                                                     |
| Course          | Owner, semester ID, name, optional code, color, archived timestamp                                                                                                                  |
| Calendar event  | Owner, semester ID, optional course ID, title, optional location/description, all-day flag, time fields, timezone, optional recurrence rule and repeat-through date, countdown flag |
| Event exception | Owner, parent event ID, immutable original occurrence key, cancelled flag or replacement event fields, revision; unique per parent and original key                                 |
| Task            | Owner, semester ID, optional course ID, title, optional due date, low/normal/high priority, completed timestamp                                                                     |
| Assessment      | Owner, course ID, title, weight percentage, possible points, nullable earned points, optional due date, completed timestamp, display order                                          |
| Focus session   | Owner, semester ID, optional course ID, stopwatch/Pomodoro mode, running/paused/completed/discarded status, target duration where applicable, completed timestamp                   |
| Focus interval  | Owner, session ID, start/end instants; each interval records active study between pauses                                                                                            |
| Note            | Owner, semester ID, optional course ID, title, validated editor JSON, content schema version, revision                                                                              |

### Relationship and storage rules

- Every academic record belongs to a semester, even when its course association is empty. Course children remain within that course's semester.
- Course schedules are stored as weekly series definitions in course_schedules with sparse schedule_exceptions. Standalone calendar_events remain unchanged; no duplicate materialized meeting rows. Multiple meeting patterns use multiple blocks.
- One event record represents either one standalone event or a recurring series. For timed standalone events, store start/end instants. For recurring events, store the local start date/time, duration, timezone, and recurrence definition. All-day events use date ranges with an exclusive end date. Constraints enforce the appropriate fields for each variant.
- Store exceptions without materializing an entire semester of occurrence rows. Index owner/semester/date queries, course references, completion timestamps, and exception keys. Bound recurrence expansion to requested calendar windows.
- Important countdowns reuse a flag on one-off events, avoiding a second deadline store. Support a small number of pinned countdowns on Home; past targets leave the upcoming list.
- Tasks and assessments remain distinct. V1 has no automatic conversion between them or duplicate calendar deadlines. An assessment is complete when explicitly marked complete, which is independent of when a score is entered.
- Store one active focus session per user, enforced in PostgreSQL. Sessions can have multiple non-overlapping intervals. Retried completion must not create duplicate sessions or time.
- Grades, semester progress, and Saturday statistics are computed from source records. No separate authoritative aggregate tables or summary snapshots are needed in V1.

### Archive and delete behavior

- Archiving a semester preserves its complete history and makes the workspace read-only until restored. A date passing does not archive or delete data automatically.
- Archived courses remain visible in historical records but leave active selectors. Their recurring schedules remain intact and are hidden from the active calendar by default.
- Course deletion shows a concrete impact preview. Delete its grade configuration and assessments; detach course links on tasks, notes, focus sessions, and calendar events so those records remain usable. Offer schedule removal as an explicit choice in the same dialog, never a silent cascade. Changes are atomic.
- Permanent semester deletion is outside V1. Semester archiving is the normal end-of-term flow.

## 4. Navigation and interaction design

### Navigation

| Destination | Contents                                                                                                    |
| ----------- | ----------------------------------------------------------------------------------------------------------- |
| Home        | Greeting, large calendar, compact support column, Saturday summary when relevant                            |
| Calendar    | Same calendar component with more space; month/week/day switch, mini calendar, course filters, event editor |
| Courses     | Flexible course list with add/edit/archive/delete; course detail tabs for Overview, Grades, Notes           |
| To-do       | Upcoming/overdue/completed tasks, quick entry, course and priority filters                                  |
| Notes       | Simple note list and editor, optional course filter                                                         |
| Focus       | Stopwatch/Pomodoro, optional course selector, recent saved sessions                                         |
| Semesters   | Create, select, archive, and revisit semesters; accessible from the semester switcher                       |
| Settings    | Name, timezone, appearance, password/account controls                                                       |

The primary sidebar contains Home, Calendar, Courses, To-do, Notes, and Focus. Put the semester switcher near the top and settings at the bottom. Grades belong inside each course, not in another primary navigation item. Authentication and initial onboarding sit outside the app shell.

### Home composition

- Calendar occupies roughly two-thirds to three-quarters of the main content width on a normal Mac display.
- The support column holds the mini calendar, the next three events, and up to three actionable tasks. Each list links to its full page.
- Semester progress and one to three countdowns appear as compact text/indicators rather than large cards.
- A small focus control starts or resumes study; the full session history lives on Focus.
- On Saturdays, a small card labeled "Last Week Summary" appears below the main content with total study time, course breakdown, completed tasks, and completed assessments. No large chart or new primary navigation item.
- Allow vertical scrolling on smaller laptop displays; do not shrink the calendar to fit every widget above the fold.

### Design system

Use the supplied reference for layout density, calendar prominence, spacing, rounded surfaces, navigation, and polish. Develop an original macOS-inspired product, without copying the reference or using a generic admin template.

- Near-black dark backgrounds, subtly elevated neutral cards, violet/indigo primary accents. Light mode uses soft neutral backgrounds and clearly separated surfaces.
- Shared semantic color, typography, spacing, radius, elevation, and motion tokens. Start from a restrained 4px spacing scale and system typography appropriate to macOS.
- Course colors accompany readable labels; color alone never conveys meaning. Keep text contrast, visible focus, and reduced-motion behavior consistent in both themes.
- Short, subtle transitions around 120–200ms for hover, dialogs, and small state changes. Avoid decorative movement.
- Click an empty calendar slot to start an event with time prefilled. Course actions prefill course association. Use a single contextual event editor with advanced recurrence fields progressively revealed.
- Suggested shortcuts: Escape closes overlays; Command+Enter submits supported forms; N creates an item only outside editable fields and only in an unambiguous page context. Do not override browser/system shortcuts.
- Provide a form alternative to dragging events and keyboard access to important calendar actions.

## 5. Rules and edge cases

### Recurring classes

V1 supports weekly recurrence with selected weekdays, a positive interval in weeks, and an explicit repeat-through date defaulting to semester end. Separate series handle meetings at different times. An advanced arbitrary RRULE editor is unnecessary.

1. Expand the series in its stored timezone so a 09:00 class stays at 09:00 through timezone offset changes. Never implement weekly recurrence by adding fixed UTC seconds.
2. Each generated occurrence has a stable key based on its original scheduled local date/time, scoped to the series. Moving it preserves that key.
3. Editing or dragging a recurring occurrence offers **This event only** (default), **This and future events**, and **Entire series** where the operation is supported. Never commit an implied series edit.
4. Moving one occurrence writes an exception. Deleting one writes a cancellation exception. Editing it again updates the same exception. The rest of the series stays unchanged.
5. Query both original occurrences and replacement exceptions that overlap the requested window. An event moved from another month into the current month must appear exactly once; its original slot must disappear.
6. Whole-series title/location/course edits preserve exceptions. Whole-series time/rule changes with exceptions require a preview and an explicit choice to reset affected exceptions; cancel leaves all records unchanged. V1 will not guess how to remap exceptions. Apply the approved change atomically.
7. Whole-series changes include historical occurrences; say so in the scope dialog. “This and future events” splitting is approved in Phase 4; cut at the immutable original meeting date.
8. Deleting a whole series deletes its exceptions after a scope confirmation. Single-occurrence changes are reversible through editing/resetting that exception.
9. Overlapping events are allowed with a subtle conflict hint. End must follow start; midnight-crossing events are supported. Recurrence bounds prevent accidental endless expansion.
10. For DST gaps, skip invalid local occurrences and surface a schedule notice; for repeated local times use the earlier offset consistently. Test the chosen recurrence/date libraries against these rules before adopting them.
11. Changing semester dates does not silently rewrite series limits. Show affected schedules and let the user update them deliberately.
12. Render occurrences as independently identified calendar events so the UI library cannot accidentally drag related occurrences together. Persist only the operation and scope explicitly selected.

### Simple weighted grades

V1 uses weighted assessment items only. Manually enter a name, weight percentage, score / possible score, and optional due date. Do not implement weighted categories or grading modes.

Let `w = assessment weight` and `p = earned points / possible points × 100`.

- Current grade = `sum(p × w) / sum(w)` over scored items with positive weights.
- Graded coverage = sum of those effective weights, expressed as a percentage of the course.
- Example: an 80% score on a 20%-weight midterm, with the remaining 80% ungraded, displays **Current grade 80% · 20% graded**. It does not display 16% as the current grade.
- A blank score is ungraded; an entered zero is a real zero. With no scored positive-weight items, display “No grades yet.”
- Assessment weights must total 100% before the setup is complete. Drafts below 100% can be saved with a clear incomplete-setup label; totals above 100% are rejected. Incomplete configurations produce a labeled provisional calculation, not a final result.
- Reject negative scores/weights, non-finite input, and possible points of zero. V1 scores may not exceed possible points; extra credit is postponed.
- Use decimal arithmetic or integer-scaled decimal values, enforce aggregate totals transactionally, and round only for display (one decimal place). Compare sums at the supported input precision.
- Editing weights or deleting scored items recalculates the grade and shows its impact.
- Completion date and score are independent: a submitted assessment can be complete while awaiting a grade. Updating a score must not count as another assessment completed.
- No letter-grade conversion, GPA, forecasts, dropped-lowest rules, or inferred institution policies in V1.

### Focus sessions and sleep

- Stopwatch runs until paused or stopped. Pomodoro defaults to 25-minute study / 5-minute break with manual start for the next interval; basic durations may be edited. Break time never counts as study time.
- Derive display time from persisted timestamps, not incrementing counters. Persist transitions immediately; a refresh or background-tab throttle must not reset or inflate time.
- When a Pomodoro finishes in a sleeping/background tab, cap credit at its planned end. Do not automatically generate further sessions.
- An unattended stopwatch can accumulate time while the Mac sleeps. On resuming after a long inactivity gap, ask whether to keep or trim that time before completion. Do not pretend browser activity can prove study.
- Start/pause/resume/complete operations are transactional and retry-safe. Another tab/device resumes the existing active session. A running session's semester is fixed. Its course/task association may be changed explicitly for the whole session.
- Completed focus intervals crossing a reporting boundary are split by actual overlap with each week. Discarded sessions and pauses do not count.

### Semester dates, tasks, and weekly statistics

- Semester progress uses local calendar days from start through inclusive end. Use an exclusive boundary on the day after end when calculating elapsed fraction; clamp to 0–100%. Before start show 0%; after end show 100%. During the final day, “1 day remaining” means the final included calendar day.
- Validate end date on/after start; a one-day semester is valid. Countdown and due-date labels use the profile timezone. Tasks with a date-only deadline become overdue on the next local day.
- Summary reporting interval is half-open: Saturday 00:00 inclusive through the next Saturday 00:00 exclusive. Use timezone conversion, not seven fixed 24-hour intervals. Show the preceding completed period on Saturday and scope it to the selected semester.
- Weekly totals use completed focus sessions and their intervals, distinct tasks currently marked complete with completion dates in the period, and distinct assessments currently marked complete in that period. Show unassigned study time separately so course subtotals match the total.
- Undoing completion clears its timestamp and removes the item from that week's count; recompletion records the new completion date. A repeated save cannot increment any count. Historical reports reflect later corrections and are not immutable audit records.
- Compute the summary when the app opens, refocuses, or crosses local midnight. No scheduled job, push notification, email, AI text, or always-running browser is required.
- Empty weeks show factual zero values. Do not count scheduled classes as attended or scheduled time as studied. Semester date changes affect progress but never delete records.
- If there is no active semester, show focused onboarding. Archiving with a running timer requires finishing/discarding the session first. Profile timezone changes recalculate reporting boundaries and display dates with a short explanatory notice.

## 6. Small, testable milestones

Each milestone ends with a short review of the working result and its checks. Phases 1–7 are approved; Phase 8 is authorized; Phase 9 requires further user approval. At the end of each later milestone, report the outcome and continue only within the user's approved scope.

| Phase                         | Deliverable                                                                                                                                       | Acceptance checks                                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1. Foundation                 | Initialize project; theme tokens, reusable controls, desktop shell, navigation placeholders, lint/typecheck/test setup, environment documentation | Both themes, keyboard focus, reduced motion, and Mac-sized layouts work; no fake production data                                |
| 2. Identity and semesters     | Supabase setup/migrations, owner account access, password recovery, profile, semester creation/selection/archive                                  | Data survives reload and a second browser; anonymous/cross-user reads and writes fail; archive preserves data                   |
| 3. Courses and basic calendar | Flexible course management; standalone events; month/week/day; shared calendar on Home; mini calendar                                             | Course CRUD and event CRUD persist; event edits and failed-drag rollback work; both themes readable                             |
| 4. Recurring schedules        | Weekly course schedule editor; exception model; scoped edits/deletes and drag/drop                                                                | Move/delete only one occurrence; moved-in/out-of-window queries; DST, semester bounds, repeated edits, series conflict previews |
| 5. Tasks                      | Quick task entry, due dates, priorities, course association, completion                                                                           | Correct overdue boundaries, undo/recompletion, retry-safe saves, and course deletion preservation                               |
| 6. Grades                     | Per-course weighted assessment items only, manual scores, current grade and coverage                                                              | Blank vs zero, no grades, mixed weights, incomplete setup, decimal rounding, concurrent totals                                  |
| 7. Focus                      | Stopwatch and Pomodoro, persisted active state, completed sessions and intervals                                                                  | Pause/reload/sleep recovery, no break credit, one active session across devices, duplicate completion prevention                |
| 8. Notes                      | Basic editor, course association, autosave with status                                                                                            | Required formatting persists; failed save retains draft; stale saves cannot silently overwrite another device                   |
| 9. Home completion            | Upcoming events, task overview, semester progress, event countdowns, compact focus control, Saturday summary                                      | Exact date ranges, partial-week interval splitting, zero-data states, no duplicated counts, calendar remains dominant           |
| 10. Release check             | Accessibility/visual review, persistence/conflict checks, deployment configuration, backup/restore notes                                          | Core journeys in current Safari and Chrome on Mac; two-user RLS tests; new-semester workflow preserves historical data          |

Tests should target behavior and risk. Domain tests cover recurrence, grades, time boundaries, and statistics; integration tests cover RLS, relational constraints, and atomic writes; a small end-to-end suite covers login and the main calendar/study/semester workflows. Use visual inspection for theme/spacing changes rather than brittle tests that mirror markup.

## 7. V1 and postponements

### Include in V1

All ten requested feature areas: calendar-led Home, month/week/day calendar, recurring classes and individual exceptions, flexible courses, simple manual grades, stopwatch/Pomodoro with stored study time, tasks, basic notes, semester history, Saturday statistics, and authenticated database persistence. Both themes, accessible interactions, and reasonable Mac keyboard shortcuts are part of V1 quality.

### Postpone

- Arbitrary recurrence rules, holiday calendars, and calendar imports/external sync.
- Offline editing, immediate realtime subscriptions, native Mac packaging, and a dedicated mobile experience. Smaller screens should still remain usable.
- Advanced grade rules, extra credit, GPA/letter grades, forecasts, and historical grade snapshots.
- Rich note databases, attachments, embedded media, and real-time collaborative editing.
- Push/email reminders, extensive analytics, streaks, gamification, and dashboard customization.
- Course/semester template duplication and permanent semester deletion.

These are exclusions, not a promised roadmap. AI features remain out of scope, rather than postponed.

## 8. Technical references

Official documentation checked during planning; confirm exact APIs against the versions chosen for implementation:

- [Next.js App Router](https://nextjs.org/docs/app) and [server/client boundaries](https://nextjs.org/docs/app/getting-started/server-and-client-components).
- [Supabase with Next.js](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs), [server authentication guidance](https://supabase.com/docs/guides/auth/server-side/advanced-guide), and [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).
- [FullCalendar React integration](https://fullcalendar.io/docs/react), [licensing](https://fullcalendar.io/license), [recurrence support](https://fullcalendar.io/docs/rrule-plugin), and [drag/drop including related events and revert](https://fullcalendar.io/docs/eventDrop). Standard is MIT licensed; the proposed views do not require Premium.
- [Tiptap StarterKit](https://tiptap.dev/docs/editor/extensions/functionality/starterkit); enable only the formatting approved for Phase 8.

## Approval boundary

Phases 1–8 are approved. Phase 8.5 refreshes the visual system and adds the approved factual Home summaries and current-week Focus chart. Preserve the shell and existing features. No sounds, notifications or Last Week Summary logic. Stop for visual review before Phase 9.

## Approved recurring schedule rules

Preserve recurring weekly course blocks with weekdays, local start/end times, location and semester-bounded inclusive effective dates. Multiple blocks per course are supported. Only-this-event edits/cancellations are sparse exceptions keyed by immutable original date. This-and-future edits atomically split a block at that original date; earlier definitions and exceptions remain intact. Entire-series acts on the selected block, including its past dates, not blocks separated by previous splits. Scope confirmation must explicitly describe resetting individual changes/cancellations in the affected range; never reset silently. Course deletion detaches and preserves recurring meetings as well as one-time events. Preserve the shell and existing workflows. Test only locally; do not alter production credentials, run production migrations or deploy.

## Approved Grades rules

Weighted assessment items only. Current Grade normalizes over scored weight; show coverage and earned points separately. Up to four decimal input places, two display places. Courses with assessments cannot be deleted. Preserve the approved Grades implementation.

## Approved Focus rules

Phase 6 and production migration 006 are approved. Phase 7 ONLY permits Free Focus/stopwatch and simple Pomodoro (default 25/5 minutes, custom whole-minute durations), one active session per owner, timestamp-based pause/resume, actual focus intervals, history, and compact Home/today reporting. Never count breaks or pauses. Cap a sleeping Pomodoro at its focus end; do not start further focus intervals automatically. The break follows the scheduled focus end; the next focus requires an explicit action. Stopwatch runs while away; review intervals over an hour before pausing/finishing, with an optional trim. Association can be changed for the whole active session; a course-linked task determines its course. Finishing never completes a task. Preserve course/task label snapshots when links are deleted. Active sessions prevent semester archiving until finished/discarded. Completed history is read-only in archived semesters. Today totals count the overlap of completed focus intervals with the profile-local day, scoped to the viewed semester. Save transitions, not per-second rows. Confirm writes before changing controls; retry receipts and revisions protect competing devices. No charts, goals, streaks, AI, sounds, notifications or long-break cycles. Local verification only; do not touch production or deploy.

## Approved Notes rules

Phase 7 and production migration 007 are approved. Phase 8 adds semester-owned Notes only: a compact list/editor, optional course, title search/filter, and debounced autosave. Tiptap supports paragraphs, headings, bold/italic/underline, bullet/numbered lists, blockquote, inline code, links and undo/redo only. No checklists, media, attachments, tables, embeds, collaboration, Markdown mode or AI. Validate restricted JSON and safe link protocols at server and database boundaries. Preserve drafts on failure, serialize saves, reject stale revisions, and protect pending edits during navigation. Archived notes are read-only; course deletion detaches notes without deleting content. Keep Home unchanged. Test locally only; do not touch production or deploy. Stop before Phase 9.

## Current Phase 8.5 authorization

Phase 8 is approved. Refresh presentation through purposeful Orbit Day/Night themes, paired semantic course colors, quieter navigation, typography and shared controls. Preserve existing architecture and all Phase 2–8 functionality. Color compatibility maps old hex values without rewriting data; new choices use canonical palette values in the existing field. Home may show four concise summaries, current-week completed Focus intervals, combined Next Up and simple task progress. Calendar remains dominant. Weekly focus uses profile-local Sunday–Saturday days, clips intervals at local boundaries, and excludes breaks, pauses and active/discarded sessions. No Last Week Summary, Phase 9, AI, collaboration, gamification, notifications, deployment or production access. Review both themes and responsive states; run complete regressions before stopping for visual approval.

## Phase 8.6 authorization

Phase 8.5 is approved. Phase 8.6 permits only height-adaptive calendar card presentation, softer Night course colors, and lightweight animated action confirmations at the right viewport edge. Confirmations must overlay without shifting content, use context when available, and respect reduced motion and keyboard focus. Preserve persistent errors, validation, recovery controls and quiet Notes autosave. No backend, schema, Supabase, recurrence or business-rule changes; no production access. Run focused calendar and feedback verification in Chrome/WebKit, lint and typecheck. Stop before Phase 9.
