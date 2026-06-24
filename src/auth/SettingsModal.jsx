// src/auth/SettingsModal.jsx
// Profile & settings. Includes the email verification flow: a "Verify" button
// next to the email that sends a code, then a box to enter it. Posting is gated
// on profile.email_verified elsewhere; this is where users complete it.

import React, { useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import { X, BadgeCheck, Mail, AlertCircle, Check, Loader2 } from "lucide-react";

export default function SettingsModal({ open, onClose, focusVerify = false }) {
  const { user, profile, emailVerified, sendVerificationCode, confirmVerificationCode } = useAuth();
  const [stage, setStage] = useState(focusVerify ? "verify" : "main"); // main | verify
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  if (!open) return null;

  async function sendCode() {
    setError(""); setOk(""); setBusy(true);
    try { await sendVerificationCode(); setSent(true); setOk("Code sent — check your email (and spam)."); }
    catch (e) { setError(e.message || "Could not send code."); }
    setBusy(false);
  }
  async function submitCode() {
    setError(""); setOk(""); setBusy(true);
    try { await confirmVerificationCode(code); setOk("Email verified! You can post now."); setStage("main"); }
    catch (e) { setError(e.message || "Verification failed."); }
    setBusy(false);
  }

  const wrap = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", zIndex: 100, backdropFilter: "blur(3px)" };
  const card = { width: 420, maxWidth: "92vw", background: "#0f141c", border: "1px solid #1a2230", borderRadius: 16, padding: 24, color: "#e2e8f0", fontFamily: "'Inter',sans-serif" };
  const input = { width: "100%", background: "#11151d", border: "1px solid #232b38", borderRadius: 9, padding: "11px 13px", color: "#e2e8f0", fontSize: 14, outline: "none" };
  const btn = { background: "#10b981", color: "#04130c", border: "none", borderRadius: 9, padding: "11px 16px", fontWeight: 700, fontSize: 14, cursor: "pointer" };

  return (
    <div style={wrap} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Settings</h2>
          <X size={20} color="#64748b" onClick={onClose} style={{ cursor: "pointer" }} />
        </div>

        {/* identity row */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", overflow: "hidden", background: "#1e3a8a", display: "grid", placeItems: "center", fontSize: 20, fontWeight: 700, color: "#fff" }}>
            {profile?.avatar_url && profile?.avatar_status === "approved"
              ? <img src={profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : (profile?.username?.[0]?.toUpperCase() || "?")}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{profile?.username}</div>
            <div style={{ fontSize: 12.5, color: "#64748b" }}>{user?.email}</div>
          </div>
        </div>

        {/* EMAIL VERIFICATION */}
        <div style={{ background: "#0b0e14", border: "1px solid #1a2230", borderRadius: 12, padding: 16, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <Mail size={17} color={emailVerified ? "#34d399" : "#fbbf24"} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Email verification</div>
                <div style={{ fontSize: 12, color: emailVerified ? "#34d399" : "#94a3b8" }}>
                  {emailVerified ? "Verified — you can post" : "Not verified — required to post"}
                </div>
              </div>
            </div>
            {emailVerified ? (
              <BadgeCheck size={22} color="#34d399" />
            ) : (
              stage !== "verify" && (
                <button onClick={() => { setStage("verify"); sendCode(); }} style={btn}>Verify</button>
              )
            )}
          </div>

          {/* verify sub-flow */}
          {!emailVerified && stage === "verify" && (
            <div style={{ marginTop: 14, borderTop: "1px solid #1a2230", paddingTop: 14 }}>
              <p style={{ fontSize: 12.5, color: "#94a3b8", lineHeight: 1.5, margin: "0 0 10px" }}>
                We sent a 6-digit code to <b style={{ color: "#cbd5e1" }}>{user?.email}</b>. Enter it below.
                The code expires after a while — if it stops working, resend a new one.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <input style={{ ...input, letterSpacing: "0.3em", textAlign: "center", fontWeight: 700 }} placeholder="######" maxLength={6}
                  value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
                <button onClick={submitCode} disabled={busy || code.length < 6} style={{ ...btn, opacity: (busy || code.length < 6) ? 0.5 : 1, display: "flex", alignItems: "center", gap: 6 }}>
                  {busy ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={15} />} Confirm
                </button>
              </div>
              <button onClick={sendCode} disabled={busy} style={{ background: "none", border: "none", color: "#60a5fa", fontSize: 12.5, fontWeight: 600, cursor: "pointer", marginTop: 10, padding: 0 }}>
                {sent ? "Resend code" : "Send code"}
              </button>
            </div>
          )}
        </div>

        {error && <Banner color="#fca5a5" bg="#1f1416" border="#4c1d1d" icon={<AlertCircle size={15} />}>{error}</Banner>}
        {ok && <Banner color="#34d399" bg="#0d1f1a" border="#16332b" icon={<Check size={15} />}>{ok}</Banner>}

        <p style={{ fontSize: 11.5, color: "#475569", lineHeight: 1.5, marginTop: 14, marginBottom: 0 }}>
          More settings (change username, password, profile picture) are coming in the next update.
        </p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );
}

function Banner({ children, color, bg, border, icon }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: bg, border: `1px solid ${border}`, color, padding: "10px 12px", borderRadius: 9, fontSize: 12.5, marginBottom: 10 }}>
      <span style={{ flexShrink: 0, marginTop: 1 }}>{icon}</span> {children}
    </div>
  );
}
