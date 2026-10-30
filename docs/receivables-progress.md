# Phase 2 — Premium receivables: progress

Resume with: **"Continue Phase 2 receivables from docs/receivables-progress.md"**.
Approved plan: 6 steps, stop for review after each. Target Supabase project:
`jltrtqwaxvsrnqmjemzc` only. Migrations additive, RLS + explicit grants.

| step | scope | state |
|---|---|---|
| 1 | migrations and logic | ✅ applied and tested |
| 2 | schedule on bind + Premium tab on submission detail | ✅ |
| 3 | receipts register + new receipt with allocation | ✅ |
| 4 | receivables register, ageing, follow-ups on the agenda | — |
| 5 | dashboard and counterparty additions | — |
| 6 | self-review | — |

## Step 1 — what exists in the database

Migrations `20261029112207_premium_enums`, `20261029114305_premium_receivables`.

- **Tables:** `premium_installments` (type original / additional / return,
  net = gross − commission − brokerage, status maintained by triggers,
  `basis_signed_share_pct`, `settled_at` for return premium, write-off with
  reason), `premium_receipts` (`RCP-YYYY-NNNN`), `premium_allocations`
  (amount in receipt currency, `fx_rate` = installment ccy per 1 receipt ccy,
  `installment_amount` stored).
- **Rules (triggers):** installments only on bound submissions; status from
  allocations (open → partially_paid → paid; written_off; return = paid when
  settled); allocations capped by receipt amount and installment outstanding;
  FX required across currencies; no allocation to return premium or
  written-off installments; amounts / currencies can't drop below what is
  paid; write-off and settling are finance / admin only; paid or written-off
  installments close their open overdue follow-ups; deletes refused while
  documents are attached; change log on all three tables.
- **RPC:** `generate_premium_schedule(submission, installments jsonb | null)` —
  default one installment of our premium due on the PPW date, else inception
  + payment terms; or custom rows; commission / brokerage rounding on the last
  row; regenerate refused once money is allocated.
- **Views:** `premium_installments_v` (paid, outstanding, days overdue in
  Tashkent time, bucket 0-30 / 31-60 / 61-90 / 90+, USD at the latest rate,
  `basis_mismatch`, submission / MGA / broker / underwriter),
  `premium_receipts_v` (allocated, unallocated, USD at the received-date rate,
  payer), `premium_schedule_check_v` (expected vs scheduled net, difference).
- **Follow-ups:** `follow_ups.assigned_role` (team ownership; finance members
  may work them), `follow_ups_v` gains `assigned_role`, `submission_id`,
  `installment_no`, refs for premium / receipt follow-ups.
- **Job:** `run_daily_premium_follow_ups` at 03:15 UTC (08:15 Tashkent) —
  one open `premium_overdue` follow-up per unpaid installment past due +
  `premium_grace_days` (setting, default 0), repeat after
  `follow_up_repeat_days`. Admin «run now»: `run_daily_premium_follow_ups_now()`.
- **Access:** receipts / allocations — finance + admin write, all app users
  read; installments — finance + admin, or the submission's own underwriter;
  documents on installments — also the own underwriter.

## Step 1 — test run (rolled back, nothing kept)

30 checks as underwriter / other underwriter / management / finance / system,
all as designed: default and split schedules (commission 2,500.00 and
brokerage 500.00 summed exactly over 3,333.33 + 3,333.33 + 3,333.34);
permissions (other underwriter, management, settle / write-off refused);
RCP-2026-0001; partially paid → paid; receipt cap, installment cap, FX
required, EUR 500 × 1.1 = 550.00 USD; regenerate refused once allocated;
views (days overdue 242 / 211, bucket 90+, difference 0.00, unallocated
2,666.67); job created 2 follow-ups for finance, then 0 on re-run; write-off
closed its follow-up; signed share change flagged (`basis_mismatch`), not
recalculated; deleting a receipt reopened its installment; 19 audit rows.

## Step 2 — schedule on bind, Premium tab

