// src/admin/useAppSettings.js
// Read/write app-wide flags (admin kill switches). Currently: posts_enabled.

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../auth/supabaseClient.js";

// One-off read used by the post composer to check if posting is allowed.
export async function arePostsEnabled() {
  if (!supabase) return true;
  try {
    const { data } = await supabase.from("app_settings").select("value").eq("key", "posts_enabled").single();
    // value is jsonb; treat anything other than explicit false as enabled
    return data ? data.value !== false : true;
  } catch {
    return true; // if the check fails, don't block legitimate users
  }
}

// Hook for the admin toggle UI.
export function useAppSettings() {
  const [postsEnabled, setPostsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setPostsEnabled(await arePostsEnabled());
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const setPosts = useCallback(async (enabled, adminId) => {
    if (!supabase) return;
    setSaving(true);
    const { error } = await supabase.from("app_settings")
      .update({ value: enabled, updated_at: new Date().toISOString(), updated_by: adminId })
      .eq("key", "posts_enabled");
    if (!error) setPostsEnabled(enabled);
    setSaving(false);
  }, []);

  return { postsEnabled, setPosts, loading, saving, reload: load };
}
