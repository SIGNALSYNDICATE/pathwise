-- Additive only. The live public.job_applications table already has
-- id, user_id, company, role, date_applied, mood, feedback,
-- application_expectation, interviewed, offered, got_job, resume_filename,
-- resume_data, created_at, and community_role. Do not recreate or alter those.
alter table public.job_applications
  add column if not exists application_status text default 'applied',
  add column if not exists job_description text,
  add column if not exists rejection_reason text,
  add column if not exists interview_feedback text;

-- Ensure RLS is on
alter table public.job_applications enable row level security;

-- Policies (drop first to make this idempotent)
drop policy if exists "Users read own apps"   on public.job_applications;
drop policy if exists "Users insert own apps" on public.job_applications;
drop policy if exists "Users update own apps" on public.job_applications;
drop policy if exists "Users delete own apps" on public.job_applications;

create policy "Users read own apps"   on public.job_applications for select using (auth.uid() = user_id);
create policy "Users insert own apps" on public.job_applications for insert with check (auth.uid() = user_id);
create policy "Users update own apps" on public.job_applications for update using (auth.uid() = user_id);
create policy "Users delete own apps" on public.job_applications for delete using (auth.uid() = user_id);