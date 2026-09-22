export type RiskLevel = "green" | "yellow" | "orange" | "red";

export type TrainingDay =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type TrainingPreferences = {
  training_days_per_week: number;
  preferred_long_run_day: TrainingDay;
  allowed_hard_workout_days: TrainingDay[];
  strength_training_enabled: boolean;
  strength_context: "bodyweight" | "equipment";
  weekly_time_capacity_minutes: number | null;
  weekly_mileage_tolerance_km: number | null;
  temporary_constraint: "none" | "travel_week" | "reduced_load_week";
};

export type Profile = {
  id: string;
  name: string;
  sex: string;
  age: number;
  height_cm: number;
  current_weight_kg: number;
  target_weight_min_kg: number;
  target_weight_max_kg: number;
  current_pb_text: string;
  current_pb_seconds: number;
  goal_time_text: string;
  goal_time_seconds: number;
  goal_pace_text: string;
  goal_pace_seconds_per_km: number;
  target_race_name: string | null;
  target_race_date: string | null;
  location: string;
  max_training_days: number;
};

export type TrainingPhase = {
  id: string;
  phase_name: string;
  start_date: string;
  end_date: string;
  goal: string;
  weekly_mileage_min: number;
  weekly_mileage_max: number;
  training_days: number;
  key_workouts: string | null;
  test_standard: string | null;
  ai_notes: string | null;
};

export type Workout = {
  id: string;
  date: string;
  week_number: number;
  workout_type: string;
  title: string;
  planned_distance_km: number;
  planned_duration_min: number;
  planned_pace_text: string | null;
  planned_pace_seconds_per_km: number | null;
  planned_rpe: number | null;
  purpose: string | null;
  warmup: string | null;
  main_set: string | null;
  cooldown: string | null;
  strength_training: boolean;
  notes: string | null;
  constraint_reasons?: string[];
  is_preference_adjusted?: boolean;
  completed: boolean;
  skipped: boolean;
  created_at?: string;
  updated_at?: string;
};

export type WorkoutSummary = Pick<Workout, "id" | "title" | "planned_rpe" | "planned_distance_km" | "workout_type">;

export type VersionChangeTag =
  | "added_workouts"
  | "removed_workouts"
  | "moved_workouts"
  | "resized_workouts"
  | "preference_adjusted"
  | "execution_guardrail"
  | "phase_window_changed";

export type PlanVersionSummary = {
  id: string;
  version_name: string;
  change_reason: string | null;
  change_type: "manual" | "ai" | "import" | "restore" | "system";
  target_table: "workouts" | "training_phases" | "full_plan";
  created_by: "user" | "ai" | "system";
  created_at: string;
  source_suggestion_id?: string | null;
  source_suggestion_type?: string | null;
  source_suggestion_text?: string | null;
  impact_summary?: string;
  highlights?: string[];
  change_tags?: VersionChangeTag[];
  changed_workout_count?: number;
  changed_phase_count?: number;
  affected_dates?: string[];
  before_data?: unknown;
  after_data?: unknown;
};

export type VersionDiffSnapshot = {
  headline: string;
  details: string[];
};

export type AISuggestionSummary = {
  id: string;
  suggestion_type: string;
  suggestion_text: string;
  risk_level: RiskLevel | null;
  applied: boolean;
  created_at: string;
};

export type AISuggestionHistoryItem = AISuggestionSummary & {
  applied_at?: string | null;
  input_summary?: string | null;
  structured_plan?: unknown;
  related_versions?: PlanVersionSummary[];
  applied_version_id?: string | null;
  affected_dates?: string[];
  related_workouts?: Array<{
    id: string;
    date: string;
    title: string;
    workout_type: string;
  }>;
};

export type WorkoutPlanSnapshot = {
  date: string | null;
  planned_distance_km: number;
  planned_duration_min: number;
  planned_rpe: number | null;
  notes: string | null;
};

export type WorkoutVersionChange = {
  version_id: string;
  version_name: string;
  workout_id: string | null;
  workout_title: string;
  workout_type: string | null;
  created_at: string;
  change_type: PlanVersionSummary["change_type"];
  change_reason: string | null;
  source_suggestion_type?: string | null;
  source_suggestion_text?: string | null;
  before: WorkoutPlanSnapshot | null;
  after: WorkoutPlanSnapshot | null;
  changes: string[];
  triggers: string[];
};

export type WorkoutExplanation = {
  is_preference_adjusted: boolean;
  constraint_reasons: string[];
  latest_audit_note: string | null;
  recent_versions: PlanVersionSummary[];
  source_suggestion: AISuggestionSummary | null;
  execution_review: WorkoutExecutionReview | null;
  change_details: WorkoutVersionChange[];
};

export type WorkoutExecutionReview = {
  status: "no_log" | "on_target" | "completed_hard" | "shortened" | "overreached";
  pattern:
    | "well_executed"
    | "easy_day_too_fast"
    | "tempo_costly"
    | "long_run_faded"
    | "interval_costly"
    | "volume_shortfall"
    | "overextended_load";
  pattern_label: string;
  headline: string;
  summary: string;
  distance_delta_km: number | null;
  duration_delta_min: number | null;
  pace_delta_seconds_per_km: number | null;
  effort_delta: number | null;
  recommendation: string;
};

export type WorkoutLog = {
  id: string;
  workout_id: string;
  date: string;
  completed: boolean;
  actual_distance_km: number;
  actual_duration_seconds: number;
  actual_pace_text: string | null;
  actual_pace_seconds_per_km: number | null;
  rpe: number | null;
  sleep_hours: number | null;
  body_weight_kg: number | null;
  fatigue_level: number | null;
  pain_area: string | null;
  pain_score: number | null;
  weather: string | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
  workouts?: WorkoutSummary | null;
};

