create or replace function public.apply_workout_csv_import(
  p_rows jsonb,
  p_change_reason text default 'CSV 批量导入训练计划'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_affected_dates text[] := array[]::text[];
  v_before_data jsonb := '[]'::jsonb;
  v_after_data jsonb := '[]'::jsonb;
  v_version_id uuid;
  v_inserted_or_updated integer := 0;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'CSV rows must be a JSON array';
  end if;

  select coalesce(array_agg(distinct value ->> 'date'), array[]::text[])
  into v_affected_dates
  from jsonb_array_elements(p_rows)
  where value ? 'date';

  if coalesce(array_length(v_affected_dates, 1), 0) = 0 then
    raise exception 'No valid workout dates found in CSV import';
  end if;

  select coalesce(jsonb_agg(to_jsonb(w) order by w.date, w.created_at), '[]'::jsonb)
  into v_before_data
  from public.workouts w
  where w.date::text = any(v_affected_dates);

  insert into public.plan_versions (
    version_name,
    change_reason,
    change_type,
    target_table,
    before_data,
    after_data,
    created_by
  ) values (
    'CSV 导入前自动备份 - ' || to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
    coalesce(p_change_reason, 'CSV 导入前自动备份'),
    'import',
    'workouts',
    jsonb_build_object('workouts', v_before_data),
    jsonb_build_object('pending', true, 'source', 'csv_import'),
    'user'
  ) returning id into v_version_id;

  for v_item in select value from jsonb_array_elements(p_rows)
  loop
    insert into public.workouts (
      date,
      week_number,
      workout_type,
      title,
      planned_distance_km,
      planned_duration_min,
      planned_pace_text,
      planned_pace_seconds_per_km,
      planned_rpe,
      purpose,
      warmup,
      main_set,
      cooldown,
      strength_training,
      notes,
      completed,
      skipped
    ) values (
      (v_item ->> 'date')::date,
      coalesce(nullif(v_item ->> 'week_number', '')::integer, extract(week from (v_item ->> 'date')::date)::integer),
      coalesce(nullif(v_item ->> 'workout_type', ''), '未分类'),
      coalesce(nullif(v_item ->> 'title', ''), '导入训练'),
      coalesce(nullif(v_item ->> 'planned_distance_km', '')::numeric, 0),
      coalesce(nullif(v_item ->> 'planned_duration_min', '')::integer, 0),
      nullif(v_item ->> 'planned_pace_text', ''),
      nullif(v_item ->> 'planned_pace_seconds_per_km', '')::integer,
      nullif(v_item ->> 'planned_rpe', '')::integer,
      nullif(v_item ->> 'purpose', ''),
      nullif(v_item ->> 'warmup', ''),
      nullif(v_item ->> 'main_set', ''),
      nullif(v_item ->> 'cooldown', ''),
      coalesce(nullif(v_item ->> 'strength_training', '')::boolean, false),
      nullif(v_item ->> 'notes', ''),
      false,
      false
    )
    on conflict (date, workout_type, title)
    do update set
      week_number = excluded.week_number,
      planned_distance_km = excluded.planned_distance_km,
      planned_duration_min = excluded.planned_duration_min,
      planned_pace_text = excluded.planned_pace_text,
      planned_pace_seconds_per_km = excluded.planned_pace_seconds_per_km,
      planned_rpe = excluded.planned_rpe,
      purpose = excluded.purpose,
      warmup = excluded.warmup,
      main_set = excluded.main_set,
      cooldown = excluded.cooldown,
      strength_training = excluded.strength_training,
      notes = excluded.notes;

    v_inserted_or_updated := v_inserted_or_updated + 1;
  end loop;

  select coalesce(jsonb_agg(to_jsonb(w) order by w.date, w.created_at), '[]'::jsonb)
  into v_after_data
  from public.workouts w
  where w.date::text = any(v_affected_dates);

  update public.plan_versions
  set after_data = jsonb_build_object('workouts', v_after_data, 'source', 'csv_import')
  where id = v_version_id;

  insert into public.audit_logs (
    action_type,
    target_table,
    target_id,
    before_data,
    after_data,
    source,
    notes
  ) values (
    'apply_csv_import',
    'workouts',
    v_version_id,
    jsonb_build_object('workouts', v_before_data),
    jsonb_build_object('workouts', v_after_data),
    'import',
    'CSV 导入由用户预览确认后应用；应用前已创建 plan_versions 备份。'
  );

  return jsonb_build_object(
    'version_id', v_version_id,
    'affected_dates', v_affected_dates,
    'upserted_count', v_inserted_or_updated
  );
end;
$$;

create or replace function public.restore_plan_version(
  p_version_id uuid,
  p_change_reason text default '恢复历史版本'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version public.plan_versions%rowtype;
  v_before_workouts jsonb;
  v_after_workouts jsonb;
  v_before_phases jsonb;
  v_after_phases jsonb;
  v_item jsonb;
  v_dates text[] := array[]::text[];
  v_current_snapshot jsonb := '{}'::jsonb;
  v_restored_snapshot jsonb := '{}'::jsonb;
  v_backup_id uuid;
  v_count integer := 0;
begin
  select * into v_version
  from public.plan_versions
  where id = p_version_id
  for update;

  if not found then
    raise exception 'Plan version not found';
  end if;

  v_before_workouts := coalesce(v_version.before_data -> 'workouts', '[]'::jsonb);
  v_after_workouts := coalesce(v_version.after_data -> 'workouts', '[]'::jsonb);
  v_before_phases := coalesce(v_version.before_data -> 'training_phases', '[]'::jsonb);
  v_after_phases := coalesce(v_version.after_data -> 'training_phases', '[]'::jsonb);

  if v_version.target_table in ('workouts', 'full_plan') then
    select coalesce(array_agg(distinct d), array[]::text[])
    into v_dates
    from (
      select value ->> 'date' as d from jsonb_array_elements(v_before_workouts)
      union
      select value ->> 'date' as d from jsonb_array_elements(v_after_workouts)
    ) dates
    where d is not null;
  end if;

  if v_version.target_table = 'workouts' then
    select coalesce(jsonb_agg(to_jsonb(w) order by w.date, w.created_at), '[]'::jsonb)
    into v_current_snapshot
    from public.workouts w
    where w.date::text = any(v_dates);
  elsif v_version.target_table = 'training_phases' then
    select coalesce(jsonb_agg(to_jsonb(t) order by t.start_date, t.created_at), '[]'::jsonb)
    into v_current_snapshot
    from public.training_phases t;
  else
    v_current_snapshot := jsonb_build_object(
      'workouts', (select coalesce(jsonb_agg(to_jsonb(w) order by w.date, w.created_at), '[]'::jsonb) from public.workouts w),
      'training_phases', (select coalesce(jsonb_agg(to_jsonb(t) order by t.start_date, t.created_at), '[]'::jsonb) from public.training_phases t)
    );
  end if;

  insert into public.plan_versions (
    version_name,
    change_reason,
    change_type,
    target_table,
    before_data,
    after_data,
    created_by
  ) values (
    '恢复历史版本前自动备份 - ' || to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
    coalesce(p_change_reason, '恢复历史版本前自动备份'),
    'restore',
    v_version.target_table,
    case when v_version.target_table = 'workouts' then jsonb_build_object('workouts', v_current_snapshot)
         when v_version.target_table = 'training_phases' then jsonb_build_object('training_phases', v_current_snapshot)
         else v_current_snapshot end,
    jsonb_build_object('restore_source_version_id', p_version_id),
    'system'
  ) returning id into v_backup_id;

  if v_version.target_table in ('workouts', 'full_plan') then
    if coalesce(array_length(v_dates, 1), 0) > 0 then
      delete from public.workouts where date::text = any(v_dates);
    elsif v_version.target_table = 'full_plan' then
      delete from public.workouts;
    end if;

    for v_item in select value from jsonb_array_elements(v_before_workouts)
    loop
      insert into public.workouts (
        id, date, week_number, workout_type, title, planned_distance_km, planned_duration_min,
        planned_pace_text, planned_pace_seconds_per_km, planned_rpe, purpose, warmup, main_set,
        cooldown, strength_training, notes, completed, skipped, created_at, updated_at
      ) values (
        coalesce(nullif(v_item ->> 'id', '')::uuid, gen_random_uuid()),
        (v_item ->> 'date')::date,
        coalesce(nullif(v_item ->> 'week_number', '')::integer, extract(week from (v_item ->> 'date')::date)::integer),
        coalesce(nullif(v_item ->> 'workout_type', ''), '未分类'),
        coalesce(nullif(v_item ->> 'title', ''), '恢复训练'),
        coalesce(nullif(v_item ->> 'planned_distance_km', '')::numeric, 0),
        coalesce(nullif(v_item ->> 'planned_duration_min', '')::integer, 0),
        nullif(v_item ->> 'planned_pace_text', ''),
        nullif(v_item ->> 'planned_pace_seconds_per_km', '')::integer,
        nullif(v_item ->> 'planned_rpe', '')::integer,
        nullif(v_item ->> 'purpose', ''),
        nullif(v_item ->> 'warmup', ''),
        nullif(v_item ->> 'main_set', ''),
        nullif(v_item ->> 'cooldown', ''),
        coalesce(nullif(v_item ->> 'strength_training', '')::boolean, false),
        nullif(v_item ->> 'notes', ''),
        coalesce(nullif(v_item ->> 'completed', '')::boolean, false),
        coalesce(nullif(v_item ->> 'skipped', '')::boolean, false),
        coalesce(nullif(v_item ->> 'created_at', '')::timestamp with time zone, now()),
        now()
      );
      v_count := v_count + 1;
    end loop;
  end if;

  if v_version.target_table in ('training_phases', 'full_plan') then
    delete from public.training_phases;
    for v_item in select value from jsonb_array_elements(v_before_phases)
    loop
      insert into public.training_phases (
        id, phase_name, start_date, end_date, goal, weekly_mileage_min, weekly_mileage_max,
        training_days, key_workouts, test_standard, ai_notes, created_at, updated_at
      ) values (
        coalesce(nullif(v_item ->> 'id', '')::uuid, gen_random_uuid()),
        coalesce(nullif(v_item ->> 'phase_name', ''), '恢复阶段'),
        (v_item ->> 'start_date')::date,
        (v_item ->> 'end_date')::date,
        coalesce(nullif(v_item ->> 'goal', ''), '恢复历史版本'),
        coalesce(nullif(v_item ->> 'weekly_mileage_min', '')::numeric, 0),
        coalesce(nullif(v_item ->> 'weekly_mileage_max', '')::numeric, 0),
        coalesce(nullif(v_item ->> 'training_days', '')::integer, 3),
        nullif(v_item ->> 'key_workouts', ''),
        nullif(v_item ->> 'test_standard', ''),
        nullif(v_item ->> 'ai_notes', ''),
        coalesce(nullif(v_item ->> 'created_at', '')::timestamp with time zone, now()),
        now()
      );
      v_count := v_count + 1;
    end loop;
  end if;

  if v_version.target_table = 'workouts' then
    select coalesce(jsonb_agg(to_jsonb(w) order by w.date, w.created_at), '[]'::jsonb)
    into v_restored_snapshot
    from public.workouts w
    where w.date::text = any(v_dates);
  elsif v_version.target_table = 'training_phases' then
    select coalesce(jsonb_agg(to_jsonb(t) order by t.start_date, t.created_at), '[]'::jsonb)
    into v_restored_snapshot
    from public.training_phases t;
  else
    v_restored_snapshot := jsonb_build_object(
      'workouts', (select coalesce(jsonb_agg(to_jsonb(w) order by w.date, w.created_at), '[]'::jsonb) from public.workouts w),
      'training_phases', (select coalesce(jsonb_agg(to_jsonb(t) order by t.start_date, t.created_at), '[]'::jsonb) from public.training_phases t)
    );
  end if;

  update public.plan_versions
  set after_data = jsonb_build_object('restored_snapshot', v_restored_snapshot, 'restore_source_version_id', p_version_id)
  where id = v_backup_id;

  insert into public.audit_logs (
    action_type, target_table, target_id, before_data, after_data, source, notes
  ) values (
    'restore_plan_version',
    v_version.target_table,
    p_version_id,
    case when v_version.target_table = 'workouts' then jsonb_build_object('workouts', v_current_snapshot)
         when v_version.target_table = 'training_phases' then jsonb_build_object('training_phases', v_current_snapshot)
         else v_current_snapshot end,
    case when v_version.target_table = 'workouts' then jsonb_build_object('workouts', v_restored_snapshot)
         when v_version.target_table = 'training_phases' then jsonb_build_object('training_phases', v_restored_snapshot)
         else v_restored_snapshot end,
    'restore',
    '恢复历史版本前已自动创建当前状态备份。'
  );

  return jsonb_build_object('backup_version_id', v_backup_id, 'restored_version_id', p_version_id, 'restored_items_count', v_count);
end;
$$;

create or replace function public.restore_json_backup(
  p_payload jsonb,
  p_change_reason text default 'JSON 完整备份恢复'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_backup_id uuid;
  v_backup_record jsonb;
  v_current jsonb;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'JSON backup payload must be an object';
  end if;

  v_current := jsonb_build_object(
    'profile', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.profile t),
    'training_phases', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.training_phases t),
    'workouts', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.workouts t),
    'workout_logs', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.workout_logs t),
    'test_results', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.test_results t),
    'body_metrics', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.body_metrics t),
    'plan_versions', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.plan_versions t),
    'ai_suggestions', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.ai_suggestions t),
    'reminders', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.reminders t),
    'app_settings', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.app_settings t)
  );

  insert into public.plan_versions (
    version_name, change_reason, change_type, target_table, before_data, after_data, created_by
  ) values (
    'JSON 恢复前自动完整备份 - ' || to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
    coalesce(p_change_reason, 'JSON 恢复前自动完整备份'),
    'restore',
    'full_plan',
    v_current,
    jsonb_build_object('restore_source', 'json_backup'),
    'system'
  ) returning id into v_backup_id;

  select to_jsonb(pv) into v_backup_record from public.plan_versions pv where pv.id = v_backup_id;

  delete from public.workout_logs;
  delete from public.workouts;
  delete from public.training_phases;
  delete from public.test_results;
  delete from public.body_metrics;
  delete from public.ai_suggestions;
  delete from public.reminders;
  delete from public.app_settings;
  delete from public.profile;
  delete from public.plan_versions;

  insert into public.profile select * from jsonb_populate_recordset(null::public.profile, coalesce(p_payload -> 'profile', '[]'::jsonb));
  insert into public.training_phases select * from jsonb_populate_recordset(null::public.training_phases, coalesce(p_payload -> 'training_phases', '[]'::jsonb));
  insert into public.workouts select * from jsonb_populate_recordset(null::public.workouts, coalesce(p_payload -> 'workouts', '[]'::jsonb));
  insert into public.workout_logs select * from jsonb_populate_recordset(null::public.workout_logs, coalesce(p_payload -> 'workout_logs', '[]'::jsonb));
  insert into public.test_results select * from jsonb_populate_recordset(null::public.test_results, coalesce(p_payload -> 'test_results', '[]'::jsonb));
  insert into public.body_metrics select * from jsonb_populate_recordset(null::public.body_metrics, coalesce(p_payload -> 'body_metrics', '[]'::jsonb));
  insert into public.ai_suggestions select * from jsonb_populate_recordset(null::public.ai_suggestions, coalesce(p_payload -> 'ai_suggestions', '[]'::jsonb));
  insert into public.reminders select * from jsonb_populate_recordset(null::public.reminders, coalesce(p_payload -> 'reminders', '[]'::jsonb));
  insert into public.app_settings select * from jsonb_populate_recordset(null::public.app_settings, coalesce(p_payload -> 'app_settings', '[]'::jsonb));
  insert into public.plan_versions select * from jsonb_populate_recordset(null::public.plan_versions, coalesce(p_payload -> 'plan_versions', '[]'::jsonb));

  insert into public.plan_versions select * from jsonb_populate_record(null::public.plan_versions, v_backup_record)
  on conflict (id) do nothing;

  insert into public.audit_logs (
    action_type, target_table, target_id, before_data, after_data, source, notes
  ) values (
    'restore_json_backup',
    'full_plan',
    v_backup_id,
    v_current,
    p_payload,
    'restore',
    'JSON 完整恢复由用户预览确认后执行；恢复前已自动创建完整备份。'
  );

  return jsonb_build_object(
    'backup_version_id', v_backup_id,
    'profile_count', jsonb_array_length(coalesce(p_payload -> 'profile', '[]'::jsonb)),
    'workouts_count', jsonb_array_length(coalesce(p_payload -> 'workouts', '[]'::jsonb)),
    'logs_count', jsonb_array_length(coalesce(p_payload -> 'workout_logs', '[]'::jsonb)),
    'versions_count', jsonb_array_length(coalesce(p_payload -> 'plan_versions', '[]'::jsonb)) + 1
  );
end;
$$;
