-- Phase 3 (claims), migration 1 of 2: new enum values and types only (a new
-- enum value cannot be used in the transaction that adds it). Additive.

create type public.claim_status as enum ('notified', 'open', 'closed', 'reopened', 'declined');
create type public.claim_payment_type as enum ('indemnity', 'expense', 'cash_call');
create type public.claim_payment_method as enum ('cash', 'offset_against_premium');
create type public.claim_recovery_type as enum ('salvage', 'subrogation', 'other');

alter type public.follow_up_type add value if not exists 'awaiting_documents';
alter type public.follow_up_type add value if not exists 'cash_call_due';
alter type public.follow_up_type add value if not exists 'claim_review';
alter type public.follow_up_type add value if not exists 'large_loss';

alter type public.doc_type add value if not exists 'adjuster_report';
alter type public.doc_type add value if not exists 'proof_of_loss';
alter type public.doc_type add value if not exists 'cash_call_request';
alter type public.doc_type add value if not exists 'payment_proof';

grant usage on type public.claim_status, public.claim_payment_type, public.claim_payment_method, public.claim_recovery_type to authenticated;
