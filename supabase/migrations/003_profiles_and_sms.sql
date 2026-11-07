-- Profiles hold the mobile number used for text alerts.
-- SMS_DISPATCH_SECRET in the server environment must hash to the value below.
-- The plaintext secret is not stored in the database.
--
-- Texts are sent only from the Next.js server:
--   opportunity_saved — the owner saves a new job advertisement
--   peer_applied — someone else applies to that same company and role,
--                  and the owner has not applied to it

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

create table if not exists private.server_secrets (
  name text primary key,
  value text not null
);

insert into private.server_secrets (name, value)
values ('sms_dispatch_sha256', 'fbad5233eb4f02fd6aa11d0892cc7802e20f8c41fc5c7214bcb57e61cf19b9a4')
on conflict (name) do update set value = excluded.value;

revoke all on table private.server_secrets from public, anon, authenticated;

-- No policies: anon and authenticated cannot read this hash.
-- dispatch_secret_ok is security definer and runs as the table owner, so it can still read the row.
alter table private.server_secrets enable row level security;

create or replace function private.dispatch_secret_ok(p_secret text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  expected text;
  actual text;
begin
  if p_secret is null or length(p_secret) < 32 then
    return false;
  end if;

  select value into expected
  from private.server_secrets
  where name = 'sms_dispatch_sha256';

  if expected is null then
    return false;
  end if;

  actual := encode(extensions.digest(convert_to(p_secret, 'UTF8'), 'sha256'), 'hex');
  return actual = expected;
end;
$$;

revoke all on function private.dispatch_secret_ok(text) from public, anon, authenticated;
grant execute on function private.dispatch_secret_ok(text) to current_user;

create or replace function public.normalize_label(value text)
returns text
language sql
immutable
parallel safe
as $$
  select regexp_replace(lower(btrim(coalesce(value, ''))), '\s+', ' ', 'g');
$$;

create table if not exists public.profiles (
  user_id uuid not null,
  full_name text,
  phone_e164 text,
  phone_country text,
  sms_opt_in boolean not null default false,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint profiles_pkey primary key (user_id),
  constraint profiles_user_id_fkey foreign key (user_id) references auth.users (id),
  constraint profiles_name_len check (
    full_name is null or char_length(btrim(full_name)) between 2 and 80
  ),
  constraint profiles_phone_e164 check (
    phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'
  ),
  constraint profiles_phone_country check (
    phone_country is null or phone_country ~ '^[A-Z]{2}$'
  ),
  constraint profiles_phone_country_pair check (
    (phone_e164 is null and phone_country is null)
    or (phone_e164 is not null and phone_country is not null)
  ),
  constraint profiles_sms_requires_phone check (
    sms_opt_in = false or phone_e164 is not null
  )
);

-- Migration 004 can run first and only adds target_roles to a profiles table
-- that already exists. CREATE TABLE IF NOT EXISTS then does nothing, so add
-- every column this migration needs before indexing them.
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists phone_e164 text;
alter table public.profiles add column if not exists phone_country text;
alter table public.profiles add column if not exists sms_opt_in boolean not null default false;
alter table public.profiles add column if not exists created_at timestamp with time zone not null default timezone('utc'::text, now());
alter table public.profiles add column if not exists updated_at timestamp with time zone not null default timezone('utc'::text, now());

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'user_id'
  ) then
    alter table public.profiles add column user_id uuid;
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = 'id'
    ) then
      update public.profiles set user_id = id where user_id is null;
    end if;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_user_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_user_id_fkey
      foreign key (user_id) references auth.users (id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype in ('p', 'u')
      and pg_get_constraintdef(oid) like '%(user_id)%'
  ) then
    alter table public.profiles
      add constraint profiles_user_id_key unique (user_id);
  end if;
end $$;

create unique index if not exists profiles_phone_e164_key
  on public.profiles (phone_e164)
  where phone_e164 is not null;

