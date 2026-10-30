-- Fix: the movement trigger read payment-only fields (currency, method) on
-- reserves and recoveries too; PL/pgSQL resolves every field of an IF, so
-- the payment checks now sit in their own block.
create or replace function public.claim_movement_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    if coalesce(current_setting('app.demo_admin', true), '') = 'on' and tg_op = 'DELETE' then
      return old; -- «Delete all demo data»
    end if;
    raise exception 'Claim movements are never changed: record a correcting one' using errcode = '42501';
  end if;
  select cl.status, cl.currency, cl.claim_no, s.mga_id into c
    from public.claims cl join public.submissions s on s.id = cl.submission_id where cl.id = new.claim_id;
  if not found then
    raise exception 'Claim not found' using errcode = 'P0002';
  end if;
  if tg_table_name in ('claim_reserves', 'claim_payments') and c.status in ('closed', 'declined') then
    raise exception 'Claim % is %: reopen it first', c.claim_no, c.status using errcode = '23514';
  end if;
  if tg_table_name = 'claim_payments' then
    if new.currency is distinct from c.currency then
      raise exception 'Pay in the claim currency (%)', c.currency using errcode = '23514';
    end if;
    -- an offset carries the MGA's receipt for exactly this amount (made by create_claim_payment)
    if new.method = 'offset_against_premium'
       and not exists (select 1 from public.premium_receipts r
                        where r.id = new.offset_receipt_id and r.payer_id = c.mga_id and r.currency = new.currency and r.amount = new.amount) then
      raise exception 'An offset needs the MGA''s receipt for the same amount' using errcode = '23514';
    end if;
  end if;
  new.entered_by := coalesce(auth.uid(), new.entered_by);
  new.created_at := now();
  return new;
end;
$$;
revoke execute on function public.claim_movement_before_write() from public, anon, authenticated;
