# Totals and KPIs by submission status — audit (2026-10-31)

The owner's rule (screenshot review v2):

- **bound** — the only status a premium total counts («our gross» is written business);
- **offered / no response** — shown apart as «pending» («в ожидании» / «kutilmoqda»), never added to the total;
- **received / under review** — no terms yet: in neither figure;
- **declined / NTU** — nowhere.

The rule lives in `src/features/submissions/totals.ts` (`isBound`, `isPending`,
`registerTotals`) and is tested in `totals.test.ts` and `e2e/register-totals.spec.ts`.

Premium installments, receipts and claims hang off bound risks only (the database
refuses a premium schedule on a non-bound submission — `premium_installments_before_write`,
`generate_premium_schedule`); claims on a non-bound risk need a coverage comment (`not_bound`).
Their totals are therefore bound-only by construction, or not about submission status at all.

| Total / KPI | Where | Statuses counted | Result |
|---|---|---|---|
| «Подтверждено (USD)» (register toolbar; was «Итого наша брутто (USD)» until 2026-10-31) | Submissions register (`SubmissionsPage.tsx`) | was **every row shown** (incl. offered, no response, NTU) → now **bound**; «в ожидании» = offered + no response; tooltip says received / under review / declined / NTU are in neither | **Changed** |
| Excel export of the register | `ExportButton.tsx` | rows only, no total line (export = what is shown) | Already correct (no total) |
| Received this month (KPI) | Dashboard › Overview | count of all received (an intake figure, no money) | Already correct (count by date, not a premium total) |
| Under review / not reviewed (KPI) | Dashboard › Overview | count of under review / received | Already correct (status counts) |
| Awaiting response (KPI) | Dashboard › Overview | count of offered + no response (= pending) | Already correct (now via `isPending`) |
| Bound YTD (KPI) + «our gross» sub-figure + 12-month trend | Dashboard › Overview | bound, by bound date | Already correct (now via `isBound`) |
| Oldest open offers (attention list, per-row USD) | Dashboard › Needs attention | offered + no response | Already correct (a pending list, not a total) |
| «Подтверждённая премия по месяцам» + header total | Dashboard › Charts (`dash.byMonth`) | bound, by bound date in the period | Already correct |
| Funnel received → reviewed → offered → bound | Dashboard › Charts | counts by stage reached | Already correct (counts, no money) |
| Hit ratio / hit ratio of decided / bound premium in period | Dashboard › Charts › Hit ratio tab | bound ÷ offered; bound ÷ (bound + NTU + no response); premium: bound | Already correct (NTU / no response are in the conversion denominator by definition, never in a premium figure) |
| MGA ranking / LOB ranking (our gross USD) | Dashboard › Charts › By MGA / By LOB | bound in period | Already correct |
| Awaiting response by age (count + USD per bucket) | Dashboard › Charts | offered + no response | Already correct (pending, labelled «awaiting») |
| Premium outstanding / overdue / not due / ageing buckets / top MGAs by overdue / most overdue | Dashboard › Premium, Receivables page, counterparty › Premium (`summary.ts`) | premium installments (bound risks only, enforced by the DB) | Already correct (bound by construction) |
| Received this month / this year (cash) | Dashboard › Premium | receipts (cash), no status | Not status-based |
| Payable to MGAs | Dashboard › Premium, Receivables | return-premium installments (bound only) | Already correct |
| «Итого (USD)» on Receipts | Receipts register | receipts shown (cash) | Not status-based |
| Open claims / outstanding reserves / paid YTD / incurred YTD / large losses / cash calls | Dashboard › Claims, Claims register, counterparty › Claims, submission › Claims tab | claims (by claim status); risks bound or commented | Not submission-status based |
| Loss ratios — written premium and earned premium | Dashboard › Claims, counterparty › Claims (`ratios.ts`, `useRatioRisks`) | bound only (query `.eq('status','bound')` and a `status !== 'bound'` guard) | Already correct |
| Binders: active, missing / late bordereaux, capacity | Dashboard › Binders, Binders register | binders and bordereau lines (no submission status) | Not status-based |
| Binder page: premium / loss ratio | Binder detail | installments of the binder's bound submission | Already correct |
| Counterparties list: submissions (count), bound (count), bound USD («Подтверждено (USD)») + its Excel export | Counterparties register (`CounterpartiesPage.tsx`) | count: all; bound and bound USD: bound | Already correct |
| Counterparty page: submissions, offered, bound, hit ratio, bound USD («Подтверждено (USD)», total / this year), open offers (count + USD), average share, declined (count) | Counterparty detail (`CounterpartyDetailPage.tsx`) | bound USD: bound; open offers USD: offered + no response (pending, its own card); declined is a count only | Already correct (now via `isBound` / `isPending`) |
| AI usage tokens | Admin › AI | not premium | Not status-based |

Summary: one total mixed statuses — the submissions register's «Итого наша брутто (USD)»
summed every row on screen, NTU and offered included. It now counts bound only, with
«в ожидании» (offered + no response) beside it. Every other premium total and KPI
already counted bound business only (or pending, labelled as such) and now reads the
statuses through the same helper where it filters submissions.

Wording (2026-10-31): the bound total reads «Подтверждено» / "Bound" / «Tasdiqlangan»
(with «(USD)» where the figure is a USD sum) everywhere it appears — the register toolbar,
the counterparties list column and the counterparty page KPI — next to «в ожидании» on the register.
