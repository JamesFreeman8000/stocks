// src/support/SupportWidget.jsx
// Floating support bubble (bottom-right). Logged-in users open it to message
// admins and see replies. Polls for new messages while open.

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import { useSupport } from "./useSupport.js";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";

export default function SupportWidget({ onOpenAuth }) {
  const { user, isAdmin, supabaseEnabled } = useAuth();
  const { sendMessage, fetchThread, busy } = useSupport();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const endRef = useRef(null);

  const load = useCallback(async () => {
    if (user) setMsgs(await fetchThread(user.id));
  }, [user, fetchThread]);

  // poll while open
  useEffect(() => {
    if (!open || !user) return;
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [open, user, load]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  // Admins use the dashboard inbox instead of this widget.
  if (!supabaseEnabled || isAdmin) return null;

  async function send() {
    if (!text.trim()) return;
    const res = await sendMessage({ userId: user.id, sender: "user", body: text });
    if (res.ok) { setText(""); setMsgs((m) => [...m, res.message]); }
  }

  return (
    <>
      {/* bubble */}
      {!open && (
        <div onClick={() => (user ? setOpen(true) : onOpenAuth())}
          style={{ position: "fixed", bottom: 22, right: 22, width: 54, height: 54, borderRadius: "50%", background: "#10b981", display: "grid", placeItems: "center", cursor: "pointer", boxShadow: "0 6px 22px rgba(16,185,129,0.4)", zIndex: 90 }}>
          <MessageCircle size={24} color="#04130c" />
        </div>
      )}

      {/* panel */}
      {open && (
        <div style={{ position: "fixed", bottom: 22, right: 22, width: 350, maxWidth: "92vw", height: 460, maxHeight: "75vh", background: "#0f141c", border: "1px solid #1a2230", borderRadius: 16, display: "flex", flexDirection: "column", zIndex: 91, overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,0.5)" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #1a2230", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>Support</div>
              <div style={{ fontSize: 11.5, color: "#64748b" }}>We usually reply within a day</div>
            </div>
            <X size={19} color="#64748b" onClick={() => setOpen(false)} style={{ cursor: "pointer" }} />
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 9 }}>
            {msgs.length === 0 && <div style={{ color: "#64748b", fontSize: 13, textAlign: "center", margin: "auto 0" }}>Send us a message and we'll get back to you here.</div>}
            {msgs.map((m) => (
              <div key={m.id} style={{ alignSelf: m.sender === "user" ? "flex-end" : "flex-start", maxWidth: "80%", background: m.sender === "user" ? "#10b981" : "#1a2230", color: m.sender === "user" ? "#04130c" : "#e2e8f0", padding: "8px 12px", borderRadius: 12, fontSize: 13.5, lineHeight: 1.45, wordBreak: "break-word" }}>
                {m.body}
              </div>
            ))}
            <div ref={endRef} />
          </div>

          <div style={{ padding: 12, borderTop: "1px solid #1a2230", display: "flex", gap: 8 }}>
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Type a message…" style={{ flex: 1, background: "#11151d", border: "1px solid #232b38", borderRadius: 9, padding: "10px 12px", color: "#e2e8f0", fontSize: 13.5, outline: "none" }} />
            <button onClick={send} disabled={busy} style={{ background: "#10b981", border: "none", borderRadius: 9, width: 40, display: "grid", placeItems: "center", cursor: "pointer" }}>
              {busy ? <Loader2 size={16} color="#04130c" style={{ animation: "spin 1s linear infinite" }} /> : <Send size={16} color="#04130c" />}
            </button>
          </div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}
    </>
  );
}
