// src/auth/useWatchlist.js
// Per-user watchlist. When signed in, reads/writes Supabase so it persists
// and syncs across devices. When signed out, falls back to in-memory state so
// the app still works for visitors (resets on refresh, which is expected).

import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient.js";
import { useAuth } from "./AuthContext.jsx";

const GUEST_DEFAULT = ["AAPL", "NVDA", "TSLA", "ARTV"];

export function useWatchlist() {
  const { user } = useAuth();
  const [tickers, setTickers] = useState(GUEST_DEFAULT);
  const [loading, setLoading] = useState(false);

  // Load from DB when the user logs in; reset to guest list when they log out.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user || !supabase) { setTickers(GUEST_DEFAULT); return; }
      setLoading(true);
      const { data, error } = await supabase
        .from("watchlist").select("ticker").eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (!cancelled) {
        if (error) setTickers([]); // empty on error rather than guest defaults
        else setTickers((data || []).map((r) => r.ticker));
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [user]);

  const addTicker = useCallback(async (t) => {
    const ticker = String(t).toUpperCase();
    setTickers((cur) => cur.includes(ticker) ? cur : [...cur, ticker]); // optimistic
    if (user && supabase) {
      await supabase.from("watchlist").insert({ user_id: user.id, ticker }).then(({ error }) => {
        // ignore unique-violation (already there); other errors are non-fatal here
      });
    }
  }, [user]);

  const removeTicker = useCallback(async (t) => {
    const ticker = String(t).toUpperCase();
    setTickers((cur) => cur.filter((x) => x !== ticker)); // optimistic
    if (user && supabase) {
      await supabase.from("watchlist").delete().eq("user_id", user.id).eq("ticker", ticker);
    }
  }, [user]);

  const toggleTicker = useCallback((t) => {
    const ticker = String(t).toUpperCase();
    setTickers((cur) => {
      if (cur.includes(ticker)) { removeTicker(ticker); return cur.filter((x) => x !== ticker); }
      addTicker(ticker); return [...cur, ticker];
    });
  }, [addTicker, removeTicker]);

  return { tickers, loading, addTicker, removeTicker, toggleTicker };
}
