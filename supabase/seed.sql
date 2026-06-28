-- ============================================================
-- CYBERIOR PAYMENT TRACKER — SEED DATA
-- Run AFTER creating users in Supabase Auth dashboard
-- ============================================================

-- Products (pre-loaded from product table)
insert into public.products (name, list_price_usd, min_price_usd, default_plan, notes) values
  ('Masterclass',               19,   19,  'one_shot',    null),
  ('Individual Courses',        299,  99,  'two_shots',   null),
  ('BugHuntingPro Path',        549,  499, 'five_shots',  null),
  ('Cyber Security Specialist', 149,  129, 'one_shot',    null),
  ('OffSecPro Path',            690,  599, 'five_shots',  null),
  ('RedOpsPro Path',            990,  890, 'seven_shots', null),
  ('Hub Pro',                   29,   29,  'monthly',     'Monthly subscription — track each renewal as installment'),
  ('Custom Bundle / Other',     0,    0,   'custom',      'Manual price entry required'),
  ('OffSec + Android',          550,  499, 'custom',      null),
  ('Cyber Security Packet',     148,  129, 'one_shot',    null),
  ('SOC',                       349,  150, 'three_shots', null);

-- Note: Sales agents are added via the Agents page after creating
-- their Supabase Auth accounts. See SETUP.md for instructions.
