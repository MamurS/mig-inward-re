# Final report — roadmap A → F

Date: 2026-10-30. Supabase project `jltrtqwaxvsrnqmjemzc` only. Details per
part in `docs/roadmap-progress.md`; business defaults in `docs/decisions.md`
(rows 1–35).

## What was built

| part | scope | PR | state |
|---|---|---|---|
| A | Premium: receivables dashboard, counterparty premium, self-review | MamurS/mig-inward-re#4 | merged |
| B | Claims: register, reserves, payments (cash / offset), recoveries, coverage check, large loss, cash calls, loss ratios | MamurS/mig-inward-re#5 | merged |
| C | Binders and bordereaux: binders, capacity, periods, upload wizard with checks, premium / claims / risk import | MamurS/mig-inward-re#6 | merged |
| D | AI-assisted entry: «Fill from document», AI column mapping, Admin › AI, usage log, cache, limits (pluggable: Anthropic or a local model) | MamurS/mig-inward-re#7 | merged |
| E | Audit and polish: security, 10,000-submission performance, reconciliation, accessibility, user guides EN / RU / UZ, design-review screenshots | MamurS/mig-inward-re#8 | merged |
| F | Self-hosting runbook (prepared, not executed) | this PR | — |

All along: EN / RU / UZ, four themes and two text sizes, the smart search bar
and filter builder on every list, Table v2, side panels, Excel export of what
is shown, Demo mode with its own data world, RLS with explicit grants on every
table, audit log, numeric money.

## Quality at the end

- Unit tests (Vitest) 107/107; browser tests (Playwright, offline mock) full suite green, incl. accessibility (axe, 21 pages × 2 themes) and text-overlap checks.
- Database rule suites (`supabase/tests/`), run on the live project, all rolled back: rules_and_rls 52/52, demo_isolation, premium_review, claims_rules, binder_rules, ai_rules; reconciliation: no discrepancies.
- Performance at 10,000 submissions: register 1.0 s, agenda 0.06 s, dashboard 0.16 s (`docs/audit-progress.md`).
- Security advisor: only the documented SECURITY DEFINER RPCs (each checks the role itself) and leaked-password protection (an owner setting).

## Owner actions still open

1. **AI-assisted entry** (optional): set `ANTHROPIC_API_KEY` (paid key) in Supabase → Edge Functions → Secrets, then Admin › AI → switch on. Or a local model (`AI_PROVIDER=ollama`, `OLLAMA_BASE_URL`).
2. **Leaked password protection** (optional, Cloud only): Supabase → Authentication → Password security.
3. **Before go-live with real data**: Admin › Demo data → «Delete all demo data» if the demo world is no longer wanted (it never mixes with real data, so this can also wait).
4. **Move to MIG servers**: when decided, follow `docs/self-hosting/` (runbook, checklist, list of Cloud dependencies). Nothing there has been executed.

## Known limits (deliberate, documented)

- Text search builds the normalised search text per row: 0.9 s at 10,000 submissions. A stored, indexed search column is the next step if the register grows far beyond that.
- Registers load up to 5,000 rows into the browser (the cap is shown when reached).
- Three migrations (binders, demo cleanup for the AI tables, audit hardening) were run by the owner in the SQL editor because the tool's approval prompt did not reach them; each was verified and recorded in the migration history.
- Browser tests run against an offline mock of Supabase; the database rules are covered by the SQL suites against the live project.
