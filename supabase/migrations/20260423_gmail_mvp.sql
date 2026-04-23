create table if not exists public.gmail_connections (
  user_id uuid primary key references public.users(id) on delete cascade,
  gmail_email text not null,
  scope text[] not null default '{}'::text[],
  connected_at timestamptz not null default timezone('utc', now()),
  last_synced_at timestamptz,
  last_sync_status text not null default 'connected'
    check (last_sync_status in ('connected', 'synced', 'error')),
  last_sync_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.gmail_tokens (
  user_id uuid primary key references public.users(id) on delete cascade,
  access_token text,
  refresh_token text,
  scope text[] not null default '{}'::text[],
  token_type text,
  expires_at timestamptz,
  oauth_state text,
  oauth_state_expires_at timestamptz,
  oauth_return_to text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists gmail_tokens_oauth_state_idx
  on public.gmail_tokens (oauth_state);

alter table public.gmail_connections enable row level security;
alter table public.gmail_tokens enable row level security;

drop policy if exists "gmail connections own rows" on public.gmail_connections;
create policy "gmail connections own rows"
  on public.gmail_connections
  for select
  using (auth.uid() = user_id);

drop trigger if exists gmail_connections_set_updated_at on public.gmail_connections;
create trigger gmail_connections_set_updated_at
before update on public.gmail_connections
for each row execute function public.set_updated_at();

drop trigger if exists gmail_tokens_set_updated_at on public.gmail_tokens;
create trigger gmail_tokens_set_updated_at
before update on public.gmail_tokens
for each row execute function public.set_updated_at();