export type WorkoutWithLog = Workout & { log: WorkoutLog | null; explanation?: WorkoutExplanation };

export type RiskResult = {
  risk_level: RiskLevel;
  reasons: string[];
  recommended_action: string;
  should_modify_today: boolean;
};

export type AppSettings = {
  id: string;
  access_code_enabled: boolean;
  dark_mode: boolean;
  pwa_enabled: boolean;
  notification_enabled: boolean;
  ai_model: string | null;
  training_preferences: TrainingPreferences;
  created_at?: string;
  updated_at?: string;
};

export type DashboardStats = {
  weekly_mileage_km: number;
  planned_weekly_mileage_km: number;
  monthly_mileage_km: number;
  weekly_training_days: number;
  recent_7_day_completion_rate: number;
  recent_7_day_completed_count: number;
  recent_7_day_planned_count: number;
};

export type BodySummary = {
  current_weight_kg: number | null;
  target_weight_min_kg: number | null;
  target_weight_max_kg: number | null;
  latest_sleep_hours: number | null;
  latest_fatigue_level: number | null;
  latest_pain_area: string | null;
  latest_pain_score: number | null;
};

export type GoalSummary = {
  target_race_name: string | null;
  target_race_date: string | null;
  countdown_days: number | null;
  countdown_text: string;
  current_pb_text: string | null;
  current_pb_seconds: number | null;
  goal_time_text: string | null;
  goal_time_seconds: number | null;
  goal_pace_text: string | null;
  goal_pace_seconds_per_km: number | null;
};

export type TodayBrief = {
  status: "empty" | "completed" | "skipped" | "pending";
  headline: string;
  workout_title: string;
  workout_type: string | null;
  purpose: string;
  focus: string;
  caution: string;
  recommendation: string;
  should_modify_today: boolean;
  modified_workout_label: string | null;
};

export type ReadinessSummary = {
  sleep_hours: number | null;
  fatigue_level: number | null;
  pain_area: string | null;
  pain_score: number | null;
  weather_note: string;
  recommendation: string;
};

export type WeeklySummary = {
  next_key_workout: string;
  completion_trend: string;
  risk_explanation: string;
  preference_summary: string;
};

export type ExecutionQualitySummary = {
  quality_score: number;
  dominant_status: "stable" | "completed_hard" | "shortened" | "overreached" | "insufficient_data";
  headline: string;
  summary: string;
  recommendation: string;
  counts: {
    on_target: number;
    completed_hard: number;
    shortened: number;
    overreached: number;
  };
};

export type RecentPlanAdjustmentSummary = {
  kind: "moved" | "resized" | "guardrail" | "adjusted" | "none";
  label: string;
  version_id: string | null;
  version_name: string | null;
  created_at: string | null;
  summary: string;
  detail: string;
};

export type DashboardData = {
  today: string;
  profile: Profile | null;
  today_workouts: WorkoutWithLog[];
  today_status: "empty" | "completed" | "skipped" | "pending";
  stats: DashboardStats;
  current_phase: TrainingPhase | null;
  body: BodySummary;
  goal: GoalSummary;
  risk: RiskResult;
  ai_today_advice: string;
  training_preferences: TrainingPreferences;
  today_brief: TodayBrief;
  readiness: ReadinessSummary;
  weekly_summary: WeeklySummary;
  recent_execution_quality: ExecutionQualitySummary;
  recent_plan_adjustment: RecentPlanAdjustmentSummary;
};

export type SettingsData = {
  profile: Profile | null;
  app_settings: AppSettings | null;
};

export type StatsSummary = {
  planned_workouts: number;
  completed_workouts: number;
  completion_rate: number;
  total_actual_km: number;
};

export type StatsData = {
  summary: StatsSummary;
  weekly_mileage_trend: Array<{ week_start: string; actual_km: number; planned_km: number }>;
  monthly_mileage_trend: Array<{ month: string; actual_km: number; planned_km: number }>;
  completion_rate: Array<{ label: string; value: number }>;
  pace_trend: Array<{ date: string; pace_seconds_per_km: number; pace_text: string | null }>;
  weight_trend: Array<{ date: string; weight_kg: number }>;
  sleep_trend: Array<{ date: string; sleep_hours: number }>;
  fatigue_trend: Array<{ date: string; fatigue_level: number }>;
  rpe_mileage: Array<{ date: string; rpe: number; distance_km: number }>;
  type_distribution: Array<{ workout_type: string; count: number }>;
  test_trend: Array<{
    date: string;
    test_type: string;
    result_time_seconds: number;
    avg_pace_seconds_per_km: number;
    predicted_half_marathon_seconds: number | null;
  }>;
  workout_type_comparison?: Array<{
    workout_type: string;
    count: number;
    avg_distance_km: number;
    avg_rpe: number | null;
    avg_pace_seconds_per_km: number | null;
  }>;
  completion_quality_trend?: Array<{
    date: string;
    title: string;
    status: WorkoutExecutionReview["status"];
    pattern: WorkoutExecutionReview["pattern"];
    pattern_label: string;
    score: number;
    headline: string;
  }>;
  completion_quality_summary?: {
    on_target: number;
    completed_hard: number;
    shortened: number;
    overreached: number;
  };
  readiness_load?: {
    fatigue_score: number;
    sleep_score: number;
    consistency_score: number;
    recommendation: string;
  };
};
