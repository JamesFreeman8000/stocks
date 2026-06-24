// src/auth/SettingsModal.jsx
// Profile & settings. Email verification was removed (free Supabase email isn't
// reliable; posting is protected by rate-limit + account-age + spam detection
// instead). Username / password / avatar editing comes in a later update.

import React from "react";
import { useAuth } from "./AuthContext.jsx";
import { X, BadgeCheck, Shield } from "lucide-react";

export default function SettingsModal({ open, onClose }) {
  const { user, profile, isPremium, accountAgeMinutes } = useAuth();
  if (!open) return null;

  const wrap = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", zIndex: 100, backdropFilter: "blur(3px)" };
  const card = { width: 420, maxWidth: "92vw", background: "#0f141c", border: "1px solid #1a2230", borderRadius: 16, padding: 24, color: "#e2e8f0", fontFamily: "'Inter',sans-serif" };
  const row = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #161b24", fontSize: 13.5 };

  return (
    <div style={wrap} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Settings</h2>
          <X size={20} color="#64748b" onClick={onClose} style={{ cursor: "pointer" }} />
        </div>

        {/* identity */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", overflow: "hidden", background: "#1e3a8a", display: "grid", placeItems: "center", fontSize: 20, fontWeight: 700, color: "#fff" }}>
            {profile?.avatar_url && profile?.avatar_status === "approved"
              ? <img src={profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : (profile?.username?.[0]?.toUpperCase() || "?")}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 7 }}>
              {profile?.username}
              {isPremium && <span style={{ fontSize: 10, fontWeight: 700, color: "#fbbf24", background: "#2a210a", padding: "2px 7px", borderRadius: 5, display: "inline-flex", alignItems: "center", gap: 3 }}><BadgeCheck size={11} /> PREMIUM</span>}
            </div>
            <div style={{ fontSize: 12.5, color: "#64748b" }}>{user?.email}</div>
          </div>
        </div>

        {/* account info */}
        <div style={{ background: "#0b0e14", border: "1px solid #1a2230", borderRadius: 12, padding: "4px 16px", marginBottom: 16 }}>
          <div style={row}><span style={{ color: "#94a3b8" }}>Username</span><span style={{ fontWeight: 600 }}>{profile?.username}</span></div>
          <div style={row}><span style={{ color: "#94a3b8" }}>Email</span><span style={{ fontWeight: 600 }}>{user?.email}</span></div>
          <div style={row}><span style={{ color: "#94a3b8" }}>Plan</span><span style={{ fontWeight: 600, color: isPremium ? "#fbbf24" : "#cbd5e1" }}>{isPremium ? "Premium" : "Free"}</span></div>
          <div style={{ ...row, borderBottom: "none" }}><span style={{ color: "#94a3b8" }}>Member for</span><span style={{ fontWeight: 600 }}>{accountAgeMinutes < 60 ? `${accountAgeMinutes} min` : accountAgeMinutes < 1440 ? `${Math.floor(accountAgeMinutes/60)} hr` : `${Math.floor(accountAgeMinutes/1440)} days`}</span></div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#0d1620", border: "1px solid #16283a", borderRadius: 10, padding: "11px 13px", fontSize: 12, color: "#7dd3fc", lineHeight: 1.5 }}>
          <Shield size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          Editing your username, password, and profile picture is coming in a later update.
        </div>
      </div>
    </div>
  );
}
