-- Weekly course meeting definitions, sparse exceptions and atomic scoped changes.
create table public.course_schedules (
 id uuid primary key,
 owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
 semester_id uuid not null,
 course_id uuid,
 title text not null check(length(btrim(title)) between 1 and 160),
 color text not null check(color ~ '^#[0-9a-fA-F]{6}$'),
 weekdays integer[] not null check(cardinality(weekdays) between 1 and 7 and weekdays <@ array[0,1,2,3,4,5,6]),
 start_time time not null,
 end_time time not null check(end_time<>start_time),
 location text not null default '' check(length(location)<=200),
 timezone text not null,
 effective_start date not null,
 effective_end date not null check(effective_end>=effective_start),
 deleted boolean not null default false,
 revision integer not null default 1,
 created_at timestamptz not null default now(),
 unique(id,semester_id,owner_id),
 foreign key(semester_id,owner_id) references public.semesters(id,owner_id),
 foreign key(course_id,semester_id,owner_id) references public.courses(id,semester_id,owner_id) on delete set null(course_id)
);
create table public.schedule_exceptions (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id) on delete cascade,
 semester_id uuid not null,
 schedule_id uuid not null,
 original_date date not null,
 cancelled boolean not null default false,
 starts_at timestamptz,
 ends_at timestamptz,
 location text not null default '' check(length(location)<=200),
 revision integer not null default 1,
 unique(schedule_id,original_date),
 foreign key(schedule_id,semester_id,owner_id) references public.course_schedules(id,semester_id,owner_id) on delete cascade,
 check(cancelled or (starts_at is not null and ends_at is not null and isfinite(starts_at) and isfinite(ends_at) and ends_at>starts_at))
);
create table public.schedule_operations (
 owner_id uuid not null references public.profiles(id) on delete cascade,
 request_id uuid not null,
 arguments jsonb not null,
 result_id uuid not null,
 primary key(owner_id,request_id)
);
create index schedules_owner_semester on public.course_schedules(owner_id,semester_id);
create index exceptions_owner_dates on public.schedule_exceptions(owner_id,semester_id,original_date);
create index exceptions_moved_dates on public.schedule_exceptions(owner_id,semester_id,starts_at,ends_at);
alter table public.course_schedules enable row level security;
alter table public.schedule_exceptions enable row level security;
alter table public.schedule_operations enable row level security;
create policy schedules_read on public.course_schedules for select to authenticated using(owner_id=(select auth.uid()));
create policy exceptions_read on public.schedule_exceptions for select to authenticated using(owner_id=(select auth.uid()));
revoke all on public.course_schedules,public.schedule_exceptions,public.schedule_operations from anon,authenticated;
grant select on public.course_schedules,public.schedule_exceptions to authenticated;
create trigger schedules_guard before insert or update or delete on public.course_schedules for each row execute function public.guard_academic();
create trigger exceptions_guard before insert or update or delete on public.schedule_exceptions for each row execute function public.guard_academic();

create function public.validate_schedule() returns trigger language plpgsql set search_path='' as $$
declare term public.semesters;
begin
 select * into term from public.semesters where id=new.semester_id and owner_id=new.owner_id;
 if new.effective_start<term.start_date or new.effective_end>term.end_date then raise exception 'Schedule dates must be within the semester'; end if;
 if not exists(select 1 from pg_timezone_names where name=new.timezone) then raise exception 'Invalid timezone'; end if;
 if new.start_time>='24:00'::time or new.end_time>='24:00'::time then raise exception 'Invalid time'; end if;
 new.weekdays := array(select distinct d from unnest(new.weekdays) d order by d);
 if array_position(new.weekdays,null) is not null then raise exception 'Invalid weekdays'; end if;
 return new;
end; $$;
create trigger schedules_validate before insert or update on public.course_schedules for each row execute function public.validate_schedule();

-- Detach recurring history as well as standalone events when deleting a course.
create function public.snapshot_course_schedules() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.profiles where id=old.owner_id) then
 update public.course_schedules set title=old.name,color=old.color where course_id=old.id and owner_id=old.owner_id;
 end if;
 return old;
end; $$;
create trigger course_schedule_snapshot before delete on public.courses for each row execute function public.snapshot_course_schedules();

