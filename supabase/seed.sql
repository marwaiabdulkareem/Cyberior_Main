-- ============================================================
-- CYBERIOR PAYMENT TRACKER — SEED DATA
-- Run AFTER creating users in Supabase Auth dashboard
-- ============================================================

-- Products (pre-loaded from product table)
-- one_time_price_usd / installment_monthly_price_usd / installment_months are the
-- fixed prices shown on the Programs page. They do NOT have to match an even split
-- of the one-time price (e.g. RedOpsPro is $990 one-time or $400 x 3 months — paying
-- in installments costs more). Review and adjust each program's numbers as needed.
insert into public.products (
  name, list_price_usd, min_price_usd, default_plan, notes,
  one_time_price_usd, installment_monthly_price_usd, installment_months
) values
  ('Masterclass',               19,   19,  'one_shot',    null,                                                    19,  19,  1),
  ('Individual Courses',        299,  99,  'two_shots',   'One-time payment only, no installment plan',           299, 0,   0),
  ('BugHuntingPro Path',        549,  499, 'five_shots',  null,                                                    549, 219, 3),
  ('Cyber Security Specialist', 149,  129, 'one_shot',    null,                                                    149, 149, 1),
  ('OffSecPro Path',            690,  599, 'five_shots',  null,                                                    690, 269, 3),
  ('RedOpsPro Path',            990,  890, 'seven_shots', null,                                                    990, 400, 3),
  ('Hub Pro',                   29,   29,  'monthly',     'Monthly subscription — track each renewal as installment', 29, 29,  1),
  ('Custom Bundle / Other',     0,    0,   'custom',      'Manual price entry required',                          0,   0,   1),
  ('OffSec + Android',          550,  499, 'custom',      null,                                                    550, 219, 3),
  ('SOC',                       349,  150, 'three_shots', null,                                                    349, 139, 3);

-- Note: Sales agents are added via the Agents page after creating
-- their Supabase Auth accounts. See SETUP.md for instructions.
