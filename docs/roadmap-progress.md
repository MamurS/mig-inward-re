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
| A | Phase 2 premium: steps 5 (dashboard, counterparty) and 6 (self-review), merge | `claude/mga-inward-reinsurance-phase-0-1-otvuzf` / MamurS/mig-inward-re#4 | in progress |
| B | Phase 3 claims (spec) | — | — |
| C | Binders and bordereaux | — | — |
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
- [ ] Step 6 self-review (DB checks: role access, schedule vs net premium, allocations vs receipts, FX, overdue days, demo isolation of every dashboard figure); full suite; merge PR #4.