Migration `20261029120456_premium_payable_writeoff` (additive):
- **Return premium is payable, not receivable.** `premium_installments_v.outstanding_amount`
  is receivable only (original + additional); return premium appears in the new
  `payable_amount` / `payable_usd`. `premium_schedule_check_v.total_net` counts
  receivables only; new `payable_total`. Screens show the two side by side and
  never net them.
- **Write-off records who.** `premium_installments.written_off_by`, set by the
  trigger to the user who wrote it off (not grantable); the view adds
  `written_off_by_name`. A reason is required (check constraint) — tested:
  refused without one; written off «by Test Finance»; undo clears who / reason.

Screens:
- **Premium tab** (opens first on bound submissions): expected vs scheduled net
  and the difference; paid; receivable with the worst ageing badge; payable to
  the MGA. Installments with type, due date, net (gross − deductions under it),
  paid, left to settle, status + days-overdue badge, write-off details (who,
  when, reason). Receipts allocated to the submission. «No longer matches»
  warning with **Regenerate** when the signed share changed.
- **Schedule editor** (side panel): one / equal (count, first due date, every
  month / quarter / half-year) / custom rows; live preview with the database's
  exact rounding (`src/features/premium/schedule.ts`, unit-tested against the
  step-1 DB results); a total that differs from the expected premium is allowed
  and flagged.
- **After binding** the page switches to Premium and opens the editor.
- **Additional / return premium** (positive amount entered; return stored
  negative), **write off** (reason required), **undo write-off**, **mark return
  premium paid to MGA** — the last three for finance / admin only.
- `Field` now links its label to the control automatically (screen readers and
  tests find every field by its label).
- Offline mock: premium tables, the three views computed on read,
  `generate_premium_schedule`, and status changes (`e2e/support/premium.ts`).
- Tests: `e2e/premium.spec.ts` (7) — payable shown separately (1,400.00 owed to
  the MGA), equal schedule matches the expected premium, a differing custom
  schedule is flagged, binding opens the schedule step, write-off needs a reason
  and shows «Written off by Nodira Saidova», return premium settles, underwriter
  and management see no finance actions. Totals: vitest 13, Playwright 39.

## Step 3 — receipts and allocation

Migration `20261030061745_create_premium_receipt` (additive):
- **`create_premium_receipt(p_receipt jsonb, p_allocations jsonb)`**: records a receipt and its allocations in one transaction.
  - It runs as the caller (SECURITY INVOKER), so RLS and the column grants apply exactly as for direct inserts: finance and admin only.
  - Every rule stays in the step-1 triggers.
  - `execute` is granted to `authenticated` only; `public` and `anon` are revoked.
- **Tested in a rolled-back transaction (11 checks):**
  - the underwriter is refused by RLS;
  - `RCP-2026-0001` is created; the bank reference is trimmed and empty notes become null;
  - USD 3,500.00 lands on a USD installment, and USD 7,604.56 at 0.9205 lands as EUR 7,000.00; both installments become paid, with 895.44 left unallocated;
  - refused, leaving no receipt behind: a duplicate installment, more than is outstanding, a missing FX rate, and allocations that are not a list;
  - a receipt without allocations is accepted, dated today by default.

