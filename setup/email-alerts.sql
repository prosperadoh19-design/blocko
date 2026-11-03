-- Blocko email alerts (optional). Run AFTER setup.sql.
-- 1. Sign up free at https://resend.com and create an API key (starts with re_).
-- 2. Replace the two values marked PASTE below, then run this in Supabase > SQL Editor.
-- Note: until you verify your own domain in Resend, emails can only go to the address you signed up to Resend with.

create extension if not exists pg_net;

-- store your key and app link safely in the Supabase vault (run once; to change later, delete them in Project Settings > Vault)
select vault.create_secret('PASTE_YOUR_RESEND_KEY_HERE', 'resend_api_key');
select vault.create_secret('PASTE_YOUR_APP_LINK_HERE', 'blocko_app_url'); -- e.g. https://sunny-baklava-5a8f61.netlify.app/

create or replace function public.notify_new_response() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  t text; emails text; key text; app text; safe_title text;
begin
  select p.title, a.emails into t, emails from pages p left join page_alerts a on a.page_id = p.id where p.id = new.page_id;
  if emails is null or btrim(emails) = '' then return new; end if;
  select decrypted_secret into key from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
  select decrypted_secret into app from vault.decrypted_secrets where name = 'blocko_app_url' limit 1;
  if key is null then return new; end if;
  safe_title := replace(replace(replace(coalesce(nullif(t, ''), 'Untitled page'), '&', '&amp;'), '<', '&lt;'), '>', '&gt;');
  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || key, 'Content-Type', 'application/json'),
    body := jsonb_build_object(
      'from', 'Blocko <onboarding@resend.dev>',
      'to', to_jsonb(string_to_array(regexp_replace(emails, '\s', '', 'g'), ',')),
      'subject', 'New response: ' || coalesce(nullif(t, ''), 'Untitled page'),
      'html', '<div style="font-family:sans-serif;font-size:16px"><p>Someone just filled in <b>' || safe_title || '</b>.</p>'
        || case when app is not null then '<p><a href="' || app || '#r-' || new.page_id || '">See the answers in Blocko</a></p>' else '' end || '</div>'
    )
  );
  return new;
end $$;

drop trigger if exists on_new_response on public.responses;
create trigger on_new_response after insert on public.responses for each row execute function public.notify_new_response();
