# Decisions taken with defaults

Business questions not yet confirmed by MIG. Each was decided with the
default from the master plan (or the safest reading of the spec); review them
and tell me which to change. «Where to change» says whether it is a setting
(Admin › Settings, no code) or code / a migration.

| # | Part | Decision | Why | Where to change |
|---|---|---|---|---|
| 1 | — | **No answer from the broker:** first follow-up 7 days after the offer, repeat every 7 days; automatic «No response» **off** (30 days if switched on). | Master-plan default. | Admin › Settings › Follow-ups on offers (`follow_up_first_days`, `follow_up_repeat_days`, `auto_no_response_enabled`, `auto_no_response_days`). |
| 2 | A | **Default premium schedule:** one installment of our net premium, due on the PPW date, else inception + the submission's payment terms, else inception + **60 days**. New submissions are prefilled with 60 days' terms. | Master-plan default. | Admin › Settings › Premium › Default payment terms (`premium_default_terms_days`); the form's prefill is in `SubmissionFormPage.tsx`. |
| 3 | A | **Commission and brokerage are deducted** from each installment (net = gross − commission − brokerage), split pro rata, the last installment taking the rounding. | Master-plan default. | Code: `generate_premium_schedule` (migration `…premium_default_terms`). |
| 4 | A | **Grace days 0:** the first overdue-premium follow-up comes the day after the due date. | Master-plan default. | Admin › Settings › Premium (`premium_grace_days`). |
| 5 | A | **Overdue premium follow-ups go to the finance team** (`assigned_role = finance`): every finance user sees them, any of them can close one; who closed it is recorded. | Phase 2 spec («for the finance role»). | Code: `run_daily_premium_follow_ups`. |
| 6 | A | **Return premium is payable, never netted** against what the MGA owes; it has its own tile and list. | Phase 2 review item 2. | Code. |
| 7 | A | **USD totals** use each installment's / receipt's own stored rate on the day; anything with no rate yet is **left out of USD totals and counted** on screen. No FX rates are seeded (shared reference data). | Spec: never guess a rate. | Admin › FX rates. |
| 8 | A | **Finance sees the dashboard** (premium section and the submission tiles); underwriters still start on the register. The premium section is shown to admin, management and finance; the counterparty premium card to every role (all may read premium). | Spec: dashboard for finance figures; underwriters «view». | Code: `nav.ts`, `App.tsx`, `DashboardPage.tsx`. |
| 9 | A | **Demo data lives in the same project**, hidden by RLS unless the user switches on Demo mode; «DEMO » names and DEMO-SUB / DEMO-RCP numbers. | Asked for (no staging). | Admin › Demo data. |
| 10 | B | **Large-loss threshold USD 250,000, our share** — the larger of the estimate (100 % × our signed line) and the reserves, at today's rate. With no FX rate for the claim currency the check cannot run (the claim page says «no rate»). | Master-plan default. | Admin › Settings › Claims (`large_loss_threshold_usd`). |
| 11 | B | **Claim review reminder after 90 days** without a reserve movement, to the handler (or the claims team when none). The register's `review` word uses 90 days too. | Master-plan default. | Admin › Settings › Claims (`claim_review_days`); the search word in `scopes.ts`. |
| 12 | B | **Offset against premium is available, finance only**, implemented as a receipt from the MGA for the same amount, allocated in full to the MGA's open installments with the receipts' rules. | Master-plan default («available but finance-only»). | Code (`create_claim_payment`); hide the option in `ClaimDialogs.tsx` if MIG does not use it. |
| 13 | B | **A separate `claims` role** handles claims; underwriters read only the claims on their own risks; finance pays; management reads all. | Master-plan default. | RLS (`can_read_claims_of`, claims policies). |
| 14 | B | **A claim on a risk that is not bound** is allowed only with a comment (the coverage check lists «not bound»), like the other coverage findings — never silently blocked or accepted. | Spec: «warn and require a comment». | Code (`claim_coverage_issues`). |
| 15 | B | **Payments are in the claim currency**; a claim in another currency than its risk needs the coverage comment. | Keeps outstanding = reserves − payments exact. | Code (claim movement trigger). |
| 16 | B | **«Incurred this year» on the dashboard = claims with a date of loss in the year**; «paid this year» = payments dated in the year. | Common reading; both labelled. | Code (`ClaimsDashboard.tsx`). |
| 17 | B | **Earned premium** = our signed net premium × the part of the risk period that has run, by day, both ends included, as of today; written = our signed net premium (USD at the bind rate). | Spec: pro rata daily on signed net premium. | Code (`src/features/claims/ratios.ts`). |
