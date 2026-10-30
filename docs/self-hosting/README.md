# Self-hosting — moving MIG Inward Re to MIG's own servers

**Status: prepared, not executed.** Nothing here has been run. The app runs on
Supabase Cloud (project `jltrtqwaxvsrnqmjemzc`) and Cloudflare Pages today.

| file | what it is for |
|---|---|
| [cloud-dependencies.md](cloud-dependencies.md) | Everything the app uses from Supabase Cloud and Cloudflare, and its self-hosted replacement |
| [runbook.md](runbook.md) | Step by step: build the server, apply the database, move the data and files, deploy functions and the frontend, cut over, verify, roll back |
| [checklist.md](checklist.md) | The cut-over day on one page, to tick off |

Short version: the app uses only open-source Supabase pieces (Postgres 17 with
pg_cron, PostgREST, GoTrue auth, Storage, Edge Runtime, Studio) and a static
frontend. No Cloud-only feature is needed; what Cloud gives for free
(backups, TLS, monitoring, the advisor) has to be set up by MIG IT.
