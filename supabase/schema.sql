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

-- Individual income/expense records.
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories (id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0),
  type text not null check (type in ('income', 'expense')),
  user_id uuid not null references auth.users (id) on delete cascade,
  occurred_on date not null,
  payment_method text not null check (
    payment_method in ('cash', 'card', 'transfer', 'other')
  ),
  notes text,
  created_at timestamptz not null default now()
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

-- Optional helper view to make monthly reporting easier.
create or replace view public.monthly_totals as
select
  date_trunc('month', occurred_on)::date as month,
  type,
  sum(amount) as total_amount
from public.transactions
group by 1, 2
order by 1 desc;

alter table public.categories enable row level security;
alter table public.transactions enable row level security;

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
