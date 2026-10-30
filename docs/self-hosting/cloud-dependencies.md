# What the app uses today, and what replaces it on MIG's servers

Checked on the live project on 2026-10-30.

## Supabase services

| piece | used for | today (Cloud) | self-hosted replacement | notes |
|---|---|---|---|---|
| PostgreSQL 17 | all data, rules (triggers, RLS), jobs | managed | `supabase/postgres` 17.x image (same major version) | 31 migrations in `supabase/migrations/` build everything |
| pg_cron 1.6 | 4 daily jobs (follow-ups, premium, claims, bordereaux) at 03:15–03:25 UTC (08:15–08:25 Tashkent) | managed | included in the `supabase/postgres` image | jobs are created by the migrations; `cron.database_name = postgres` |
| pgcrypto, uuid-ossp | ids, hashes | extensions | included | |
| pg_stat_statements | query statistics only | extension | included | optional |
| supabase_vault | not used by the app | installed by default | included | nothing to move |
| PostgREST | the app's data API (`/rest/v1`) | managed | `rest` container | exposed schema `public` only; max rows 5000 |
| GoTrue (Auth) | email + password sign-in; admin creates users | managed | `auth` container | self sign-up **off**; no confirmation e-mails; no OAuth, no magic links, no SMS |
| Storage | `documents` bucket (private, 50 MB per file) | managed (S3 behind) | `storage` container, file system or S3-compatible (MinIO) backend | files must be copied (runbook step 6) |
| Edge Functions | `admin-users` (create logins, set passwords — service role), `ai-extract` (AI-assisted entry) | managed Deno | `functions` container (Supabase Edge Runtime) | both `verify_jwt = true`; secrets as container environment |
| Realtime | not used | — | can be left out of the compose file | |
| Kong API gateway | one URL for all services | managed | `kong` container | |
| Studio (dashboard, SQL editor) | admin by IT | managed | `studio` container — put behind VPN / basic auth | |
| Security advisor | lint of RLS / grants | Cloud only | run `supabase db lint` or the open-source splinter lints manually | not needed at runtime |
| Leaked password protection (HIBP) | — (switched off) | Cloud only | not available; keep the 10-character minimum for temporary passwords | |
| Backups / PITR | daily backups | Cloud | **MIG IT**: nightly `pg_dump` + WAL archiving, copy of the storage volume | see runbook §10 |
| TLS, DNS | `*.supabase.co` | Cloud | MIG's reverse proxy (nginx / Traefik) with MIG certificates | |
| Logs, metrics | Cloud log explorer | Cloud | container logs (`docker compose logs`), optional Grafana / Loki | |

## Frontend

| piece | today | self-hosted | notes |
|---|---|---|---|
| static site (`npm run build` → `dist/`) | Cloudflare Pages, preview per branch | any web server (nginx) serving `dist/` with SPA fallback to `index.html` | build-time variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, optional `VITE_LOGIN_PHOTO` |
| fonts | bundled (Inter, PT Sans Narrow via fontsource) | same | no external CDN at runtime |

## Outside services

| service | used by | needed on-premises? |
|---|---|---|
| Anthropic API (`claude-haiku-5-5`) | `ai-extract`, only when AI is switched on | outbound HTTPS to `api.anthropic.com`, **or** switch to a local model: `AI_PROVIDER=ollama`, `OLLAMA_BASE_URL` (any OpenAI-compatible server) |
| E-mail (SMTP) | not used (no confirmation or reset e-mails) | no |
| GitHub | source code, CI | build can run anywhere with Node 22 |

## Secrets and settings to carry over

| name | where | value on the new server |
|---|---|---|
| `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY` | docker `.env` | **new** values (generate); everyone signs in again once |
| `POSTGRES_PASSWORD`, `DASHBOARD_USERNAME/PASSWORD` | docker `.env` | new |
| `SITE_URL`, `API_EXTERNAL_URL`, `SUPABASE_PUBLIC_URL` | docker `.env` | MIG's URLs |
| `DISABLE_SIGNUP=true`, `ENABLE_EMAIL_AUTOCONFIRM=true`, `ENABLE_EMAIL_SIGNUP=true` | docker `.env` | as written (sign-in by e-mail + password, no self sign-up) |
| `PGRST_DB_SCHEMAS=public` | docker `.env` | as written |
| `AI_PROVIDER`, `AI_MODEL`, `ANTHROPIC_API_KEY` / `OLLAMA_BASE_URL`, `OLLAMA_API_KEY` | `functions` service environment | copy from Cloud function secrets (or the new local model) |
| app settings (`settings` table: follow-up days, thresholds, AI switch, roles, limit) | database | come across with the data |
