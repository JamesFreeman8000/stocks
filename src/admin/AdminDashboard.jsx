// src/admin/AdminDashboard.jsx
// Admin-only dashboard. Home for moderation + (later) support. For now:
// a moderation queue of images the AI was unsure about (status 'pending'),
// where you approve or reject each. Only visible to is_admin users.

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import { supabase } from "../auth/supabaseClient.js";
import { Shield, Check, X, Loader2, ImageOff, Inbox } from "lucide-react";

export default function AdminDashboard() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState("queue");

  if (!isAdmin) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "60px 28px", textAlign: "center", color: "#64748b" }}>
        <Shield size={36} style={{ marginBottom: 14, color: "#1e3a34" }} />
        <div style={{ fontSize: 17, fontWeight: 700, color: "#94a3b8" }}>Admins only</div>
        <div style={{ fontSize: 13.5, marginTop: 6 }}>You don't have access to this area.</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "26px 28px" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 18px", letterSpacing: "-.02em", display: "flex", alignItems: "center", gap: 10 }}>
        <Shield size={24} color="#10b981" /> Admin Dashboard
      </h1>
      <div style={{ display: "flex", gap: 6, marginBottom: 18, borderBottom: "1px solid #161b24" }}>
        {[["queue", "Image Moderation"], ["support", "Support"]].map(([id, label]) => (
          <div key={id} onClick={() => setTab(id)} style={{ padding: "10px 16px", cursor: "pointer", fontSize: 14, fontWeight: 600, color: tab === id ? "#10b981" : "#64748b", borderBottom: tab === id ? "2px solid #10b981" : "2px solid transparent", marginBottom: -1 }}>{label}</div>
        ))}
      </div>
      {tab === "queue" && <ModerationQueue />}
      {tab === "support" && <div style={{ padding: 40, textAlign: "center", color: "#64748b", fontSize: 13.5 }}><Inbox size={28} style={{ marginBottom: 10 }} /><div>Support inbox is coming in the next milestone.</div></div>}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function ModerationQueue() {
  const [items, setItems] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    // pending post images
    const { data: posts } = await supabase
      .from("posts")
      .select("id, body, image_url, created_at, user_id, profiles!posts_user_id_profiles_fkey(username)")
      .eq("image_status", "pending")
      .order("created_at", { ascending: false });
    // pending avatars
    const { data: avatars } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .eq("avatar_status", "pending");
    const list = [
      ...(posts || []).map((p) => ({ kind: "post", id: p.id, url: p.image_url, who: p.profiles?.username, extra: p.body })),
      ...(avatars || []).map((a) => ({ kind: "avatar", id: a.id, url: a.avatar_url, who: a.username, extra: "Profile picture" })),
    ];
    setItems(list);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function decide(item, approve) {
    setBusyId(`${item.kind}:${item.id}`);
    try {
      if (item.kind === "post") {
        await supabase.from("posts").update({ image_status: approve ? "approved" : "rejected" }).eq("id", item.id);
      } else {
        await supabase.from("profiles").update({ avatar_status: approve ? "approved" : "rejected", ...(approve ? {} : { avatar_url: null }) }).eq("id", item.id);
      }
      setItems((cur) => cur.filter((x) => !(x.kind === item.kind && x.id === item.id)));
    } catch (e) { /* ignore */ }
    setBusyId(null);
  }

  if (items === null) return <div style={{ padding: 40, textAlign: "center" }}><Loader2 size={24} style={{ animation: "spin 1s linear infinite", color: "#10b981" }} /></div>;
  if (!items.length) return (
    <div style={{ padding: 50, textAlign: "center", color: "#64748b" }}>
      <Check size={30} style={{ marginBottom: 10, color: "#16332b" }} />
      <div style={{ fontSize: 14.5, fontWeight: 600, color: "#94a3b8" }}>Queue is clear</div>
      <div style={{ fontSize: 13, marginTop: 5 }}>No images waiting for review.</div>
    </div>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
      {items.map((item) => {
        const busy = busyId === `${item.kind}:${item.id}`;
        return (
          <div key={`${item.kind}:${item.id}`} style={{ background: "#0f141c", border: "1px solid #1a2230", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ height: 180, background: "#0b0e14", display: "grid", placeItems: "center", overflow: "hidden" }}>
              {item.url ? <img src={item.url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <ImageOff size={28} color="#475569" />}
            </div>
            <div style={{ padding: 12 }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 2 }}>{item.kind === "avatar" ? "Avatar" : "Post image"} · @{item.who || "user"}</div>
              {item.extra && item.kind === "post" && <div style={{ fontSize: 12.5, color: "#94a3b8", marginBottom: 10, maxHeight: 36, overflow: "hidden" }}>{item.extra}</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button onClick={() => decide(item, true)} disabled={busy} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: "#0d1f1a", color: "#34d399", border: "1px solid #16332b", borderRadius: 8, padding: "8px", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
                  {busy ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={14} />} Approve
                </button>
                <button onClick={() => decide(item, false)} disabled={busy} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: "#1f1416", color: "#fca5a5", border: "1px solid #4c1d1d", borderRadius: 8, padding: "8px", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
                  <X size={14} /> Reject
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
