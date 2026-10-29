-- =====================================================================
-- Phase 2 / Step 1a: enum values for premium receivables (additive only).
-- Separate migration: a new enum value can't be used in the transaction
-- that adds it.
--   entity_type 'receipt'           — follow-ups / documents on receipts
--                                     ('premium' = an installment)
--   follow_up_type 'premium_overdue'
--   doc_type 'remittance_advice'
-- Target project: mig-inward-re (ref jltrtqwaxvsrnqmjemzc)
-- =====================================================================

alter type public.entity_type    add value if not exists 'receipt';
alter type public.follow_up_type add value if not exists 'premium_overdue';
alter type public.doc_type       add value if not exists 'remittance_advice';
