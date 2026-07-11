-- ============================================================
-- 007: SHARED COMMISSION — optional co-agent per deal
-- Run this in Supabase SQL Editor.
-- Additive only: does not touch/drop any existing policy.
-- ============================================================

alter table public.deals
  add column co_agent_id uuid,
  add column co_agent_split_pct numeric(5,2);

alter table public.deals
  add constraint deals_co_agent_id_fkey foreign key (co_agent_id) references public.sales_agents(id);

alter table public.deals
  add constraint deals_co_agent_split_pct_range
    check (co_agent_split_pct is null or (co_agent_split_pct >= 0 and co_agent_split_pct <= 100));

alter table public.deals
  add constraint deals_co_agent_not_primary
    check (co_agent_id is null or co_agent_id <> agent_id);

create index if not exists deals_co_agent_id_idx on public.deals(co_agent_id);

-- ------------------------------------------------------------
-- Additive RLS: co-agent gets the same read/write the primary
-- agent already has, mirrored via NEW policy names keyed off
-- co_agent_id. Existing policies are untouched.
-- ------------------------------------------------------------

create policy "deals_select_co_agent" on public.deals
  for select using (
    exists (select 1 from public.sales_agents sa
            where sa.id = deals.co_agent_id and sa.profile_id = auth.uid())
  );

create policy "deals_update_co_agent" on public.deals
  for update using (
    exists (select 1 from public.sales_agents sa
            where sa.id = deals.co_agent_id and sa.profile_id = auth.uid())
  );

create policy "installments_select_co_agent" on public.installments
  for select using (
    exists (select 1 from public.deals d
            join public.sales_agents sa on sa.id = d.co_agent_id
            where d.id = installments.deal_id and sa.profile_id = auth.uid())
  );

create policy "installments_update_co_agent" on public.installments
  for update using (
    exists (select 1 from public.deals d
            join public.sales_agents sa on sa.id = d.co_agent_id
            where d.id = installments.deal_id and sa.profile_id = auth.uid())
  );

create policy "customers_select_co_agent" on public.customers
  for select using (
    exists (select 1 from public.deals d
            join public.sales_agents sa on sa.id = d.co_agent_id
            where d.customer_id = customers.id and sa.profile_id = auth.uid())
  );
