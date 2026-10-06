-- Phase 3: standalone timed events only. Existing identity data is untouched.
create table public.courses (
 id uuid primary key,
 owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
 semester_id uuid not null,
 code text not null check (length(btrim(code)) between 1 and 30),
 name text not null check (length(btrim(name)) between 1 and 120),
 instructor text not null default '' check (length(instructor) <= 120),
 color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
 revision integer not null default 1,
 unique(id, semester_id, owner_id),
 foreign key(semester_id,owner_id) references public.semesters(id,owner_id)
);
create table public.calendar_events (
 id uuid primary key,
 owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
 semester_id uuid not null,
 course_id uuid,
 title text not null check (length(btrim(title)) between 1 and 160),
 starts_at timestamptz not null check (isfinite(starts_at)),
 ends_at timestamptz not null check (isfinite(ends_at) and ends_at > starts_at),
 color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
 revision integer not null default 1,
 foreign key(semester_id,owner_id) references public.semesters(id,owner_id),
 foreign key(course_id,semester_id,owner_id) references public.courses(id,semester_id,owner_id) on delete set null (course_id)
);
create index courses_semester on public.courses(owner_id,semester_id);
create index events_range on public.calendar_events(owner_id,semester_id,starts_at,ends_at);
create index events_course on public.calendar_events(course_id,semester_id,owner_id);

-- Lock the parent against concurrent archiving; all writers share this guard.
create function public.guard_academic() returns trigger language plpgsql set search_path='' as $$
declare sid uuid; oid uuid; archived timestamptz;
begin
 sid := case when tg_op='DELETE' then old.semester_id else new.semester_id end;
 oid := case when tg_op='DELETE' then old.owner_id else new.owner_id end;
 select archived_at into archived from public.semesters where id=sid and owner_id=oid for share;
 if not found or archived is not null then raise exception 'Semester unavailable or archived'; end if;
 if tg_op='DELETE' then return old; end if;
 if tg_op='UPDATE' then
  if new.id<>old.id or new.owner_id<>old.owner_id or new.semester_id<>old.semester_id then raise exception 'Ownership cannot change'; end if;
  new.revision := old.revision+1;
 else new.revision := 1; end if;
 return new;
end; $$;
create trigger courses_guard before insert or update or delete on public.courses for each row execute function public.guard_academic();
create trigger events_guard before insert or update or delete on public.calendar_events for each row execute function public.guard_academic();
alter table public.courses enable row level security;
alter table public.calendar_events enable row level security;
create policy courses_owner on public.courses for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy events_owner on public.calendar_events for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
-- Mutations only through scoped functions: clients cannot bypass revisions.
revoke all on public.courses,public.calendar_events from anon,authenticated;
grant select on public.courses,public.calendar_events to authenticated;

create function public.save_course(p_id uuid,p_semester uuid,p_revision integer,p_code text,p_name text,p_instructor text,p_color text)
returns public.courses language plpgsql security definer set search_path='' as $$
declare result public.courses;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.semesters where id=p_semester and owner_id=auth.uid()) then raise exception 'Semester unavailable'; end if;
 if p_revision=0 then
  insert into public.courses(id,owner_id,semester_id,code,name,instructor,color) values(p_id,auth.uid(),p_semester,btrim(p_code),btrim(p_name),btrim(p_instructor),p_color) on conflict(id) do nothing;
  select * into result from public.courses where id=p_id and owner_id=auth.uid() and semester_id=p_semester;
  if not found or (result.code,result.name,result.instructor,result.color) is distinct from (btrim(p_code),btrim(p_name),btrim(p_instructor),p_color) then raise exception 'Record changed'; end if;
 else
  update public.courses set code=btrim(p_code),name=btrim(p_name),instructor=btrim(p_instructor),color=p_color where id=p_id and owner_id=auth.uid() and semester_id=p_semester and revision=p_revision returning * into result;
  if not found then raise exception 'Record changed'; end if;
 end if;
 return result;
end; $$;
create function public.save_event(p_id uuid,p_semester uuid,p_revision integer,p_title text,p_start timestamptz,p_end timestamptz,p_course uuid,p_color text)
returns public.calendar_events language plpgsql security definer set search_path='' as $$
declare result public.calendar_events;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.semesters where id=p_semester and owner_id=auth.uid()) then raise exception 'Semester unavailable'; end if;
 if p_revision=0 then
  insert into public.calendar_events(id,owner_id,semester_id,title,starts_at,ends_at,course_id,color) values(p_id,auth.uid(),p_semester,btrim(p_title),p_start,p_end,p_course,p_color) on conflict(id) do nothing;
  select * into result from public.calendar_events where id=p_id and owner_id=auth.uid() and semester_id=p_semester;
  if not found or (result.title,result.starts_at,result.ends_at,result.course_id,result.color) is distinct from (btrim(p_title),p_start,p_end,p_course,p_color) then raise exception 'Record changed'; end if;
 else
  update public.calendar_events set title=btrim(p_title),starts_at=p_start,ends_at=p_end,course_id=p_course,color=p_color where id=p_id and owner_id=auth.uid() and semester_id=p_semester and revision=p_revision returning * into result;
  if not found then raise exception 'Record changed'; end if;
 end if;
 return result;
end; $$;
create function public.delete_academic(p_id uuid,p_semester uuid,p_revision integer,p_kind text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_kind='course' then
  if not exists(select 1 from public.courses where id=p_id and owner_id=auth.uid() and semester_id=p_semester) then return; end if;
  delete from public.courses where id=p_id and owner_id=auth.uid() and semester_id=p_semester and revision=p_revision;
 elsif p_kind='event' then
  if not exists(select 1 from public.calendar_events where id=p_id and owner_id=auth.uid() and semester_id=p_semester) then return; end if;
  delete from public.calendar_events where id=p_id and owner_id=auth.uid() and semester_id=p_semester and revision=p_revision;
 else raise exception 'Invalid kind'; end if;
 if not found then raise exception 'Record changed'; end if;
end; $$;
revoke all on function public.guard_academic(), public.save_course(uuid,uuid,integer,text,text,text,text),public.save_event(uuid,uuid,integer,text,timestamptz,timestamptz,uuid,text),public.delete_academic(uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.save_course(uuid,uuid,integer,text,text,text,text),public.save_event(uuid,uuid,integer,text,timestamptz,timestamptz,uuid,text),public.delete_academic(uuid,uuid,integer,text) to authenticated;
