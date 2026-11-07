-- Replace the save functions so inserts fill profiles.id.
-- The live profiles table requires id, and the previous functions only wrote user_id.

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

create or replace function public.save_target_roles(
  p_roles text[],
  p_dispatch_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
  clean text[] := '{}';
  role text;
  label text;
  saved text[];
begin
  if uid is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if not private.dispatch_secret_ok(p_dispatch_secret) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  foreach role in array coalesce(p_roles, '{}'::text[])
  loop
    label := regexp_replace(btrim(coalesce(role, '')), '\s+', ' ', 'g');
    if label = '' then
      continue;
    end if;
    if char_length(label) < 2 or char_length(label) > 80 then
      raise exception 'invalid target role' using errcode = '22023';
    end if;
    if not exists (
      select 1 from unnest(clean) as existing where lower(existing) = lower(label)
    ) then
      clean := array_append(clean, label);
    end if;
    if cardinality(clean) > 8 then
      raise exception 'invalid target role' using errcode = '22023';
    end if;
  end loop;

  if cardinality(clean) = 0 then
    raise exception 'invalid target role' using errcode = '22023';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'id'
  ) then
    update public.profiles
    set user_id = uid,
        target_roles = clean
    where id = uid or user_id = uid
    returning public.profiles.target_roles into saved;

    if not found then
      insert into public.profiles (id, user_id, target_roles)
      values (uid, uid, clean)
      returning public.profiles.target_roles into saved;
    end if;
  else
    insert into public.profiles (user_id, target_roles)
    values (uid, clean)
    on conflict (user_id) do update
      set target_roles = excluded.target_roles
    returning public.profiles.target_roles into saved;
  end if;

  return jsonb_build_object('targetRoles', to_jsonb(saved));
end;
$$;

revoke all on function public.save_target_roles(text[], text) from public, anon, authenticated;
grant execute on function public.save_target_roles(text[], text) to authenticated;
