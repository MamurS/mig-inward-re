# Part E — whole-system audit and polish: what was checked and fixed

Scope: the master plan, part E — security, reconciliation, performance
(10,000 submissions, then removed), UX and accessibility, user guides.
Supabase project `jltrtqwaxvsrnqmjemzc` only.

## Security

Checked on the live database:

| check | result |
|---|---|
| RLS on every table | ✅ every table in `public` has RLS on and at least one policy |
| grants to `anon` | ❌ → ✅ five newer views (`ai_usage_v`, `binder_capacity_v`, `binders_v`, `claim_payments_v`, `claims_v`) carried TRUNCATE / TRIGGER / REFERENCES for `anon` and `authenticated` from Supabase's default privileges. No data reachable (views cannot be truncated; RLS applies), but revoked, and the default privileges for new tables fixed |
| functions executable by `anon` | ✅ none |
| views | ✅ all `security_invoker` |
| audit log on every business table | ✅; added to the reference data too (countries, currencies, FX rates, lines of business) |
| `is_demo` + demo guard | ✅ on every business table (reference data, settings, profiles, logs are shared by design) |
| storage policies | ✅ documents bucket: read for active users, write per entity, delete own or admin |
| security advisor | the documented SECURITY DEFINER RPCs (each checks the role itself) and «leaked password protection» (owner setting in Supabase Auth) |
| secrets | ✅ none in the repo or the frontend; AI key only in Edge Function secrets |

Migration `20261030150000_audit_hardening` (run by the owner in the SQL
editor — the MCP approval prompt did not reach them — then recorded in the
history).

## Performance — 10,000 submissions

Each run inserted 10,000 submissions (+ 10,000 follow-ups) inside a block that
always ends in an error, so nothing was kept; timings as an admin through RLS.

| query | before | after |
|---|---|---|
| register (5,000 rows, all columns) + count | 3.9 s | 1.0 s |
| register filtered by text | 2.1 s | 0.9 s |
| dashboard by status | 0.9 s | 0.16 s |
| agenda (5,000 overdue) | 3.1 s | 0.06 s |
| quick search (top bar) | — | 0.03 s |

Two causes, both fixed:

1. **RLS checks ran once per row.** 72 policies called `is_app_user()` /
   `auth_role()` / `has_role(…)` bare (≈ 0.08 ms each, per row, per table).
   Rewritten as `(select …)`: Postgres evaluates them once per query. Same
   rules — all DB rule suites pass unchanged (below).
2. **The register downloaded `search_text`**, which only serves the search
   filter and is the dearest column to build. The register, its export and
   the counterparty page now select `LIST_COLUMNS` (every other column; a unit
   test keeps it in step with the view).

Left as is (fine at the expected volume): a text search still builds
`search_text` per row (0.9 s at 10,000); a stored, indexed search column is
the next step if the register grows far beyond that.

## Reconciliation

`supabase/tests/reconciliation.sql` (read-only): installment net = gross −
deductions; allocations never above the installment or the receipt; status
follows the allocations; bound schedules = signed net premium; claim payments
in the claim currency; outstanding never negative, zero on closed / declined
claims; bordereau line counts and totals as imported; installments created by
bordereaux exist. **Live data: no discrepancies.**

DB rule suites re-run after the RLS rewrite (each rolls back):
`demo_isolation` 8/8, `premium_review` 5/5, `claims_rules` 11/11,
`binder_rules` 7/7, `ai_rules` 3/3, `rules_and_rls` (see roadmap).

## Accessibility and UX

`e2e/accessibility.spec.ts`: axe-core, WCAG 2.1 A + AA, 21 pages (every
register, detail page, form and admin tab, the login) × 2 themes — 43 checks.
Found and fixed:

- unlabelled controls: dashboard period, admin users (name, role, active),
  reference-data rows, FX currency (a `Field` wrapping its control in a sizing
  `div` lost the label link);
- `aria-sort` on the sort button → on the column header;
- table scroll boxes not reachable by keyboard → focusable, with a focus ring;
- the reserve chart: `role="img"` with its name;
- the loss-ratio `dl` holding a paragraph.

Colour contrast passed in both themes. Wording fixed where the translators
found ambiguity: RU «Возмещение» meant both indemnity and recoveries (now
«Страховое возмещение» / «Взыскания»), RU auto-allocate, UZ «Insured» on the
bordereau fields read «insurer».

## User guides

`docs/guides/` — underwriter, finance, claims, management and admin, each in
EN / RU / UZ, with the app's exact labels (taken from the locale files).
