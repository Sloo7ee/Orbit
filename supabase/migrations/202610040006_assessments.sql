-- Weighted assessment items, separate from calendar events. Numeric values are
-- deliberately unconstrained by typmod so excess precision is rejected, not rounded.
create table public.assessments (
 id uuid primary key,
 owner_id uuid not null references public.profiles(id) on delete cascade,
 semester_id uuid not null,
 course_id uuid not null,
 name text not null check(length(btrim(name)) between 1 and 160),
 weight numeric not null check(weight>0 and weight<=100 and scale(weight)<=4),
 score_earned numeric check(score_earned>=0 and score_earned<=score_possible and scale(score_earned)<=4),
 score_possible numeric not null check(score_possible>0 and score_possible<=1000000000 and scale(score_possible)<=4),
 due_date date check(due_date is null or (isfinite(due_date) and due_date between date '1900-01-01' and date '9999-12-31')),
 due_time time check(due_time is null or (due_time<'24:00'::time and extract(second from due_time)=0)),
 notes text not null default '' check(length(notes)<=4000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 revision integer not null default 1,
 check(due_time is null or due_date is not null),
 foreign key(semester_id,owner_id) references public.semesters(id,owner_id),
 constraint assessments_course_history foreign key(course_id,semester_id,owner_id) references public.courses(id,semester_id,owner_id)
);
create index assessments_owner_semester on public.assessments(owner_id,semester_id,course_id);
create table public.assessment_operations (
 owner_id uuid not null references public.profiles(id) on delete cascade,
 request_id uuid not null,
 arguments jsonb not null,
 result_revision integer not null,
 primary key(owner_id,request_id)
);
alter table public.assessments enable row level security;
alter table public.assessment_operations enable row level security;
create policy assessments_read on public.assessments for select to authenticated using(owner_id=(select auth.uid()));
revoke all on public.assessments,public.assessment_operations from anon,authenticated;
grant select on public.assessments to authenticated;
create trigger assessments_guard before insert or update or delete on public.assessments for each row execute function public.guard_academic();

create function public.change_assessment(p_request uuid,p_id uuid,p_semester uuid,p_course uuid,p_revision integer,p_delete boolean,p_payload jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare a public.assessments; c public.courses; term public.semesters; receipt public.assessment_operations; args jsonb; result integer; w numeric;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_request is null or p_id is null or p_semester is null or p_course is null or p_revision is null or p_revision<0 or p_payload is null or p_delete is null then raise exception 'Invalid request'; end if;
 args:=jsonb_build_array(p_id,p_semester,p_course,p_revision,p_delete,p_payload);
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request::text,0));
 select * into receipt from public.assessment_operations where owner_id=auth.uid() and request_id=p_request;
 if found then
  if receipt.arguments is distinct from args then raise exception 'Request changed. Try again.'; end if;
  return receipt.result_revision;
 end if;
 select * into term from public.semesters where id=p_semester and owner_id=auth.uid() for share;
 if not found or term.archived_at is not null then raise exception 'Semester unavailable or archived'; end if;
 -- Serialize every assessment mutation for this course to protect the weight sum.
 select * into c from public.courses where id=p_course and semester_id=p_semester and owner_id=auth.uid() for update;
 if not found then raise exception 'Course unavailable'; end if;
 select * into a from public.assessments where id=p_id and course_id=c.id and semester_id=term.id and owner_id=auth.uid() for update;
 if (p_revision=0 and found) or (p_revision>0 and (not found or a.revision<>p_revision)) then raise exception 'Assessment changed. Reload and try again.'; end if;
 if p_delete then
  if p_revision=0 then raise exception 'Assessment unavailable'; end if;
  delete from public.assessments where id=a.id;
  result:=a.revision;
 else
  w:=(p_payload->>'weight')::numeric;
  if w+(select coalesce(sum(weight),0) from public.assessments where course_id=c.id and id<>p_id)>100 then raise exception 'Total assessment weight cannot exceed 100 percent'; end if;
  if p_revision=0 then
   insert into public.assessments(id,owner_id,semester_id,course_id,name,weight,score_earned,score_possible,due_date,due_time,notes)
   values(p_id,auth.uid(),term.id,c.id,btrim(p_payload->>'name'),w,nullif(p_payload->>'score_earned','')::numeric,(p_payload->>'score_possible')::numeric,nullif(p_payload->>'due_date','')::date,nullif(p_payload->>'due_time','')::time,coalesce(p_payload->>'notes','')) returning revision into result;
  else
   update public.assessments set name=btrim(p_payload->>'name'),weight=w,score_earned=nullif(p_payload->>'score_earned','')::numeric,score_possible=(p_payload->>'score_possible')::numeric,due_date=nullif(p_payload->>'due_date','')::date,due_time=nullif(p_payload->>'due_time','')::time,notes=coalesce(p_payload->>'notes',''),updated_at=now() where id=a.id returning revision into result;
  end if;
 end if;
 insert into public.assessment_operations values(auth.uid(),p_request,args,result);
 return result;
end; $$;
revoke all on function public.change_assessment(uuid,uuid,uuid,uuid,integer,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.change_assessment(uuid,uuid,uuid,uuid,integer,boolean,jsonb) to authenticated;
