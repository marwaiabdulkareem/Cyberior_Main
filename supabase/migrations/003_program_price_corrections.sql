-- ============================================================
-- CYBERIOR PAYMENT TRACKER — REAL PROGRAM PRICE CORRECTIONS
-- ============================================================
-- Replaces the placeholder installment numbers from migration 002
-- (which were derived by evenly splitting the old list price) with
-- the real fixed installment pricing per program.

update public.products set installment_monthly_price_usd = 299, installment_months = 3
  where name = 'OffSecPro Path';

update public.products set installment_monthly_price_usd = 219, installment_months = 3
  where name = 'OffSec + Android';

update public.products set installment_monthly_price_usd = 139, installment_months = 3
  where name = 'SOC';

update public.products set installment_monthly_price_usd = 219, installment_months = 3
  where name = 'BugHuntingPro Path';

-- Individual Courses: one-time payment only, no installment plan.
update public.products set installment_monthly_price_usd = 0, installment_months = 0
  where name = 'Individual Courses';

-- Cyber Security Packet: remove entirely. Guarded so this silently does
-- nothing (instead of failing) if any existing deal still references it —
-- in that case, archive it from the Programs page instead of deleting.
delete from public.products
  where name = 'Cyber Security Packet'
    and not exists (select 1 from public.deals where deals.product_id = products.id);
