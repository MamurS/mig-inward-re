# MIG Inward Reinsurance (MGA) System

Internal system for Mosaic Insurance Group (Tashkent) to register, assess, offer and track
inward reinsurance shares from MGA partners. CEO dashboard for all MGA business.

> Status: **Phase 0–1, Step 2** — database: reference data, submissions, status machine, follow-ups, documents, audit, RLS, demo data. UI pages come in Steps 3–5.

## Stack

React + TypeScript + Vite · Tailwind v4 + shadcn/ui · TanStack Query · React Hook Form + Zod ·
Recharts · i18next · Supabase (Postgres, Auth, Storage, RLS, pg_cron) · Cloudflare Pages.

## Supabase project

| | |
|---|---|
| Project name | `mig-inward-re` |
| Project ref | `jltrtqwaxvsrnqmjemzc` |
| URL | `https://jltrtqwaxvsrnqmjemzc.supabase.co` |

**Never** apply migrations to `tci_erp` (`reunqrpeumokqgarknge`) or `mosaic-erp-production` (`onppnfyoffhyaxemsqoz`).

All database structure lives in `supabase/migrations/*.sql`, applied in filename order.
Nothing depends on dashboard-only settings, so the same files can rebuild the database on a
self-hosted Supabase.

## Database (Phase 0–1)

Migrations in `supabase/migrations/` (apply in filename order):

| File | Contents |
|---|---|
| `…_auth_roles.sql` | roles enum, `profiles`, role helpers, `admin_update_user()` |
| `…_reference_data.sql` | `currencies`, `countries`, `lines_of_business`, `counterparties`, `fx_rates`, `settings` (+ base data) |
| `…_core_submissions.sql` | `submissions`, `submission_status_history`, `follow_ups`, `documents`, `audit_log`, view `submissions_v`, RLS, grants |
| `…_status_machine.sql` | `change_submission_status()` — the only way to change a status |
| `…_storage_documents.sql` | private Storage bucket `documents` + access rules |
| `…_policy_tuning.sql` | RLS performance tuning, extra indexes |

Conventions: money `numeric(18,2)`, shares / percentages `numeric(9,6)` stored as percent (12.5 = 12.5 %),
every amount keeps its own currency; USD via `fx_rates` (rate on the bound date, otherwise the received date).
`follow_ups` and `documents` are generic (`entity_type` + `entity_id`) so premium, claims and bordereaux phases reuse them.

### Status machine (enforced in the database)

```
received → under_review → declined | offered
offered → bound | ntu | no_response
no_response → bound | ntu        (late answer)
```

- `offered` needs written share > 0 and an "offer valid until" date; creates a follow-up after `follow_up_first_days`.
- `bound` needs signed share > 0 and ≤ written share; a confirmation document can be attached.
- `declined` / `ntu` need a reason.
- Every change is written to `submission_status_history`; open reminders close automatically on bound / NTU / declined / no response.
- A direct `UPDATE … SET status` is rejected — only `change_submission_status()` may change it.

### Calculated figures (`submissions_v`)

share = signed share if bound, else written share ·
our gross premium = gross premium 100 % × share ·
commission and brokerage = % of our gross · our net = gross − commission − brokerage · USD equivalents.

### Demo data

`supabase/seed.sql` adds 3 MGAs, 2 brokers, monthly FX rates and 22 submissions across all statuses
(rows marked `DEMO`). Remove before go-live with `supabase/demo_cleanup.sql`.

### Checks

`supabase/tests/rules_and_rls.sql` — 34 checks of the status rules and per-role access; runs in a
transaction and rolls back. Paste into the SQL editor: every row must say PASS.

## Roles

| Role | Can do |
|---|---|
| `admin` | Everything; manages users, reference data, settings |
| `underwriter` | Create / edit submissions, follow-ups, documents |
| `finance` | Read |
| `claims` | Read |
| `management` | Read everything + CEO dashboard |

A new login has **no role** and sees only a "waiting for access" page until an admin assigns one.
Access is enforced in the database (RLS), not only in the UI.

## Creating users (for now)

1. Supabase Dashboard → **Authentication → Users → Add user → Create new user**
   (email + password, tick "Auto confirm user").
2. Give the user a role. For the **first admin** run in the SQL editor:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@mig.uz';
   ```
   After that, admins assign roles from the Admin page (built in a later step).

Self sign-up should stay **off** (Authentication → Sign In / Providers → "Allow new users to sign up" = off).
For self-hosted Supabase the same is set by `enable_signup = false` in `supabase/config.toml` / `GOTRUE_DISABLE_SIGNUP=true`.

## Cloudflare Pages

| Setting | Value |
|---|---|
| Framework preset | Vite |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` |
| Env var `VITE_SUPABASE_URL` | `https://jltrtqwaxvsrnqmjemzc.supabase.co` |
| Env var `VITE_SUPABASE_ANON_KEY` | the project's anon / publishable key |

Only the anon / publishable key goes in the frontend — **never** the `service_role` key.
Cloudflare Pages serves `index.html` for unknown paths automatically (no `404.html` in the build),
so deep links like `/submissions` work.

Also add the Pages URL to Supabase → Authentication → URL Configuration → Site URL / Redirect URLs.

## Local development

```bash
cp .env.example .env.local   # fill in the anon key
npm install
npm run dev
```
