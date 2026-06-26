-- ============================================================
-- MIGRATION 05 — storage upload policies for images
-- Run in Supabase SQL Editor (new snippet).
--
-- The buckets 'post-images' and 'avatars' were created in schema.sql.
-- These policies let a logged-in user UPLOAD images into a folder named
-- after their own user id, and let anyone READ (so images can display).
-- Files are organized as:  post-images/<user_id>/<filename>
-- ============================================================

-- Allow public read of both buckets (needed to display images).
drop policy if exists "public read post-images" on storage.objects;
create policy "public read post-images" on storage.objects
  for select using (bucket_id = 'post-images');

drop policy if exists "public read avatars" on storage.objects;
create policy "public read avatars" on storage.objects
  for select using (bucket_id = 'avatars');

-- Allow a logged-in user to upload into THEIR OWN folder (first path segment
-- must equal their user id). Prevents users writing into others' folders.
drop policy if exists "user upload own post-images" on storage.objects;
create policy "user upload own post-images" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "user upload own avatars" on storage.objects;
create policy "user upload own avatars" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow users to delete their own uploaded files (e.g. when deleting a post).
drop policy if exists "user delete own post-images" on storage.objects;
create policy "user delete own post-images" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
