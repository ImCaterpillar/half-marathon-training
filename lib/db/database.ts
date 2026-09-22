export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profile: {
        Row: {
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
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profile"]["Row"]> & Pick<Database["public"]["Tables"]["profile"]["Row"], "name" | "sex" | "age" | "height_cm" | "current_weight_kg" | "target_weight_min_kg" | "target_weight_max_kg" | "current_pb_text" | "current_pb_seconds" | "goal_time_text" | "goal_time_seconds" | "goal_pace_text" | "goal_pace_seconds_per_km" | "location" | "max_training_days">;
        Update: Partial<Database["public"]["Tables"]["profile"]["Row"]>;
      };
      training_phases: {
        Row: {
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
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["training_phases"]["Row"]> & Pick<Database["public"]["Tables"]["training_phases"]["Row"], "phase_name" | "start_date" | "end_date" | "goal" | "weekly_mileage_min" | "weekly_mileage_max" | "training_days">;
        Update: Partial<Database["public"]["Tables"]["training_phases"]["Row"]>;
      };
      workouts: {
        Row: {
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
          completed: boolean;
          skipped: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["workouts"]["Row"]> & Pick<Database["public"]["Tables"]["workouts"]["Row"], "date" | "week_number" | "workout_type" | "title">;
        Update: Partial<Database["public"]["Tables"]["workouts"]["Row"]>;
      };
      workout_logs: {
        Row: {
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
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["workout_logs"]["Row"]> & Pick<Database["public"]["Tables"]["workout_logs"]["Row"], "workout_id" | "date" | "actual_distance_km" | "actual_duration_seconds">;
        Update: Partial<Database["public"]["Tables"]["workout_logs"]["Row"]>;
      };
      test_results: {
        Row: {
          id: string;
          test_date: string;
          test_type: string;
          distance_km: number;
          result_time_text: string;
          result_time_seconds: number;
          avg_pace_text: string;
          avg_pace_seconds_per_km: number;
          weather: string | null;
          route: string | null;
          feeling: string | null;
          predicted_half_marathon_seconds: number | null;
          predicted_half_marathon_text: string | null;
          ai_analysis: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["test_results"]["Row"]> & Pick<Database["public"]["Tables"]["test_results"]["Row"], "test_date" | "test_type" | "distance_km" | "result_time_text" | "result_time_seconds" | "avg_pace_text" | "avg_pace_seconds_per_km">;
        Update: Partial<Database["public"]["Tables"]["test_results"]["Row"]>;
      };
      body_metrics: {
        Row: {
          id: string;
          date: string;
          weight_kg: number;
          sleep_hours: number | null;
          fatigue_level: number | null;
          pain_area: string | null;
          pain_score: number | null;
          resting_hr: number | null;
          recovery_score: number | null;
          ai_recovery_advice: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["body_metrics"]["Row"]> & Pick<Database["public"]["Tables"]["body_metrics"]["Row"], "date" | "weight_kg">;
        Update: Partial<Database["public"]["Tables"]["body_metrics"]["Row"]>;
      };
      plan_versions: {
        Row: {
          id: string;
          version_name: string;
          change_reason: string | null;
          change_type: "manual" | "ai" | "import" | "restore" | "system";
          target_table: "workouts" | "training_phases" | "full_plan";
          before_data: Json;
          after_data: Json;
          created_by: "user" | "ai" | "system";
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["plan_versions"]["Row"]> & Pick<Database["public"]["Tables"]["plan_versions"]["Row"], "version_name" | "change_type" | "target_table" | "before_data" | "after_data" | "created_by">;
        Update: Partial<Database["public"]["Tables"]["plan_versions"]["Row"]>;
      };
      ai_suggestions: {
        Row: {
          id: string;
          suggestion_type: string;
          input_summary: string | null;
          suggestion_text: string;
          structured_plan: Json | null;
          risk_level: "green" | "yellow" | "orange" | "red" | null;
          applied: boolean;
          created_at: string;
          applied_at: string | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["ai_suggestions"]["Row"]> & Pick<Database["public"]["Tables"]["ai_suggestions"]["Row"], "suggestion_type" | "suggestion_text">;
        Update: Partial<Database["public"]["Tables"]["ai_suggestions"]["Row"]>;
      };
      reminders: {
        Row: {
          id: string;
          reminder_type: string;
          enabled: boolean;
          reminder_time: string | null;
          message: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["reminders"]["Row"]> & Pick<Database["public"]["Tables"]["reminders"]["Row"], "reminder_type" | "message">;
        Update: Partial<Database["public"]["Tables"]["reminders"]["Row"]>;
      };
      app_settings: {
        Row: {
          id: string;
          access_code_enabled: boolean;
          dark_mode: boolean;
          pwa_enabled: boolean;
          notification_enabled: boolean;
          ai_model: string | null;
          training_preferences: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["app_settings"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["app_settings"]["Row"]>;
      };
      audit_logs: {
        Row: {
          id: string;
          action_type: string;
          target_table: string;
          target_id: string | null;
          before_data: Json | null;
          after_data: Json | null;
          source: "manual" | "ai" | "import" | "restore" | "system";
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["audit_logs"]["Row"]> & Pick<Database["public"]["Tables"]["audit_logs"]["Row"], "action_type" | "target_table" | "source">;
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Row"]>;
      };
      error_logs: {
        Row: {
          id: string;
          error_type: string;
          message: string;
          stack: string | null;
          route: string | null;
          payload: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["error_logs"]["Row"]> & Pick<Database["public"]["Tables"]["error_logs"]["Row"], "error_type" | "message">;
        Update: Partial<Database["public"]["Tables"]["error_logs"]["Row"]>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      apply_ai_suggestion: {
        Args: {
          p_suggestion_id: string;
          p_change_reason?: string;
        };
        Returns: Json;
      };
      apply_workout_csv_import: {
        Args: {
          p_rows: Json;
          p_change_reason?: string;
        };
        Returns: Json;
      };
      restore_plan_version: {
        Args: {
          p_version_id: string;
          p_change_reason?: string;
        };
        Returns: Json;
      };
      restore_json_backup: {
        Args: {
          p_payload: Json;
          p_change_reason?: string;
        };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type DbTable<Name extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][Name]["Row"];
export type DbInsert<Name extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][Name]["Insert"];
export type DbUpdate<Name extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][Name]["Update"];
