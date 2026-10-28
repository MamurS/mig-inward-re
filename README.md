# MIG Inward Reinsurance (MGA) System

Internal system for Mosaic Insurance Group (Tashkent) to register, assess, offer and track inward
reinsurance shares from MGA partners, with a CEO dashboard of all MGA business.

**Phase 0–1 (done):** submissions register, form and detail page, status machine, documents,
follow-ups with a daily job, My agenda, CEO dashboard, counterparty (MGA / broker) pages, admin,
EN / RU / UZ.
**Later phases (designed for, not built):** premium & installments (2), claims (3), binders &
bordereaux (4), AI email parsing (5).

---

## 1. Stack

React + TypeScript + Vite · Tailwind v4 + shadcn/ui · TanStack Query · React Hook Form + Zod ·
Recharts · i18next · Supabase (Postgres, Auth, Storage, RLS, pg_cron, one edge function) ·
Cloudflare Pages.

```
src/
  features/submissions     register, form, detail, status dialog, Excel export
  features/followups       agenda page, follow-up dialogs
  features/dashboard       CEO dashboard
  features/counterparties  list + MGA / broker page
  features/admin           users, reference data, FX, settings, jobs
  features/documents       generic documents panel (any entity type)
  lib/decimal.ts           exact money maths (same formulas as the database view)
  locales/{en,ru,uz}.json
supabase/
  migrations/              ALL database structure, applied in filename order
  functions/admin-users/   create logins / set passwords (server-side, admin only)
  seed.sql                 demo data · demo_cleanup.sql removes it
  tests/rules_and_rls.sql  status rules, per-role access, calculations (rolls back)
```

## 2. Supabase project

| | |
|---|---|
| Project name | `mig-inward-re` |
| Project ref | `jltrtqwaxvsrnqmjemzc` |
| URL | `https://jltrtqwaxvsrnqmjemzc.supabase.co` |

**Never** apply migrations to `tci_erp` (`reunqrpeumokqgarknge`) or `mosaic-erp-production` (`onppnfyoffhyaxemsqoz`).

The project has *"Automatically expose new tables"* **disabled**. Every migration therefore grants
access explicitly: `authenticated` gets only what the app needs (often column-level), `anon` gets
nothing, `service_role` (server-side only) gets full access. A missing grant shows in the app as
"permission denied".

### Database at a glance

| Area | Objects |
|---|---|
| Users & roles | `profiles` (role NULL = no access), `auth_role()`, `has_role()`, `admin_update_user()` |
| Reference | `currencies`, `countries`, `lines_of_business` (EN/RU/UZ names), `counterparties` (MGA / broker / cedent, contacts), `fx_rates`, `settings` |
| Core | `submissions`, `submission_status_history` (append-only), `follow_ups`, `documents`, `audit_log`, `job_runs` |
| Views | `submissions_v` (our share figures, USD), `follow_ups_v` (agenda) |
| Logic | `change_submission_status()`, `run_daily_follow_ups()` (pg_cron 03:15 UTC = 08:15 Tashkent) |
| Storage | private bucket `documents`, path `<entity_type>/<entity_id>/<uuid>-<file>` |

Conventions: money `numeric(18,2)`, shares / percentages `numeric(9,6)` stored as percent
(12.5 = 12.5 %); every amount keeps its currency; USD via `fx_rates` (rate on the bound date,
otherwise the received date; latest rate on or before that date).
`follow_ups` and `documents` are generic (`entity_type` + `entity_id`) — premium, claims and
bordereaux phases add an enum value and reuse them, including the daily job and the agenda.

### Status machine (enforced in the database)

```
received → under_review → declined | offered
offered → bound | ntu | no_response
no_response → bound | ntu        (late answer)
```

