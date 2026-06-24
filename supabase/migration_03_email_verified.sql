-- ============================================================
-- MIGRATION 03 — controlled email verification flag
-- Run in Supabase SQL Editor (new snippet) AFTER migration 02.
--
-- Why: with "Confirm email" OFF (so users log in instantly), Supabase
-- auto-marks everyone confirmed — useless for a posting gate. So we keep
-- our OWN flag that starts false and is only set true after the user
-- actually clicks their verification link.
-- ============================================================

alter table public.profiles
  add column if not exists email_verified boolean default false;

-- Make sure the trigger that creates new profiles also sets it false
-- (default already handles it, but explicit is safer for clarity).

-- A helper the frontend can call to re-check its own verified status.
create or replace function public.am_i_verified()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce((select email_verified from public.profiles where id = auth.uid()), false);
$$;
