create table if not exists public.candidate_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  source text not null default 'gmail',
  source_message_id text not null,
  category text not null check (category in ('trial', 'renewal', 'return', 'bill', 'followup')),
  title text not null,
  description text,
  merchant text,
  amount numeric(10,2),
  currency text not null default 'USD',
  due_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'kept', 'dismissed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, source, source_message_id)
);

create index if not exists candidate_items_user_status_due_idx
  on public.candidate_items (user_id, status, due_at);

alter table public.candidate_items enable row level security;

drop policy if exists "candidate items select own rows" on public.candidate_items;
create policy "candidate items select own rows"
  on public.candidate_items
  for select
  using (auth.uid() = user_id);

drop policy if exists "candidate items update own rows" on public.candidate_items;
create policy "candidate items update own rows"
  on public.candidate_items
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists candidate_items_set_updated_at on public.candidate_items;
create trigger candidate_items_set_updated_at
before update on public.candidate_items
for each row execute function public.set_updated_at();