create table if not exists public.sms_notifications (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  event_type text not null,
  dedupe_key text not null,
  message text not null,
  phone_e164 text not null,
  status text not null,
  provider_ref text,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint sms_notifications_pkey primary key (id),
  constraint sms_notifications_user_id_fkey foreign key (user_id) references auth.users (id),
  constraint sms_notifications_event_type check (event_type in ('opportunity_saved', 'peer_applied')),
  constraint sms_notifications_dedupe_len check (char_length(dedupe_key) between 1 and 400),
  constraint sms_notifications_message_len check (char_length(message) between 1 and 480),
  constraint sms_notifications_phone check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  constraint sms_notifications_status check (status in ('pending', 'sent', 'failed')),
  constraint sms_notifications_user_event_key unique (user_id, event_type, dedupe_key)
);

create index if not exists sms_notifications_user_created_idx
  on public.sms_notifications (user_id, created_at desc);

create index if not exists job_advertisements_role_match_idx
  on public.job_advertisements (public.normalize_label(company), public.normalize_label(title));

create index if not exists job_applications_role_match_idx
  on public.job_applications (public.normalize_label(company), public.normalize_label(role));

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row
  execute function public.touch_updated_at();

drop trigger if exists sms_notifications_touch_updated_at on public.sms_notifications;
create trigger sms_notifications_touch_updated_at
  before update on public.sms_notifications
  for each row
  execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.sms_notifications enable row level security;

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile"
  on public.profiles
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users read own sms notifications" on public.sms_notifications;
create policy "Users read own sms notifications"
  on public.sms_notifications
  for select
  using (auth.uid() = user_id);

grant select on table public.profiles to authenticated;
grant select on table public.sms_notifications to authenticated;

create or replace function public.save_profile(
  p_full_name text,
  p_phone_e164 text,
  p_phone_country text,
  p_sms_opt_in boolean,
  p_dispatch_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
  clean_name text := nullif(regexp_replace(btrim(coalesce(p_full_name, '')), '\s+', ' ', 'g'), '');
  clean_phone text := nullif(btrim(coalesce(p_phone_e164, '')), '');
  clean_country text := nullif(upper(btrim(coalesce(p_phone_country, ''))), '');
  opt_in boolean := coalesce(p_sms_opt_in, false);
  saved public.profiles;
begin
  if uid is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if not private.dispatch_secret_ok(p_dispatch_secret) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if clean_name is not null and (
    char_length(clean_name) < 2
    or char_length(clean_name) > 80
    or clean_name !~ '^[[:alpha:]][[:alpha:] .''’-]{1,79}$'
  ) then
    raise exception 'invalid name' using errcode = '22023';
  end if;

  if (clean_phone is null) <> (clean_country is null) then
    raise exception 'invalid phone' using errcode = '22023';
  end if;
  if clean_phone is not null and clean_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'invalid phone' using errcode = '22023';
  end if;
  if clean_country is not null and clean_country !~ '^[A-Z]{2}$' then
    raise exception 'invalid phone' using errcode = '22023';
  end if;
  if opt_in and clean_phone is null then
    raise exception 'invalid phone' using errcode = '22023';
  end if;
  if not opt_in then
    opt_in := false;
  end if;

  -- Existing projects require profiles.id. Fill it with the auth user id.
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'id'
  ) then
    update public.profiles
    set user_id = uid,
        full_name = clean_name,
        phone_e164 = clean_phone,
        phone_country = clean_country,
        sms_opt_in = opt_in
    where id = uid or user_id = uid
    returning * into saved;

    if not found then
      insert into public.profiles (id, user_id, full_name, phone_e164, phone_country, sms_opt_in)
      values (uid, uid, clean_name, clean_phone, clean_country, opt_in)
      returning * into saved;
    end if;
  else
    insert into public.profiles (user_id, full_name, phone_e164, phone_country, sms_opt_in)
    values (uid, clean_name, clean_phone, clean_country, opt_in)
    on conflict (user_id) do update
      set full_name = excluded.full_name,
          phone_e164 = excluded.phone_e164,
          phone_country = excluded.phone_country,
          sms_opt_in = excluded.sms_opt_in
    returning * into saved;
  end if;

  return jsonb_build_object(
    'fullName', saved.full_name,
    'phone', saved.phone_e164,
    'phoneCountry', saved.phone_country,
    'smsOptIn', saved.sms_opt_in
  );
