-- Add MVP fields to job_applications
alter table job_applications
  add column if not exists application_status text default 'applied',
  add column if not exists job_description text,
  add column if not exists rejection_reason text,
  add column if not exists interview_feedback text;

-- Ensure RLS is on
alter table job_applications enable row level security;

-- Policies (drop first to make this idempotent)
drop policy if exists "Users read own apps"   on job_applications;
drop policy if exists "Users insert own apps" on job_applications;
drop policy if exists "Users update own apps" on job_applications;
drop policy if exists "Users delete own apps" on job_applications;

create policy "Users read own apps"   on job_applications for select using (auth.uid() = user_id);
create policy "Users insert own apps" on job_applications for insert with check (auth.uid() = user_id);
create policy "Users update own apps" on job_applications for update using (auth.uid() = user_id);
create policy "Users delete own apps" on job_applications for delete using (auth.uid() = user_id);