alter table public.app_settings
add column if not exists training_preferences jsonb not null default jsonb_build_object(
  'training_days_per_week', 5,
  'preferred_long_run_day', 'sunday',
  'allowed_hard_workout_days', jsonb_build_array('tuesday', 'thursday'),
  'strength_training_enabled', true,
  'strength_context', 'bodyweight',
  'weekly_time_capacity_minutes', null,
  'weekly_mileage_tolerance_km', null,
  'temporary_constraint', 'none'
);
