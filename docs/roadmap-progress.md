# Roadmap progress — finish everything before moving to MIG servers

Resume with: **"Continue from docs/roadmap-progress.md"**.

Plan: parts **A → B → C → D → E → F**, one branch + one PR per part, worked
continuously; at the end of each part: self-review, full test suite, CI green,
this file updated, PR merged, next part. Stop only for: a migration that would
drop / rename / delete data, a decision that cannot be defaulted, a failure I
cannot fix, or an action only the owner can do.

- Specs: `docs/specs/inward-re-phase-2-prompt.md`, `docs/specs/inward-re-phase-3-claims-prompt.md`; parts C–F are in the master plan (summarised below).
- Business defaults taken: `docs/decisions.md`.
- Supabase project **`jltrtqwaxvsrnqmjemzc` only** (never `tci_erp`, never `mosaic-erp-production`). Migrations additive, RLS + explicit grants, numeric money, audit log on new tables, `is_demo` + demo guard on new tables, demo seed extended per part, jobs skip demo rows.
- UI: EN / RU / UZ, four themes, two text sizes, the smart search bar + filter builder on every list, Table v2 (48 px rows, no Density control, keep Columns), side panels, Excel export = what is shown, refs never fixed-width (`e2e/layout-overlap.spec.ts`).

| part | scope | branch / PR | state |
|---|---|---|---|
| A | Phase 2 premium: steps 5 (dashboard, counterparty) and 6 (self-review), merge | `claude/mga-inward-reinsurance-phase-0-1-otvuzf` / MamurS/mig-inward-re#4 | ✅ merged |
| B | Phase 3 claims (spec) | same branch name, restarted from main / MamurS/mig-inward-re#5 | ✅ merged |
| C | Binders and bordereaux | same branch name, restarted from main / MamurS/mig-inward-re#6 | ✅ merged |
| D | AI-assisted data entry (pluggable provider) | same branch name, restarted from main / MamurS/mig-inward-re#7 | ✅ merged |
| E | Whole-system audit and polish | same branch name, restarted from main / MamurS/mig-inward-re#8 | ✅ merged |
| F | Self-hosting runbook (prepare, do not execute) | same branch name, restarted from main / MamurS/mig-inward-re#9 | ✅ merged |

## A — Phase 2 steps 5–6

Steps 1–4, demo data and the Density removal: `docs/receivables-progress.md`.

- [x] Dashboard › Premium: outstanding, overdue with buckets, received this month / year, payable apart, top MGAs by overdue, most overdue with exact days; every figure opens the filtered register; no-rate count.
- [x] Counterparty page › Premium card (all roles).
- [x] `premium_default_terms_days` = 60 (migration `20261030092035_premium_default_terms`), Admin › Settings grouped (Follow-ups, Premium).
- [x] Ref overflow fix + `e2e/layout-overlap.spec.ts`; wider search bar.
- [x] e2e `premium-dashboard.spec.ts`.
- [x] Step 6 self-review: `supabase/tests/premium_review.sql` (sums, FX, overdue days, roles, demo isolation of every dashboard figure) — all pass; details in `docs/receivables-progress.md`.
- [x] Full suite green (build, vitest 77/77, Playwright 147/147); PR #4 merged.

## B — Phase 3 claims

Branch: the session's branch name, restarted from `main` after #4 merged; PR MamurS/mig-inward-re#5. Details and the self-review: `docs/claims-progress.md`.

- [x] Database: claims, append-only reserves, payments (cash / offset), recoveries; signed line at DOL; coverage check with comment; status rules; large loss; cash calls; review job; RLS per role; audit; demo integration and seed (9 demo claims). `supabase/tests/claims_rules.sql` 11/11.
- [x] Register with its search words and export; new-claim form with the coverage check; claim detail (reserve chart, payments incl. offset, recoveries, follow-ups, documents, change log).
- [x] Claims tab, counterparty claims card with both loss ratios, dashboard claims section with loss ratios by MGA / line / year.
- [x] Settings (threshold, review days), demo counts, EN / RU / UZ, mock + e2e (7), overlap and large-text checks, screenshots.
- [x] Advisor reviewed; full suite green; PR #5 merged.

## C — Binders and bordereaux

Branch: the session's branch name, restarted from `main` after #5 merged; PR MamurS/mig-inward-re#6. Details and the self-review: `docs/binders-progress.md`. Defaults: `docs/decisions.md` rows 18–26.

