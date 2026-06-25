-- ============================================================
-- MIGRATION 04 — fix post → profile join (usernames/avatars)
-- Run in Supabase SQL Editor (new snippet) AFTER the earlier migrations.
--
-- Problem: posts.user_id referenced auth.users, so Supabase couldn't
-- auto-join the profiles table — posts showed "user" / "?" and the feed
-- couldn't load author info. Fix: add a FK from posts.user_id to profiles.id
-- so the embedded select `profiles(...)` works. (profiles.id already equals
-- auth.users.id, so this is consistent.)
-- ============================================================

-- Add the foreign key posts.user_id -> profiles.id (if not already present).
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'posts_user_id_profiles_fkey'
      and table_name = 'posts'
  ) then
    alter table public.posts
      add constraint posts_user_id_profiles_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

-- Make sure profiles are readable so the join returns author info.
-- (This policy may already exist from schema.sql; re-create to be safe.)
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (true);

-- Make sure visible posts are readable by everyone (incl. logged-out visitors).
drop policy if exists posts_read on public.posts;
create policy posts_read on public.posts for select
  using (status = 'visible' or auth.uid() = user_id or public.is_admin());
