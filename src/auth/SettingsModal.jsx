// src/auth/SettingsModal.jsx
// Profile & settings: change profile picture (with NSFW moderation), username,
// and password. Avatar uploads run through the same moderation as post images.

import React, { useState, useRef } from "react";
import { useAuth } from "./AuthContext.jsx";
import { supabase } from "./supabaseClient.js";
import { useImageUpload } from "../community/useImageUpload.js";
import { X, BadgeCheck, Camera, Loader2, Check, AlertCircle, Lock } from "lucide-react";

export default function SettingsModal({ open, onClose }) {
  const { user, profile, isPremium, accountAgeMinutes, reloadProfile } = useAuth();
  const { uploadAndModerate, uploading } = useImageUpload();
  const fileRef = useRef(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [username, setUsername] = useState(profile?.username || "");
  const [savingName, setSavingName] = useState(false);
  const [pw, setPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  if (!open) return null;

  async function onPickAvatar(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(""); setOk("");
    const up = await uploadAndModerate(f, "avatars", user.id);
    if (!up.ok) { setError(up.error); return; }
    // save avatar URL + moderation status to the profile
    const { error: upErr } = await supabase
      .from("profiles")
      .update({ avatar_url: up.imageUrl, avatar_status: up.status })
      .eq("id", user.id);
    if (upErr) { setError(upErr.message); return; }
    await reloadProfile();
    setOk(up.status === "approved"
      ? "Profile picture updated."
      : "Picture uploaded — it'll show once an admin approves it.");
  }

  async function saveUsername() {
    const name = username.trim();
    if (name.length < 3) { setError("Username must be at least 3 characters."); return; }
    if (name === profile?.username) { setError("That's already your username."); return; }
    setError(""); setOk(""); setSavingName(true);
    const { error: e } = await supabase.from("profiles").update({ username: name }).eq("id", user.id);
    setSavingName(false);
    if (e) { setError(e.message.includes("duplicate") ? "That username is taken." : e.message); return; }
    await reloadProfile();
    setOk("Username updated.");
  }

  async function savePassword() {
    if (pw.length < 8) { setError("Password must be at least 8 characters."); return; }
    setError(""); setOk(""); setSavingPw(true);
    const { error: e } = await supabase.auth.updateUser({ password: pw });
    setSavingPw(false);
    if (e) { setError(e.message); return; }
    setPw("");
    setOk("Password changed.");
  }

  const wrap = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", zIndex: 100, backdropFilter: "blur(3px)" };
  const card = { width: 440, maxWidth: "92vw", maxHeight: "90vh", overflowY: "auto", background: "#0f141c", border: "1px solid #1a2230", borderRadius: 16, padding: 24, color: "#e2e8f0", fontFamily: "'Inter',sans-serif" };
  const input = { width: "100%", background: "#11151d", border: "1px solid #232b38", borderRadius: 9, padding: "10px 12px", color: "#e2e8f0", fontSize: 13.5, outline: "none" };
  const btn = { background: "#10b981", color: "#04130c", border: "none", borderRadius: 9, padding: "10px 15px", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" };
  const label = { fontSize: 12, color: "#94a3b8", fontWeight: 600, marginBottom: 6, display: "block" };
  const pending = profile?.avatar_url && profile?.avatar_status === "pending";

  return (
    <div style={wrap} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Settings</h2>
          <X size={20} color="#64748b" onClick={onClose} style={{ cursor: "pointer" }} />
        </div>

        {/* avatar + identity */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <div style={{ position: "relative" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", overflow: "hidden", background: "#1e3a8a", display: "grid", placeItems: "center", fontSize: 26, fontWeight: 700, color: "#fff" }}>
              {profile?.avatar_url && profile?.avatar_status === "approved"
                ? <img src={profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : (profile?.username?.[0]?.toUpperCase() || "?")}
            </div>
            <div onClick={() => !uploading && fileRef.current?.click()}
              style={{ position: "absolute", bottom: -2, right: -2, width: 26, height: 26, borderRadius: "50%", background: "#10b981", display: "grid", placeItems: "center", cursor: uploading ? "default" : "pointer", border: "2px solid #0f141c" }}>
              {uploading ? <Loader2 size={13} color="#04130c" style={{ animation: "spin 1s linear infinite" }} /> : <Camera size={13} color="#04130c" />}
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPickAvatar} style={{ display: "none" }} />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", gap: 7 }}>
              {profile?.username}
              {isPremium && <span style={{ fontSize: 10, fontWeight: 700, color: "#fbbf24", background: "#2a210a", padding: "2px 7px", borderRadius: 5, display: "inline-flex", alignItems: "center", gap: 3 }}><BadgeCheck size={11} /> PREMIUM</span>}
            </div>
            <div style={{ fontSize: 12.5, color: "#64748b" }}>{user?.email}</div>
            {pending && <div style={{ fontSize: 11.5, color: "#fbbf24", marginTop: 3 }}>Picture pending review</div>}
          </div>
        </div>

        {error && <Banner color="#fca5a5" bg="#1f1416" border="#4c1d1d" icon={<AlertCircle size={15} />}>{error}</Banner>}
        {ok && <Banner color="#34d399" bg="#0d1f1a" border="#16332b" icon={<Check size={15} />}>{ok}</Banner>}

        {/* username */}
        <div style={{ marginBottom: 16 }}>
          <label style={label}>Username</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input style={input} value={username} onChange={(e) => setUsername(e.target.value)} maxLength={20} />
            <button style={{ ...btn, opacity: savingName ? 0.6 : 1 }} onClick={saveUsername} disabled={savingName}>
              {savingName ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        {/* password */}
        <div style={{ marginBottom: 18 }}>
          <label style={label}>Change password</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input style={input} type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password (8+ chars)" />
            <button style={{ ...btn, opacity: savingPw ? 0.6 : 1 }} onClick={savePassword} disabled={savingPw}>
              {savingPw ? "Saving…" : "Update"}
            </button>
          </div>
        </div>

        {/* account info */}
        <div style={{ background: "#0b0e14", border: "1px solid #1a2230", borderRadius: 12, padding: "4px 16px" }}>
          <Row k="Plan" v={isPremium ? "Premium" : "Free"} vc={isPremium ? "#fbbf24" : "#cbd5e1"} />
          <Row k="Member for" v={accountAgeMinutes < 60 ? `${accountAgeMinutes} min` : accountAgeMinutes < 1440 ? `${Math.floor(accountAgeMinutes/60)} hr` : `${Math.floor(accountAgeMinutes/1440)} days`} last />
        </div>

        <div style={{ display: "flex", gap: 7, alignItems: "center", justifyContent: "center", marginTop: 14, fontSize: 11.5, color: "#475569" }}>
          <Lock size={12} /> Profile pictures are checked for inappropriate content before they appear.
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );
}

function Row({ k, v, vc, last }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: last ? "none" : "1px solid #161b24", fontSize: 13.5 }}>
      <span style={{ color: "#94a3b8" }}>{k}</span><span style={{ fontWeight: 600, color: vc || "#e2e8f0" }}>{v}</span>
    </div>
  );
}

function Banner({ children, color, bg, border, icon }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: bg, border: `1px solid ${border}`, color, padding: "10px 12px", borderRadius: 9, fontSize: 12.5, marginBottom: 12 }}>
      <span style={{ flexShrink: 0, marginTop: 1 }}>{icon}</span> {children}
    </div>
  );
}