exception
  when unique_violation then
    raise exception 'phone in use' using errcode = '23505';
end;
$$;

create or replace function public.claim_opportunity_alert(
  p_advertisement_id uuid,
  p_dispatch_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
  ad public.job_advertisements%rowtype;
  label_title text;
  label_company text;
  alert_message text;
  alerts jsonb := '[]'::jsonb;
  has_id boolean;
begin
  if uid is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if not private.dispatch_secret_ok(p_dispatch_secret) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into ad
  from public.job_advertisements
  where id = p_advertisement_id
    and user_id = uid;

  if not found then
    return jsonb_build_object('status', 'not_found', 'alerts', '[]'::jsonb);
  end if;

  label_title := left(regexp_replace(ad.title, '[[:cntrl:]]+', ' ', 'g'), 60);
  label_company := left(regexp_replace(ad.company, '[[:cntrl:]]+', ' ', 'g'), 60);
  alert_message := 'Pathwise: New opportunity - ' || label_title || ' at ' || label_company || '.';

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'id'
  ) into has_id;

  if has_id then
    with candidates as (
      select recipient_id as user_id, min(phone_e164) as phone_e164
      from (
        select coalesce(p.user_id, p.id) as recipient_id, p.phone_e164
        from public.profiles as p
        where p.phone_e164 is not null
      ) as listed
      where recipient_id is not null
        and recipient_id <> uid
      group by recipient_id
    ),
    upserted as (
      insert into public.sms_notifications (
        user_id, event_type, dedupe_key, message, phone_e164, status
      )
      select candidates.user_id, 'opportunity_saved', 'ad:' || ad.id::text, alert_message, candidates.phone_e164, 'pending'
      from candidates
      on conflict (user_id, event_type, dedupe_key) do update
        set status = 'pending',
            message = excluded.message,
            phone_e164 = excluded.phone_e164
        where public.sms_notifications.status = 'failed'
           or (
             public.sms_notifications.status = 'pending'
             and public.sms_notifications.updated_at < timezone('utc'::text, now()) - interval '10 minutes'
           )
      returning id, phone_e164, message
    )
    select coalesce(
      jsonb_agg(jsonb_build_object(
        'notification_id', upserted.id,
        'phone_e164', upserted.phone_e164,
        'message', upserted.message
      )),
      '[]'::jsonb
    )
    into alerts
    from upserted;
  else
    with candidates as (
      select p.user_id, min(p.phone_e164) as phone_e164
      from public.profiles as p
      where p.phone_e164 is not null
        and p.user_id is not null
        and p.user_id <> uid
      group by p.user_id
    ),
    upserted as (
      insert into public.sms_notifications (
        user_id, event_type, dedupe_key, message, phone_e164, status
      )
      select candidates.user_id, 'opportunity_saved', 'ad:' || ad.id::text, alert_message, candidates.phone_e164, 'pending'
      from candidates
      on conflict (user_id, event_type, dedupe_key) do update
        set status = 'pending',
            message = excluded.message,
            phone_e164 = excluded.phone_e164
        where public.sms_notifications.status = 'failed'
           or (
             public.sms_notifications.status = 'pending'
             and public.sms_notifications.updated_at < timezone('utc'::text, now()) - interval '10 minutes'
           )
      returning id, phone_e164, message
    )
    select coalesce(
      jsonb_agg(jsonb_build_object(
        'notification_id', upserted.id,
        'phone_e164', upserted.phone_e164,
        'message', upserted.message
      )),
      '[]'::jsonb
    )
    into alerts
    from upserted;
  end if;

  return jsonb_build_object('status', 'ok', 'alerts', alerts);
end;
$$;

