-- ============================================================
-- FULL RESET + REBUILD — run this entire file at once
-- ============================================================

-- STEP 1: DROP EVERYTHING
drop table if exists public.notifications cascade;
drop table if exists public.activity_logs cascade;
drop table if exists public.attachments cascade;
drop table if exists public.notes cascade;
drop table if exists public.installments cascade;
drop table if exists public.payment_plans cascade;
drop table if exists public.deals cascade;
drop table if exists public.customers cascade;
drop table if exists public.products cascade;
drop table if exists public.sales_agents cascade;
drop table if exists public.profiles cascade;
drop function if exists public.handle_new_user cascade;
drop function if exists public.update_updated_at cascade;
drop function if exists public.mark_late_installments cascade;
drop function if exists public.current_user_role cascade;

-- STEP 2: CREATE ALL TABLES
create extension if not exists "uuid-ossp";

create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text not null,
  role text not null default 'agent' check (role in ('admin', 'agent', 'finance')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sales_agents (
  id uuid default uuid_generate_v4() primary key,
  profile_id uuid references public.profiles(id) on delete set null,
  name text not null,
  email text,
  phone text,
  commission_rate decimal(5,2) not null default 10.00,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  list_price_usd decimal(10,2) not null default 0,
  min_price_usd decimal(10,2) not null default 0,
  default_plan text not null default 'one_shot'
    check (default_plan in ('one_shot','two_shots','three_shots','five_shots','seven_shots','monthly','custom')),
  one_time_price_usd decimal(10,2) not null default 0,
  installment_monthly_price_usd decimal(10,2) not null default 0,
  installment_months integer not null default 1,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customers (
  id uuid default uuid_generate_v4() primary key,
  full_name text not null,
  phone text,
  email text,
  country text,
  lead_source text,
  status text not null default 'lead'
    check (status in ('lead','contacted','enrolled','active','completed','cancelled','refunded')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.deals (
  id uuid default uuid_generate_v4() primary key,
  customer_id uuid references public.customers(id) on delete cascade not null,
  product_id uuid references public.products(id) not null,
  agent_id uuid references public.sales_agents(id) not null,
  deal_price_usd decimal(10,2) not null,
  deal_price_iqd decimal(15,2),
  discount_amount decimal(10,2) not null default 0,
  payment_type text not null check (payment_type in ('full','installment','monthly','custom')),
  status text not null default 'active' check (status in ('active','completed','cancelled','refunded','paused')),
  start_date date,
  below_min_override boolean not null default false,
  below_min_note text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payment_plans (
  id uuid default uuid_generate_v4() primary key,
  deal_id uuid references public.deals(id) on delete cascade not null unique,
  total_amount decimal(10,2) not null,
  num_installments integer not null default 1,
  installment_amount decimal(10,2),
  currency text not null default 'USD' check (currency in ('USD','IQD','TRY','OTHER')),
  other_currency_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.installments (
  id uuid default uuid_generate_v4() primary key,
  deal_id uuid references public.deals(id) on delete cascade not null,
  payment_plan_id uuid references public.payment_plans(id) on delete cascade,
  installment_number integer not null,
  amount_due decimal(10,2) not null,
  amount_paid decimal(10,2) not null default 0,
  due_date date not null,
  paid_date date,
  status text not null default 'pending'
    check (status in ('pending','paid','partial','late','cancelled','paused')),
  payment_method text
    check (payment_method in ('card','bank_transfer','superq','zaincash','western_union','cash','other')),
  proof_url text,
  notes text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notes (
  id uuid default uuid_generate_v4() primary key,
  entity_type text not null check (entity_type in ('customer','deal','installment')),
  entity_id uuid not null,
  content text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.attachments (
  id uuid default uuid_generate_v4() primary key,
  entity_type text not null check (entity_type in ('customer','deal','installment')),
  entity_id uuid not null,
  file_url text not null,
  file_name text not null,
  file_size integer,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.activity_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete set null,
  user_name text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  entity_label text,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  type text not null check (type in ('payment_due','payment_overdue','payment_received','deal_created','below_min_price','installment_paused','refund')),
  title text not null,
  message text not null,
  is_read boolean not null default false,
  entity_type text,
  entity_id uuid,
  created_at timestamptz not null default now()
);

-- STEP 3: HELPER FUNCTION (no recursion)
create or replace function public.current_user_role()
returns text language sql security definer stable as $$
  select role from public.profiles where id = auth.uid()
$$;

-- STEP 4: ENABLE RLS
alter table public.profiles enable row level security;
alter table public.sales_agents enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.deals enable row level security;
alter table public.payment_plans enable row level security;
alter table public.installments enable row level security;
alter table public.notes enable row level security;
alter table public.attachments enable row level security;
alter table public.activity_logs enable row level security;
alter table public.notifications enable row level security;

-- STEP 5: RLS POLICIES
create policy "profiles_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_admin_select" on public.profiles for select using (public.current_user_role() = 'admin');
create policy "profiles_admin_all" on public.profiles for all using (public.current_user_role() = 'admin');
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

create policy "agents_select" on public.sales_agents for select using (auth.role() = 'authenticated');
create policy "agents_admin" on public.sales_agents for all using (public.current_user_role() = 'admin');

create policy "products_select" on public.products for select using (auth.role() = 'authenticated');
create policy "products_admin" on public.products for all using (public.current_user_role() = 'admin');

create policy "customers_admin" on public.customers for all using (public.current_user_role() = 'admin');
create policy "customers_finance_select" on public.customers for select using (public.current_user_role() = 'finance');
create policy "customers_agent_select" on public.customers for select using (
  public.current_user_role() = 'agent' and (
    created_by = auth.uid() or
    exists (select 1 from public.deals d join public.sales_agents sa on sa.id = d.agent_id where d.customer_id = customers.id and sa.profile_id = auth.uid())
  )
);
create policy "customers_insert" on public.customers for insert with check (auth.role() = 'authenticated');
create policy "customers_update_own" on public.customers for update using (created_by = auth.uid() or public.current_user_role() in ('admin','finance'));

create policy "deals_admin" on public.deals for all using (public.current_user_role() = 'admin');
create policy "deals_finance_select" on public.deals for select using (public.current_user_role() = 'finance');
create policy "deals_agent_select" on public.deals for select using (exists (select 1 from public.sales_agents sa where sa.id = deals.agent_id and sa.profile_id = auth.uid()));
create policy "deals_insert" on public.deals for insert with check (auth.role() = 'authenticated');
create policy "deals_update" on public.deals for update using (public.current_user_role() in ('admin','finance') or exists (select 1 from public.sales_agents sa where sa.id = deals.agent_id and sa.profile_id = auth.uid()));

create policy "plans_all" on public.payment_plans for all using (auth.role() = 'authenticated');

create policy "installments_admin" on public.installments for all using (public.current_user_role() = 'admin');
create policy "installments_finance_select" on public.installments for select using (public.current_user_role() = 'finance');
create policy "installments_finance_update" on public.installments for update using (public.current_user_role() = 'finance');
create policy "installments_agent_select" on public.installments for select using (exists (select 1 from public.deals d join public.sales_agents sa on sa.id = d.agent_id where d.id = installments.deal_id and sa.profile_id = auth.uid()));
create policy "installments_agent_update" on public.installments for update using (exists (select 1 from public.deals d join public.sales_agents sa on sa.id = d.agent_id where d.id = installments.deal_id and sa.profile_id = auth.uid()));
create policy "installments_insert" on public.installments for insert with check (auth.role() = 'authenticated');

create policy "notes_all" on public.notes for all using (auth.role() = 'authenticated');
create policy "attachments_all" on public.attachments for all using (auth.role() = 'authenticated');
create policy "logs_select" on public.activity_logs for select using (public.current_user_role() in ('admin','finance'));
create policy "logs_insert" on public.activity_logs for insert with check (auth.role() = 'authenticated');
create policy "notifs_select" on public.notifications for select using (auth.uid() = user_id);
create policy "notifs_update" on public.notifications for update using (auth.uid() = user_id);
create policy "notifs_insert" on public.notifications for insert with check (auth.role() = 'authenticated');

-- STEP 6: TRIGGERS
create or replace function update_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger set_updated_at before update on public.profiles for each row execute function update_updated_at();
create trigger set_updated_at before update on public.sales_agents for each row execute function update_updated_at();
create trigger set_updated_at before update on public.products for each row execute function update_updated_at();
create trigger set_updated_at before update on public.customers for each row execute function update_updated_at();
create trigger set_updated_at before update on public.deals for each row execute function update_updated_at();
create trigger set_updated_at before update on public.payment_plans for each row execute function update_updated_at();
create trigger set_updated_at before update on public.installments for each row execute function update_updated_at();

create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), coalesce(new.raw_user_meta_data->>'role', 'agent'));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.mark_late_installments() returns void as $$
begin
  update public.installments set status = 'late' where status = 'pending' and due_date < current_date;
end;
$$ language plpgsql security definer;

-- STEP 7: SEED PRODUCTS
insert into public.products (name, list_price_usd, min_price_usd, default_plan, notes) values
  ('Masterclass', 19, 19, 'one_shot', null),
  ('Individual Courses', 299, 99, 'two_shots', null),
  ('BugHuntingPro Path', 549, 499, 'five_shots', null),
  ('Cyber Security Specialist', 149, 129, 'one_shot', null),
  ('OffSecPro Path', 690, 599, 'five_shots', null),
  ('RedOpsPro Path', 990, 890, 'seven_shots', null),
  ('Hub Pro', 29, 29, 'monthly', 'Monthly subscription'),
  ('Custom Bundle / Other', 0, 0, 'custom', 'Manual price entry required'),
  ('OffSec + Android', 550, 499, 'custom', null),
  ('Cyber Security Packet', 148, 129, 'one_shot', null),
  ('SOC', 349, 150, 'three_shots', null);

-- STEP 8: RECREATE ADMIN PROFILE
insert into public.profiles (id, full_name, role)
select id, email, 'admin'
from auth.users
where email = 'marwa.i.abdulkareem@gmail.com'
on conflict (id) do update set role = 'admin';
