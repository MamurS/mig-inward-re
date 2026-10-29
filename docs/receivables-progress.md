# Phase 2 — Premium receivables: progress

Resume with: **"Continue Phase 2 receivables from docs/receivables-progress.md"**.
Approved plan: 6 steps, stop for review after each. Target Supabase project:
`jltrtqwaxvsrnqmjemzc` only. Migrations additive, RLS + explicit grants.

| step | scope | state |
|---|---|---|
| 1 | migrations and logic | ✅ applied and tested |
| 2 | schedule on bind + Premium tab on submission detail | — |
| 3 | receipts register + new receipt with allocation | — |
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
