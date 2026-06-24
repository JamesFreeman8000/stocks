// src/auth/AuthModal.jsx
// Signup / Login / Recovery UI. On signup, shows the one-time recovery code
// with a slide-to-confirm control the user must toggle before continuing.

import React, { useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import { X, Copy, Check, ShieldCheck, AlertCircle, Download } from "lucide-react";

export default function AuthModal({ open, onClose }) {
  const { signUp, signIn, recoverWithCode } = useAuth();
  const [mode, setMode] = useState("login"); // login | signup | recover
  const [form, setForm] = useState({ username: "", email: "", password: "", code: "", newPassword: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recoveryCode, setRecoveryCode] = useState(null); // shown after signup
  const [savedConfirmed, setSavedConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!open) return null;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit() {
    setError(""); setBusy(true);
    try {
      if (mode === "signup") {
        if (form.username.length < 3) throw new Error("Username must be at least 3 characters.");
        if (form.password.length < 8) throw new Error("Password must be at least 8 characters.");
        const { recoveryCode } = await signUp(form);
        setRecoveryCode(recoveryCode); // switch to the "save your code" screen
      } else if (mode === "login") {
        await signIn(form);
        onClose();
      } else {
        if (form.newPassword.length < 8) throw new Error("New password must be at least 8 characters.");
        await recoverWithCode({ email: form.email, code: form.code, newPassword: form.newPassword });
        setMode("login");
        setError("Password reset. You can log in now.");
      }
    } catch (e) { setError(e.message || "Something went wrong."); }
    setBusy(false);
  }

  function finishSignup() {
    setRecoveryCode(null);
    setSavedConfirmed(false);
    onClose();
  }

  const wrap = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", zIndex: 100, backdropFilter: "blur(3px)" };
  const card = { width: 380, background: "#0f141c", border: "1px solid #1a2230", borderRadius: 16, padding: 24, color: "#e2e8f0", fontFamily: "'Inter',sans-serif" };
  const input = { width: "100%", background: "#11151d", border: "1px solid #232b38", borderRadius: 9, padding: "11px 13px", color: "#e2e8f0", fontSize: 14, outline: "none", marginBottom: 10 };
  const btn = { width: "100%", background: "#10b981", color: "#04130c", border: "none", borderRadius: 9, padding: "12px", fontWeight: 700, fontSize: 14, cursor: "pointer" };

  // ---- Recovery-code screen (after signup) ----
  if (recoveryCode) {
    return (
      <div style={wrap}>
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
            <ShieldCheck size={22} color="#10b981" />
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800 }}>Save your recovery code</h2>
          </div>
          <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, marginTop: 6 }}>
            This is the <b>only</b> way to recover your account if you forget your password.
            We can't show it again. Store it somewhere safe.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#0b0e14", border: "1px dashed #2b3a4a", borderRadius: 10, padding: "14px", margin: "12px 0" }}>
            <code style={{ flex: 1, fontSize: 16, letterSpacing: "0.04em", color: "#6ee7b7", fontFamily: "monospace" }}>{recoveryCode}</code>
            <button onClick={() => { navigator.clipboard?.writeText(recoveryCode); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              style={{ background: "#1a2230", border: "none", borderRadius: 7, padding: 8, cursor: "pointer", color: "#94a3b8" }}>
              {copied ? <Check size={16} color="#34d399" /> : <Copy size={16} />}
            </button>
          </div>

          {/* download as a clearly-named file */}
          <button onClick={() => downloadRecoveryCode(recoveryCode)}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#11151d", border: "1px solid #232b38", borderRadius: 9, padding: "11px", color: "#cbd5e1", fontSize: 13.5, fontWeight: 600, cursor: "pointer", marginBottom: 14 }}>
            <Download size={16} /> Download recovery code
          </button>

          {/* slide-to-confirm */}
          <SaveSlider confirmed={savedConfirmed} onConfirm={() => setSavedConfirmed(true)} />

          <button onClick={finishSignup} disabled={!savedConfirmed}
            style={{ ...btn, marginTop: 14, opacity: savedConfirmed ? 1 : 0.4, cursor: savedConfirmed ? "pointer" : "not-allowed" }}>
            I've saved it — continue
          </button>
        </div>
      </div>
    );
  }

  // ---- Login / Signup / Recover ----
  return (
    <div style={wrap} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
            {mode === "login" ? "Log in" : mode === "signup" ? "Create account" : "Recover account"}
          </h2>
          <X size={20} color="#64748b" onClick={onClose} style={{ cursor: "pointer" }} />
        </div>

        {error && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#1f1416", border: "1px solid #4c1d1d", color: "#fca5a5", padding: "10px 12px", borderRadius: 9, fontSize: 12.5, marginBottom: 12 }}>
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
          </div>
        )}

        {mode === "signup" && <input style={input} placeholder="Username" value={form.username} onChange={set("username")} />}
        {(mode === "login" || mode === "signup" || mode === "recover") && (
          <input style={input} placeholder="Email" type="email" value={form.email} onChange={set("email")} />
        )}
        {mode === "recover" ? (
          <>
            <input style={input} placeholder="Recovery code (SS-XXXX-XXXX-XXXX)" value={form.code} onChange={set("code")} />
            <input style={input} placeholder="New password" type="password" value={form.newPassword} onChange={set("newPassword")} />
          </>
        ) : (
          <input style={input} placeholder="Password" type="password" value={form.password} onChange={set("password")} />
        )}

        <button style={{ ...btn, opacity: busy ? 0.6 : 1 }} onClick={submit} disabled={busy}>
          {busy ? "Please wait…" : mode === "login" ? "Log in" : mode === "signup" ? "Sign up" : "Reset password"}
        </button>

        <div style={{ marginTop: 14, fontSize: 12.5, color: "#64748b", textAlign: "center", lineHeight: 1.8 }}>
          {mode === "login" && <>No account? <A onClick={() => { setMode("signup"); setError(""); }}>Sign up</A><br/>Forgot password? <A onClick={() => { setMode("recover"); setError(""); }}>Use recovery code</A></>}
          {mode === "signup" && <>Have an account? <A onClick={() => { setMode("login"); setError(""); }}>Log in</A></>}
          {mode === "recover" && <>Remembered it? <A onClick={() => { setMode("login"); setError(""); }}>Log in</A></>}
        </div>
      </div>
    </div>
  );
}

