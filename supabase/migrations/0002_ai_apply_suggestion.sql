create or replace function public.apply_ai_suggestion(
  p_suggestion_id uuid,
  p_change_reason text default '应用 AI 建议'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_suggestion public.ai_suggestions%rowtype;
  v_plan jsonb;
  v_workouts jsonb;
  v_item jsonb;
  v_affected_dates text[] := array[]::text[];
  v_before_data jsonb := '[]'::jsonb;
  v_after_data jsonb := '[]'::jsonb;
  v_version_id uuid;
  v_existing_id uuid;
  v_target_date date;
  v_count integer := 0;
  v_action text;
begin
  select * into v_suggestion
  from public.ai_suggestions
  where id = p_suggestion_id
  for update;

  if not found then
    raise exception 'AI suggestion not found';
  end if;

  if v_suggestion.applied then
    raise exception 'AI suggestion already applied';
  end if;

  v_plan := coalesce(v_suggestion.structured_plan, '{}'::jsonb);

  if v_suggestion.suggestion_type = 'daily-advice' then
    if coalesce((v_plan #>> '{workout_adjustment,should_modify_today}')::boolean, false) is false then
      raise exception 'Daily advice does not require plan changes';
    end if;

    v_target_date := nullif(v_plan #>> '{workout_adjustment,date}', '')::date;
    if v_target_date is null then
      raise exception 'Daily advice missing workout adjustment date';
    end if;

    v_affected_dates := array[v_target_date::text];
  elsif v_suggestion.suggestion_type in ('weekly-adjustment', 'generate-plan') then
    v_workouts := v_plan -> 'workouts';
    if v_workouts is null or jsonb_typeof(v_workouts) <> 'array' or jsonb_array_length(v_workouts) = 0 then
      raise exception 'AI suggestion has no workouts to apply';
    end if;

    select coalesce(array_agg(distinct (item.value ->> 'date')), array[]::text[])
    into v_affected_dates
    from jsonb_array_elements(v_workouts) as item(value)
    where item.value ? 'date';

    if coalesce(array_length(v_affected_dates, 1), 0) = 0 then
      raise exception 'AI suggestion workouts missing dates';
    end if;
  else
    raise exception 'Unsupported suggestion type: %', v_suggestion.suggestion_type;
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
    'AI 建议应用前自动备份 - ' || to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
    coalesce(p_change_reason, '应用 AI 建议前自动创建版本备份'),
    'ai',
    'workouts',
    jsonb_build_object('workouts', v_before_data),
    jsonb_build_object('pending', true, 'source_suggestion_id', p_suggestion_id),
    'ai'
  ) returning id into v_version_id;

  if v_suggestion.suggestion_type = 'daily-advice' then
    select id into v_existing_id
    from public.workouts
    where date = v_target_date
    order by created_at asc
    limit 1
    for update;

    if v_existing_id is null then
      raise exception 'No workout found for daily advice date %', v_target_date;
    end if;

    update public.workouts
    set
      workout_type = coalesce(nullif(v_plan #>> '{workout_adjustment,new_workout_type}', ''), workout_type),
      planned_distance_km = coalesce(nullif(v_plan #>> '{workout_adjustment,new_distance_km}', '')::numeric, planned_distance_km),
      planned_rpe = coalesce(nullif(v_plan #>> '{workout_adjustment,new_rpe}', '')::integer, planned_rpe),
      notes = trim(both E'\n' from concat_ws(E'\n', notes, '[AI建议] ' || coalesce(v_plan #>> '{workout_adjustment,new_notes}', v_suggestion.suggestion_text)))
    where id = v_existing_id;

    v_count := 1;
  else
    for v_item in select value from jsonb_array_elements(v_workouts)
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
        coalesce(nullif(v_item ->> 'title', ''), 'AI 训练计划'),
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

      v_count := v_count + 1;
    end loop;
  end if;

  select coalesce(jsonb_agg(to_jsonb(w) order by w.date, w.created_at), '[]'::jsonb)
  into v_after_data
  from public.workouts w
  where w.date::text = any(v_affected_dates);

  update public.plan_versions
  set after_data = jsonb_build_object(
    'workouts', v_after_data,
    'source_suggestion_id', p_suggestion_id,
    'source_suggestion_type', v_suggestion.suggestion_type
  )
  where id = v_version_id;

  update public.ai_suggestions
  set applied = true,
      applied_at = now()
  where id = p_suggestion_id;

  v_action := case
    when v_suggestion.suggestion_type = 'daily-advice' then 'apply_ai_daily_advice'
    else 'apply_ai_weekly_adjustment'
  end;

  insert into public.audit_logs (
    action_type,
    target_table,
    target_id,
    before_data,
    after_data,
    source,
    notes
  ) values (
    v_action,
    'workouts',
    v_version_id,
    jsonb_build_object('workouts', v_before_data),
    jsonb_build_object('workouts', v_after_data, 'suggestion_id', p_suggestion_id),
    'ai',
    'AI 建议由用户确认后应用；应用前已创建 plan_versions 备份。'
  );

  return jsonb_build_object(
    'version_id', v_version_id,
    'suggestion_id', p_suggestion_id,
    'affected_dates', v_affected_dates,
    'applied_workouts_count', v_count
  );
end;
$$;