create or replace function public.claim_peer_application_alerts(
  p_application_id uuid,
  p_dispatch_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
  app public.job_applications%rowtype;
  company_key text;
  role_key text;
  dedupe text;
  alert_message text;
  alerts jsonb;
begin
  if uid is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if not private.dispatch_secret_ok(p_dispatch_secret) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into app
  from public.job_applications
  where id = p_application_id
    and user_id = uid;

  if not found then
    return jsonb_build_object('status', 'not_found', 'alerts', '[]'::jsonb);
  end if;

  company_key := public.normalize_label(app.company);
  role_key := public.normalize_label(app.role);
  if company_key = '' or role_key = '' then
    return jsonb_build_object('status', 'not_found', 'alerts', '[]'::jsonb);
  end if;

  dedupe := 'role:' || company_key || '|' || role_key;
  alert_message := 'Pathwise: Someone else applied to '
    || left(regexp_replace(app.role, '[[:cntrl:]]+', ' ', 'g'), 60)
    || ' at '
    || left(regexp_replace(app.company, '[[:cntrl:]]+', ' ', 'g'), 60)
    || '. You have not applied to this role yet.';

  with candidates as (
    select p.user_id, min(p.phone_e164) as phone_e164
    from public.job_advertisements as saved
    join public.profiles as p on p.user_id = saved.user_id
    where public.normalize_label(saved.company) = company_key
      and public.normalize_label(saved.title) = role_key
      and saved.user_id <> uid
      and p.sms_opt_in
      and p.phone_e164 is not null
      and not exists (
        select 1
        from public.job_applications as existing
        where existing.user_id = saved.user_id
          and public.normalize_label(existing.company) = company_key
          and public.normalize_label(existing.role) = role_key
      )
      and not exists (
        select 1
        from public.sms_notifications as sent
        where sent.user_id = p.user_id
          and sent.event_type = 'peer_applied'
          and sent.dedupe_key = dedupe
          and sent.status = 'sent'
      )
    group by p.user_id
    order by p.user_id
    limit 25
  ),
  upserted as (
    insert into public.sms_notifications (
      user_id, event_type, dedupe_key, message, phone_e164, status
    )
    select candidates.user_id, 'peer_applied', dedupe, alert_message, candidates.phone_e164, 'pending'
    from candidates
    on conflict (user_id, event_type, dedupe_key) do update
      set status = 'pending',
          message = excluded.message,
          phone_e164 = excluded.phone_e164
      where public.sms_notifications.status = 'failed'
         or (
           public.sms_notifications.status = 'pending'
           and public.sms_notifications.updated_at < timezone('utc'::text, now()) - interval '10 minutes'
         )
    returning id, phone_e164, message
  )
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'notification_id', upserted.id,
      'phone_e164', upserted.phone_e164,
      'message', upserted.message
    )),
    '[]'::jsonb
  )
  into alerts
  from upserted;

  return jsonb_build_object('status', 'ok', 'alerts', alerts);
end;
$$;

create or replace function public.finalize_sms_notification(
  p_notification_id uuid,
  p_dispatch_secret text,
  p_status text,
  p_provider_ref text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.uid() is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if not private.dispatch_secret_ok(p_dispatch_secret) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_status not in ('sent', 'failed') then
    raise exception 'invalid status' using errcode = '22023';
  end if;

  update public.sms_notifications
  set status = p_status,
      provider_ref = case
        when p_status = 'sent' then nullif(left(btrim(coalesce(p_provider_ref, '')), 120), '')
        else null
      end
  where id = p_notification_id
    and status = 'pending';
end;
$$;

revoke all on function public.save_profile(text, text, text, boolean, text) from public, anon, authenticated;
revoke all on function public.claim_opportunity_alert(uuid, text) from public, anon, authenticated;
revoke all on function public.claim_peer_application_alerts(uuid, text) from public, anon, authenticated;
revoke all on function public.finalize_sms_notification(uuid, text, text, text) from public, anon, authenticated;

grant execute on function public.save_profile(text, text, text, boolean, text) to authenticated;
grant execute on function public.claim_opportunity_alert(uuid, text) to authenticated;
grant execute on function public.claim_peer_application_alerts(uuid, text) to authenticated;
grant execute on function public.finalize_sms_notification(uuid, text, text, text) to authenticated;
