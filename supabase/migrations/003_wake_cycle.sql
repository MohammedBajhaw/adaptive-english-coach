-- Wake cycle (the "day" of the whole app) and the vocabulary session load.
-- Run once in Supabase: SQL Editor -> paste -> Run. Safe to run twice.

alter table public.learner_profiles
  add column if not exists cycle_number integer not null default 0 check (cycle_number >= 0),
  add column if not exists cycle_opened_at timestamptz,
  add column if not exists cycle_started_at timestamptz,
  add column if not exists cycle_date_key date,
  add column if not exists cycle_hours integer not null default 18 check (cycle_hours between 6 and 24),
  add column if not exists wake_prompt_sent_at timestamptz,
  add column if not exists daily_reminder_after_hours integer not null default 8 check (daily_reminder_after_hours between 0 and 23),
  add column if not exists vocab_session_closed_at timestamptz;

-- Vocabulary reminders now repeat every two hours by default.
alter table public.learner_profiles alter column vocab_reminder_every_hours set default 2;
update public.learner_profiles set vocab_reminder_every_hours = 2 where vocab_reminder_every_hours = 3;

alter table public.vocabulary_cards
  add column if not exists intake_rating text check (intake_rating in ('again', 'hard', 'good', 'easy')),
  add column if not exists intake_at timestamptz,
  add column if not exists last_rating text check (last_rating in ('again', 'hard', 'good', 'easy')),
  add column if not exists last_reviewed_at timestamptz;

-- One-time bring-over of the existing cards (only rows that were reviewed before this migration and have no intake yet):
-- fill the intake and last rating from the review history, and move to the new fixed schedule:
-- not easy -> due now and then every two hours; easy -> back after three weeks.
with first_review as (
  select distinct on (card_id) card_id, rating, reviewed_at from public.card_reviews order by card_id, reviewed_at asc
), last_review as (
  select distinct on (card_id) card_id, rating, reviewed_at from public.card_reviews order by card_id, reviewed_at desc
)
update public.vocabulary_cards c
set intake_rating = f.rating,
    intake_at = f.reviewed_at,
    last_rating = l.rating,
    last_reviewed_at = l.reviewed_at,
    next_review_at = case when l.rating = 'easy' then now() + interval '21 days' else now() end
from first_review f
join last_review l on l.card_id = f.card_id
where c.id = f.card_id
  and c.intake_at is null
  and c.review_count > 0
  and (c.content_id is null or c.content_id not like 'vocabulary.%');

create index if not exists vocabulary_cards_user_last_rating_idx on public.vocabulary_cards(user_id, last_rating);
