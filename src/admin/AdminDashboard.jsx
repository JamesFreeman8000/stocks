// src/admin/AdminDashboard.jsx
// Admin-only dashboard. Home for moderation + (later) support. For now:
// a moderation queue of images the AI was unsure about (status 'pending'),
// where you approve or reject each. Only visible to is_admin users.

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import { supabase } from "../auth/supabaseClient.js";
import { useSupport } from "../support/useSupport.js";
import { Shield, Check, X, Loader2, ImageOff, Inbox, Send, ArrowLeft, UserPlus } from "lucide-react";

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
        {[["queue", "Image Moderation"], ["support", "Support"], ["users", "Users"]].map(([id, label]) => (
          <div key={id} onClick={() => setTab(id)} style={{ padding: "10px 16px", cursor: "pointer", fontSize: 14, fontWeight: 600, color: tab === id ? "#10b981" : "#64748b", borderBottom: tab === id ? "2px solid #10b981" : "2px solid transparent", marginBottom: -1 }}>{label}</div>
        ))}
      </div>
      {tab === "queue" && <ModerationQueue />}
      {tab === "support" && <SupportInbox />}
      {tab === "users" && <UsersAdmin />}
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

// ---- SUPPORT INBOX (admin) ----
function SupportInbox() {
  const { user } = useAuth();
  const { fetchAllThreads, fetchThread, sendMessage, busy } = useSupport();
  const [threads, setThreads] = useState(null);
  const [active, setActive] = useState(null); // { userId, username }
  const [msgs, setMsgs] = useState([]);
  const [reply, setReply] = useState("");

  const loadThreads = useCallback(async () => { setThreads(await fetchAllThreads()); }, [fetchAllThreads]);
  useEffect(() => { loadThreads(); }, [loadThreads]);

  const openThread = useCallback(async (t) => {
    setActive(t);
    setMsgs(await fetchThread(t.userId));
  }, [fetchThread]);

  // poll the open thread
  useEffect(() => {
    if (!active) return;
    const i = setInterval(async () => setMsgs(await fetchThread(active.userId)), 5000);
    return () => clearInterval(i);
  }, [active, fetchThread]);

  async function send() {
    if (!reply.trim() || !active) return;
    const res = await sendMessage({ userId: active.userId, sender: "admin", body: reply });
    if (res.ok) { setReply(""); setMsgs((m) => [...m, res.message]); }
  }

  if (threads === null) return <div style={{ padding: 40, textAlign: "center" }}><Loader2 size={24} style={{ animation: "spin 1s linear infinite", color: "#10b981" }} /></div>;

  // thread view
  if (active) {
    return (
      <div style={{ maxWidth: 640 }}>
        <div onClick={() => { setActive(null); loadThreads(); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#60a5fa", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 14 }}><ArrowLeft size={15} /> All conversations</div>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>@{active.username}</div>
        <div style={{ background: "#0b0e14", border: "1px solid #1a2230", borderRadius: 12, height: 380, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 9, marginBottom: 12 }}>
          {msgs.map((m) => (
            <div key={m.id} style={{ alignSelf: m.sender === "admin" ? "flex-end" : "flex-start", maxWidth: "78%", background: m.sender === "admin" ? "#10b981" : "#1a2230", color: m.sender === "admin" ? "#04130c" : "#e2e8f0", padding: "8px 12px", borderRadius: 12, fontSize: 13.5, lineHeight: 1.45, wordBreak: "break-word" }}>{m.body}</div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Type your reply…" style={{ flex: 1, background: "#11151d", border: "1px solid #232b38", borderRadius: 9, padding: "10px 12px", color: "#e2e8f0", fontSize: 13.5, outline: "none" }} />
          <button onClick={send} disabled={busy} style={{ background: "#10b981", border: "none", borderRadius: 9, padding: "0 16px", display: "grid", placeItems: "center", cursor: "pointer" }}>
            {busy ? <Loader2 size={16} color="#04130c" style={{ animation: "spin 1s linear infinite" }} /> : <Send size={16} color="#04130c" />}
          </button>
        </div>
      </div>
    );
  }

  // thread list
  if (!threads.length) return <div style={{ padding: 50, textAlign: "center", color: "#64748b" }}><Inbox size={30} style={{ marginBottom: 10 }} /><div style={{ fontSize: 14.5, fontWeight: 600, color: "#94a3b8" }}>No messages yet</div></div>;
  return (
    <div style={{ maxWidth: 640 }}>
      {threads.map((t) => (
        <div key={t.userId} onClick={() => openThread(t)} style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, background: "#0f141c", border: "1px solid #1a2230", borderRadius: 12, marginBottom: 10, cursor: "pointer" }}>
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#1e3a8a", display: "grid", placeItems: "center", fontWeight: 700, color: "#fff", flexShrink: 0 }}>{t.username?.[0]?.toUpperCase() || "?"}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>@{t.username}</div>
            <div style={{ fontSize: 12.5, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.last.sender === "admin" ? "You: " : ""}{t.last.body}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- USERS ADMIN (promote/demote admins) ----
function UsersAdmin() {
  const [users, setUsers] = useState(null);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from("profiles").select("id, username, is_admin, tier, created_at").order("created_at", { ascending: false }).limit(200);
    setUsers(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function toggleAdmin(u) {
    setBusyId(u.id);
    await supabase.from("profiles").update({ is_admin: !u.is_admin }).eq("id", u.id);
    setUsers((cur) => cur.map((x) => x.id === u.id ? { ...x, is_admin: !x.is_admin } : x));
    setBusyId(null);
  }

  if (users === null) return <div style={{ padding: 40, textAlign: "center" }}><Loader2 size={24} style={{ animation: "spin 1s linear infinite", color: "#10b981" }} /></div>;
  const filtered = q ? users.filter((u) => u.username?.toLowerCase().includes(q.toLowerCase())) : users;

  return (
    <div style={{ maxWidth: 640 }}>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search username…" style={{ width: "100%", background: "#11151d", border: "1px solid #232b38", borderRadius: 9, padding: "10px 12px", color: "#e2e8f0", fontSize: 13.5, outline: "none", marginBottom: 14 }} />
      {filtered.map((u) => (
        <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, background: "#0f141c", border: "1px solid #1a2230", borderRadius: 12, marginBottom: 9 }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#1e3a8a", display: "grid", placeItems: "center", fontWeight: 700, color: "#fff", flexShrink: 0 }}>{u.username?.[0]?.toUpperCase() || "?"}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 7 }}>@{u.username} {u.is_admin && <span style={{ fontSize: 10, fontWeight: 700, color: "#10b981", background: "#0d1f1a", padding: "2px 7px", borderRadius: 5 }}>ADMIN</span>}</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>{u.tier === "premium" ? "Premium" : "Free"}</div>
          </div>
          <button onClick={() => toggleAdmin(u)} disabled={busyId === u.id} style={{ display: "flex", alignItems: "center", gap: 5, background: u.is_admin ? "#1f1416" : "#0d1f1a", color: u.is_admin ? "#fca5a5" : "#34d399", border: `1px solid ${u.is_admin ? "#4c1d1d" : "#16332b"}`, borderRadius: 8, padding: "7px 12px", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
            {busyId === u.id ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <UserPlus size={13} />}
            {u.is_admin ? "Remove admin" : "Make admin"}
          </button>
        </div>
      ))}
    </div>
  );
}
