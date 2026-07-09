-- ============================================================
-- STORAGE POLICIES for payments-proofs bucket
-- Run this in Supabase SQL Editor
-- Fixes: "new row violates row-level security policy" on upload
-- ============================================================

create policy "payments_proofs_insert"
  on storage.objects for insert
  with check (bucket_id = 'payments-proofs' and auth.role() = 'authenticated');

create policy "payments_proofs_select"
  on storage.objects for select
  using (bucket_id = 'payments-proofs');

create policy "payments_proofs_update"
  on storage.objects for update
  using (bucket_id = 'payments-proofs' and auth.role() = 'authenticated');

create policy "payments_proofs_delete"
  on storage.objects for delete
  using (bucket_id = 'payments-proofs' and auth.role() = 'authenticated');
