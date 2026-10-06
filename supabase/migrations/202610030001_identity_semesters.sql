-- Orbit Phase 2. No academic feature tables are created here.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  timezone text not null default 'Asia/Riyadh',
  selected_semester_id uuid,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.semesters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  start_date date not null check (start_date >= '1900-01-01' and start_date <= '9999-12-31'),
  end_date date not null check (end_date >= start_date and end_date <= '9999-12-31'),
  archived_at timestamptz,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);
-- A selected semester must belong to the same profile, including direct API writes.
alter table public.profiles add constraint selected_semester_owner_fk
  foreign key (selected_semester_id, id) references public.semesters(id, owner_id);
create index semesters_owner_dates on public.semesters(owner_id, start_date desc);
alter table public.profiles enable row level security;
alter table public.semesters enable row level security;
create policy profiles_read on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_insert on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy semesters_read on public.semesters for select to authenticated using (owner_id = (select auth.uid()));
create policy semesters_insert on public.semesters for insert to authenticated with check (owner_id = (select auth.uid()));
create policy semesters_update on public.semesters for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
-- No delete grants or policies. Archive is the supported lifecycle.
revoke all on public.profiles, public.semesters from anon, authenticated;
grant select on public.profiles, public.semesters to authenticated;
grant insert (id, display_name, timezone), update (display_name, timezone, selected_semester_id) on public.profiles to authenticated;
grant insert (id, owner_id, name, start_date, end_date), update (archived_at) on public.semesters to authenticated;

create function public.guard_profile() returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.timezone) then raise exception 'Invalid timezone'; end if;
  new.display_name := btrim(new.display_name);
  if tg_op = 'UPDATE' then
    if new.id <> old.id then raise exception 'Profile ownership cannot change'; end if;
    new.created_at := old.created_at;
    new.revision := old.revision + 1;
  else new.revision := 1; end if;
  new.updated_at := now();
  return new;
end; $$;
create trigger profiles_guard before insert or update on public.profiles for each row execute function public.guard_profile();
create function public.guard_semester() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.id <> old.id or new.owner_id <> old.owner_id then raise exception 'Semester ownership cannot change'; end if;
    if new.name <> old.name or new.start_date <> old.start_date or new.end_date <> old.end_date then raise exception 'Semester details are immutable in this phase'; end if;
    new.created_at := old.created_at;
    new.revision := old.revision + 1;
  else new.revision := 1; end if;
  new.name := btrim(new.name);
  new.updated_at := now();
  return new;
end; $$;
create trigger semesters_guard before insert or update on public.semesters for each row execute function public.guard_semester();

-- Invoker functions preserve RLS. They make related writes atomic.
create function public.save_profile(p_name text, p_timezone text, p_revision integer)
returns public.profiles language plpgsql security invoker set search_path = '' as $$
declare result public.profiles;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_revision = 0 then
    insert into public.profiles(id, display_name, timezone) values(auth.uid(), p_name, p_timezone) returning * into result;
  else
    update public.profiles set display_name = p_name, timezone = p_timezone where id = auth.uid() and revision = p_revision returning * into result;
    if not found then raise exception 'This profile changed. Reload and try again.'; end if;
  end if;
  return result;
end; $$;
create function public.create_semester(p_id uuid, p_name text, p_start date, p_end date)
returns public.semesters language plpgsql security invoker set search_path = '' as $$
declare result public.semesters;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  -- Retry with the same request ID cannot duplicate a semester.
  insert into public.semesters(id, owner_id, name, start_date, end_date)
    values(p_id, auth.uid(), p_name, p_start, p_end) on conflict(id) do nothing;
  select * into result from public.semesters where id = p_id and owner_id = auth.uid();
  if not found or result.name <> btrim(p_name) or result.start_date <> p_start or result.end_date <> p_end then
    raise exception 'Could not create this semester. Reload and try again.';
  end if;
  update public.profiles set selected_semester_id = result.id where id = auth.uid();
  return result;
end; $$;
create function public.select_semester(p_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.semesters where id = p_id and owner_id = auth.uid()) then raise exception 'Semester not found'; end if;
  update public.profiles set selected_semester_id = p_id where id = auth.uid();
  if not found then raise exception 'Profile required'; end if;
end; $$;
create function public.archive_semester(p_id uuid, p_revision integer, p_archive boolean)
returns public.semesters language plpgsql security invoker set search_path = '' as $$
declare result public.semesters;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into result from public.semesters where id = p_id and owner_id = auth.uid() for update;
  if not found then raise exception 'Semester not found'; end if;
  -- Repeating a successful transition is safe.
  if (result.archived_at is not null) = p_archive then return result; end if;
  if result.revision <> p_revision then raise exception 'This semester changed. Reload and try again.'; end if;
  update public.semesters set archived_at = case when p_archive then now() else null end where id = p_id and owner_id = auth.uid() returning * into result;
  return result;
end; $$;
revoke all on function public.guard_profile(), public.guard_semester(), public.save_profile(text,text,integer), public.create_semester(uuid,text,date,date), public.select_semester(uuid), public.archive_semester(uuid,integer,boolean) from public, anon;
grant execute on function public.save_profile(text,text,integer), public.create_semester(uuid,text,date,date), public.select_semester(uuid), public.archive_semester(uuid,integer,boolean) to authenticated;
