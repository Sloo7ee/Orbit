-- Timestamp-based sessions. Only actual focus intervals contribute to reports.
alter table public.tasks add constraint tasks_identity_owner_semester unique(id,semester_id,owner_id);
create table public.focus_sessions (
 id uuid primary key,
 owner_id uuid not null references public.profiles(id) on delete cascade,
 semester_id uuid not null,
 course_id uuid,
 task_id uuid,
 course_label text not null default '',
 task_label text not null default '',
 mode text not null check(mode in ('stopwatch','pomodoro')),
 state text not null check(state in ('running','paused','ready','completed')),
 phase text not null check(phase in ('focus','break')),
 focus_seconds integer not null check(focus_seconds between 60 and 10800),
 break_seconds integer not null check(break_seconds between 60 and 3600),
 remaining_ms bigint,
 segment_started_at timestamptz,
 focused_ms bigint not null default 0 check(focused_ms>=0),
 started_at timestamptz not null default now(),
 ended_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 revision integer not null default 1,
 unique(id,semester_id,owner_id),
 check((state='running')=(segment_started_at is not null)),
 check((state='completed')=(ended_at is not null)),
 check(ended_at is null or ended_at>=started_at),
 check(segment_started_at is null or segment_started_at>=started_at),
 check((mode='stopwatch' and remaining_ms is null and phase='focus' and state<>'ready') or (mode='pomodoro' and remaining_ms between 0 and 10800000)),
 foreign key(semester_id,owner_id) references public.semesters(id,owner_id),
 foreign key(course_id,semester_id,owner_id) references public.courses(id,semester_id,owner_id) on delete set null(course_id),
 foreign key(task_id,semester_id,owner_id) references public.tasks(id,semester_id,owner_id) on delete set null(task_id)
);
create unique index focus_one_active_per_owner on public.focus_sessions(owner_id) where ended_at is null;
create index focus_history on public.focus_sessions(owner_id,semester_id,ended_at desc);
create table public.focus_intervals (
 id bigint generated always as identity primary key,
 session_id uuid not null,
 owner_id uuid not null,
 semester_id uuid not null,
 started_at timestamptz not null,
 ended_at timestamptz not null check(ended_at>started_at),
 foreign key(session_id,semester_id,owner_id) references public.focus_sessions(id,semester_id,owner_id) on delete cascade
);
create index focus_intervals_session on public.focus_intervals(session_id);
create index focus_intervals_reporting on public.focus_intervals(owner_id,semester_id,ended_at);
create table public.focus_operations (
 owner_id uuid not null references public.profiles(id) on delete cascade,
 request_id uuid not null,
 arguments jsonb not null,
 result_revision integer not null,
 primary key(owner_id,request_id)
);
alter table public.focus_sessions enable row level security;
alter table public.focus_intervals enable row level security;
alter table public.focus_operations enable row level security;
create policy focus_sessions_read on public.focus_sessions for select to authenticated using(owner_id=(select auth.uid()));
create policy focus_intervals_read on public.focus_intervals for select to authenticated using(owner_id=(select auth.uid()));
revoke all on public.focus_sessions,public.focus_intervals,public.focus_operations from anon,authenticated;
grant select on public.focus_sessions,public.focus_intervals to authenticated;
create trigger focus_sessions_guard before insert or update or delete on public.focus_sessions for each row execute function public.guard_academic();

create function public.focus_archive_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.archived_at is null and new.archived_at is not null and exists(select 1 from public.focus_sessions where semester_id=old.id and ended_at is null) then
  raise exception 'Finish or discard the active focus session before archiving this semester';
 end if;
 return new;
end; $$;
create trigger focus_prevent_active_archive before update of archived_at on public.semesters for each row execute function public.focus_archive_guard();
revoke all on function public.focus_archive_guard() from public,anon,authenticated;

