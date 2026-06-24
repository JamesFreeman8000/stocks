-- ============================================================
-- StockScope database schema (run this in Supabase SQL Editor)
-- Covers: profiles, watchlists, community posts, post tickers,
-- support chat, and subscription state. Row-Level Security (RLS)
-- ensures users can only touch their own data.
-- ============================================================

-- ---------- PROFILES ----------
-- Supabase already has auth.users (email + hashed password, managed by Supabase).
-- We add a public profile row per user for app-specific fields.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  avatar_url text,                      -- profile picture (Supabase Storage URL)
  avatar_status text default 'pending', -- pending | approved | rejected (moderation)
  recovery_code_hash text not null,     -- hash of the one-time recovery code
  is_admin boolean default false,       -- YOUR account = true
  tier text default 'free',             -- free | premium
  premium_until timestamptz,            -- when a sub expires (null = none / lifetime uses far-future)
  created_at timestamptz default now()
);

-- ---------- WATCHLIST ----------
create table if not exists public.watchlist (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  created_at timestamptz default now(),
  unique (user_id, ticker)
);

-- ---------- COMMUNITY POSTS ----------
create table if not exists public.posts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  image_url text,                       -- optional screenshot (Storage URL)
  image_status text default 'none',     -- none | pending | approved | rejected
  status text default 'visible',        -- visible | hidden (spam/mod)
  created_at timestamptz default now()
);

-- Tickers mentioned in a post (one row per $TICKER) so a post can appear
-- on multiple stock pages. Populated when the post is created.
create table if not exists public.post_tickers (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts(id) on delete cascade,
  ticker text not null
);
create index if not exists idx_post_tickers_ticker on public.post_tickers(ticker);

-- ---------- SUPPORT CHAT ----------
create table if not exists public.support_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  sender text not null,                 -- 'user' | 'admin'
  body text not null,
  created_at timestamptz default now()
);
create index if not exists idx_support_user on public.support_messages(user_id, created_at);

-- ---------- SUBSCRIPTIONS (Stripe state mirror) ----------
create table if not exists public.subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text,                            -- monthly | yearly | lifetime
  status text,                          -- active | canceled | past_due
  current_period_end timestamptz,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.watchlist enable row level security;
alter table public.posts enable row level security;
alter table public.post_tickers enable row level security;
alter table public.support_messages enable row level security;
alter table public.subscriptions enable row level security;

-- helper: is the current user an admin?
create or replace function public.is_admin() returns boolean
language sql security definer stable as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- PROFILES: anyone signed-in can read profiles (needed to show usernames/avatars);
-- users can update only their own; admins can update any.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (true);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update
  using (auth.uid() = id or public.is_admin());
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert
  with check (auth.uid() = id);

-- WATCHLIST: fully private to the owner.
drop policy if exists watchlist_all_own on public.watchlist;
create policy watchlist_all_own on public.watchlist for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- POSTS: everyone signed-in can read visible posts; author can write/delete own;
-- admins can do anything.
drop policy if exists posts_read on public.posts;
create policy posts_read on public.posts for select
  using (status = 'visible' or auth.uid() = user_id or public.is_admin());
drop policy if exists posts_insert_own on public.posts;
create policy posts_insert_own on public.posts for insert
  with check (auth.uid() = user_id);
drop policy if exists posts_update_own on public.posts;
create policy posts_update_own on public.posts for update
  using (auth.uid() = user_id or public.is_admin());
drop policy if exists posts_delete_own on public.posts;
create policy posts_delete_own on public.posts for delete
  using (auth.uid() = user_id or public.is_admin());

-- POST_TICKERS: readable by all; writable only via the owning post.
drop policy if exists post_tickers_read on public.post_tickers;
create policy post_tickers_read on public.post_tickers for select using (true);
drop policy if exists post_tickers_insert on public.post_tickers;
create policy post_tickers_insert on public.post_tickers for insert
  with check (exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid()));

-- SUPPORT: a user sees only their own thread; admin sees all.
drop policy if exists support_read on public.support_messages;
create policy support_read on public.support_messages for select
  using (auth.uid() = user_id or public.is_admin());
drop policy if exists support_insert on public.support_messages;
create policy support_insert on public.support_messages for insert
  with check (auth.uid() = user_id or public.is_admin());

-- SUBSCRIPTIONS: user reads own; only server (service role) writes.
drop policy if exists subs_read_own on public.subscriptions;
create policy subs_read_own on public.subscriptions for select
  using (auth.uid() = user_id or public.is_admin());

-- ============================================================
-- STORAGE BUCKETS (create these in the Storage UI, or run below)
--   avatars     - profile pictures
--   post-images - post screenshots
-- Both public-read so images can display; writes restricted to owners
-- via Storage policies (set in dashboard).
-- ============================================================
insert into storage.buckets (id, name, public)
  values ('avatars','avatars', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public)
  values ('post-images','post-images', true) on conflict (id) do nothing;
