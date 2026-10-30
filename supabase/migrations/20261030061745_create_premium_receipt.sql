-- Phase 2 step 3: record a receipt and its allocations in one transaction.
-- SECURITY INVOKER: the caller's RLS and column grants apply exactly as for
-- direct inserts (finance / admin write); every rule (caps, FX, return /
-- written-off installments, numbering) stays in the step-1 triggers. Either
-- the receipt and all its allocations are saved, or nothing is.
--
-- p_receipt:     {"received_date", "payer_id", "currency", "amount", "bank_reference", "notes"}
-- p_allocations: [{"installment_id", "amount", "fx_rate"}]  (fx_rate: installment ccy per 1 receipt ccy; null when equal)

create or replace function public.create_premium_receipt(p_receipt jsonb, p_allocations jsonb default '[]'::jsonb)
returns public.premium_receipts
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.premium_receipts;
  v_a   jsonb;
begin
  if jsonb_typeof(coalesce(p_allocations, '[]'::jsonb)) <> 'array' then
    raise exception 'Allocations must be a list' using errcode = '22023';
  end if;

  insert into public.premium_receipts (received_date, payer_id, currency, amount, bank_reference, notes)
  values (
    coalesce((p_receipt ->> 'received_date')::date, current_date),
    (p_receipt ->> 'payer_id')::uuid,
    p_receipt ->> 'currency',
    (p_receipt ->> 'amount')::numeric,
    nullif(trim(p_receipt ->> 'bank_reference'), ''),
    nullif(trim(p_receipt ->> 'notes'), '')
  )
  returning * into v_row;

  for v_a in select * from jsonb_array_elements(coalesce(p_allocations, '[]'::jsonb)) loop
    insert into public.premium_allocations (receipt_id, installment_id, amount, fx_rate)
    values (v_row.id, (v_a ->> 'installment_id')::uuid, (v_a ->> 'amount')::numeric, nullif(v_a ->> 'fx_rate', '')::numeric);
  end loop;

  return v_row;
end;
$$;

revoke execute on function public.create_premium_receipt(jsonb, jsonb) from public, anon;
grant execute on function public.create_premium_receipt(jsonb, jsonb) to authenticated;
