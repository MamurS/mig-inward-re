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
