// src/auth/AuthContext.jsx
// Provides auth state + actions to the whole app via React context.
// Signup creates the auth user, a profile row, a hashed recovery code,
// and (best-effort) logs non-password info to your Google Sheet via the API.

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase, supabaseEnabled } from "./supabaseClient.js";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

// Generate a human-friendly recovery code like "SS-7K9F-2QX4-8M1P"
function makeRecoveryCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusing 0/O/1/I
  const block = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `SS-${block()}-${block()}-${block()}`;
}

// Hash a string with the browser's SubtleCrypto (SHA-256). Used so we never
// store the recovery code in readable form — same principle as passwords.
async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);       // supabase auth user
  const [profile, setProfile] = useState(null);  // our profiles row
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (uid) => {
    if (!supabase) return null;
    const { data } = await supabase.from("profiles").select("*").eq("id", uid).single();
    setProfile(data || null);
    return data || null;
  }, []);

  useEffect(() => {
    if (!supabaseEnabled) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user || null;
      setUser(u);
      if (u) loadProfile(u.id).finally(() => setLoading(false));
      else setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user || null;
      setUser(u);
      if (u) loadProfile(u.id); else setProfile(null);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  // ---- SIGN UP ----
  // ---- SIGN UP (two-step so nothing is created until the user confirms) ----
  // Step 1: validate inputs, generate the recovery code. NOTHING is created yet.
  // Returns { recoveryCode, hash } for the UI to show + later pass to complete.
  async function prepareSignup({ username, email, password }) {
    if (!supabase) throw new Error("Auth is not configured yet.");
    if (username.trim().length < 3) throw new Error("Username must be at least 3 characters.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter a valid email.");
    if (password.length < 8) throw new Error("Password must be at least 8 characters.");

    // Pre-check the email isn't already taken, so the user finds out NOW
    // (before saving a code), not after confirming.
    // We attempt a lightweight check via the profiles/username uniqueness later;
    // email uniqueness is enforced by Supabase at creation time as a backstop.

    const recoveryCode = makeRecoveryCode();
    const hash = await sha256(recoveryCode);
    return { recoveryCode, hash };
  }

  // Step 2: actually create the account. Called only after the user confirms
  // they've saved their recovery code. If they bailed earlier, nothing exists.
  async function completeSignup({ username, email, password, hash }) {
    if (!supabase) throw new Error("Auth is not configured yet.");
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { username, recovery_code_hash: hash } },
    });
    if (error) {
      if (error.message?.toLowerCase().includes("already")) throw new Error("That email is already registered.");
      throw error;
    }
    const uid = data.user?.id;
    if (!uid) throw new Error("Signup failed. Try again.");

    // best-effort: log non-password info to your Google Sheet (server-side)
    try {
      await fetch("/api/sheet-log", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, created_at: new Date().toISOString() }),
      });
    } catch { /* non-fatal: the sheet is just a convenience mirror */ }

    // The DB trigger creates the profile; give it a moment, then load it.
    await new Promise((r) => setTimeout(r, 600));
    await loadProfile(uid);
  }

  async function signIn({ email, password }) {
    if (!supabase) throw new Error("Auth is not configured yet.");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setProfile(null);
  }

  // ---- RECOVERY: verify code, then set a new password ----
  // The user provides their email + recovery code + new password. We verify the
  // code hash matches the stored one, then update the password via Supabase.
  async function recoverWithCode({ email, code, newPassword }) {
    if (!supabase) throw new Error("Auth is not configured yet.");
    // Look up the profile by joining on email requires a server function; for
    // simplicity we ask the user to also be signed-in-by-email magic OR we use
    // an Edge Function. Here we call a server route that does the secure check.
    const codeHash = await sha256(code);
    const res = await fetch("/api/recover", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, codeHash, newPassword }),
    });
    const out = await res.json();
    if (!res.ok) throw new Error(out.error || "Recovery failed.");
    return out;
  }

  // Account age in minutes — used to gate posting against instant-signup spam bots.
  const accountAgeMinutes = profile?.created_at
    ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 60000)
    : 0;

  const value = {
    user, profile, loading,
    isAdmin: !!profile?.is_admin,
    isPremium: profile?.tier === "premium",
    accountAgeMinutes,
    supabaseEnabled,
    signUp: completeSignup, prepareSignup, completeSignup, signIn, signOut, recoverWithCode,
    reloadProfile: () => user && loadProfile(user.id),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