- [x] Database: `binders` (terms, limits per risk / aggregate, territories, frequency, due days), `binder_lobs` (per-line limits), `submissions.binder_id`, `bordereau_templates`, `bordereaux`, `bordereau_lines` (checked again on insert, duplicates refused, never changed); `import_bordereau` (premium → installment, claims → claims by the cedent's reference, risk → capacity alert at 80 / 100 %); `binder_periods`, `binders_v`, `binder_capacity_v`; daily missing-bordereau job; RLS, grants, audit, demo integration. Migration applied by the owner in the SQL editor (the MCP approval prompt did not reach them) and recorded in the history. `supabase/tests/binder_rules.sql` 7/7.
- [x] Demo seed: the Almalyk cargo binder at 85 % capacity (4 risk months, one late; 3 premium months → installments; a claims bordereau → 2 claims), the Aktau draft binder, Caspian's saved mappings.
- [x] Screens: binders register (search words, export), binder page (terms, capacity, periods grid received / late / missing, bordereaux with their lines in a side panel, premium, claims, loss ratio, follow-ups, documents, change log), binder form, upload wizard (file → mapping with saved template → line checks with comments and totals → import, original file kept), dashboard section, binder picker on the submission form.
- [x] Unit tests (`validate.test.ts`, 13), e2e `binders.spec.ts` (8), binder pages in the overlap and large-text checks.
- [x] Screenshots `docs/binders/screenshots/`; advisor reviewed; full suite green (build, vitest 93/93, Playwright 168 + 76 screenshot specs skipped); PR #6 merged.

## D — AI-assisted data entry

Branch: the session's branch name, restarted from `main` after #6 merged; PR MamurS/mig-inward-re#7. Details and the self-review: `docs/ai-progress.md`. Defaults: `docs/decisions.md` rows 27–35.

- [x] Database: settings (off by default, roles, daily limit), `ai_usage_log`, `ai_cache`, `ai_usage_v`, `ai_available()`; RLS, grants, audit, demo. `supabase/tests/ai_rules.sql` 3/3.
- [x] Edge Function `ai-extract` deployed (Anthropic `claude-haiku-5-5` default, Ollama / OpenAI-compatible alternative; strict JSON with value, confidence, source; caps, cache, daily limit, usage log).
- [x] Submission form «Fill from document» (review panel, fuzzy counterparty match, duplicate warning, marked fields, nothing saved until Save); AI mapping in the bordereau wizard; Admin › AI.
- [x] Unit tests (13), e2e `ai.spec.ts` (5), EN / RU / UZ.
- [x] Migration `demo_data_ai` (demo delete / counts cover the AI tables), run by the owner in the SQL editor (the MCP approval prompt did not reach them), verified and recorded in the history.
- [x] Advisor: nothing new (the documented definer RPCs; `ai_available` is invoker). Full suite green (build, vitest 106/106, Playwright 172 + 76 screenshot specs skipped; `feedback.spec.ts` timing passes alone — 107 ms once under full-suite load on the dev container, CI green); PR #7 merged.
- **Owner action:** set `ANTHROPIC_API_KEY` (optional `AI_PROVIDER`, `AI_MODEL`) in Supabase → Edge Functions → Secrets, then Admin › AI → switch on.

## E — Whole-system audit and polish

Branch: the session's branch name, restarted from `main` after #7 merged; PR MamurS/mig-inward-re#8. Details: `docs/audit-progress.md`.

- [x] Security: RLS on every table with policies, no `anon` grants (five views fixed, default privileges fixed), invoker views, audit log incl. reference data, storage policies, advisor reviewed. Migration `20261030150000_audit_hardening` run by the owner in the SQL editor and recorded.
- [x] Performance with 10,000 submissions (rolled back): RLS checks once per query instead of per row (agenda 3.1 s → 0.06 s, register 3.9 s → 1.0 s); register and counterparty page no longer download `search_text`.
- [x] Reconciliation `supabase/tests/reconciliation.sql`: no discrepancies. All DB rule suites pass after the RLS rewrite (rules_and_rls 52/52 — two stale checks fixed for Demo mode — demo_isolation, premium_review, claims_rules, binder_rules, ai_rules).
- [x] Accessibility: axe WCAG 2.1 A/AA on 21 pages × 2 themes (`e2e/accessibility.spec.ts`), all fixed; RU / UZ wording fixes.
- [x] User guides EN / RU / UZ for underwriter, finance, claims, management, admin (`docs/guides/`).
- [x] Design-review screenshots in Demo mode (`docs/review-screenshots/demo/`, + zip).
- [x] Full suite green; the receivables export test no longer races the filter. PR #8 merged.

## F — Self-hosting runbook (prepared, not executed)

- [x] `docs/self-hosting/`: list of Cloud dependencies and their replacements, the runbook (server, stack, database, functions, data and files, frontend, rehearsal, cut-over, operations, rollback), the cut-over checklist. Checked against the live project (Postgres 17, pg_cron jobs, the documents bucket, both Edge Functions, auth settings). No Cloud-only feature is needed.
- [x] Final report: `docs/final-report.md`; README brought up to date.

Roadmap A → F complete.
