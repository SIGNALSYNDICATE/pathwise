-- Saved job advertisements. Separate from public.job_applications.
-- Matches the live database conventions:
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   user_id uuid NOT NULL REFERENCES auth.users(id)   (no ON DELETE CASCADE)
--   timestamps DEFAULT timezone('utc', now())
-- dedupe_key is produced by lib/jobAdvertisements.ts:
--   url:<normalized listing> when a public link is present
--   role:<company>|<title> when the opportunity has no public listing

create table if not exists public.job_advertisements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  company text NOT NULL,
  description text,
  link text,
  deadline date,
  dedupe_key text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT job_advertisements_pkey PRIMARY KEY (id),
  CONSTRAINT job_advertisements_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id),
  CONSTRAINT job_advertisements_title_len CHECK (char_length(btrim(title)) BETWEEN 2 AND 160),
  CONSTRAINT job_advertisements_company_len CHECK (char_length(btrim(company)) BETWEEN 2 AND 160),
  CONSTRAINT job_advertisements_description_len CHECK (
    description IS NULL OR char_length(description) <= 8000
  ),
  CONSTRAINT job_advertisements_link_url CHECK (
    link IS NULL OR (char_length(link) <= 2000 AND link ~* '^https?://')
  ),
  CONSTRAINT job_advertisements_dedupe_key_len CHECK (char_length(btrim(dedupe_key)) > 0)
);

create unique index if not exists job_advertisements_user_dedupe_idx
  on public.job_advertisements (user_id, dedupe_key);

create index if not exists job_advertisements_user_created_idx
  on public.job_advertisements (user_id, created_at desc);

create or replace function public.set_job_advertisements_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists job_advertisements_set_updated_at on public.job_advertisements;
create trigger job_advertisements_set_updated_at
  before update on public.job_advertisements
  for each row
  execute function public.set_job_advertisements_updated_at();

alter table public.job_advertisements enable row level security;

drop policy if exists "Users read own ads" on public.job_advertisements;
drop policy if exists "Users insert own ads" on public.job_advertisements;
drop policy if exists "Users update own ads" on public.job_advertisements;
drop policy if exists "Users delete own ads" on public.job_advertisements;

create policy "Users read own ads"
  on public.job_advertisements
  for select
  using (auth.uid() = user_id);

create policy "Users insert own ads"
  on public.job_advertisements
  for insert
  with check (auth.uid() = user_id);

create policy "Users update own ads"
  on public.job_advertisements
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users delete own ads"
  on public.job_advertisements
  for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on table public.job_advertisements to authenticated;
