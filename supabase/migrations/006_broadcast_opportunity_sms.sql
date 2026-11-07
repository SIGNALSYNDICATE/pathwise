-- New opportunities text every other user who has a mobile number.
-- The person who added the opportunity is not texted.

create or replace function public.claim_opportunity_alert(
  p_advertisement_id uuid,
  p_dispatch_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
#variable_conflict use_column
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
      returning id, phone_e164, sms_notifications.message as alert_body
    )
    select coalesce(
      jsonb_agg(jsonb_build_object(
        'notification_id', upserted.id,
        'phone_e164', upserted.phone_e164,
        'message', upserted.alert_body
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
      returning id, phone_e164, sms_notifications.message as alert_body
    )
    select coalesce(
      jsonb_agg(jsonb_build_object(
        'notification_id', upserted.id,
        'phone_e164', upserted.phone_e164,
        'message', upserted.alert_body
      )),
      '[]'::jsonb
    )
    into alerts
    from upserted;
  end if;

  return jsonb_build_object('status', 'ok', 'alerts', alerts);
end;
$$;
