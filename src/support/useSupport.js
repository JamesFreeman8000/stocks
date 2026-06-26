// src/support/useSupport.js
// Support messaging. Users send messages to admins and see their own thread.
// Admins can list all threads and reply to any user.

import { useState, useCallback } from "react";
import { supabase } from "../auth/supabaseClient.js";

export function useSupport() {
  const [busy, setBusy] = useState(false);

  // Send a message. sender = "user" | "admin". When admin replies, pass the
  // target user's id as `toUserId`; for a user's own message it's their id.
  const sendMessage = useCallback(async ({ userId, sender, body }) => {
    if (!supabase) return { ok: false, error: "Not connected." };
    const text = (body || "").trim();
    if (!text) return { ok: false, error: "Empty message." };
    if (text.length > 2000) return { ok: false, error: "Message too long." };
    setBusy(true);
    const { data, error } = await supabase
      .from("support_messages")
      .insert({ user_id: userId, sender, body: text })
      .select()
      .single();
    setBusy(false);
    if (error) return { ok: false, error: error.message };
    return { ok: true, message: data };
  }, []);

  // Fetch a single user's thread (their messages + admin replies), oldest first.
  const fetchThread = useCallback(async (userId) => {
    if (!supabase) return [];
    const { data } = await supabase
      .from("support_messages")
      .select("id, sender, body, created_at, user_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    return data || [];
  }, []);

  // Admin: list all threads grouped by user, with the latest message preview.
  const fetchAllThreads = useCallback(async () => {
    if (!supabase) return [];
    const { data } = await supabase
      .from("support_messages")
      .select("id, sender, body, created_at, user_id, profiles!support_messages_user_id_fkey(username, avatar_url, avatar_status)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (!data) return [];
    // group by user_id, keep newest as preview
    const byUser = new Map();
    for (const m of data) {
      if (!byUser.has(m.user_id)) {
        byUser.set(m.user_id, {
          userId: m.user_id,
          username: m.profiles?.username || "user",
          last: m,
          unreadFromUser: 0,
        });
      }
      const t = byUser.get(m.user_id);
      if (m.sender === "user") t.unreadFromUser += 1;
    }
    return [...byUser.values()];
  }, []);

  return { sendMessage, fetchThread, fetchAllThreads, busy };
}
