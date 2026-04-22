create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  name text not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  notification_time text not null default '09:00',
  enabled_categories text[] not null default array['trial','renewal','return','bill','followup'],
  onboarding_completed boolean not null default false,
  gmail_connected boolean not null default false,
  plan_tier text not null default 'free' check (plan_tier in ('free', 'premium')),
  push_enabled boolean not null default true,
  email_digest_enabled boolean not null default false,
  quiet_hours_enabled boolean not null default true,
  first_capture_completed boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.undo_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null,
  detail text,
  category text not null check (category in ('trial', 'renewal', 'return', 'bill', 'followup')),
  source_type text not null default 'manual' check (source_type in ('manual', 'text', 'screenshot', 'auto')),
  due_date timestamptz not null,
  urgency text,
  amount numeric(10,2),
  amount_display text,
  merchant_name text,
  source_label text,
  status text not null default 'active' check (status in ('active', 'snoozed', 'done', 'archived')),
  notes text,
  remind_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists undo_items_user_due_idx on public.undo_items (user_id, due_date);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  undo_item_id uuid not null references public.undo_items (id) on delete cascade,
  remind_at timestamptz not null,
  reminder_type text not null check (reminder_type in ('default', 'premium', 'manual', 'snooze')),
  status text not null default 'scheduled' check (status in ('scheduled', 'sent', 'cancelled')),
  channel text not null default 'in_app' check (channel in ('in_app')),
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists reminders_item_idx on public.reminders (undo_item_id, remind_at);

create table if not exists public.uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  file_type text not null check (file_type in ('text', 'screenshot')),
  extracted_text text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, 'undo'), '@', 1))
  )
  on conflict (id) do update
  set email = excluded.email,
      name = excluded.name;

  insert into public.preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists preferences_set_updated_at on public.preferences;
create trigger preferences_set_updated_at
before update on public.preferences
for each row execute procedure public.set_updated_at();

drop trigger if exists undo_items_set_updated_at on public.undo_items;
create trigger undo_items_set_updated_at
before update on public.undo_items
for each row execute procedure public.set_updated_at();

alter table public.users enable row level security;
alter table public.preferences enable row level security;
alter table public.undo_items enable row level security;
alter table public.reminders enable row level security;
alter table public.uploads enable row level security;

create policy "users select own profile"
on public.users for select
using (auth.uid() = id);

create policy "users update own profile"
on public.users for update
using (auth.uid() = id);

create policy "preferences own rows"
on public.preferences for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "undo items own rows"
on public.undo_items for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "reminders own rows"
on public.reminders for all
using (
  exists (
    select 1
    from public.undo_items
    where public.undo_items.id = reminders.undo_item_id
      and public.undo_items.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.undo_items
    where public.undo_items.id = reminders.undo_item_id
      and public.undo_items.user_id = auth.uid()
  )
);

create policy "uploads own rows"
on public.uploads for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