create function public.change_focus(p_request uuid,p_id uuid,p_semester uuid,p_revision integer,p_operation text,p_payload jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare s public.focus_sessions; receipt public.focus_operations; args jsonb; term public.semesters; c public.courses; t public.tasks;
 cid uuid; tid uuid; result integer; stamp timestamptz:=clock_timestamp(); boundary timestamptz; elapsed bigint; trimmed bigint;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_request is null or p_id is null or p_semester is null or p_revision is null or p_revision<0 or p_payload is null or p_operation is null or p_operation not in ('start','pause','resume','next','finish','discard','delete','associate') then raise exception 'Invalid request'; end if;
 args:=jsonb_build_array(p_id,p_semester,p_revision,p_operation,p_payload);
 -- Serialize starts and transitions across tabs/devices, then enforce a unique active row.
 perform pg_advisory_xact_lock(hashtextextended('focus-owner:'||auth.uid()::text,0));
 select * into receipt from public.focus_operations where owner_id=auth.uid() and request_id=p_request;
 if found then
  if receipt.arguments is distinct from args then raise exception 'Request changed. Reload and try again.'; end if;
  return receipt.result_revision;
 end if;
 select * into term from public.semesters where id=p_semester and owner_id=auth.uid() for share;
 if not found or term.archived_at is not null then raise exception 'Semester unavailable or archived'; end if;
 if p_operation in ('start','associate') then
  cid:=nullif(p_payload->>'course_id','')::uuid;
  tid:=nullif(p_payload->>'task_id','')::uuid;
  if tid is not null then
   select * into t from public.tasks where id=tid and semester_id=term.id and owner_id=auth.uid() for share;
   if not found then raise exception 'Task unavailable'; end if;
   if t.course_id is not null then
    if cid is not null and cid<>t.course_id then raise exception 'Choose the task course'; end if;
    cid:=t.course_id;
   end if;
  end if;
  if cid is not null then
   select * into c from public.courses where id=cid and semester_id=term.id and owner_id=auth.uid() for key share;
   if not found then raise exception 'Course unavailable'; end if;
  end if;
 end if;
 select * into s from public.focus_sessions where id=p_id and semester_id=term.id and owner_id=auth.uid() for update;
 stamp:=clock_timestamp();
 if p_operation='start' then
  if p_revision<>0 or found then raise exception 'Session changed. Reload and try again.'; end if;
  if exists(select 1 from public.focus_sessions where owner_id=auth.uid() and ended_at is null) then raise exception 'An active focus session already exists. Reload to continue it.'; end if;
  insert into public.focus_sessions(id,owner_id,semester_id,course_id,task_id,course_label,task_label,mode,state,phase,focus_seconds,break_seconds,remaining_ms,segment_started_at,started_at)
  values(p_id,auth.uid(),term.id,cid,tid,case when cid is null then '' else c.code||' · '||c.name end,coalesce(t.title,''),p_payload->>'mode','running','focus',coalesce((p_payload->>'focus_seconds')::int,1500),coalesce((p_payload->>'break_seconds')::int,300),case when p_payload->>'mode'='pomodoro' then coalesce((p_payload->>'focus_seconds')::int,1500)*1000::bigint else null end,stamp,stamp) returning revision into result;
 else
  if not found or s.revision<>p_revision then raise exception 'Session changed. Reload and try again.'; end if;
  if p_operation='delete' then
   if s.ended_at is null then raise exception 'Use discard for an active session'; end if;
   delete from public.focus_sessions where id=s.id; result:=s.revision;
  elsif p_operation='discard' then
   if s.ended_at is not null then raise exception 'Session already completed'; end if;
   delete from public.focus_sessions where id=s.id; result:=s.revision;
  elsif p_operation='associate' then
   if s.ended_at is not null then raise exception 'Session already completed'; end if;
   -- Attribution changes must not close an unreviewed stopwatch interval.
   update public.focus_sessions set course_id=cid,task_id=tid,course_label=case when cid is null then '' else c.code||' · '||c.name end,task_label=coalesce(t.title,''),updated_at=stamp where id=s.id returning revision into result;
  else
   if s.ended_at is not null then raise exception 'Session already completed'; end if;
   -- Settle at most one focus/break pair; never invent later study cycles.
   if s.state='running' then
    boundary:=case when s.mode='pomodoro' then least(stamp,s.segment_started_at+s.remaining_ms*interval '1 millisecond') else stamp end;
    elapsed:=greatest(0,floor(extract(epoch from (boundary-s.segment_started_at))*1000)::bigint);
    if p_payload ? 'trim_ms' then
     trimmed:=(p_payload->>'trim_ms')::bigint;
     if s.mode<>'stopwatch' or p_operation not in ('pause','finish') or trimmed is null or trimmed<0 or trimmed>elapsed then raise exception 'Invalid retained duration'; end if;
     elapsed:=trimmed; boundary:=s.segment_started_at+elapsed*interval '1 millisecond';
    end if;
    if s.phase='focus' and elapsed>0 then
     insert into public.focus_intervals(session_id,owner_id,semester_id,started_at,ended_at) values(s.id,s.owner_id,s.semester_id,s.segment_started_at,s.segment_started_at+elapsed*interval '1 millisecond');
     s.focused_ms:=s.focused_ms+elapsed;
    end if;
    if s.mode='pomodoro' then
     s.remaining_ms:=greatest(0,s.remaining_ms-elapsed);
     if s.remaining_ms=0 and s.phase='focus' then
      s.phase:='break';s.remaining_ms:=s.break_seconds*1000::bigint;
      s.segment_started_at:=boundary;
      elapsed:=greatest(0,least(s.remaining_ms,floor(extract(epoch from(stamp-boundary))*1000)::bigint));
      s.remaining_ms:=s.remaining_ms-elapsed;
     end if;
     if s.remaining_ms=0 and s.phase='break' then
      s.phase:='focus';s.state:='ready';s.remaining_ms:=s.focus_seconds*1000::bigint;
     end if;
    end if;
    s.segment_started_at:=case when s.state='running' then stamp else null end;
   end if;
   if p_operation='pause' then
    if s.state<>'running' then raise exception 'Session is not running. Reload its current state.'; end if;
    s.state:='paused';s.segment_started_at:=null;
   elsif p_operation='resume' then
    if s.state<>'paused' then raise exception 'Session is not paused'; end if;
    s.state:='running';s.segment_started_at:=stamp;
   elsif p_operation='next' then
    if s.mode<>'pomodoro' or not (s.phase='break' or s.state='ready') then raise exception 'Finish this focus interval first'; end if;
    s.state:='running';s.phase:='focus';s.remaining_ms:=s.focus_seconds*1000::bigint;s.segment_started_at:=stamp;
   elsif p_operation='finish' then
    s.state:='completed';s.ended_at:=stamp;s.segment_started_at:=null;
   end if;
   update public.focus_sessions set state=s.state,phase=s.phase,remaining_ms=s.remaining_ms,segment_started_at=s.segment_started_at,focused_ms=s.focused_ms,ended_at=s.ended_at,course_id=s.course_id,task_id=s.task_id,course_label=s.course_label,task_label=s.task_label,updated_at=stamp where id=s.id returning revision into result;
  end if;
 end if;
 insert into public.focus_operations values(auth.uid(),p_request,args,result);
 return result;
end; $$;
revoke all on function public.change_focus(uuid,uuid,uuid,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.change_focus(uuid,uuid,uuid,integer,text,jsonb) to authenticated;

create function public.focus_snapshot(p_semester uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare zone text; day_start timestamptz; day_end timestamptz; stamp timestamptz:=clock_timestamp(); result jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select timezone into zone from public.profiles where id=auth.uid();
 if not found then raise exception 'Profile required'; end if;
 if p_semester is not null and not exists(select 1 from public.semesters where id=p_semester and owner_id=auth.uid()) then raise exception 'Semester unavailable'; end if;
 day_start:=date_trunc('day',stamp at time zone zone) at time zone zone;
 day_end:=((day_start at time zone zone)+interval '1 day') at time zone zone;
 select jsonb_build_object(
  'server_now',stamp,'semester_id',p_semester,
  'active',(select to_jsonb(s) from public.focus_sessions s where owner_id=auth.uid() and ended_at is null),
  'recent',coalesce((select jsonb_agg(r order by r.ended_at desc) from (select * from public.focus_sessions where owner_id=auth.uid() and semester_id=p_semester and ended_at is not null order by ended_at desc limit 20) r),'[]'::jsonb),
  'today_ms',coalesce((select sum(greatest(0,floor(extract(epoch from(least(i.ended_at,day_end)-greatest(i.started_at,day_start)))*1000))) from public.focus_intervals i join public.focus_sessions s on s.id=i.session_id where s.owner_id=auth.uid() and s.semester_id=p_semester and s.ended_at is not null and i.ended_at>day_start and i.started_at<day_end),0),
  'today_sessions',(select count(distinct i.session_id) from public.focus_intervals i join public.focus_sessions s on s.id=i.session_id where s.owner_id=auth.uid() and s.semester_id=p_semester and s.ended_at is not null and i.ended_at>day_start and i.started_at<day_end)
 ) into result;
 return result;
end; $$;
revoke all on function public.focus_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.focus_snapshot(uuid) to authenticated;
