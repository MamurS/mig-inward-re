# Phase 3 — Claims: what was built and the self-review

Spec: `docs/specs/inward-re-phase-3-claims-prompt.md`. Defaults for its open
assumptions: `docs/decisions.md` (rows 10–17). Supabase project
`jltrtqwaxvsrnqmjemzc` only.

## Database

Migrations (additive): `20261030094838_claims_enums`, `20261030095433_claims`,
`…_seed_demo_claims`, `…_claim_movement_fix`.

- **`claims`** — `CLM-YYYY-0001` (demo `DEMO-CLM-…`, own counter), the bound risk, notified date, date of loss, cause, location, description, the cedent's reference (unique per risk — bordereaux will match on it), currency, estimate at 100 %, **our share = the signed line on the date of loss** (snapshot from the status history: the last line signed on or before that day), status, decline reason, close comment, handler, large-loss mark, coverage issues + comment.
- **`claim_reserves`** — append-only movements (our share, claim currency): never updated or deleted, a correction is a new movement.
- **`claim_payments`** — our share paid: indemnity / expense / cash call; cash, or **offset against premium**: `create_claim_payment()` records a receipt from the MGA for the same amount and allocates it to the MGA's open installments with the receipts' own rules (caps, a rate across currencies), in full, all or nothing. Finance (and admin) only.
- **`claim_recoveries`** — salvage / subrogation / other (append-only).
- **Rules (trigger):** coverage check on create and when the date of loss or currency changes — not bound, no period, before inception, after expiry, a future date, another currency: **warn and require a comment, never silent**; status transitions notified → open / declined, open / reopened → closed / declined, closed / declined → reopened; decline needs a reason; close with money outstanding needs a comment; no reserve or payment on a closed or declined claim; payments in the claim currency.
- **Large loss:** setting `large_loss_threshold_usd` (250,000): our share (the larger of estimate and reserves) in USD at today's rate ≥ threshold → the claim is marked (sticky; users cannot set or clear it) and **management and admin** each get a `large_loss` follow-up. Checked on notification, on estimate change and on every reserve movement.
- **Follow-ups:** `awaiting_documents` and `cash_call_due` (handler sets the date; a cash call can go to the finance team), closed automatically when a cash-call payment is recorded; **daily job** `run_daily_claim_follow_ups` (03:20 UTC): a `claim_review` follow-up for the handler (or the claims team) when an open claim has had no reserve movement for `claim_review_days` (90). Skips demo rows.
- **Views:** `claims_v` (risk, MGA, broker, line, handler, our share, reserves / paid / recoveries, **outstanding = reserves − payments**, **incurred = paid + outstanding − recoveries**, USD at today's rate, days since the last reserve movement, cash call due, underwriting year, `search_text`), `claim_payments_v` (USD on the payment date). `follow_ups_v` shows the claim number.
- **Roles (RLS):** `claims` — claims, reserves, recoveries, documents, status; `finance` — payments incl. offsets; `underwriter` — reads the claims of their own risks only; `management` — reads everything; `admin` — everything. Audit log on all four tables.
- **Demo data:** `is_demo` + restrictive policy + the guard on all four tables (a claim takes its risk's world; payments, reserves, recoveries take the claim's; an offset receipt and a payee must be in the same world); the link check, «Delete all demo data» and the counts cover them. Demo seed: 9 claims on the demo risks — every status, reserve history and a review reminder, a large loss with a paid and an open cash call, a claim closed at zero, an offset against overdue premium, a notified claim awaiting documents, a EUR claim (no rate) with a salvage recovery, a declined claim, a loss before inception accepted with a comment, a closed-and-reopened claim.

## Screens

- **Claims register** (`/claims`; admin, claims, finance, management, underwriters for their risks): the search bar filters in the database — `status:`, `mga:`, `broker:`, `lob:`, `handler:`, `uw:`, `ccy:`, `ref:`, `dol:2026-01-01..2026-06-30`, `notified:`, `outstanding>50k`, `incurred>`, `paid>` (USD, our share), `large`, `cashcall`, `review`, `mine`; Excel export = what is shown.
- **New claim** (claims, admin): pick a bound risk (search by ref, insured, MGA), the loss, the estimate (our share shown), and the **coverage check inline**, with the comment it needs.
- **Claim detail:** header (status, large-loss and cash-call marks, our share at the signed line, estimate, outstanding, paid, recoveries, incurred — USD under them for other currencies, «no rate» otherwise), risk and loss details, accepted coverage issues with their comment; **reserve history** chart (outstanding and paid over time) and movements; payments (offsets link to their receipt); recoveries; follow-ups; documents (loss advice, adjuster report, proof of loss, cash call request, payment proof, correspondence); change log.
- **Submission › Claims tab** with the risk's totals.
- **Counterparty › Claims:** open claims, outstanding and incurred (USD), large losses, and the MGA's **loss ratio, incurred / written** and **incurred / earned**.
- **Dashboard › Claims** (admin, management, finance, claims): open claims, outstanding reserves, paid this year, incurred this year (losses in the year), large losses, cash calls due — each opens the filtered register; **loss ratios** by MGA, line or underwriting year as a chart and a table, both kinds labelled; large losses and cash calls lists.
- **Admin › Settings › Claims:** large-loss threshold, review days. The agenda shows team follow-ups (finance cash calls, management / admin large losses).

## Self-review (step 6)

`supabase/tests/claims_rules.sql` — 11 rolled-back checks on the live project, all pass:

1. **Roles** — the claims role creates claims and reserves but cannot pay; finance, underwriters and management cannot create claims or reserves.
2. **Reading** — the risk's own underwriter, management and finance read the claim; another underwriter does not (not even its reserves).
3. **Our share at the signed line on the date of loss** — 10 % before an endorsement, 15 % after it; the estimate's our share follows.
4. **Coverage** — outside the period / another currency is refused without a comment and stored with it.
5. **Status rules** — no notified → closed; decline needs a reason; closing with money outstanding needs a comment; no reserve on a closed claim; reopen works.
6. **Append-only** — a reserve cannot be edited or deleted; a correcting movement adjusts outstanding.
7. **Large loss** — crossing the threshold marks the claim and creates the management and admin follow-ups (showing the claim number); a user cannot set the mark.
8. **Payments** — a cash-call payment closes the open cash-call follow-up; a partial offset is refused; a full offset records the MGA's receipt and pays the installment; a cross-currency offset without a rate is refused; paid and incurred totals add up.
9. **Recoveries** reduce incurred.
10. **Review job** reminds the handler of a stale real claim and never touches demo claims.
11. **Demo isolation** — a real user sees no demo claims or payments; demo mode sees only demo claims; the link check is clean; delete removes only demo claims.

Earned premium and loss ratios: `src/features/claims/ratios.ts` with unit tests (pro rata by day, both ends included, 0…1; ratios by MGA / line / year; unbound risks and no-rate items left out and counted).

Browser: `e2e/claims.spec.ts` (7) — register and search words, export; new claim with the coverage warning and comment; reserve movement, close-with-outstanding comment, large-loss and cash-call marks; finance offset payment and its receipt; Claims tab and counterparty card; dashboard figures and labelled loss ratios; roles, demo isolation, RU / UZ. Claims pages added to the overlap and large-text checks.

Screenshots: `docs/claims/screenshots/` (register EN / RU / UZ, a large loss, the coverage warning, the dashboard section).
