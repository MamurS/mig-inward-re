# Phase 2 — Premium receivables

Go ahead with Phase 2, using the spec below. FIRST show me a short plan (tables, migrations, pages, changes to existing screens) and wait for my OK before writing code.

## Ground rules

* Real data may already exist. Migrations must be additive and non-destructive; no data loss, no renumbering. Same rules as before: correct project ref only, RLS + explicit GRANTs, numeric money, EN/RU/UZ.
* Reuse the generic `follow_ups` and `documents` tables (entity_type + entity_id).

## What we track

For each BOUND submission, our share of premium to be received from the MGA/broker. Amounts follow the signed line. If the signed share changes later, show that the schedule no longer matches the expected total. Do NOT recalculate the schedule automatically; let the user regenerate it.

## Installments (premium schedule)

* Table `premium_installments`: submission_id, installment_no, due_date, currency, gross_amount (our share), commission/brokerage deductions, net_amount_due, type (`original` | `additional` | `return`; return = negative amount), status (`open` | `partially_paid` | `paid` | `written_off`), notes.
* On bind, offer to generate a default schedule: one installment of our net premium, due = PPW date if set, else inception + payment_terms_days. The user can split it into N installments (equal or custom amounts/dates) before saving. The sum must equal our net premium, or show the difference clearly.
* Finance and underwriters can edit the schedule; every change is logged in the audit log.

## Receipts

* Table `premium_receipts`: received_date, payer counterparty, currency, amount, bank reference, notes, created_by.
* Allocation table: one receipt can pay several installments and one installment can have several receipts (partial payments). Unallocated balance stays visible on the receipt.
* If the receipt currency differs from the installment currency, require an exchange rate for the allocation.
* Installment status updates automatically from allocations.
* Documents on installments/receipts: invoice, debit note, credit note, remittance advice.

## Overdue & aging

* For every open or partially paid installment past its due date show: outstanding amount, EXACT days overdue (sortable, filterable, e.g. "> 45"), aging bucket 0–30 / 31–60 / 61–90 / 90+.
* Daily pg_cron job: create a `premium_overdue` follow-up for the finance role when an installment becomes overdue, then repeat every `follow_up_repeat_days` while unpaid. Add setting `premium_grace_days` (default 0) before the first follow-up.

## Pages

1. Receivables register: all installments with filters (MGA, broker, status, currency, overdue only, days overdue range, bucket, due date range) and Excel export.
2. Receipts register + new receipt form with allocation to open installments of the payer.
3. Submission detail: new "Premium" tab with schedule, receipts, outstanding, days overdue.
4. Counterparty page: receivables summary and aging for that MGA/broker.
5. Dashboard additions: outstanding premium (USD), overdue total with bucket breakdown, top MGAs by overdue amount, cash received this month/year, and a list of the most overdue items with exact days. Clicking any figure opens the filtered register.

## Roles

finance: full access to receipts, allocations and schedules. underwriter: view, and edit schedules on own submissions. management: read-only. admin: everything.

## Steps (stop for my review after each)

1. Plan, then migrations + RLS/grants + recalculation logic.
2. Schedule generation on bind + Premium tab.
3. Receipts + allocation.
4. Receivables register, aging, overdue follow-ups.
5. Dashboard + counterparty page additions.
6. Self-review: role access, sums (schedule vs net premium, allocations vs receipts), FX conversion, overdue day counts.
