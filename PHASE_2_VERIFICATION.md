# Phase 2 verification

Verified locally on October 3, 2026. Phase 3 has not started.

## Implemented scope

Supabase Auth and PostgreSQL integration; email/password sign-in/out; recovery emails and password updates; profile onboarding/editing; display name/timezone and first-name greeting; semester creation, selection, inclusive-date progress, archive/history and restore; ownership protection, transactional mutations, conflict detection, loading/error/success states.

The approved shell, navigation, spacing, rounded surfaces, violet accent and calendar prominence remain. Dark is the fresh-browser default. Light surfaces are slightly more distinct. Decorative copy has been reduced. Academic feature destinations remain placeholders.

## Results

| Check | Result |
| --- | --- |
| `npm run lint` | Passed, zero warnings |
| `npm run typecheck` | Passed |
| `npm run build` | Passed with the local Supabase environment configured |
| `PLAYWRIGHT_CHROME=1 npm test` | Passed: 5 unit, 7 integration, 8 browser tests |
| Database migrations | `202610030001` applied and recorded in local migration history |
| Database types | Regenerated from the actual local schema |
| RLS | Enabled on profiles and semesters; six owner-scoped policies verified |
| Runtime dependencies | `npm audit --omit=dev`: zero known vulnerabilities |
| Production response | Sign-in response confirmed `Cache-Control: private, no-store` |

The final browser suite ran against **`npm start` using the production build**, with real local Supabase services, not mocked authentication or a fake database.

### Behaviors verified

- Anonymous users cannot access protected application routes or personal database rows.
- Correct/incorrect passwords, disabled public registration, session refresh, sign-out and subsequent protection.
- Profile creation, first-name greeting, profile edits/timezone persistence after reload, and stale-edit rejection without losing the draft.
- Semester creation, selection, second independent browser session, archive/history, reload, and restore.
- Inclusive dates, final-day behavior, one-day semesters, leap days, timezone midnight and DST.
- Two separate test users: row isolation, denied forged ownership, denied cross-owner selected semester references, denied archive/update of another owner's records, and no deletion grant.
- Creation retries do not duplicate semesters; repeated archive transitions are safe; stale revisions are rejected.
- Actual recovery email captured in the local mailbox; token opened after clearing cookies; password changed; old password rejected; used link rejected.
- Failed network save preserves form entries and succeeds on retry.
- Both themes, navigation, automated WCAG checks on sign-in/Home/Settings, narrow screens and reduced motion.
- Screenshots inspected for sign-in, Home, semester management and narrow-screen semester layout in light/dark themes. Isolated screenshot test data was removed afterward.

## Environment and remaining limitations

- Local Supabase is running in Docker. No cloud project has been created or connected, and no site was deployed.
- The local preview owner account is recorded privately in `.orbit/local-account.txt`; no profile or academic records are seeded for that account. Finish onboarding yourself.
- Local recovery mail is captured at http://127.0.0.1:54324. Real email delivery and cloud configuration must be checked after following `SUPABASE_SETUP.md`.
- Chrome was exercised. Installed Safari/WebKit has not been verified in this phase.
- The full dependency audit still reports five entries from a development-only ESLint `braces` dependency advisory chain. Runtime audit is clear. A forced incompatible downgrade was not applied.
- Calendar dates are explicitly static preview artwork. No courses, events, grades, tasks, notes, focus timer, or weekly-statistics functionality was added.

## Fixes made during verification

- Enabled email login in local Supabase while retaining the separate global public-signup prohibition.
- Used the configured public origin for recovery redirects, preventing a localhost/127.0.0.1 cookie mismatch.
- Strengthened muted text contrast in Light Mode.
- Made authentication routes explicitly dynamic/private and excluded recovery URLs and server action arguments from development request logging.
- Kept semester creation request IDs stable for retries and retained profile revisions for conflict detection.

Stop here for user review before Phase 3.
