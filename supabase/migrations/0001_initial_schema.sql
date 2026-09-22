create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profile (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sex text not null,
  age integer not null check (age >= 0 and age <= 120),
  height_cm numeric(6,2) not null check (height_cm > 0),
  current_weight_kg numeric(6,2) not null check (current_weight_kg > 0),
  target_weight_min_kg numeric(6,2) not null check (target_weight_min_kg > 0),
  target_weight_max_kg numeric(6,2) not null check (target_weight_max_kg > 0),
  current_pb_text text not null,
  current_pb_seconds integer not null check (current_pb_seconds > 0),
  goal_time_text text not null,
  goal_time_seconds integer not null check (goal_time_seconds > 0),
  goal_pace_text text not null,
  goal_pace_seconds_per_km integer not null check (goal_pace_seconds_per_km > 0),
  target_race_name text,
  target_race_date date,
  location text not null,
  max_training_days integer not null check (max_training_days between 1 and 7),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create unique index if not exists profile_single_row_idx on public.profile ((true));

create table if not exists public.training_phases (
  id uuid primary key default gen_random_uuid(),
  phase_name text not null,
  start_date date not null,
  end_date date not null,
  goal text not null,
  weekly_mileage_min numeric(6,2) not null check (weekly_mileage_min >= 0),
  weekly_mileage_max numeric(6,2) not null check (weekly_mileage_max >= 0),
  training_days integer not null check (training_days between 1 and 7),
  key_workouts text,
  test_standard text,
  ai_notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint training_phases_date_order check (end_date >= start_date),
  constraint training_phases_mileage_order check (weekly_mileage_max >= weekly_mileage_min)
);

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  week_number integer not null check (week_number >= 1),
  workout_type text not null,
  title text not null,
  planned_distance_km numeric(6,2) not null default 0 check (planned_distance_km >= 0),
  planned_duration_min integer not null default 0 check (planned_duration_min >= 0),
  planned_pace_text text,
  planned_pace_seconds_per_km integer check (planned_pace_seconds_per_km is null or planned_pace_seconds_per_km >= 0),
  planned_rpe integer check (planned_rpe is null or planned_rpe between 1 and 10),
  purpose text,
  warmup text,
  main_set text,
  cooldown text,
  strength_training boolean not null default false,
  notes text,
  completed boolean not null default false,
  skipped boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint workouts_unique_identity unique (date, workout_type, title)
);

create table if not exists public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  date date not null,
  completed boolean not null default true,
  actual_distance_km numeric(6,2) not null default 0 check (actual_distance_km >= 0),
  actual_duration_seconds integer not null default 0 check (actual_duration_seconds >= 0),
  actual_pace_text text,
  actual_pace_seconds_per_km integer check (actual_pace_seconds_per_km is null or actual_pace_seconds_per_km >= 0),
  rpe integer check (rpe is null or rpe between 1 and 10),
  sleep_hours numeric(4,2) check (sleep_hours is null or sleep_hours between 0 and 24),
  body_weight_kg numeric(6,2) check (body_weight_kg is null or body_weight_kg > 0),
  fatigue_level integer check (fatigue_level is null or fatigue_level between 1 and 5),
  pain_area text,
  pain_score integer check (pain_score is null or pain_score between 0 and 10),
  weather text,
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint workout_logs_workout_id_unique unique (workout_id)
);

create table if not exists public.test_results (
  id uuid primary key default gen_random_uuid(),
  test_date date not null,
  test_type text not null,
  distance_km numeric(6,2) not null check (distance_km > 0),
  result_time_text text not null,
  result_time_seconds integer not null check (result_time_seconds > 0),
  avg_pace_text text not null,
  avg_pace_seconds_per_km integer not null check (avg_pace_seconds_per_km > 0),
  weather text,
  route text,
  feeling text,
  predicted_half_marathon_seconds integer check (predicted_half_marathon_seconds is null or predicted_half_marathon_seconds > 0),
  predicted_half_marathon_text text,
  ai_analysis text,
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  weight_kg numeric(6,2) not null check (weight_kg > 0),
  sleep_hours numeric(4,2) check (sleep_hours is null or sleep_hours between 0 and 24),
  fatigue_level integer check (fatigue_level is null or fatigue_level between 1 and 5),
  pain_area text,
  pain_score integer check (pain_score is null or pain_score between 0 and 10),
  resting_hr integer check (resting_hr is null or resting_hr > 0),
  recovery_score integer check (recovery_score is null or recovery_score between 0 and 100),
  ai_recovery_advice text,
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.plan_versions (
  id uuid primary key default gen_random_uuid(),
  version_name text not null,
  change_reason text,
  change_type text not null check (change_type in ('manual', 'ai', 'import', 'restore', 'system')),
  target_table text not null check (target_table in ('workouts', 'training_phases', 'full_plan')),
  before_data jsonb not null default '{}'::jsonb,
  after_data jsonb not null default '{}'::jsonb,
  created_by text not null check (created_by in ('user', 'ai', 'system')),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  suggestion_type text not null,
  input_summary text,
  suggestion_text text not null,
  structured_plan jsonb,
  risk_level text check (risk_level is null or risk_level in ('green', 'yellow', 'orange', 'red')),
  applied boolean not null default false,
  created_at timestamp with time zone not null default now(),
  applied_at timestamp with time zone,
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  reminder_type text not null,
  enabled boolean not null default true,
  reminder_time time,
  message text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  access_code_enabled boolean not null default true,
  dark_mode boolean not null default false,
  pwa_enabled boolean not null default true,
  notification_enabled boolean not null default false,
  ai_model text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create unique index if not exists app_settings_single_row_idx on public.app_settings ((true));

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  action_type text not null,
  target_table text not null,
  target_id uuid,
  before_data jsonb,
  after_data jsonb,
  source text not null check (source in ('manual', 'ai', 'import', 'restore', 'system')),
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.error_logs (
  id uuid primary key default gen_random_uuid(),
  error_type text not null,
  message text not null,
  stack text,
  route text,
  payload jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists workouts_date_idx on public.workouts (date);
create index if not exists workout_logs_date_idx on public.workout_logs (date);
create index if not exists body_metrics_date_idx on public.body_metrics (date);
create index if not exists test_results_test_date_idx on public.test_results (test_date);
create index if not exists training_phases_start_end_date_idx on public.training_phases (start_date, end_date);
create index if not exists ai_suggestions_created_at_idx on public.ai_suggestions (created_at desc);
create index if not exists plan_versions_created_at_idx on public.plan_versions (created_at desc);
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists error_logs_created_at_idx on public.error_logs (created_at desc);

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'profile', 'training_phases', 'workouts', 'workout_logs', 'test_results',
    'body_metrics', 'plan_versions', 'ai_suggestions', 'reminders', 'app_settings',
    'audit_logs', 'error_logs'
  ] loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', tbl, tbl);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', tbl, tbl);
  end loop;
end $$;

alter table public.profile enable row level security;
alter table public.training_phases enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_logs enable row level security;
alter table public.test_results enable row level security;
alter table public.body_metrics enable row level security;
alter table public.plan_versions enable row level security;
alter table public.ai_suggestions enable row level security;
alter table public.reminders enable row level security;
alter table public.app_settings enable row level security;
alter table public.audit_logs enable row level security;
alter table public.error_logs enable row level security;