Screens:
- **Receipts** (nav: admin, finance, management; underwriters see receipts on the Premium tab).
  - **Register:**
    - columns: ref, received, payer with its type, currency, amount, allocated, unallocated (a badge) or "fully allocated", USD, bank reference;
    - **search bar** (in the database): text over ref / bank reference / payer / notes, `payer:`, `ccy:`, `ref:`, `bank:`, `received` dates, `amount`, `unallocated` / `allocated`, in EN/RU/UZ;
    - count and total USD; export = what is shown.
  - **New receipt** (finance / admin):
    - Fields: date, payer (grouped MGA / broker / cedent), currency, amount, bank reference, notes.
    - **Allocate to installments:**
      - The payer's open installments are suggested, oldest due first; any other open installment can be added.
      - **Auto-allocate oldest first** fills each installment up to what fits.
      - **Max** fills one row.
      - A running total shows what is allocated, what is left unallocated, or how much it is over the receipt.
    - All saved in one transaction.
  - **Across currencies (review item 3):**
    - The rate field (installment currency per 1 receipt currency) is prefilled with the stored rate on the received date.
    - A live preview shows the converted amount, rounded as the database rounds, and **the rate both ways** (`1 USD = 0.9205 EUR · 1 EUR = 1.0863661054 USD`), plus the stored rate.
    - **«This looks inverted»** appears when the rate is close to 1 ÷ the stored one; a "more than 10 % away" warning appears otherwise; **Use stored** restores the stored rate.
    - More than is outstanding cannot be saved.
  - **Receipt panel:**
    - shows what the receipt paid (submission, installment, receipt amount, the amount on the installment and its rate);
    - finance can remove an allocation and **Allocate the remaining …**.
- **Premium tab:** each allocated receipt links to it in the register (finance, admin, management).
- **Maths:** `src/features/premium/receipts.ts` (convert, rate both ways, stored cross rate, inverted / far check, max that fits, auto-allocate). 6 unit tests, using the database test's figures.
- **Offline mock:** `create_premium_receipt` with the triggers' rules (all or nothing).
- **Tests:**
  - `e2e/receipts.spec.ts` (7): register and search; record with auto-allocate (due dates in order, RCP-2026-0003, Premium tab link back); cross-currency preview, rate both ways, inverted warning, Use stored, cap and Max; panel remove and allocate the rest; export = shown; management read-only, no page for underwriters; RU/UZ;
  - receipts scope unit tests;
  - Receipts added to the Large-text fit check.

## Review items (asked with step 2)

1. **SECURITY DEFINER functions the advisor lists** — all 11 have
   `search_path = ''`, EXECUTE revoked from `public` and `anon` (checked in
   `pg_proc` with `has_function_privilege`):

   | function | what it checks inside |
   |---|---|
   | `admin_update_user` | raises unless `has_role('admin')`; refuses removing your own admin access |
   | `change_submission_status` | raises unless `has_role('admin','underwriter')`; then the status machine's own rules |
   | `generate_premium_schedule` | raises unless `can_edit_premium_schedule` (admin, finance, or the submission's own underwriter); bound only; refuses once money is allocated |
   | `run_daily_follow_ups_now` | raises unless `has_role('admin')` |
   | `run_daily_premium_follow_ups_now` | raises unless `has_role('admin')` |
   | `auth_role` | returns only the caller's own role (`auth.uid()`), null if inactive |
   | `has_role` | true / false about the caller's own role |
   | `is_app_user` | true / false: caller has an active role |
   | `can_write_entity` | true / false: may the caller write that entity type |
   | `can_edit_premium_schedule` | true / false about the caller and one submission |
   | `is_own_installment` | true / false: the caller is the underwriter of that installment's submission (UUID-checked input) |

   The last six are policy helpers: definer so RLS on `profiles` doesn't
   recurse; they only answer questions about the caller and reveal no data.
   The other 29 definer functions (triggers, internal workers, the cron jobs)
   are not executable by `anon` or `authenticated` at all.
2. **Return premium as payable** — done (above).
3. **Cross-currency allocation preview** (converted amount, rate both ways) —
   in step 3 with the allocation form.
4. **Finance team follow-ups** — closing one records who closed it already
   (`follow_ups.done_by` is set by the trigger to `auth.uid()`, not grantable;
   `follow_ups_v.done_by_name`); showing them on every finance user's agenda is
   in step 4 with the agenda changes.
5. **Write-off reason, who and when** — done (above).
6. **Status RPC share-argument typing** — restored and now kept by
   `scripts/write-db-types.mjs` (`p_written_share_pct` / `p_signed_share_pct`:
   `number | string`); the build fails if it is ever lost (the bind dialog
   passes exact decimal strings).
