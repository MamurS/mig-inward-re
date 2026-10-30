# Cut-over day — checklist

Prepared, not executed. Names, times and owners to be filled in by MIG IT.

**Days before**
- [ ] Server built, stack running, TLS and DNS names ready (runbook §1–3)
- [ ] Migrations applied, 4 cron jobs and the `documents` bucket present (§4)
- [ ] Both Edge Functions deployed with their secrets (§5)
- [ ] Rehearsal done end to end, issues fixed, new database wiped (§8)
- [ ] Users told the date, the time and the new address; told they will sign in again
- [ ] A fresh Cloud backup taken (dashboard → Database → Backups)

**Cut-over** (about 1–2 hours)
- [ ] Freeze: announcement sent; optional hard stop on Cloud (§6a)
- [ ] Dump auth, public, storage.objects from Cloud (§6a)
- [ ] Load with `session_replication_role = replica` (§6b)
- [ ] Copy the document files (§6c)
- [ ] Row counts match on both sides; `reconciliation.sql` returns no rows (§6d)
- [ ] Frontend built with the new API URL and anon key, served by nginx (§7)
- [ ] DNS switched; old Cloudflare Pages address shows a «moved» note or redirects

**Smoke test** (one person per role)
- [ ] Sign in: admin, underwriter, finance, claims, management
- [ ] Open a submission and download one of its documents
- [ ] Receivables and dashboard totals match the Cloud figures noted before the freeze
- [ ] Record and delete a test follow-up; upload and delete a test document
- [ ] Admin › Scheduled jobs → «Run now»
- [ ] (if AI is on) «Fill from document» reads a test slip

**After**
- [ ] Open to users
- [ ] Backups running and one restore tested (§10)
- [ ] Cloud project kept read-only for 30 days, then paused (not deleted) after sign-off
