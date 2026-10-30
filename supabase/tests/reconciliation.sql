-- Part E — reconciliation: do the stored figures add up? Read-only; covers real
-- and demo data alike. Each row returned is a discrepancy (none = all agree).
-- Usage: paste into the SQL editor and run.
-- Last run 2026-10-30 (Part E): no discrepancies.
with
alloc as (
  select installment_id, sum(installment_amount) as allocated from public.premium_allocations group by installment_id
),
inst as (
  select i.*, coalesce(a.allocated, 0) as allocated from public.premium_installments i left join alloc a on a.installment_id = i.id
),
recv as (
  select r.id, r.ref_no, r.amount, coalesce(sum(a.amount), 0) as allocated
  from public.premium_receipts r left join public.premium_allocations a on a.receipt_id = r.id group by r.id
),
claim_tot as (
  select c.id, c.claim_no, c.status, c.currency,
    coalesce((select sum(m.amount) from public.claim_reserves m where m.claim_id = c.id), 0) as reserves,
    coalesce((select sum(p.amount) from public.claim_payments p where p.claim_id = c.id), 0) as paid
  from public.claims c
),
bdx as (
  select b.id, b.ref_no, b.kind, b.line_count, b.computed_total, b.installment_ids,
    (select count(*) from public.bordereau_lines l where l.bordereau_id = b.id) as lines,
    (select coalesce(sum(case b.kind when 'premium' then coalesce(l.gross_premium_100, 0)
                                      when 'risk' then coalesce(l.limit_100, l.sum_insured_100, 0)
                                      else coalesce(l.paid_100, 0) + coalesce(l.outstanding_100, 0) end), 0)
       from public.bordereau_lines l where l.bordereau_id = b.id) as lines_total
  from public.bordereaux b
)
-- premium: net = gross − commission − brokerage
select 'installment net ≠ gross − deductions' as check, s.ref_no || ' #' || i.installment_no as record, i.net_amount::text || ' vs ' || (i.gross_amount - i.commission_amount - i.brokerage_amount)::text as detail
  from inst i join public.submissions s on s.id = i.submission_id
 where i.net_amount <> i.gross_amount - i.commission_amount - i.brokerage_amount
union all
-- premium: allocated never above the installment, and the status follows the allocations
select 'installment over-allocated', s.ref_no || ' #' || i.installment_no, i.allocated || ' > ' || i.net_amount
  from inst i join public.submissions s on s.id = i.submission_id where abs(i.allocated) > abs(i.net_amount)
union all
select 'installment status ≠ allocations', s.ref_no || ' #' || i.installment_no, i.status || ' with ' || i.allocated || ' of ' || i.net_amount
  from inst i join public.submissions s on s.id = i.submission_id
 where i.written_off_at is null and i.status in ('open', 'partially_paid', 'paid')
   and i.status::text <> case when i.allocated = 0 then 'open' when abs(i.allocated) >= abs(i.net_amount) then 'paid' else 'partially_paid' end
union all
-- receipts: never allocated beyond the money received
select 'receipt over-allocated', r.ref_no, r.allocated || ' > ' || r.amount from recv r where r.allocated > r.amount
union all
-- bound risks: the schedule matches our signed net premium
select 'schedule ≠ signed premium', c.ref_no, 'difference ' || c.difference
  from public.premium_schedule_check_v c where c.has_schedule and not c.basis_mismatch and c.difference <> 0
union all
-- claims: payments in the claim currency, outstanding never below zero, closed claims settled
select 'claim payment currency', ct.claim_no, p.currency || ' on a ' || ct.currency || ' claim'
  from claim_tot ct join public.claim_payments p on p.claim_id = ct.id where p.currency <> ct.currency
union all
select 'claim outstanding < 0', ct.claim_no, (ct.reserves - ct.paid)::text from claim_tot ct where ct.reserves - ct.paid < 0
union all
select 'closed claim with outstanding', ct.claim_no, (ct.reserves - ct.paid)::text from claim_tot ct where ct.status in ('closed', 'declined') and ct.reserves - ct.paid <> 0
union all
-- bordereaux: line counts and totals as imported; the installments they created exist
select 'bordereau line count', b.ref_no, b.line_count || ' recorded, ' || b.lines || ' lines' from bdx b where b.line_count <> b.lines
union all
select 'bordereau total', b.ref_no, b.computed_total || ' recorded, ' || b.lines_total || ' from lines' from bdx b where b.computed_total is not null and b.computed_total <> b.lines_total
union all
select 'bordereau installment missing', b.ref_no, x::text
  from bdx b cross join lateral unnest(coalesce(b.installment_ids, '{}')) x
 where not exists (select 1 from public.premium_installments i where i.id = x);
-- Demo data never touching real data: Admin › Demo data › «Check links»
-- (demo_link_violations(), admin only).
