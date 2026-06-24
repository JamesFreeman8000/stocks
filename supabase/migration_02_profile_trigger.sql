-- ============================================================
-- MIGRATION 02 — auto-create profile on signup (fixes RLS error)
-- Run this in Supabase SQL Editor AFTER schema.sql.
--
-- Why: creating the profile row from the browser fails RLS because the
-- user isn't fully authenticated at that instant. Instead, the database
-- creates the profile automatically the moment a new auth user appears,
-- reading the username + recovery hash from the signup metadata.
-- ============================================================

-- The function runs with definer rights, so it bypasses the RLS timing issue.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, recovery_code_hash)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'user_' || left(new.id::text, 8)),
    coalesce(new.raw_user_meta_data->>'recovery_code_hash', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Fire it whenever a new auth user is created.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Since the trigger now creates profiles, the frontend no longer inserts them.
-- We can drop the frontend insert policy (kept harmless if you leave it).
-- (No change needed; the trigger uses definer rights regardless.)

-- ============================================================
-- Helper view so the app can check "is this user's email verified?"
-- Supabase stores email_confirmed_at on auth.users. We expose a tiny,
-- safe function the frontend can call to know whether to allow posting.
-- ============================================================
create or replace function public.my_email_verified()
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  select (select email_confirmed_at is not null from auth.users where id = auth.uid());
$$;