- `offered` needs written share > 0 and "offer valid until"; creates a follow-up after `follow_up_first_days`.
- `bound` needs signed share > 0 and ≤ written share; the app asks for a confirmation document (which then can't be deleted).
- `declined` / `ntu` need a reason. Every change is written to the status history.
- A direct `UPDATE … SET status` is rejected — only `change_submission_status()` changes status.

### Calculations (`submissions_v`, mirrored exactly in `src/lib/decimal.ts`)

share = signed if bound, else written · our gross = gross 100 % × share ·
commission / brokerage = % of our gross · our net = gross − commission − brokerage ·
all rounded to cents (half away from zero) · USD = amount × FX rate.

### Daily job

For offered submissions without an open follow-up it creates the next one
(`follow_up_repeat_days` after the last closed one); it adds one "offer validity has passed"
follow-up per expired offer; if `auto_no_response_enabled`, offers older than
`auto_no_response_days` move to "No response". Admin → Scheduled jobs shows every run and has
"Run now".

## 3. Roles

| Role | Can do |
|---|---|
| `admin` | Everything; users, reference data, FX, settings, jobs |
| `underwriter` | Create / edit submissions, status changes, documents, follow-ups, add / edit counterparties |
| `finance` | Read everything; close follow-ups assigned to them (premium phase will add write access) |
| `claims` | Read everything; close follow-ups assigned to them (claims phase will add write access) |
| `management` (CEO) | Read everything + CEO dashboard + anyone's agenda + job log |

A login without a role sees only "waiting for access". All rules are enforced by RLS in the database.

## 4. Users

**Normal way — Admin page → Users & roles → New user:** enter email, name, role; the app proposes
a temporary password (≥ 10 characters). Give email + password to the person; they sign in at once.
"Set new password" (key icon) resets a forgotten password.
People who leave are **deactivated** (untick *Active*), not deleted — their name stays on their work.

**First admin / fallback (SQL editor):** create the user in Supabase → Authentication → Users →
*Add user* (tick *Auto confirm*), then

```sql
update public.profiles set role = 'admin' where email = 'you@mig.uz';
```

Recommended Auth settings (Supabase dashboard → Authentication):
- *Sign In / Providers → Allow new users to sign up* = **off** (internal system).
- *Attack Protection → Leaked password protection* = on (if your plan allows).
- *URL Configuration*: Site URL = the Cloudflare Pages URL.

The `admin-users` edge function uses the `service_role` key on the server only. Redeploy it after
changes with `supabase functions deploy admin-users` (or the Supabase dashboard).

## 5. Cloudflare Pages

| Setting | Value |
|---|---|
| Framework preset | Vite |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` |
| Env var `VITE_SUPABASE_URL` | `https://jltrtqwaxvsrnqmjemzc.supabase.co` |
| Env var `VITE_SUPABASE_ANON_KEY` | the project's anon / publishable key |

Only the anon / publishable key goes in the frontend — **never** the `service_role` key.
Pages serves `index.html` for unknown paths (no `404.html` in the build), so deep links work.
`main` is the production branch; every other branch gets a preview URL.

## 6. Demo data

`supabase/seed.sql`: 3 MGAs, 2 brokers, monthly demo FX rates, 22 submissions across all statuses
(rows marked `DEMO` / source `demo`). **Before go-live** run `supabase/demo_cleanup.sql` in the
SQL editor and enter real FX rates (Admin → FX rates).

## 7. Checks

`supabase/tests/rules_and_rls.sql` — paste into the SQL editor and run. It works inside a
transaction that is rolled back (nothing changes) and returns one row per check — all must be PASS:
status rules, follow-up rules, append-only history, delete protections, per-role access
(underwriter / finance / management / no role / anonymous) for tables, views, functions and
Storage, and a recomputation of every submission's figures against the view.
Local checks: `npm run build` (type-check + build).

## 8. Moving to MIG's own servers (self-hosted Supabase)

Nothing depends on Supabase Cloud-only features. Steps:

1. **Install self-hosted Supabase** (official Docker setup: `supabase/docker`). Set
   `GOTRUE_DISABLE_SIGNUP=true`, and the site URL to the new app address.
2. **Database — structure from this repo, data from the old project** (keeps users, passwords, IDs):
   ```bash
   # old (Cloud) project — connection string from Settings → Database
   pg_dump "$OLD_DB_URL" --schema=public --schema=auth --schema=storage \
     --no-owner --no-privileges --data-only -Fc -f data.dump
   # new server: create the structure from supabase/migrations, then load the data
   supabase db push --db-url "$NEW_DB_URL"
   pg_restore --data-only --disable-triggers -d "$NEW_DB_URL" data.dump
   ```
   (`--disable-triggers` stops the audit / history triggers from firing while loading.)
   A full `pg_dump` / `pg_restore` of the whole database also works between Supabase
   installations with the same major Postgres version.
3. **Storage files:** copy every object of the `documents` bucket keeping the same paths
   (`submission/<id>/<file>`) — e.g. `rclone` between the two S3-compatible endpoints
   (Cloud: Settings → Storage → S3 access keys), or a small script using the Storage API
   (`list` + `download` from the old project, `upload` to the new one). The `documents` table
   already holds the paths, so nothing else changes.
4. **pg_cron:** the migration schedules `daily-follow-ups` automatically when the extension exists;
   check with `select * from cron.job;`.
5. **Edge function:** `supabase functions deploy admin-users` against the new instance (or copy
   `supabase/functions/admin-users` into the self-hosted `volumes/functions` folder).
6. **Frontend:** point `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` at the new instance and
   rebuild (Cloudflare Pages or any static web server serving `dist/`).
7. Run `supabase/tests/rules_and_rls.sql` on the new database — all checks must pass.

## 9. Local development

```bash
cp .env.example .env.local   # fill in the anon key
npm install
npm run dev
```
