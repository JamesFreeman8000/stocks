-- ============================================================
-- MIGRATION 07 — app settings (admin kill switches)
-- Run in Supabase SQL Editor (new snippet) after the earlier migrations.
--
-- A tiny key/value table for app-wide flags controlled by admins.
-- First use: "posts_enabled" — a master switch to disable all new posts
-- instantly (e.g. if someone finds a way to upload bad images).
-- ============================================================

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now(),
  updated_by uuid references public.profiles(id)
);

-- default: posting is ON
insert into public.app_settings (key, value)
  values ('posts_enabled', 'true'::jsonb)
  on conflict (key) do nothing;

alter table public.app_settings enable row level security;

-- Everyone can READ settings (the app needs to know if posting is on).
drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings for select using (true);

-- Only admins can CHANGE settings.
drop policy if exists app_settings_write on public.app_settings;
create policy app_settings_write on public.app_settings for all
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- DATABASE-LEVEL ENFORCEMENT of the posting kill switch.
-- The client checks posts_enabled too (for a nice message), but this makes
-- it real: even someone hitting the API directly cannot insert a post while
-- posting is disabled. Admins are exempt so you can still test.
-- ============================================================
create or replace function public.posting_allowed() returns boolean
language sql security definer stable set search_path = public as $$
  select coalesce((select value = 'true'::jsonb from public.app_settings where key = 'posts_enabled'), true)
         or public.is_admin();
$$;

-- Replace the posts insert policy to also require posting be enabled.
drop policy if exists posts_insert_own on public.posts;
create policy posts_insert_own on public.posts for insert
  with check (auth.uid() = user_id and public.posting_allowed());

