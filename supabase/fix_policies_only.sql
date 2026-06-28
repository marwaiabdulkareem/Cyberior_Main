-- ============================================================
-- POLICY-ONLY FIX — run this in Supabase SQL Editor
-- Does NOT drop any tables or delete any data
-- ============================================================

-- STEP 1: Create the security-definer helper (no RLS recursion)
create or replace function public.current_user_role()
returns text language sql security definer stable as $$
  select role from public.profiles where id = auth.uid()
$$;

-- STEP 2: Drop ALL existing policies on every table
-- (removes the recursive ones without touching data)
do $$
declare pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      pol.policyname, pol.schemaname, pol.tablename
    );
  end loop;
end $$;

-- STEP 3: Re-create all policies using the helper function (no recursion)

-- profiles
create policy "profiles_own"         on public.profiles for select using (auth.uid() = id);
create policy "profiles_admin_all"   on public.profiles for all    using (public.current_user_role() = 'admin');
create policy "profiles_update_own"  on public.profiles for update using (auth.uid() = id);

-- sales_agents
create policy "agents_select" on public.sales_agents for select using (auth.role() = 'authenticated');
create policy "agents_admin"  on public.sales_agents for all    using (public.current_user_role() = 'admin');

-- products
create policy "products_select" on public.products for select using (auth.role() = 'authenticated');
create policy "products_admin"  on public.products for all    using (public.current_user_role() = 'admin');

-- customers
create policy "customers_admin"      on public.customers for all    using (public.current_user_role() = 'admin');
create policy "customers_finance"    on public.customers for select using (public.current_user_role() = 'finance');
create policy "customers_agent"      on public.customers for select using (
  public.current_user_role() = 'agent' and (
    created_by = auth.uid() or
    exists (select 1 from public.deals d join public.sales_agents sa on sa.id = d.agent_id
            where d.customer_id = customers.id and sa.profile_id = auth.uid())
  )
);
create policy "customers_insert"     on public.customers for insert with check (auth.role() = 'authenticated');
create policy "customers_update_own" on public.customers for update using (
  created_by = auth.uid() or public.current_user_role() in ('admin','finance')
);

-- deals
create policy "deals_admin"      on public.deals for all    using (public.current_user_role() = 'admin');
create policy "deals_finance"    on public.deals for select using (public.current_user_role() = 'finance');
create policy "deals_agent"      on public.deals for select using (
  exists (select 1 from public.sales_agents sa where sa.id = deals.agent_id and sa.profile_id = auth.uid())
);
create policy "deals_insert"     on public.deals for insert with check (auth.role() = 'authenticated');
create policy "deals_update_own" on public.deals for update using (
  public.current_user_role() in ('admin','finance') or
  exists (select 1 from public.sales_agents sa where sa.id = deals.agent_id and sa.profile_id = auth.uid())
);

-- payment_plans
create policy "plans_all" on public.payment_plans for all using (auth.role() = 'authenticated');

-- installments
create policy "installments_admin"        on public.installments for all    using (public.current_user_role() = 'admin');
create policy "installments_finance_sel"  on public.installments for select using (public.current_user_role() = 'finance');
create policy "installments_finance_upd"  on public.installments for update using (public.current_user_role() = 'finance');
create policy "installments_agent_sel"    on public.installments for select using (
  exists (select 1 from public.deals d join public.sales_agents sa on sa.id = d.agent_id
          where d.id = installments.deal_id and sa.profile_id = auth.uid())
);
create policy "installments_agent_upd"    on public.installments for update using (
  exists (select 1 from public.deals d join public.sales_agents sa on sa.id = d.agent_id
          where d.id = installments.deal_id and sa.profile_id = auth.uid())
);
create policy "installments_insert"       on public.installments for insert with check (auth.role() = 'authenticated');

-- notes, attachments
create policy "notes_all"       on public.notes       for all using (auth.role() = 'authenticated');
create policy "attachments_all" on public.attachments for all using (auth.role() = 'authenticated');

-- activity_logs
create policy "logs_select" on public.activity_logs for select using (public.current_user_role() in ('admin','finance'));
create policy "logs_insert" on public.activity_logs for insert with check (auth.role() = 'authenticated');

-- notifications
create policy "notifs_select" on public.notifications for select using (auth.uid() = user_id);
create policy "notifs_update" on public.notifications for update using (auth.uid() = user_id);
create policy "notifs_insert" on public.notifications for insert with check (auth.role() = 'authenticated');
