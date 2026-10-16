-- Phone reminders (Web Push): device subscriptions and per-learner reminder preferences.
-- Run once in Supabase: SQL Editor -> paste -> Run. Safe to run twice.

alter table public.learner_profiles
  add column if not exists timezone text not null default 'UTC',
  add column if not exists reminder_hour_local integer not null default 20 check (reminder_hour_local between 0 and 23),
  add column if not exists vocab_reminder_enabled boolean not null default true,
  add column if not exists vocab_reminder_every_hours integer not null default 3 check (vocab_reminder_every_hours between 1 and 12),
  add column if not exists reminder_window_start integer not null default 9 check (reminder_window_start between 0 and 23),
  add column if not exists reminder_window_end integer not null default 21 check (reminder_window_end between 1 and 24),
  add column if not exists last_vocab_push_at timestamptz,
  add column if not exists last_daily_push_date date;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_success_at timestamptz
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_own_rows" on public.push_subscriptions;
create policy "push_subscriptions_own_rows" on public.push_subscriptions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
