create table public.learner_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  daily_minutes integer not null default 30 check (daily_minutes between 10 and 180),
  study_mode text not null default 'balanced' check (study_mode in ('steady', 'balanced', 'intensive')),
  engineering_specialty text not null default 'mechatronics',
  goal_track text not null default 'job_interviews',
  starting_band text not null default 'A2/B1',
  vocabulary_weight integer not null default 25 check (vocabulary_weight between 0 and 100),
  grammar_weight integer not null default 20 check (grammar_weight between 0 and 100),
  listening_weight integer not null default 15 check (listening_weight between 0 and 100),
  speaking_weight integer not null default 25 check (speaking_weight between 0 and 100),
  writing_weight integer not null default 15 check (writing_weight between 0 and 100),
  calibration_confidence integer not null default 15 check (calibration_confidence between 0 and 100),
  reminder_enabled boolean not null default true,
  reminder_hour_utc integer not null default 17 check (reminder_hour_utc between 0 and 23),
  last_reminder_date_key date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.skill_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date_key date not null,
  vocabulary_score integer not null check (vocabulary_score between 0 and 100),
  grammar_score integer not null check (grammar_score between 0 and 100),
  listening_score integer not null check (listening_score between 0 and 100),
  speaking_score integer not null check (speaking_score between 0 and 100),
  writing_score integer not null check (writing_score between 0 and 100),
  aggregate_score integer not null check (aggregate_score between 0 and 100),
  practical_band text not null,
  evidence_count integer not null default 0,
  summary text not null,
  created_at timestamptz not null default now()
);

create index skill_snapshots_user_date_idx on public.skill_snapshots(user_id, date_key desc);

create table public.diagnostic_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  skill text not null check (skill in ('vocabulary', 'grammar', 'listening', 'speaking', 'writing')),
  evidence_type text not null,
  prompt text not null,
  response text not null,
  score integer not null check (score between 0 and 100),
  created_at timestamptz not null default now()
);

create index diagnostic_attempts_user_skill_idx on public.diagnostic_attempts(user_id, skill, created_at desc);

create table public.vocabulary_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_id text,
  term text not null,
  arabic_meaning text not null,
  part_of_speech text not null,
  ipa text not null,
  engineering_domain text not null,
  examples jsonb not null default '[]'::jsonb,
  review_strength integer not null default 0 check (review_strength >= 0),
  review_count integer not null default 0 check (review_count >= 0),
  next_review_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, content_id)
);

create index vocabulary_cards_user_due_idx on public.vocabulary_cards(user_id, next_review_at);

create table public.card_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.vocabulary_cards(id) on delete cascade,
  rating text not null check (rating in ('again', 'hard', 'good', 'easy')),
  strength_after integer not null check (strength_after >= 0),
  reviewed_at timestamptz not null default now()
);

create index card_reviews_user_card_idx on public.card_reviews(user_id, card_id, reviewed_at desc);

create table public.daily_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date_key date not null,
  task_key text not null,
  content_id text,
  skill text not null check (skill in ('vocabulary', 'grammar', 'listening', 'speaking', 'writing')),
  title text not null,
  instructions text not null,
  minutes integer not null check (minutes > 0),
  status text not null default 'pending' check (status in ('pending', 'completed')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id, date_key, task_key)
);

create index daily_tasks_user_date_idx on public.daily_tasks(user_id, date_key desc);

create table public.learner_content_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_id text not null,
  skill text not null check (skill in ('vocabulary', 'grammar', 'listening', 'speaking', 'writing')),
  status text not null default 'introduced' check (status in ('introduced', 'completed', 'mastered')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  completed_at timestamptz,
  next_review_at timestamptz,
  completion_count integer not null default 0 check (completion_count >= 0),
  unique(user_id, content_id)
);

create index learner_content_progress_user_skill_review_idx on public.learner_content_progress(user_id, skill, next_review_at);

create table public.learner_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  source_date_key date not null,
  title text not null,
  content text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id, kind, source_date_key)
);

create index learner_notifications_user_created_idx on public.learner_notifications(user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger learner_profiles_set_updated_at before update on public.learner_profiles
for each row execute function public.set_updated_at();

create trigger vocabulary_cards_set_updated_at before update on public.vocabulary_cards
for each row execute function public.set_updated_at();

alter table public.learner_profiles enable row level security;
alter table public.skill_snapshots enable row level security;
alter table public.diagnostic_attempts enable row level security;
alter table public.vocabulary_cards enable row level security;
alter table public.card_reviews enable row level security;
alter table public.daily_tasks enable row level security;
alter table public.learner_content_progress enable row level security;
alter table public.learner_notifications enable row level security;

create policy "learner_profiles_own_rows" on public.learner_profiles for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "skill_snapshots_own_rows" on public.skill_snapshots for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "diagnostic_attempts_own_rows" on public.diagnostic_attempts for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "vocabulary_cards_own_rows" on public.vocabulary_cards for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "card_reviews_own_rows" on public.card_reviews for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "daily_tasks_own_rows" on public.daily_tasks for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "learner_content_progress_own_rows" on public.learner_content_progress for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "learner_notifications_own_rows" on public.learner_notifications for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
