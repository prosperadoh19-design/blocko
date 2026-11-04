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

-------------------------------------------------- who can fill in a form (v4)
-- access: 'open' (anyone with the link), 'code' (needs the page's access code), 'email' (must verify an email first)
alter table public.pages add column if not exists access text not null default 'open';
alter table public.pages add column if not exists one_per_person boolean not null default false;
alter table public.pages drop constraint if exists pages_access_check;
do $$ begin
  alter table public.pages add constraint pages_access_check check (access in ('open', 'code', 'email', 'both'));
exception when duplicate_object then null; end $$;
alter table public.responses add column if not exists respondent_id uuid;
alter table public.responses add column if not exists respondent_email text;

-- access codes are kept apart so the public can never read them
create table if not exists public.page_secrets (
  page_id uuid primary key references public.pages on delete cascade,
  access_code text not null default ''
);
alter table public.page_secrets enable row level security;
drop policy if exists "team manages access codes" on public.page_secrets;
create policy "team manages access codes" on public.page_secrets for all to authenticated
  using (exists (select 1 from public.pages p where p.id = page_id and public.is_member(p.workspace_id)))
  with check (exists (select 1 from public.pages p where p.id = page_id and public.is_member(p.workspace_id)));

-- record who answered (from their verified sign-in, never from the form itself) and enforce the page's rules
create or replace function public.stamp_respondent() returns trigger
language plpgsql security definer set search_path = public as $$
declare p pages;
begin
  select * into p from pages where id = new.page_id;
  new.respondent_id := auth.uid();
  new.respondent_email := lower(nullif(auth.jwt() ->> 'email', ''));
  if p.access in ('email', 'both') and new.respondent_id is null then raise exception 'Please verify your email first.'; end if;
  if p.one_per_person and new.respondent_id is not null
     and exists (select 1 from responses r where r.page_id = new.page_id and r.respondent_id = new.respondent_id) then
    raise exception 'You have already filled in this form.';
  end if;
  return new;
end $$;
drop trigger if exists stamp_respondent on public.responses;
create trigger stamp_respondent before insert on public.responses for each row execute function public.stamp_respondent();

drop policy if exists "anyone can answer open pages" on public.responses;
create policy "anyone can answer open pages" on public.responses for insert to anon, authenticated
  with check (exists (select 1 from public.pages p where p.id = page_id and p.published and p.accepting
    and (p.access = 'open' or (p.access = 'email' and auth.uid() is not null))));

create or replace function public.check_access_code(p_page uuid, p_code text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from pages p join page_secrets s on s.page_id = p.id
    where p.id = p_page and p.published and p.access in ('code', 'both') and s.access_code <> ''
      and lower(btrim(s.access_code)) = lower(btrim(p_code)))
$$;

create or replace function public.submit_with_code(p_page uuid, p_answers jsonb, p_code text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.check_access_code(p_page, p_code) then raise exception 'That access code is not right.'; end if;
  if not exists (select 1 from pages where id = p_page and accepting) then raise exception 'This form is not accepting responses.'; end if;
  insert into responses (page_id, answers) values (p_page, p_answers);
end $$;
grant execute on function public.check_access_code(uuid, text) to anon, authenticated;
grant execute on function public.submit_with_code(uuid, jsonb, text) to anon, authenticated;

-------------------------------------------------- terms & abuse reports (v5)
-- who agreed to which version of the Terms of Use, and when
create table if not exists public.terms_acceptances (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  version text not null,
  accepted_at timestamptz not null default now(),
  primary key (user_id, version)
);
alter table public.terms_acceptances enable row level security;
drop policy if exists "record your own agreement" on public.terms_acceptances;
create policy "record your own agreement" on public.terms_acceptances for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "see your own agreements" on public.terms_acceptances;
create policy "see your own agreements" on public.terms_acceptances for select to authenticated using (user_id = auth.uid());

-- "Report this form": anyone can file a report; only you (in the Supabase dashboard) can read them
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references public.pages on delete set null,
  reason text not null,
  details text not null default '',
  reporter_email text,
  created_at timestamptz not null default now(),
  constraint report_size check (char_length(details) <= 2000 and char_length(reason) <= 100)
);
alter table public.reports enable row level security;
drop policy if exists "anyone can report a form" on public.reports;
create policy "anyone can report a form" on public.reports for insert to anon, authenticated with check (true);

-------------------------------------------------- ads on published pages (v6)
-- Blocko admins (the app owner) manage the sponsored ads shown on published forms.
create table if not exists public.admins (
  user_id uuid primary key references auth.users on delete cascade
);
alter table public.admins enable row level security;
drop policy if exists "admins see themselves" on public.admins;
create policy "admins see themselves" on public.admins for select to authenticated using (user_id = auth.uid());

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid())
$$;
grant execute on function public.is_admin() to authenticated;

create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  image text not null default '',
  link text not null,
  cta text not null default 'Learn more',
  advertiser text not null default '',
  active boolean not null default true,
  ends_on date,
  views integer not null default 0,
  clicks integer not null default 0,
  created_at timestamptz not null default now(),
  constraint ad_link_https check (link ~* '^https://'),
  constraint ad_sizes check (char_length(title) <= 80 and char_length(body) <= 200 and char_length(cta) <= 30)
);
alter table public.ads enable row level security;
drop policy if exists "anyone sees running ads" on public.ads;
create policy "anyone sees running ads" on public.ads for select to anon, authenticated
  using (active and (ends_on is null or ends_on >= current_date));
drop policy if exists "admins manage ads" on public.ads;
create policy "admins manage ads" on public.ads for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- count a view or a click (people seeing ads can't edit them, only bump these counters)
create or replace function public.ad_event(p_ad uuid, p_kind text) returns void
language sql security definer set search_path = public as $$
  update ads set views = views + case when p_kind = 'view' then 1 else 0 end,
                 clicks = clicks + case when p_kind = 'click' then 1 else 0 end
  where id = p_ad and active;
$$;
grant execute on function public.ad_event(uuid, text) to anon, authenticated;

-------------------------------------------------- music on artist pages (v7)
-- audio: private bucket. Team members upload songs; listeners only get links that expire after 1 hour.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('audio', 'audio', false, 26214400, array['audio/*'])
  on conflict (id) do nothing;
do $$ begin if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='team uploads audio') then
create policy "team uploads audio" on storage.objects for insert to authenticated
  with check (bucket_id = 'audio' and exists (select 1 from public.members m where m.workspace_id::text = (storage.foldername(name))[1] and m.user_id = auth.uid()));
end if; end $$;
do $$ begin if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='team removes audio') then
create policy "team removes audio" on storage.objects for delete to authenticated
  using (bucket_id = 'audio' and exists (select 1 from public.members m where m.workspace_id::text = (storage.foldername(name))[1] and m.user_id = auth.uid()));
end if; end $$;
-- listeners can make a short-lived play link for a song in a workspace that has a published page
do $$ begin if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='listeners stream audio') then
create policy "listeners stream audio" on storage.objects for select to anon, authenticated
  using (bucket_id = 'audio' and exists (select 1 from public.pages p where p.workspace_id::text = (storage.foldername(name))[1] and p.published));
end if; end $$;
do $$ begin if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='team reads audio') then
create policy "team reads audio" on storage.objects for select to authenticated
  using (bucket_id = 'audio' and exists (select 1 from public.members m where m.workspace_id::text = (storage.foldername(name))[1] and m.user_id = auth.uid()));
end if; end $$;
