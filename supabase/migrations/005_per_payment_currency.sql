-- ============================================================
-- CYBERIOR PAYMENT TRACKER — PER-PAYMENT CURRENCY
-- ============================================================
-- Currency used to be chosen once per deal, but the same agent's
-- customers actually pay in different currencies on different days
-- (some installments in IQD, some in USD). Each installment now
-- carries its own currency, chosen at the moment the payment is
-- recorded — this is what the commission-by-currency report groups on.
--
-- Existing installments are backfilled from their deal's payment_plan
-- currency so historical data keeps reporting correctly.

alter table public.installments
  add column currency text not null default 'USD'
    check (currency in ('USD','IQD','TRY','OTHER')),
  add column other_currency_label text;

update public.installments i
set currency = pp.currency,
    other_currency_label = pp.other_currency_label
from public.payment_plans pp
where pp.deal_id = i.deal_id;
