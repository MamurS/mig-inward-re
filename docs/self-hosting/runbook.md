# Runbook — MIG Inward Re on MIG's own servers

**Prepared, not executed.** Read it end to end before starting; do steps 1–5
and the rehearsal (step 8) days before the cut-over.

- Source: Supabase Cloud project `jltrtqwaxvsrnqmjemzc` (+ Cloudflare Pages).
- Target: one Linux server (or VM) at MIG running the open-source Supabase stack in Docker, plus nginx for the frontend.
- Never point any of this at `tci_erp` (`reunqrpeumokqgarknge`) or `mosaic-erp-production` (`onppnfyoffhyaxemsqoz`).
- Downtime: the cut-over (step 9) needs about 1–2 hours without writes.

## 1. Server

- Ubuntu 24.04 LTS (or RHEL 9), 4 vCPU, 16 GB RAM, 200 GB SSD to start (database + document files; the documents bucket grows with uploads, 50 MB per file at most).
- Docker Engine + Docker Compose plugin, `git`, `psql` 17 client, `rclone` (file copy), Node 22 (frontend build) — or build the frontend elsewhere.
- Firewall: 443 open to MIG users (frontend + API through the reverse proxy); 5432 and Studio (3000) **not** exposed — admin access over VPN only.
- Outbound: `api.anthropic.com:443` only if AI-assisted entry stays on the Anthropic provider.
- MIG DNS names, e.g. `inwardre.mig.uz` (frontend) and `api.inwardre.mig.uz` (Supabase API), with MIG TLS certificates.

## 2. Supabase stack

```bash
git clone --depth 1 https://github.com/supabase/supabase
cp -r supabase/docker /opt/inwardre && cd /opt/inwardre
cp .env.example .env
```

In `/opt/inwardre/.env`:

1. Generate new secrets: `POSTGRES_PASSWORD`, `JWT_SECRET` (≥ 32 characters), then `ANON_KEY` and `SERVICE_ROLE_KEY` signed with that `JWT_SECRET` (the Supabase self-hosting guide has the generator), `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD`, `SECRET_KEY_BASE`, `VAULT_ENC_KEY`.
2. URLs: `SITE_URL=https://inwardre.mig.uz`, `API_EXTERNAL_URL=https://api.inwardre.mig.uz`, `SUPABASE_PUBLIC_URL=https://api.inwardre.mig.uz`.
3. Auth: `DISABLE_SIGNUP=true`, `ENABLE_EMAIL_SIGNUP=true`, `ENABLE_EMAIL_AUTOCONFIRM=true`, `ENABLE_PHONE_SIGNUP=false`, `ENABLE_ANONYMOUS_USERS=false`, `JWT_EXPIRY=3600`.
4. API: `PGRST_DB_SCHEMAS=public`.
5. Pin the image versions in `docker-compose.yml` (no `latest`) and make sure the `db` image is a **Postgres 17** `supabase/postgres` tag (the Cloud project is 17.x).
6. Storage: keep the file backend (`/opt/inwardre/volumes/storage`) or point it at MIG's S3-compatible store (MinIO); file size limit 50 MB.
7. Remove the `realtime` service if you like (not used); keep `studio` but only reachable over VPN.

Start: `docker compose pull && docker compose up -d`, then check every container is healthy (`docker compose ps`).

## 3. Reverse proxy

nginx (or Traefik) in front:

- `api.inwardre.mig.uz` → `http://127.0.0.1:8000` (Kong), with `client_max_body_size 60m` (documents up to 50 MB, AI uploads up to 8 MB as base64).
- `inwardre.mig.uz` → the frontend (step 7).

## 4. Database structure

The 31 files in `supabase/migrations/` are the whole structure (tables, rules, RLS, grants, views, functions, cron jobs, audit, demo guard). Apply them **in filename order** to the new, empty database:

```bash
export DB="postgres://postgres:${POSTGRES_PASSWORD}@127.0.0.1:5432/postgres"
for f in supabase/migrations/*.sql; do
  echo ">> $f"; psql "$DB" -v ON_ERROR_STOP=1 -f "$f" || break
done
```

(or `supabase db push --db-url "$DB"`, which also fills `supabase_migrations.schema_migrations`.)

Then check:

- `select jobname, schedule from cron.job;` → 4 jobs (`daily-follow-ups`, `daily-premium-follow-ups`, `daily-claim-follow-ups`, `daily-bordereau-follow-ups`), times in UTC.
- `select id, public, file_size_limit from storage.buckets;` → `documents`, private, 52428800.
- No table without RLS, no grants to `anon` (queries in `docs/audit-progress.md`).

The migrations also insert the reference data defaults (currencies, countries, lines of business, settings). Those rows are **replaced** by the Cloud data in step 6 (`truncate` first, see there).

## 5. Edge Functions

Copy both functions into the stack's functions volume and give them their secrets:

```bash
cp -r supabase/functions/admin-users supabase/functions/ai-extract /opt/inwardre/volumes/functions/
```

In `docker-compose.yml`, `functions` service → `environment`:

