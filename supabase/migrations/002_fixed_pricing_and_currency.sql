-- ============================================================
-- CYBERIOR PAYMENT TRACKER — FIXED PROGRAM PRICING + CURRENCY
-- ============================================================
-- Adds a fixed one-time price and a fixed monthly installment price
-- to each program (they no longer need to match — e.g. RedOpsPro can
-- be $990 one-time or $400 x 3 months), and widens the currency a
-- deal can be recorded in beyond USD/IQD.
--
-- Nothing existing is dropped or renamed: list_price_usd, min_price_usd
-- and default_plan stay on products untouched (old data preserved),
-- the new columns are additive and get sensible backfilled defaults
-- below. Review/update each program's numbers on the Programs page
-- after running this (the backfill is a starting guess, not final —
-- e.g. RedOpsPro's real installment plan is $400 x 3 months, not an
-- even split of $990).
-- ============================================================

alter table public.products
  add column one_time_price_usd decimal(10,2),
  add column installment_monthly_price_usd decimal(10,2),
  add column installment_months integer;

update public.products
set
  one_time_price_usd = list_price_usd,
  installment_months = case default_plan
    when 'one_shot' then 1
    when 'two_shots' then 2
    when 'three_shots' then 3
    when 'five_shots' then 5
    when 'seven_shots' then 7
    when 'monthly' then 1
    else 1
  end,
  installment_monthly_price_usd = round(
    list_price_usd / case default_plan
      when 'one_shot' then 1
      when 'two_shots' then 2
      when 'three_shots' then 3
      when 'five_shots' then 5
      when 'seven_shots' then 7
      when 'monthly' then 1
      else 1
    end, 2
  );

alter table public.products
  alter column one_time_price_usd set default 0,
  alter column installment_monthly_price_usd set default 0,
  alter column installment_months set default 1,
  alter column one_time_price_usd set not null,
  alter column installment_monthly_price_usd set not null,
  alter column installment_months set not null;

-- Currency: widen payment_plans to accept TRY and a free-text "Other"
alter table public.payment_plans
  drop constraint payment_plans_currency_check;

alter table public.payment_plans
  add constraint payment_plans_currency_check
  check (currency in ('USD','IQD','TRY','OTHER'));

alter table public.payment_plans
  add column other_currency_label text;
