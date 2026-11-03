-- Blocko database setup (v2: teams, uploads).
-- Supabase > SQL Editor > New query > paste this whole file > Run. Safe to run again.

-------------------------------------------------- workspaces & team
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My workspace',
  created_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  workspace_id uuid not null references public.workspaces on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  email text not null default '',
  role text not null default 'editor' check (role in ('owner', 'editor')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  email text not null,
  role text not null default 'editor' check (role in ('owner', 'editor')),
  invited_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (workspace_id, email)
);

create or replace function public.is_member(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where workspace_id = ws and user_id = auth.uid())
$$;

create or replace function public.is_ws_owner(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where workspace_id = ws and user_id = auth.uid() and role = 'owner')
$$;

-------------------------------------------------- pages & responses
create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces on delete cascade,
  owner uuid default auth.uid() references auth.users on delete set null,
  title text not null default '',
  description text not null default '',
  emoji text not null default '📝',
  color text not null default '#7b3ff2',
  brand jsonb not null default '{}',
  blocks jsonb not null default '[]',
  published boolean not null default false,
  accepting boolean not null default true,
  thank_you text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.pages add column if not exists workspace_id uuid references public.workspaces on delete cascade;
alter table public.pages alter column owner drop not null;
alter table public.pages add column if not exists brand jsonb not null default '{}';

create table if not exists public.responses (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages on delete cascade,
  answers jsonb not null,
  created_at timestamptz not null default now(),
  constraint answers_not_huge check (pg_column_size(answers) < 50000)
);
create index if not exists responses_page_idx on public.responses (page_id, created_at desc);
create index if not exists pages_ws_idx on public.pages (workspace_id, updated_at desc);

