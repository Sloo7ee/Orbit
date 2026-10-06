-- Restricted rich-text documents. No HTML is stored or rendered.
create or replace function public.valid_note_node(n jsonb, parent text default '', depth integer default 0)
returns boolean language plpgsql immutable set search_path='' as $$
declare t text; child jsonb; mark jsonb; a jsonb; k text;
begin
 if depth>24 or jsonb_typeof(n)<>'object' or jsonb_typeof(n->'type') is distinct from 'string' then return false; end if;
 t:=n->>'type';
 if t not in ('doc','paragraph','heading','text','bulletList','orderedList','listItem','blockquote') then return false; end if;
 if (parent='' and t<>'doc') or (parent<>'' and t='doc') then return false; end if;
 if parent in ('paragraph','heading') and t<>'text' then return false; end if;
 if parent in ('bulletList','orderedList') and t<>'listItem' then return false; end if;
 if parent in ('doc','blockquote','listItem') and t not in ('paragraph','heading','bulletList','orderedList','blockquote') then return false; end if;
 for k in select jsonb_object_keys(n) loop
  if k not in ('type','content','text','marks','attrs') then return false; end if;
 end loop;
 if t='text' then
  if jsonb_typeof(n->'text') is distinct from 'string' or length(n->>'text')=0 or n ? 'content' or n ? 'attrs' then return false; end if;
 else
  if n ? 'text' or n ? 'marks' then return false; end if;
 end if;
 if n ? 'attrs' then
  a:=n->'attrs';
  if jsonb_typeof(a)<>'object' then return false; end if;
  if t='heading' then
   if a - 'level'<>'{}'::jsonb or (a->'level' is null) or not(a->'level' in ('1'::jsonb,'2'::jsonb,'3'::jsonb)) then return false; end if;
  elsif t='orderedList' then
   if a - array['start','type']<>'{}'::jsonb or (a ? 'type' and a->'type'<>'null'::jsonb and a->>'type'<>'1') or jsonb_typeof(a->'start') is distinct from 'number' or (a->>'start')::numeric<1 or (a->>'start')::numeric>100000 or (a->>'start')::numeric<>trunc((a->>'start')::numeric) then return false; end if;
  elsif a<>'{}'::jsonb then return false;
  end if;
 elsif t='heading' then return false;
 end if;
 if n ? 'marks' then
  if jsonb_typeof(n->'marks')<>'array' or jsonb_array_length(n->'marks')>5 then return false; end if;
  for mark in select * from jsonb_array_elements(n->'marks') loop
   if jsonb_typeof(mark)<>'object' or mark - array['type','attrs']<>'{}'::jsonb or jsonb_typeof(mark->'type') is distinct from 'string' or mark->>'type' not in ('bold','italic','underline','code','link') then return false; end if;
   if mark->>'type'='link' then
    a:=mark->'attrs';
    if jsonb_typeof(a) is distinct from 'object' or a - array['href','target','rel','class','title']<>'{}'::jsonb or jsonb_typeof(a->'href') is distinct from 'string' or length(a->>'href')>2048 or a->>'href' !~ '^(https?://[^[:space:]]+|mailto:[^[:space:]]+)$' then return false; end if;
    if (a ? 'target' and a->'target'<>'null'::jsonb and a->>'target'<>'_blank') or (a ? 'rel' and a->'rel'<>'null'::jsonb and a->>'rel'<>'noopener noreferrer nofollow') or (a ? 'class' and a->'class'<>'null'::jsonb) or (a ? 'title' and a->'title'<>'null'::jsonb and (jsonb_typeof(a->'title')<>'string' or length(a->>'title')>160)) then return false; end if;
   elsif mark ? 'attrs' and mark->'attrs'<>'{}'::jsonb then return false;
   end if;
  end loop;
 end if;
 if n ? 'content' then
  if jsonb_typeof(n->'content')<>'array' then return false; end if;
  for child in select * from jsonb_array_elements(n->'content') loop
   if not public.valid_note_node(child,t,depth+1) then return false; end if;
  end loop;
 end if;
 if t in ('doc','bulletList','orderedList','listItem','blockquote') then
  if not(n ? 'content') or jsonb_array_length(n->'content')=0 then return false; end if;
  if t='listItem' and n->'content'->0->>'type'<>'paragraph' then return false; end if;
 end if;
 return true;
