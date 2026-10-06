-- Preserve Supabase's administrative account-deletion cascade. Ordinary user
-- writes still lock the parent semester and reject edits to archived history.
create or replace function public.guard_academic() returns trigger language plpgsql set search_path='' as $$
declare sid uuid; oid uuid; archived timestamptz;
begin
 sid := case when tg_op='DELETE' then old.semester_id else new.semester_id end;
 oid := case when tg_op='DELETE' then old.owner_id else new.owner_id end;
 if tg_op='DELETE' and not exists(select 1 from public.profiles where id=oid) then return old; end if;
 select archived_at into archived from public.semesters where id=sid and owner_id=oid for share;
 if not found or archived is not null then raise exception 'Semester unavailable or archived'; end if;
 if tg_op='DELETE' then return old; end if;
 if tg_op='UPDATE' then
  if new.id<>old.id or new.owner_id<>old.owner_id or new.semester_id<>old.semester_id then raise exception 'Ownership cannot change'; end if;
  new.revision := old.revision+1;
 else new.revision := 1; end if;
 return new;
end; $$;