-- who gets an email when a page receives a response (kept apart so the public can't read it)
create table if not exists public.page_alerts (
  page_id uuid primary key references public.pages on delete cascade,
  emails text not null default ''
);

-------------------------------------------------- sign-in helpers
-- Called after sign-in: joins any workspaces you were invited to, or creates your first one.
create or replace function public.bootstrap() returns setof public.workspaces
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  uemail text := lower(coalesce(auth.jwt() ->> 'email', ''));
  ws uuid;
begin
  if uid is null then raise exception 'Please sign in first'; end if;
  if uemail <> '' then
    insert into members (workspace_id, user_id, email, role)
      select i.workspace_id, uid, uemail, i.role from invites i where lower(i.email) = uemail
      on conflict (workspace_id, user_id) do nothing;
    delete from invites where lower(email) = uemail;
  end if;
  if not exists (select 1 from members where user_id = uid) then
    insert into workspaces (name, created_by) values ('My workspace', uid) returning id into ws;
    insert into members (workspace_id, user_id, email, role) values (ws, uid, uemail, 'owner');
  end if;
  update members set email = uemail where user_id = uid and email = '';
  return query select w.* from workspaces w join members m on m.workspace_id = w.id where m.user_id = uid order by w.created_at;
end $$;

create or replace function public.create_workspace(ws_name text) returns public.workspaces
language plpgsql security definer set search_path = public as $$
declare w workspaces;
begin
  if auth.uid() is null then raise exception 'Please sign in first'; end if;
  insert into workspaces (name, created_by) values (coalesce(nullif(btrim(ws_name), ''), 'New workspace'), auth.uid()) returning * into w;
  insert into members (workspace_id, user_id, email, role) values (w.id, auth.uid(), lower(coalesce(auth.jwt() ->> 'email', '')), 'owner');
  return w;
end $$;

-------------------------------------------------- security rules
alter table public.workspaces enable row level security;
alter table public.members enable row level security;
alter table public.invites enable row level security;
alter table public.pages enable row level security;
alter table public.responses enable row level security;
alter table public.page_alerts enable row level security;

drop policy if exists "members see workspace" on public.workspaces;
create policy "members see workspace" on public.workspaces for select to authenticated using (public.is_member(id));
drop policy if exists "owners rename workspace" on public.workspaces;
create policy "owners rename workspace" on public.workspaces for update to authenticated using (public.is_ws_owner(id)) with check (public.is_ws_owner(id));
drop policy if exists "owners delete workspace" on public.workspaces;
create policy "owners delete workspace" on public.workspaces for delete to authenticated using (public.is_ws_owner(id));

drop policy if exists "members see team" on public.members;
create policy "members see team" on public.members for select to authenticated using (public.is_member(workspace_id));
drop policy if exists "owners change roles" on public.members;
create policy "owners change roles" on public.members for update to authenticated using (public.is_ws_owner(workspace_id)) with check (public.is_ws_owner(workspace_id));
drop policy if exists "owners remove members or you leave" on public.members;
create policy "owners remove members or you leave" on public.members for delete to authenticated using (public.is_ws_owner(workspace_id) or user_id = auth.uid());

drop policy if exists "members see invites" on public.invites;
create policy "members see invites" on public.invites for select to authenticated using (public.is_member(workspace_id));
drop policy if exists "owners invite" on public.invites;
create policy "owners invite" on public.invites for insert to authenticated with check (public.is_ws_owner(workspace_id));
drop policy if exists "owners cancel invites" on public.invites;
create policy "owners cancel invites" on public.invites for delete to authenticated using (public.is_ws_owner(workspace_id));

drop policy if exists "owners manage their pages" on public.pages;
drop policy if exists "anyone can read published pages" on public.pages;
drop policy if exists "team reads pages" on public.pages;
create policy "team reads pages" on public.pages for select to authenticated using (public.is_member(workspace_id));
drop policy if exists "public reads published pages" on public.pages;
create policy "public reads published pages" on public.pages for select to anon, authenticated using (published);
drop policy if exists "team adds pages" on public.pages;
create policy "team adds pages" on public.pages for insert to authenticated with check (public.is_member(workspace_id));
drop policy if exists "team edits pages" on public.pages;
create policy "team edits pages" on public.pages for update to authenticated using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
drop policy if exists "team deletes pages" on public.pages;
create policy "team deletes pages" on public.pages for delete to authenticated using (public.is_member(workspace_id));

drop policy if exists "anyone can answer open pages" on public.responses;
create policy "anyone can answer open pages" on public.responses for insert to anon, authenticated
  with check (exists (select 1 from public.pages p where p.id = page_id and p.published and p.accepting));
drop policy if exists "owners read responses" on public.responses;
drop policy if exists "team reads responses" on public.responses;
create policy "team reads responses" on public.responses for select to authenticated
  using (exists (select 1 from public.pages p where p.id = page_id and public.is_member(p.workspace_id)));
drop policy if exists "owners delete responses" on public.responses;
drop policy if exists "team deletes responses" on public.responses;
create policy "team deletes responses" on public.responses for delete to authenticated
  using (exists (select 1 from public.pages p where p.id = page_id and public.is_member(p.workspace_id)));

drop policy if exists "team manages alerts" on public.page_alerts;
create policy "team manages alerts" on public.page_alerts for all to authenticated
  using (exists (select 1 from public.pages p where p.id = page_id and public.is_member(p.workspace_id)))
  with check (exists (select 1 from public.pages p where p.id = page_id and public.is_member(p.workspace_id)));

-------------------------------------------------- file storage
-- media: pictures shown on pages (public). submissions: files people attach to forms (private).
insert into storage.buckets (id, name, public, file_size_limit)
  values ('media', 'media', true, 5242880) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit)
  values ('submissions', 'submissions', false, 10485760) on conflict (id) do nothing;

drop policy if exists "team uploads media" on storage.objects;
create policy "team uploads media" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and exists (select 1 from public.members m where m.workspace_id::text = (storage.foldername(name))[1] and m.user_id = auth.uid()));
drop policy if exists "team removes media" on storage.objects;
create policy "team removes media" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and exists (select 1 from public.members m where m.workspace_id::text = (storage.foldername(name))[1] and m.user_id = auth.uid()));

drop policy if exists "anyone attaches files to open forms" on storage.objects;
create policy "anyone attaches files to open forms" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'submissions' and exists (select 1 from public.pages p where p.id::text = (storage.foldername(name))[1] and p.published and p.accepting));
drop policy if exists "team opens attached files" on storage.objects;
create policy "team opens attached files" on storage.objects for select to authenticated
  using (bucket_id = 'submissions' and exists (select 1 from public.pages p where p.id::text = (storage.foldername(name))[1] and public.is_member(p.workspace_id)));