-- All writes are scoped, ownership checked, revision protected, and replay safe.
create function public.change_schedule(p_request uuid,p_id uuid,p_revision integer,p_scope text,p_original date,p_delete boolean,p_payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare s public.course_schedules; c public.courses; term public.semesters;
 args jsonb; receipt public.schedule_operations; result uuid; new_start date; new_end date;
 days integer[]; st time; et time; place text; zone text; starts timestamptz; ends timestamptz;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_request is null or p_id is null or p_revision is null or p_scope is null or p_delete is null or p_payload is null then raise exception 'Invalid request'; end if;
 args:=jsonb_build_array(p_id,p_revision,p_scope,p_original,p_delete,p_payload);
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request::text,0));
 select * into receipt from public.schedule_operations where owner_id=auth.uid() and request_id=p_request;
 if found then
 if receipt.arguments is distinct from args then raise exception 'Request changed. Try again.'; end if;
 return receipt.result_id;
 end if;
 if p_scope='create' then
  if p_revision<>0 or p_delete then raise exception 'Invalid create'; end if;
  select * into c from public.courses where id=(p_payload->>'course_id')::uuid and owner_id=auth.uid();
  if not found then raise exception 'Course unavailable'; end if;
  select * into term from public.semesters where id=c.semester_id and owner_id=auth.uid() for share;
 else
  select * into s from public.course_schedules where id=p_id and owner_id=auth.uid() for update;
  if not found or s.deleted then raise exception 'Schedule changed. Reload and try again.'; end if;
  if s.revision<>p_revision then raise exception 'Schedule changed. Reload and try again.'; end if;
  select * into term from public.semesters where id=s.semester_id and owner_id=auth.uid() for share;
  if p_scope not in ('one','future','all') then raise exception 'Invalid scope'; end if;
  if p_scope in ('one','future') and (p_original is null or p_original<s.effective_start or p_original>s.effective_end or not(extract(dow from p_original)::integer=any(s.weekdays))) then raise exception 'Original meeting unavailable'; end if;
  if p_scope in ('future','all') and coalesce((p_payload->>'confirm_reset')::boolean,false) is not true then raise exception 'Confirm the affected meetings'; end if;
 end if;
 if term.id is null or term.archived_at is not null then raise exception 'Semester unavailable or archived'; end if;
 result:=p_id;
 if p_scope='one' then
  if not p_delete then
   starts:=(p_payload->>'starts_at')::timestamptz;ends:=(p_payload->>'ends_at')::timestamptz;
   if starts is null or ends is null or not isfinite(starts) or not isfinite(ends) or ends<=starts then raise exception 'Invalid meeting times'; end if;
   if (starts at time zone s.timezone)::date<term.start_date or (starts at time zone s.timezone)::date>term.end_date then raise exception 'Meeting must start within the semester'; end if;
  end if;
  insert into public.schedule_exceptions(owner_id,semester_id,schedule_id,original_date,cancelled,starts_at,ends_at,location)
  values(auth.uid(),s.semester_id,s.id,p_original,p_delete,starts,ends,coalesce(p_payload->>'location',''))
  on conflict(schedule_id,original_date) do update set cancelled=excluded.cancelled,starts_at=excluded.starts_at,ends_at=excluded.ends_at,location=excluded.location;
  update public.course_schedules set revision=revision+1 where id=s.id;
 elsif p_delete then
  delete from public.schedule_exceptions where schedule_id=s.id and (p_scope='all' or original_date>=p_original);
  if p_scope='all' or p_original=s.effective_start then
   update public.course_schedules set deleted=true where id=s.id;
  else update public.course_schedules set effective_end=p_original-1 where id=s.id; end if;
 else
  new_start:=(p_payload->>'effective_start')::date;new_end:=(p_payload->>'effective_end')::date;
  days:=array(select jsonb_array_elements_text(p_payload->'weekdays')::integer);
  st:=(p_payload->>'start_time')::time;et:=(p_payload->>'end_time')::time;place:=coalesce(p_payload->>'location','');
  if p_scope='future' and new_start<p_original then raise exception 'Future schedule must begin on or after the selected original date'; end if;
  if p_scope='create' then
   select timezone into zone from public.profiles where id=auth.uid();
   insert into public.course_schedules(id,owner_id,semester_id,course_id,title,color,weekdays,start_time,end_time,location,timezone,effective_start,effective_end)
   values(p_id,auth.uid(),c.semester_id,c.id,c.name,c.color,days,st,et,place,zone,new_start,new_end);
  elsif p_scope='all' then
   delete from public.schedule_exceptions where schedule_id=s.id;
   update public.course_schedules set weekdays=days,start_time=st,end_time=et,location=place,effective_start=new_start,effective_end=new_end where id=s.id;
  else
   delete from public.schedule_exceptions where schedule_id=s.id and original_date>=p_original;
   if p_original=s.effective_start then update public.course_schedules set deleted=true where id=s.id;
   else update public.course_schedules set effective_end=p_original-1 where id=s.id; end if;
   result:=gen_random_uuid();
   insert into public.course_schedules(id,owner_id,semester_id,course_id,title,color,weekdays,start_time,end_time,location,timezone,effective_start,effective_end)
   values(result,auth.uid(),s.semester_id,s.course_id,s.title,s.color,days,st,et,place,s.timezone,new_start,new_end);
  end if;
 end if;
 insert into public.schedule_operations(owner_id,request_id,arguments,result_id) values(auth.uid(),p_request,args,result);
 return result;
end; $$;
revoke all on function public.validate_schedule(),public.snapshot_course_schedules(),public.change_schedule(uuid,uuid,integer,text,date,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.change_schedule(uuid,uuid,integer,text,date,boolean,jsonb) to authenticated;
