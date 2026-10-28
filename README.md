# MIG Inward Reinsurance (MGA) System

Internal system for Mosaic Insurance Group (Tashkent) to register, assess, offer and track
inward reinsurance shares from MGA partners. CEO dashboard for all MGA business.

> Status: **Phase 0–1, Step 1** — app shell, login, roles, EN/RU/UZ, layout. Pages are built in later steps.

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
