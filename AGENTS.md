# Orbit: product and engineering rules

## Scope and authority

- Orbit is a private personal academic productivity web app, designed for daily use on a Mac. The interface is English-only.
- Read `PROJECT_PLAN.md` before implementing a feature. It contains the approved architecture, data rules, and acceptance checks. Phases 1–8.5 are approved. Only Phase 8.6 (Calendar Cards and Action Feedback) is now authorized. Stop for review before Phase 9.
- User instructions and approved scope take precedence. Keep these rules stable; put temporary task notes and milestone status elsewhere.
- Do not add features merely because other productivity apps have them. Do not add AI features, recommendations, predictions, or AI-generated summaries.

## Product and design

- The calendar is the visual centerpiece. Keep Home calm and selective, with detailed workflows on their own pages.
- Preserve the approved shell, sidebar structure, spacing, rounded surfaces, and violet accents. Do not redesign it from scratch. Dark mode is the primary visual identity. Remove decorative/product-marketing copy as real functionality replaces previews. Prioritize useful information, with Mini Calendar, Next Up, and To-do on the right; keep semester progress and future focus controls compact. Strengthen light-mode surface separation subtly. Avoid a card-heavy admin dashboard.
- Support both light and dark themes. Dark mode uses near-black surfaces, subtle elevated cards, and restrained violet/indigo accents.
- Use the visual reference as inspiration for layout density, calendar prominence, spacing, rounded surfaces, navigation, and polish; do not copy it pixel-for-pixel. Orbit should feel like a polished macOS productivity product rather than a generic admin template.
- Use shared design tokens and reusable components. Prefer spacious layouts, rounded surfaces, clear typography, and subtle short animations.
- Preserve keyboard navigation, visible focus, accessible labels, readable contrast, and reduced-motion preferences. Course colors must not be the only identifying cue.
- Minimize entry steps through context and sensible defaults. Offer form-based event editing as an alternative to dragging. Do not intercept shortcuts inside editable fields or override common system/browser commands.
- Courses are user-defined. Math and English are possible initial entries, never hardcoded assumptions. Profile names come from stored data.
- Notes remain a small editor with headings, lists, links, and basic emphasis. Grades remain manual weighted assessments. Avoid recreating Notion or an academic analytics platform.

## Architecture and persistence

- This is a personal app for one primary user. Avoid enterprise complexity unless it protects data integrity or serves a requested feature.
- Implement the approved stack and check the installed version's APIs before using examples from another version. Prefer one application and a small feature-oriented data layer.
- Use TypeScript strictly. Share validation and pure domain logic where appropriate; keep calculation rules out of UI components.
- The database is authoritative for all academic data and focus sessions. Do not substitute localStorage, hardcoded fixtures, or in-memory data for production persistence.
- Use versioned schema migrations, generated database types, relational constraints, and transactions for dependent writes.
- Enforce ownership with database Row Level Security and server authentication. Validate ownership/semester compatibility of parent-child references. Keep secrets out of browser bundles, source control, and logs.
- Avoid privileged database credentials for ordinary user operations. Do not publicly cache authenticated personal data.
- Make failures visible. Revert failed optimistic changes; retain unsaved drafts where possible. Do not claim a save succeeded before persistence is confirmed.
- Protect mutable records against stale updates and make retryable transitions idempotent. Synchronize data across sessions/devices according to the approved plan.

## Calendar and time

- Reuse the calendar component between Home and Calendar. Support month, week, and day views.
- Represent recurring schedules as a series plus exceptions identified by the original occurrence. Never mutate a series when the user chooses one occurrence.
- Recurring edits/deletes must have explicit scope. Preserve original occurrence identity after rescheduling and prevent duplicate exceptions.
- Range queries must include occurrences moved into the visible range and exclude their replaced originals. Bound recurrence expansion.
- Recurring class times follow their stored IANA timezone and local wall-clock schedule. Store instants, local recurrence values, and date-only deadlines according to their distinct meanings.
- Use explicit inclusive/exclusive boundaries for all-day events, semester dates, and reporting periods. Never assume every local day has 24 hours.
- Test recurrence behavior, moved occurrences, timezone transitions, and semester boundaries before marking scheduling complete.

## Grades and factual statistics

- V1 grades use weighted assessment items only: name, weight, score / possible score, and optional due date. Do not implement weighted categories or grading modes.
- Blank scores are ungraded, distinct from zero. Show current grade over graded weight and display coverage; do not silently count ungraded work as zero.
- Keep grade weights explicit. Validate scores, possible points, weight totals, and incomplete configurations. Round only for display.
- Assessment completion and score entry are separate actions. Do not count a score correction as a new completion.
- The Saturday card is labeled exactly "Last Week Summary". It covers the completed Saturday–Friday period, shows the exact date range, and uses persisted records and the profile timezone. No AI text, inferred attendance, or invented study time.
- Prevent double-counting on retries, task recompletion, and timer completion. Breaks and paused intervals do not contribute to study time.
- Timers derive elapsed time from timestamps and persisted state. Account for refreshes, sleeping Macs, background throttling, and competing tabs/devices.

## History and destructive actions

- Archiving preserves data. Starting a new semester must not overwrite previous semesters or reuse their course records.
- Semester end dates do not automatically delete or archive anything. Archived data remains accessible.
- Do not silently cascade-delete unrelated tasks, notes, events, or study history when deleting a course. Follow the approved deletion policy and show its concrete impact.
- Use explicit confirmation for destructive actions and whole-series edits that affect exceptions. Do not introduce approval prompts for routine reversible work already authorized by the user.

## Delivery and verification

- Work in small, reviewable milestones with the approved acceptance checks. Do not skip persistence/security in favor of a polished mockup.
- Run relevant lint/type checks and meaningful tests for changed behavior. Prioritize recurrence, grade arithmetic, ownership, transactions, time boundaries, and persistence.
- Inspect both themes and Mac desktop layouts for visible UI changes. Use current Safari and Chrome for release verification.
- Do not add tests that merely repeat implementation details or broaden testing without a concrete reason.
- Report what changed, how it was checked, and material limitations. Never describe proposed or untested behavior as implemented.
- Keep documentation consistent with approved decisions. Phase 8 permits restricted rich-text Notes with autosave and course association. Preserve Phases 2–7. No analytics, notifications, sounds or weekly-summary logic. Stop for review before Phase 9. Do not deploy.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

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
