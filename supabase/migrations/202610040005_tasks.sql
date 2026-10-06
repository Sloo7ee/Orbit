-- Tasks remain independent of calendar events; due values are local profile dates/times.
create table public.tasks (
 id uuid primary key,
 owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
 semester_id uuid not null,
 course_id uuid,
 title text not null check(length(btrim(title)) between 1 and 160),
 description text not null default '' check(length(description)<=4000),
 due_date date check(due_date is null or (isfinite(due_date) and due_date between date '1900-01-01' and date '9999-12-31')),
 due_time time check(due_time is null or (due_time<'24:00'::time and extract(second from due_time)=0)),
 priority text not null default 'medium' check(priority in ('low','medium','high')),
 completed_at timestamptz,
 created_at timestamptz not null default now(),
 revision integer not null default 1,
 check(due_time is null or due_date is not null),
 foreign key(semester_id,owner_id) references public.semesters(id,owner_id),
 foreign key(course_id,semester_id,owner_id) references public.courses(id,semester_id,owner_id) on delete set null(course_id)
);
create index tasks_owner_semester on public.tasks(owner_id,semester_id,due_date);
create table public.task_operations (
 owner_id uuid not null references public.profiles(id) on delete cascade,
 request_id uuid not null,
 arguments jsonb not null,
 result_revision integer not null,
 primary key(owner_id,request_id)
);
alter table public.tasks enable row level security;
alter table public.task_operations enable row level security;
create policy tasks_read on public.tasks for select to authenticated using(owner_id=(select auth.uid()));
revoke all on public.tasks,public.task_operations from anon,authenticated;
grant select on public.tasks to authenticated;
create trigger tasks_guard before insert or update or delete on public.tasks for each row execute function public.guard_academic();

create function public.change_task(p_request uuid,p_id uuid,p_semester uuid,p_revision integer,p_operation text,p_payload jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare t public.tasks; term public.semesters; receipt public.task_operations; args jsonb; result integer; cid uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_request is null or p_id is null or p_semester is null or p_revision is null or p_revision<0 or p_payload is null or p_operation is null or p_operation not in ('save','complete','delete') then raise exception 'Invalid request'; end if;
 args:=jsonb_build_array(p_id,p_semester,p_revision,p_operation,p_payload);
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request::text,0));
 select * into receipt from public.task_operations where owner_id=auth.uid() and request_id=p_request;
 if found then
  if receipt.arguments is distinct from args then raise exception 'Request changed. Try again.'; end if;
  return receipt.result_revision;
 end if;
 select * into term from public.semesters where id=p_semester and owner_id=auth.uid() for share;
 if not found or term.archived_at is not null then raise exception 'Semester unavailable or archived'; end if;
 select * into t from public.tasks where id=p_id and semester_id=p_semester and owner_id=auth.uid() for update;
 if (p_revision=0 and found) or (p_revision>0 and (not found or t.revision<>p_revision)) then raise exception 'Task changed. Reload and try again.'; end if;
 if p_operation<>'save' and p_revision=0 then raise exception 'Task unavailable'; end if;
 if p_operation='save' then
  cid:=nullif(p_payload->>'course_id','')::uuid;
  if cid is not null then
   perform 1 from public.courses where id=cid and semester_id=p_semester and owner_id=auth.uid() for key share;
   if not found then raise exception 'Course unavailable'; end if;
  end if;
  if p_revision=0 then
   insert into public.tasks(id,owner_id,semester_id,course_id,title,description,due_date,due_time,priority)
   values(p_id,auth.uid(),p_semester,cid,btrim(p_payload->>'title'),coalesce(p_payload->>'description',''),nullif(p_payload->>'due_date','')::date,nullif(p_payload->>'due_time','')::time,p_payload->>'priority') returning revision into result;
  else
   update public.tasks set course_id=cid,title=btrim(p_payload->>'title'),description=coalesce(p_payload->>'description',''),due_date=nullif(p_payload->>'due_date','')::date,due_time=nullif(p_payload->>'due_time','')::time,priority=p_payload->>'priority' where id=t.id returning revision into result;
  end if;
 elsif p_operation='complete' then
  if jsonb_typeof(p_payload->'completed') is distinct from 'boolean' then raise exception 'Invalid completion'; end if;
  update public.tasks set completed_at=case when (p_payload->>'completed')::boolean then coalesce(completed_at,now()) else null end where id=t.id returning revision into result;
 else
  delete from public.tasks where id=t.id;
  result:=t.revision;
 end if;
 insert into public.task_operations values(auth.uid(),p_request,args,result);
 return result;
end; $$;
revoke all on function public.change_task(uuid,uuid,uuid,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.change_task(uuid,uuid,uuid,integer,text,jsonb) to authenticated;
