-- ============================================================
-- CYBERIOR PAYMENT TRACKER — LOCAL CURRENCY AMOUNTS
-- ============================================================
-- Deals already tag which currency a customer paid in (USD/IQD/TRY/Other),
-- but the actual number was always the fixed USD program price relabeled —
-- there was no way to record the real amount collected in that currency.
--
-- These new columns hold the real local-currency figures. The existing
-- amount_due/amount_paid columns stay USD-only and keep driving revenue
-- totals on the Dashboard/Reports; amount_due_local/amount_paid_local are
-- only used for the per-currency commission calculation on the Reports page.
-- Null means "not entered" (typically because the deal's currency is USD,
-- where the local amount and the USD amount are the same number).

alter table public.installments
  add column amount_due_local decimal(15,2),
  add column amount_paid_local decimal(15,2);

-- Price correction: OffSecPro Path's real installment plan is $269 x 3
-- months (the $299x3 set in migration 003 was wrong).
update public.products set installment_monthly_price_usd = 269, installment_months = 3
  where name = 'OffSecPro Path';
