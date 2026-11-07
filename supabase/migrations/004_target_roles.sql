-- Roles the user wants before they apply. Collected during onboarding.

alter table public.profiles
  add column if not exists target_roles text[] not null default '{}';

alter table public.profiles
  drop constraint if exists profiles_target_roles_count;

alter table public.profiles
  add constraint profiles_target_roles_count
  check (cardinality(target_roles) <= 8);

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
