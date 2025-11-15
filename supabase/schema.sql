-- Enable UUID generation helpers. You only need this once per database.
create extension if not exists "pgcrypto";

-- Categories table for both income and expense groupings.
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('income', 'expense')),
  icon text not null default '🏷️',
  user_id uuid not null references auth.users (id) on delete cascade,
  color text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  currency_code text not null default 'USD',
  display_name text,
  pay_cycle_start_day integer not null default 1 check (pay_cycle_start_day between 1 and 31),
  saved_filters jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Individual income/expense records.
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories (id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0),
  type text not null check (type in ('income', 'expense')),
  user_id uuid not null references auth.users (id) on delete cascade,
  currency_code text not null default 'USD',
  occurred_on date not null,
  payment_method text not null check (
    payment_method in ('cash', 'card', 'transfer', 'other')
  ),
  notes text,
  created_at timestamptz not null default now()
);

-- Category budgets per month stored as integer cents for precision.
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  amount_cents bigint not null check (amount_cents >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, category_id, month)
);

create index if not exists transactions_occurred_on_idx
  on public.transactions (occurred_on desc);

create index if not exists transactions_category_id_idx
  on public.transactions (category_id);
create index if not exists transactions_user_id_idx
  on public.transactions (user_id);
create index if not exists categories_user_id_idx
  on public.categories (user_id);
create unique index if not exists categories_user_id_name_key
  on public.categories (user_id, name);
create index if not exists user_settings_currency_code_idx
  on public.user_settings (currency_code);
create index if not exists budgets_user_month_idx
  on public.budgets (user_id, month);
create index if not exists transactions_user_month_category_idx
  on public.transactions (user_id, occurred_on, category_id)
  where type = 'expense';

-- Optional helper view to make monthly reporting easier per user.
create or replace view public.monthly_totals as
select
  user_id,
  date_trunc('month', occurred_on)::date as month,
  type,
  sum(amount) as total_amount
from public.transactions
group by user_id, 2, 3
order by month desc;

alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.user_settings enable row level security;
alter table public.budgets enable row level security;

create policy if not exists "Users can view their categories"
  on public.categories for select
  using (auth.uid() = user_id);

create policy if not exists "Users can insert their categories"
  on public.categories for insert
  with check (auth.uid() = user_id);

create policy if not exists "Users can update their categories"
  on public.categories for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy if not exists "Users can delete their categories"
  on public.categories for delete
  using (auth.uid() = user_id);

create policy if not exists "Users can view their transactions"
  on public.transactions for select
  using (auth.uid() = user_id);

create policy if not exists "Users can insert their transactions"
  on public.transactions for insert
  with check (auth.uid() = user_id);

create policy if not exists "Users can update their transactions"
  on public.transactions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy if not exists "Users can delete their transactions"
  on public.transactions for delete
  using (auth.uid() = user_id);

create policy if not exists "Users can manage their settings"
  on public.user_settings
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

do $$
begin
  create policy budgets_select on public.budgets for select using (auth.uid() = user_id);
  create policy budgets_insert on public.budgets for insert with check (auth.uid() = user_id);
  create policy budgets_update on public.budgets for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  create policy budgets_delete on public.budgets for delete using (auth.uid() = user_id);
exception
  when duplicate_object then
    null;
end $$;

-- View comparing spend vs budget per category/month.
create or replace view public.v_budget_summary as
with budget_cycles as (
  select
    b.user_id,
    b.month,
    b.category_id,
    b.amount_cents,
    u.pay_cycle_start_day,
    date_trunc('month', to_date(b.month || '-01', 'YYYY-MM-DD')) as base_month
  from public.budgets b
  join public.user_settings u on u.user_id = b.user_id
),
cycle_ranges as (
  select
    bc.user_id,
    bc.month,
    bc.category_id,
    bc.amount_cents,
    (
      bc.base_month
      + (least(bc.pay_cycle_start_day, extract(day from bc.base_month + interval '1 month - 1 day')::int) - 1) * interval '1 day'
    )::date as cycle_start,
    (
      bc.base_month
      + (least(bc.pay_cycle_start_day, extract(day from bc.base_month + interval '1 month - 1 day')::int) - 1) * interval '1 day'
      + interval '1 month'
    )::date as cycle_end
  from budget_cycles bc
)
select
  cr.user_id,
  cr.month,
  cr.category_id,
  cr.amount_cents as budget_cents,
  coalesce((
    select sum((t.amount * 100)::bigint)
    from public.transactions t
    where t.user_id = cr.user_id
      and t.type = 'expense'
      and t.category_id = cr.category_id
      and t.occurred_on >= cr.cycle_start
      and t.occurred_on < cr.cycle_end
  ), 0) as spent_cents
from cycle_ranges cr;

-- RPC to fetch budget summary for a month (scoped via RLS).
create or replace function public.rpc_get_budget_summary(p_month text)
returns table (
  category_id uuid,
  budget_cents bigint,
  spent_cents bigint,
  remaining_cents bigint,
  used_pct numeric
)
language sql
stable
as $$
  select
    v.category_id,
    v.budget_cents,
    v.spent_cents,
    (v.budget_cents - v.spent_cents) as remaining_cents,
    case
      when v.budget_cents = 0 then 0
      else round(100.0 * v.spent_cents::numeric / nullif(v.budget_cents, 0), 1)
    end as used_pct
  from public.v_budget_summary v
  where v.user_id = auth.uid()
    and v.month = p_month
  order by used_pct desc nulls last, v.category_id;
$$;

-- RPC to copy budgets from one month into another (skip existing rows).
create or replace function public.rpc_copy_budgets(p_from_month text, p_to_month text)
returns integer
language plpgsql
security definer
as $$
declare
  inserted integer;
begin
  insert into public.budgets (user_id, category_id, month, amount_cents)
  select auth.uid(), b.category_id, p_to_month, b.amount_cents
  from public.budgets b
  where b.user_id = auth.uid()
    and b.month = p_from_month
    and not exists (
      select 1
      from public.budgets existing
      where existing.user_id = auth.uid()
        and existing.category_id = b.category_id
        and existing.month = p_to_month
    );

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;