```yaml
AI_PROVIDER: anthropic          # or: ollama
AI_MODEL: claude-haiku-5-5      # or the local model name
ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
# OLLAMA_BASE_URL: http://ollama.mig.local:11434
# OLLAMA_API_KEY: ...
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are already passed to the functions container by the stock compose file. JWT verification stays on (the stock `functions` service verifies JWTs unless `VERIFY_JWT=false`). Restart: `docker compose up -d functions`.

## 6. Data and files (rehearse first — step 8)

### 6a. Freeze and dump from Cloud

1. Announce the window; ask users to stop. (Optional hard stop: in the Cloud SQL editor, `revoke insert, update, delete on all tables in schema public from authenticated;` — re-grant on rollback.)
2. Get the direct connection string from the Cloud dashboard (Project settings → Database), then:

```bash
export CLOUD="postgres://postgres:<password>@db.jltrtqwaxvsrnqmjemzc.supabase.co:5432/postgres"
pg_dump "$CLOUD" --data-only --no-owner --no-privileges \
  --table='auth.users' --table='auth.identities' -f auth.sql
pg_dump "$CLOUD" --data-only --no-owner --no-privileges --schema=public -f public.sql
pg_dump "$CLOUD" --data-only --no-owner --no-privileges --table='storage.objects' -f storage_objects.sql
```

### 6b. Load into the new database

Triggers must **not** fire during the load (they would re-number references, write audit rows, refuse demo / status changes): load with `session_replication_role = replica`.

```bash
psql "$DB" -v ON_ERROR_STOP=1 <<'SQL'
begin;
set session_replication_role = replica;
-- the migrations' default reference rows are replaced by the Cloud rows
truncate public.settings, public.currencies, public.countries, public.lines_of_business cascade;
\i auth.sql
\i public.sql
\i storage_objects.sql
commit;
SQL
```

(`pg_dump --data-only` restores sequence values too: audit log ids, job runs. The auth dump uses column lists, so the new server's auth version must be the same or newer than Cloud's — check `select max(version) from auth.schema_migrations` on both sides.)

### 6c. Document files

The `storage.objects` rows only describe files; copy the files themselves. Cloud Storage has an S3-compatible endpoint (Project settings → Storage → S3 access keys):

```bash
rclone copy cloud:documents /opt/inwardre/volumes/storage/stub/stub/documents   # file backend
# or: rclone copy cloud:documents mig-minio:documents                            # S3 backend
```

(The exact on-disk layout of the file backend depends on the storage image version — check with one test upload before the copy.)

### 6d. Compare

On both sides, row counts per table must match:

```sql
select relname, n_live_tup from pg_stat_user_tables where schemaname = 'public' order by 1;
select count(*) from auth.users;  select count(*) from storage.objects;
```

(run `analyze;` first on the new side), then run `supabase/tests/reconciliation.sql` on the new database: no rows = all figures agree.

## 7. Frontend

```bash
VITE_SUPABASE_URL=https://api.inwardre.mig.uz \
VITE_SUPABASE_ANON_KEY=<new ANON_KEY> \
npm ci && npm run build          # → dist/
```

nginx site for `inwardre.mig.uz`: serve `dist/`, `try_files $uri /index.html;` (single-page app), long cache for `/assets/*`, no cache for `index.html`. Use the **anon** key only — never the service-role key in the frontend.

## 8. Rehearsal (before the real day)

Do steps 6a–6d with a fresh dump **without** freezing, on the new server, and:

- sign in with three real accounts (passwords carry over — GoTrue keeps the bcrypt hashes);
- open a submission, its documents (download one), the receivables, a claim, a binder and its bordereaux;
- run the DB test files in `supabase/tests/` (each rolls back; see their headers);
- Admin › Scheduled jobs: «Run now» for the daily follow-ups;
- if AI is used: Admin › AI shows it on, «Fill from document» reads a slip.

Then wipe the new database (`docker compose down -v` + steps 2, 4, 5) ready for the real run.

## 9. Cut-over day

See [checklist.md](checklist.md). Order: freeze → dump (6a) → load (6b) → files (6c) → compare (6d) → frontend points to the new API (7) → DNS → smoke test → open to users. Keep the Cloud project untouched (read-only) for at least 30 days.

## 10. Running it afterwards (MIG IT)

- **Backups**: nightly `pg_dump -Fc` of the whole database to another machine, 30 days kept; WAL archiving (e.g. pgBackRest / wal-g) if point-in-time recovery is wanted; nightly copy of the storage volume (or MinIO replication). Test a restore every quarter.
- **Updates**: Supabase images monthly (read the changelog; stay on Postgres 17 until a planned upgrade); OS patches.
- **Jobs**: `select * from cron.job_run_details order by start_time desc limit 20;` and Admin › Scheduled jobs show the daily runs.
- **New migrations**: apply in filename order with `psql -f` (or `supabase db push --db-url`); never edit an applied one.
- **Monitoring**: container health, disk space (database + storage volume), certificate expiry.
- **Lints**: `supabase db lint --db-url "$DB"` after each migration (replaces the Cloud security advisor).

## 11. Rollback

Until users start writing on the new server, rollback is instant: point DNS / the frontend back to Cloudflare Pages and the Cloud API, re-grant writes on Cloud if they were revoked (`grant insert, update, delete on all tables in schema public to authenticated;` — then re-run the original column-level grants from the migrations if any were narrower; or skip the hard stop in 6a and rely on the announcement). After users have written on the new server, moving back means dumping from the new server into Cloud the same way.
