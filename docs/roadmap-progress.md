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
| D | AI-assisted data entry (pluggable provider) | — | — |
| E | Whole-system audit and polish | — | — |
| F | Self-hosting runbook (prepare, do not execute) | — | — |

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

Next: **D — AI-assisted data entry**, on the same branch name restarted from `main`.

