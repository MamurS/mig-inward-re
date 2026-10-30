-- Search bar: one normalised text column on submissions_v that free text
-- matches (ref no., insured, risk, MGA, broker, source, country and line of
-- business in EN/RU/UZ, notes). Additive: a new immutable function and a
-- column appended at the end of the view; every existing column is unchanged.
--
-- public.search_norm() lower-cases, maps accented Latin and marked Cyrillic
-- letters to their base letter and drops apostrophes (Uzbek oʻ gʻ, ’, ', `).
-- The two character lists are the ones in src/features/search/normalize.ts;
-- normalize.test.ts fails if they drift apart.
--
-- No index: a view column over joined tables cannot be indexed, and a scan
-- of a few thousand rows is fast; revisit with a stored column + trigram
-- index if the register grows past ~50k rows.

create or replace function public.search_norm(t text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select translate(lower(t), 'àáâãäåāăąçćčďđèéêëēėęěğìíîïīıįłñńňòóôõöøōőřśşšșțţťùúûüūůűųýÿžźżёўқғҳʻʼ‘’''`´', 'aaaaaaaaacccddeeeeeeeegiiiiiiilnnnoooooooorsssstttuuuuuuuuyyzzzеукгх')
$$;

revoke execute on function public.search_norm(text) from public, anon;
grant execute on function public.search_norm(text) to authenticated;

create or replace view public.submissions_v
with (security_invoker = true)
as
with base as (
  select
    s.*,
    case when s.status = 'bound' then s.signed_share_pct else s.written_share_pct end as share_pct,
    public.fx_rate_to_usd(s.currency, coalesce(s.bound_at::date, s.received_at)) as fx_rate_to_usd
  from public.submissions s
), calc as (
  select
    b.*,
    round(b.gross_premium_100 * b.share_pct / 100, 2) as our_gross_premium,
    round(b.sum_insured_100   * b.share_pct / 100, 2) as our_sum_insured,
    round(b.limit_100         * b.share_pct / 100, 2) as our_limit
  from base b
), ded as (
  select
    c.*,
    round(c.our_gross_premium * c.commission_pct / 100, 2) as commission_amount,
    round(c.our_gross_premium * c.brokerage_pct / 100, 2)  as brokerage_amount
  from calc c
)
select
  d.*,
  d.commission_amount + d.brokerage_amount                                         as deductions_amount,
  d.our_gross_premium - d.commission_amount - d.brokerage_amount                   as our_net_premium,
  round(d.gross_premium_100 * d.fx_rate_to_usd, 2)                                 as gross_premium_100_usd,
  round(d.our_gross_premium * d.fx_rate_to_usd, 2)                                 as our_gross_premium_usd,
  round((d.our_gross_premium - d.commission_amount - d.brokerage_amount) * d.fx_rate_to_usd, 2) as our_net_premium_usd,
  round(d.sum_insured_100 * d.fx_rate_to_usd, 2)                                   as sum_insured_100_usd,
  mga.name    as mga_name,
  brk.name    as broker_name,
  src.name    as source_party_name,
  src.type    as source_party_type,
  lob.code    as lob_code,
  lob.name    as lob_name,
  coalesce(uw.full_name, uw.email) as underwriter_name,
  (d.status = 'offered' and d.offer_valid_until < current_date)                   as offer_expired,
  (d.next_follow_up_at is not null and d.next_follow_up_at < now())               as follow_up_overdue,
  case when d.status in ('offered', 'no_response')
       then (current_date - d.offered_at::date) end                                as days_since_offered,
  -- appended (search bar): everything free text matches, normalised like the browser does
  public.search_norm(concat_ws(' ',
    d.ref_no, d.insured_name, d.risk_description, mga.name, brk.name, src.name,
    d.insured_country, ctry.name, ctry.name_ru, ctry.name_uz,
    lob.code, lob.name, lob.name_ru, lob.name_uz, d.notes))                          as search_text
from ded d
join public.counterparties mga on mga.id = d.mga_id
join public.counterparties src on src.id = d.source_party_id
left join public.counterparties brk on brk.id = d.broker_id
left join public.lines_of_business lob on lob.id = d.lob_id
left join public.profiles uw on uw.id = d.underwriter_id
left join public.countries ctry on ctry.code = d.insured_country;

-- create or replace keeps the view's grants; restated for clarity
grant select on public.submissions_v to authenticated;