function A({ children, onClick }) {
  return <span onClick={onClick} style={{ color: "#10b981", fontWeight: 600, cursor: "pointer" }}>{children}</span>;
}

// Save the recovery code as a clearly-named .txt file so users know what it is.
function downloadRecoveryCode(code) {
  const now = new Date().toLocaleString();
  const contents =
`StockScope — Account Recovery Code
====================================

KEEP THIS FILE SAFE AND PRIVATE.

This code is the ONLY way to recover your StockScope account
if you forget your password. Anyone with this code may be able
to reset your account, so do not share it.

Your recovery code:

    ${code}

Generated: ${now}
Website: StockScope
`;
  const blob = new Blob([contents], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "StockScope-Recovery-Code.txt";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Slide-to-confirm control: user drags the knob to the right to confirm.
function SaveSlider({ confirmed, onConfirm }) {
  const [x, setX] = useState(0);
  const W = 332, KNOB = 44, MAX = W - KNOB - 6;
  const onDown = (e) => {
    if (confirmed) return;
    const startX = (e.touches?.[0]?.clientX ?? e.clientX);
    const move = (ev) => {
      const cx = (ev.touches?.[0]?.clientX ?? ev.clientX);
      setX(Math.max(0, Math.min(MAX, cx - startX)));
    };
    const up = () => {
      window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", move); window.removeEventListener("touchend", up);
      setX((cur) => { if (cur >= MAX - 8) { onConfirm(); return MAX; } return 0; });
    };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", move); window.addEventListener("touchend", up);
  };
  return (
    <div style={{ position: "relative", height: KNOB + 6, background: confirmed ? "#0d1f1a" : "#11151d", border: `1px solid ${confirmed ? "#16332b" : "#232b38"}`, borderRadius: 25, userSelect: "none", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 13, fontWeight: 600, color: confirmed ? "#34d399" : "#64748b" }}>
        {confirmed ? "✓ Confirmed — I saved my code" : "Slide to confirm you saved it →"}
      </div>
      <div onMouseDown={onDown} onTouchStart={onDown}
        style={{ position: "absolute", top: 3, left: 3, width: KNOB, height: KNOB, borderRadius: "50%", background: confirmed ? "#10b981" : "#1e3a8a", transform: `translateX(${confirmed ? MAX : x}px)`, transition: x === 0 ? "transform .2s" : "none", cursor: confirmed ? "default" : "grab", display: "grid", placeItems: "center" }}>
        {confirmed ? <Check size={20} color="#04130c" /> : <span style={{ color: "#fff", fontSize: 18 }}>→</span>}
      </div>
    </div>
  );
}
