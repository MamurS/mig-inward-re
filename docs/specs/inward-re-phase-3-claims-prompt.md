# Phase 3 — Claims

Start only after Phase 2 step 6 is done and PR #4 is merged. New branch, new PR. FIRST show me a short plan (tables, migrations, pages, changes to existing screens) and wait for my OK.

## Ground rules (same as before)

* Supabase project `jltrtqwaxvsrnqmjemzc` only; additive migrations; RLS + explicit GRANTs; numeric money; EN/RU/UZ; all four themes and both text sizes.
* Reuse `follow_ups`, `documents`, the audit log, the smart search bar (parser + filter builder), Table v2, side panels, KPI cards.
* Demo data: `is_demo` on every new table, demo rows hidden unless Demo mode is on, demo claims numbered `DEMO-CLM-…`, never linked to real rows. Extend the demo seed with claims.
* Keep everything portable to self-hosted Supabase.

## What we track

Claims notified to us by MGAs/brokers on BOUND submissions, our share of reserves and payments, and claims we pay to the MGA.

## Data

* `claims`: claim_no (`CLM-YYYY-0001`), submission_id (must be bound), notified_date, date_of_loss, cause / peril, location, description, cedent's claim reference, currency, estimate_100, status (`notified` | `open` | `closed` | `reopened` | `declined`), decline reason, claims handler (user), large-loss flag, notes.
* Coverage check on create: date of loss inside the submission period, submission bound, currency consistent. If a check fails, warn and require a comment to continue — never silently block or silently accept.
* `claim_reserves`: append-only reserve movements (our share), date, amount, reason, entered_by. The current outstanding = sum of movements minus payments. Never edit a movement; correct with a new one.
* `claim_payments`: our share paid, date, currency, amount, type (`indemnity` | `expense` | `cash_call`), payee counterparty, method (`cash` | `offset_against_premium`), bank ref. Offset against premium creates a linked allocation against open premium installments of the same MGA (finance only, same rules as receipts, cross-currency rate required).
* `claim_recoveries`: salvage / subrogation / other, amount (our share), date.
* Our share uses the SIGNED line of the submission at the date of loss.

## Workflow and alerts

* Status transitions enforced in the database with required fields (decline needs a reason, close needs outstanding = 0 or an explicit comment).
* Large loss: setting `large_loss_threshold_usd` (default 250000, our share). Crossing it (on notification or on reserve increase) creates a follow-up for management and admin and marks the claim with a badge everywhere.
* Follow-ups: `awaiting_documents` (handler sets a due date), `cash_call_due` (payment due date), plus a reminder if an open claim has no reserve movement for `claim_review_days` (default 90).
* Documents: loss advice, adjuster report, proof of loss, cash call request, payment proof, correspondence.

## Ratios

* Incurred = paid + outstanding − recoveries (our share).
* Earned premium: pro rata daily over the submission period, on our signed net premium.
* Loss ratio per MGA, per LOB, per underwriting year, shown both as incurred / written and incurred / earned. Clearly labelled which one.

## Pages

1. Claims register (search bar: `status:`, `mga:`, `lob:`, `large`, `cashcall`, `dol:2026-01-01..2026-06-30`, `outstanding>50k`, `handler:`), Excel export.
2. New claim form starting from a bound submission (searchable), with the coverage check shown inline.
3. Claim detail: header card (claim no., insured, MGA, status, our share, outstanding, paid, incurred), reserve history as a small chart + table, payments, recoveries, follow-ups, documents, timeline.
4. Submission detail: new "Claims" tab with that risk's claims and totals.
5. Counterparty page: claims summary and loss ratios for that MGA.
6. Dashboard: open claims count, outstanding reserves (USD), paid YTD, incurred YTD, loss ratio by MGA (bar chart), large losses list, cash calls due; all clickable to the filtered register.

## Roles

* New role `claims`: full access to claims, reserves, recoveries, documents.
* finance: payments (incl. offsets).
* underwriter: read claims on their own submissions.
* management: read everything.
* admin: everything.

## Steps (stop for my review after each)

1. Plan, then migrations, RLS/grants, status function, rolled-back database tests.
2. Claims register, new-claim form with coverage check, claim detail.
3. Reserves, payments (incl. offset against premium), recoveries.
4. Follow-ups, large-loss alerts, Claims tab on submission, counterparty additions.
5. Dashboard additions and loss ratios (written vs earned).
6. Self-review: role access, our-share maths at signed line, outstanding/incurred, earned premium, offset allocations, demo isolation; report and screenshots.

## Assumptions to confirm with me in the plan

Large-loss threshold, claim review days, whether offset against premium is actually used at MIG, and whether a separate claims role is needed or underwriters handle claims.
