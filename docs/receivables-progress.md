# Phase 2 — Premium receivables: progress

Resume with: **"Continue Phase 2 receivables from docs/receivables-progress.md"**.
Approved plan: 6 steps, stop for review after each. Target Supabase project:
`jltrtqwaxvsrnqmjemzc` only. Migrations additive, RLS + explicit grants.

| step | scope | state |
|---|---|---|
| 1 | migrations and logic | ✅ applied and tested |
| 2 | schedule on bind + Premium tab on submission detail | ✅ |
| 3 | receipts register + new receipt with allocation | ✅ |
| 4 | receivables register, ageing, follow-ups on the agenda | ✅ (+ demo data) |
| 5 | dashboard and counterparty additions | ✅ |
| 6 | self-review | ✅ |

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

## Step 5 — dashboard and counterparty additions

- **Dashboard › Premium** (admin, management, finance — finance now sees the dashboard): premium outstanding (USD, with what is not yet due), overdue premium (USD, count), received this month, received this year, payable to MGAs (apart); overdue by age (0-30 / 31-60 / 61-90 / 90+, each opens its bucket); top MGAs by overdue; most overdue items with exact days. Every figure opens the filtered Receivables / Receipts register, and the register shows the same total (checked in `e2e/premium-dashboard.spec.ts`). Items with no FX rate are left out of USD totals and counted under the tiles.
- **Counterparty page › Premium** (MGAs and brokers, every role): outstanding, overdue, payable to them, received this year, by bucket; links open the registers filtered to them.
- **Settings:** `premium_default_terms_days` = 60 (migration `20261030092035_premium_default_terms`): due = PPW date, else inception + the submission's terms, else + 60 days; Admin › Settings now grouped (Follow-ups on offers, Premium: default terms, grace days).
- Shared figures: `src/features/premium/summary.ts` (`ageing`, `premiumSummary`, `usePremiumOverview`) — one set of rules for the dashboard, the counterparty card and the register.

## Step 6 — self-review

`supabase/tests/premium_review.sql` (rolled back, on the demo data), all pass:

1. **Sums** — every demo schedule equals our net premium (`premium_schedule_check_v.difference = 0`); no installment paid over its net; no receipt over-allocated, unallocated = amount − allocated; every status agrees with its payments.
2. **FX** — every allocation's installment amount = amount × rate, rounded to cents; no cross-currency allocation without a rate; the demo USD → EUR one is covered.
3. **Overdue days** — days overdue = Tashkent today − due date for everything still owed; buckets match the days; paid and return items never overdue; the demo data covers all four buckets.
4. **Roles** — an underwriter regenerates the schedule of his own submission, not someone else's, and cannot record a receipt; management changes nothing; finance cannot allocate more than the receipt.
5. **Demo isolation of every dashboard figure** — out of Demo mode, outstanding / overdue / payable / receipts / overdue-premium follow-ups equal the real-only sums and list no demo row; in Demo mode, the demo-only sums.

Also re-checked: the security advisor (only the documented definer functions and leaked-password protection, an Auth setting for the owner), the full unit and e2e suites.

## Step 4 — receivables register, ageing, finance follow-ups

- **Receivables page** (`/receivables`, nav «Receivables»; finance, admin, management):
  - every installment MGAs still owe, oldest due first: ref no. #n (links to the submission), insured, MGA, broker, due date, days overdue (ageing badge), currency, net, paid, outstanding, outstanding in USD, status;
  - **ageing summary in USD** over exactly the rows the search shows: outstanding, not yet due, 0-30, 31-60, 61-90, 90+ (each tile filters by its bucket); rows with no FX rate are counted apart («… without an FX rate are not in the USD totals»);
  - **receivable and payable stay apart:** return premium is never in the list or the totals; its own tile «Payable to MGAs» and the `payable` search show it;
  - export to Excel = the rows shown.