exception when others then return false;
end; $$;

create table public.notes (
 id uuid primary key,
 owner_id uuid not null references public.profiles(id) on delete cascade,
 semester_id uuid not null,
 course_id uuid,
 title text not null check(length(btrim(title)) between 1 and 160),
 content jsonb not null check(octet_length(content::text)<=200000 and public.valid_note_node(content)),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 revision integer not null default 1,
 foreign key(semester_id,owner_id) references public.semesters(id,owner_id),
 foreign key(course_id,semester_id,owner_id) references public.courses(id,semester_id,owner_id) on delete set null(course_id)
);
create index notes_owner_semester_updated on public.notes(owner_id,semester_id,updated_at desc,id);
create table public.note_operations (
 owner_id uuid not null references public.profiles(id) on delete cascade,
 request_id uuid not null,
 arguments jsonb not null,
 result_revision integer not null,
 primary key(owner_id,request_id)
);
alter table public.notes enable row level security;
alter table public.note_operations enable row level security;
create policy notes_read on public.notes for select to authenticated using(owner_id=(select auth.uid()));
revoke all on public.notes,public.note_operations from anon,authenticated;
grant select on public.notes to authenticated;
create trigger notes_guard before insert or update or delete on public.notes for each row execute function public.guard_academic();

create function public.change_note(p_request uuid,p_id uuid,p_semester uuid,p_course uuid,p_revision integer,p_delete boolean,p_title text,p_content jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare n public.notes; term public.semesters; receipt public.note_operations; args jsonb; result integer;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_request is null or p_id is null or p_semester is null or p_revision is null or p_revision<0 or p_delete is null then raise exception 'Invalid request'; end if;
 args:=jsonb_build_array(p_id,p_semester,p_course,p_revision,p_delete,p_title,p_content);
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request::text,0));
 select * into receipt from public.note_operations where owner_id=auth.uid() and request_id=p_request;
 if found then
  if receipt.arguments is distinct from args then raise exception 'Request changed. Try again.'; end if;
  return receipt.result_revision;
 end if;
 select * into term from public.semesters where id=p_semester and owner_id=auth.uid() for share;
 if not found or term.archived_at is not null then raise exception 'Semester unavailable or archived'; end if;
 if p_course is not null then
  perform 1 from public.courses where id=p_course and semester_id=term.id and owner_id=auth.uid() for key share;
  if not found then raise exception 'Course unavailable'; end if;
 end if;
 select * into n from public.notes where id=p_id and semester_id=term.id and owner_id=auth.uid() for update;
 if (p_revision=0 and found) or (p_revision>0 and (not found or n.revision<>p_revision)) then raise exception 'Note changed. Reload and try again.'; end if;
 if p_delete then
  if p_revision=0 then raise exception 'Note unavailable'; end if;
  delete from public.notes where id=n.id;
  result:=n.revision;
 elsif p_revision=0 then
  insert into public.notes(id,owner_id,semester_id,course_id,title,content) values(p_id,auth.uid(),term.id,p_course,btrim(p_title),p_content) returning revision into result;
 else
  update public.notes set title=btrim(p_title),content=p_content,course_id=p_course,updated_at=now() where id=n.id returning revision into result;
 end if;
 insert into public.note_operations values(auth.uid(),p_request,args,result);
 return result;
end; $$;
revoke all on function public.change_note(uuid,uuid,uuid,uuid,integer,boolean,text,jsonb) from public,anon,authenticated;
grant execute on function public.change_note(uuid,uuid,uuid,uuid,integer,boolean,text,jsonb) to authenticated;
