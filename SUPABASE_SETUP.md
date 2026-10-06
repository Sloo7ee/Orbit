# Connect Orbit to Supabase

Phase 5 is implemented. For an existing production project with Phases 2–4 applied, use the Phase 5 upgrade instructions below. The local and cloud databases are separate; local records do not upload automatically.

## A. Local preview on this Mac

Docker Desktop must be running. From the Orbit folder:

```sh
npm ci
npm run db:start
npm run local:setup
npm run dev
```

Open http://127.0.0.1:3000. The local setup script writes a **local-only** owner account to `.orbit/local-account.txt`. Keep the login details on this Mac; do not paste them into chat. Use that email/password to sign in, then enter your display name and timezone and create your first semester. The script will not replace an environment connected to another project.

The local Supabase Studio is http://127.0.0.1:54323. Password recovery messages are captured at http://127.0.0.1:54324 instead of sent to your inbox. Click the reset link in that local inbox to test recovery.

`npm run db:stop` stops the local stack and preserves its database volume. Do not use `supabase db reset` or `supabase stop --no-backup` on data you want to keep. Docker data is local development data, not cloud backup.

## B. Create the cloud project

Do this after reviewing the local implementation, before relying on Orbit for real semester data.

1. Sign in to [Supabase](https://supabase.com/dashboard) and create a project named **Orbit**. Choose a region near you and a strong database password; save the password in your password manager. Review the current plan/cost before choosing it.
2. Wait for the project to finish provisioning.
3. Open **SQL Editor**, create a query, and paste the complete contents of `supabase/migrations/202610030001_identity_semesters.sql`. Run it **once on the new project**. This creates only profiles, semesters, constraints, RLS policies, and transactional functions.
4. Confirm **profiles** and **semesters** appear in Table Editor with RLS enabled. Do not disable RLS or add public policies.

For later migration-managed deployment, use `npx supabase login`, `npx supabase link --project-ref YOUR_PROJECT_REF`, and `npx supabase db push`. Choose either CLI migrations or SQL Editor for the initial migration; do not apply the same migration twice. If initially applied through SQL Editor, link the project and run `npx supabase migration repair 202610030001 --status applied --linked` before switching to CLI deployment. This records the already-applied migration; do not run it unless the SQL Editor migration succeeded.

## C. Configure identity and recovery

1. In **Authentication → Sign In / Providers**, enable email/password authentication. Disable **Allow new users to sign up**. Orbit has no public registration screen.
2. Set the minimum password length to **12**. Orbit accepts passwords up to 128 characters.
3. In **Authentication → URL Configuration**, set **Site URL** to `http://127.0.0.1:3000` for this local web app connected to the cloud. Add the exact redirect URL `http://127.0.0.1:3000/auth/confirm`.
4. In **Authentication → Email Templates → Reset Password**, use the contents of `supabase/templates/recovery.html`. The essential link is:

   ```html
   <a
     href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=recovery"
     >Reset password</a
   >
   ```

   This verifies a one-time token on the server and supports opening the email on another browser. The app also supports PKCE callback codes. Invalid/expired links lead to a recovery error rather than granting access.

5. Configure **custom SMTP** for dependable delivery to your own email. Supabase's built-in mail service has recipient restrictions and rate limits; use the dashboard's current guidance. Keep SMTP credentials in Supabase, not in Orbit's public environment variables.
6. In **Authentication → Users → Add user → Create new user**, create your own account with your real email and a strong password. For this manually provisioned personal account, enable email confirmation in that creation dialog so you can sign in. Do not manually create a profile row; Orbit's short onboarding does that after sign-in.

When a hosted application URL is approved in a later task, replace Site URL and Orbit's `NEXT_PUBLIC_SITE_URL` with that HTTPS origin and add its exact `/auth/confirm` redirect. Do not use broad redirect wildcards. Keep recovery email templates aligned with the selected origin.

## D. Connect the web app

Copy `.env.example` to `.env.local`, replacing the local preview settings if present:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000
```

Find the URL and **publishable key** in the project's Connect dialog or API settings. A legacy anon key is also supported. **Never use a secret/service-role key in these variables.** Normal app requests use the owner's verified session and RLS.

Stop the current preview server, then run `npm run dev`. For a production-mode preview, rebuild with the new environment using `npm run build` before `npm start`. Open http://127.0.0.1:3000, and sign in with your cloud account. Finish profile setup, then create a semester. The empty cloud workspace is expected; local test data is separate.

## E. Verify your cloud connection

- Create a semester, refresh, and sign in from a separate browser. Confirm the profile and selected semester persist.
- Archive that semester, select it from History, then restore it. Confirm the same dates and name remain.
- Request a password reset, open the delivered email, and sign in with the new password. Old passwords and used/expired recovery links must fail.
- Confirm signed-out requests redirect to sign-in.
- The automated two-user ownership tests target **local Supabase only**. Apply the identical migration to cloud; do not weaken policies there. Local verification does not prove your manual cloud setup is correct.

## Data and security notes

- One profile per Auth user. Semester ownership is derived from the verified user, never a submitted owner field.
- RLS denies access to other owners' profiles/semesters. A composite foreign key also prevents selecting another owner's semester.
- Profiles and semesters cannot be deleted through the app. Phase 3 academic deletions use explicit ownership-checked functions with revision checks. Archiving preserves history. Restoring is explicit.
- Profile edits check revisions. Semester creation uses a request UUID to prevent duplicates after retries. Related writes are transactional.
- Dates are inclusive calendar dates. Progress uses the profile timezone, clamps before/after the semester, and treats a one-day semester as valid.
- The selected archived semester remains viewable with a visible history banner. Its details are read-only. Names/dates are immutable in Phase 2; editing them was not part of this milestone.
- Production backups depend on the Supabase plan you choose. Before relying on real data, confirm its retention and restore options; take a database export before future schema changes. Never reset a cloud database to run tests.

References: [Supabase server-side auth](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [password authentication](https://supabase.com/docs/guides/auth/passwords), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## Phase 3 upgrade for an existing cloud project

The original identity migration is already applied. Follow the two new migration steps in [PHASE_3_VERIFICATION.md](PHASE_3_VERIFICATION.md); do not rerun the initial migration or reset the database. No new environment variables, services or Auth settings are required. The updated recovery template uses RedirectTo to support the isolated local test server; an existing working production template using SiteURL remains valid for the single configured production origin.

## Phase 4 upgrade for an existing cloud project

Apply only `202610030004_recurring_schedules.sql` after the existing 001–003 migrations. Follow the transaction, RLS checks and smoke-test steps in [PHASE_4_VERIFICATION.md](PHASE_4_VERIFICATION.md). No environment or Auth configuration changes are needed. Never reset the production database or reapply earlier migrations.

## Phase 5 upgrade for an existing cloud project

Apply only `202610040005_tasks.sql` after migrations 001–004. Follow the transaction, RLS checks and smoke-test steps in [PHASE_5_VERIFICATION.md](PHASE_5_VERIFICATION.md). No environment or Auth changes are required. Do not reset production or rerun earlier migrations.

## Phase 6 upgrade for an existing cloud project

Apply only `202610040006_assessments.sql` after migrations 001–005. Follow the transaction, verification and smoke-test instructions in [PHASE_6_VERIFICATION.md](PHASE_6_VERIFICATION.md). No environment, Auth or service configuration changes are required. Do not reset production or rerun earlier migrations.

## Phase 7 upgrade for an existing cloud project

Apply only `202610040007_focus.sql` after migrations 001–006. Follow the transaction, RLS checks and smoke-test instructions in [PHASE_7_VERIFICATION.md](PHASE_7_VERIFICATION.md). No environment, Auth, Realtime, scheduled-job or service configuration changes are required. Do not reset production or rerun earlier migrations.

## Phase 8 upgrade for an existing cloud project

Apply only `202610050008_notes.sql` after migrations 001–007. Follow the transaction, RLS checks and smoke-test instructions in [PHASE_8_VERIFICATION.md](PHASE_8_VERIFICATION.md). No environment, Auth, Realtime, storage or service configuration changes are required. Install the locked editor dependencies with `npm ci`. Do not reset production or rerun earlier migrations.
