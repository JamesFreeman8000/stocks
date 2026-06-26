-- ============================================================
-- MIGRATION 06 — support chat FK + admin promotion
-- Run in Supabase SQL Editor (new snippet) after the earlier migrations.
-- ============================================================

-- Let the support thread join pull the username/avatar from profiles.
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'support_messages_user_id_fkey'
      and table_name = 'support_messages'
  ) then
    alter table public.support_messages
      add constraint support_messages_user_id_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

-- Allow admins to update ANY profile's is_admin (to promote/demote users).
-- profiles_update_own already includes is_admin() so admins can update any row;
-- this is just an explicit confirmation that the policy covers it.
-- (No new policy needed — profiles_update_own uses: auth.uid() = id OR is_admin())