- **Search words** (EN / RU / UZ): `overdue>45` (days overdue; `просрочено>45`), `bucket:61-90|90+` (`корзина:`), `payable` (`возврат`, `qaytarish`), `overdue`, `mga:`, `broker:`, `uw:`, `ccy:`, `status:open|partially_paid|paid|written_off`, `due<30d`, `outstanding>10k`, `ref:`, `mine`. Without `status:` or `payable` the list shows what is still owed.
- **Agenda — finance team follow-ups** (review item 4): your own agenda also lists your team's follow-ups (`assigned_role` = your role), so every finance user sees each overdue-premium follow-up; «Finance team» as the assignee; the amount column shows what is still owed on the installment; the link opens the submission; anyone in the team can close it and the closing records who (`done_by`, shown on the Done tab). The nav badge counts team items too. «Schedule next» keeps it a team follow-up.
- **Database:** nothing new needed — `premium_installments_v` already has days overdue, bucket, outstanding / payable in USD; the `follow_ups_update_team` policy lets the team close. Checked rolled back: a finance user sees the 7 team follow-ups and closing one sets `done_by` to that user.
- **Tests:** `e2e/receivables.spec.ts` (6): register order and tiles; `overdue>45`, bucket tile, `payable`; Russian words; export = shown; finance agenda team item closed and «(Nodira Saidova)» on the Done tab; management reads, no register for underwriters. Unit: receivables scope (words, PostgREST filters) and the ageing maths. Receivables added to the Large-text fit check.

## Demo data (asked with step 4)

- **Hidden by default, everywhere:** `is_demo` on counterparties, submissions (and their status history), installments, receipts, allocations, follow-ups, documents. A **restrictive RLS policy** `is_demo = demo_mode()` on each means a user out of demo mode never receives a demo row — lists, search, dashboard totals, exports all follow. The daily jobs skip demo rows.
- **Demo mode** (per user, Appearance): shows only demo rows, with an amber **DEMO** banner across the top (it stays in view and has «Leave demo mode»).
- **Never mixed:** a guard trigger makes children inherit the parent's flag and refuses links between the worlds (e.g. a real receipt paying a demo installment); a user writes only in their own mode. «DEMO » names are reserved for demo rows (and added automatically); demo numbers are DEMO-SUB-… / DEMO-RCP-… with their own counters.
- **Loaded on the project:** 5 MGAs, 3 brokers (all «DEMO …»), 30 submissions in every status (back-dated through the status machine), schedules with overdue items in every bucket, a return premium, partly paid installments, 5 receipts (one USD receipt paying a EUR installment at 0.9205, one with money left unallocated), 26 follow-ups incl. 7 finance-team overdue-premium ones.
- **Admin › Demo data:** counts, **Check links** (`demo_link_violations()` — none), **Delete all demo data** (also removes demo documents' files), **Load demo data**.
- **Tests:** `supabase/tests/demo_isolation.sql` — 8 checks, rolled back: hidden when off (lists, views, dashboard total), prefix reserved, mixing refused, only demo when on, writes in own mode, jobs skip demo, link check clean and delete removes only demo, admin only. `e2e/demo.spec.ts` (6).

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

   Added with demo data (same pattern, checked by the advisor on 30 Oct):
   `seed_demo_data`, `delete_demo_data`, `demo_link_violations`,
   `demo_data_counts` raise / return nothing unless `has_role('admin')`;
   `demo_mode` answers only about the caller's own profile.

   The last six are policy helpers: definer so RLS on `profiles` doesn't
   recurse; they only answer questions about the caller and reveal no data.
   The other 29 definer functions (triggers, internal workers, the cron jobs)
   are not executable by `anon` or `authenticated` at all.
2. **Return premium as payable** — done (above).
3. **Cross-currency allocation preview** (converted amount, rate both ways) —
   in step 3 with the allocation form.
4. **Finance team follow-ups** — closing one records who closed it already
   (`follow_ups.done_by` is set by the trigger to `auth.uid()`, not grantable;
   `follow_ups_v.done_by_name`); every finance user's agenda shows them — done
   in step 4.
5. **Write-off reason, who and when** — done (above).
6. **Status RPC share-argument typing** — restored and now kept by
   `scripts/write-db-types.mjs` (`p_written_share_pct` / `p_signed_share_pct`:
   `number | string`); the build fails if it is ever lost (the bind dialog
   passes exact decimal strings).
