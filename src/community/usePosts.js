// src/community/usePosts.js
// Create + fetch community posts. Enforces all the anti-abuse rules:
// account-age gate, rate limit (premium = 1/min, free = 1/5min), no links,
// and spam/repetition detection. Tickers are extracted and saved so posts
// show on each mentioned stock's page.

import { useState, useCallback } from "react";
import { supabase } from "../auth/supabaseClient.js";
import { extractTickers, containsLink, detectSpam } from "./postUtils.js";

const MIN_ACCOUNT_AGE_MIN = 5;     // must be 5+ min old to post (kills instant bots)
const FREE_COOLDOWN_MS = 5 * 60_000; // free: 1 post / 5 min
const PREMIUM_COOLDOWN_MS = 60_000;  // premium: 1 post / 1 min
const MAX_LEN = 1000;

export function usePosts() {
  const [posting, setPosting] = useState(false);

  // Create a post. `ctx` = { userId, accountAgeMinutes, isPremium, lastPostAt }.
  // Returns { ok, error, post }.
  const createPost = useCallback(async ({ body, imageUrl, ctx }) => {
    if (!supabase) return { ok: false, error: "Not connected." };
    const text = (body || "").trim();

    // ---- client-side guards (server/RLS still protects the table) ----
    if (!text && !imageUrl) return { ok: false, error: "Write something first." };
    if (text.length > MAX_LEN) return { ok: false, error: `Keep it under ${MAX_LEN} characters.` };
    if (ctx.accountAgeMinutes < MIN_ACCOUNT_AGE_MIN)
      return { ok: false, error: `New accounts can post after ${MIN_ACCOUNT_AGE_MIN} minutes. Hang tight.` };
    if (containsLink(text))
      return { ok: false, error: "Links aren't allowed in posts." };
    const spam = detectSpam(text);
    if (spam.spam) return { ok: false, error: spam.reason };

    // rate limit
    const cooldown = ctx.isPremium ? PREMIUM_COOLDOWN_MS : FREE_COOLDOWN_MS;
    if (ctx.lastPostAt && Date.now() - ctx.lastPostAt < cooldown) {
      const wait = Math.ceil((cooldown - (Date.now() - ctx.lastPostAt)) / 1000);
      const human = wait >= 60 ? `${Math.ceil(wait / 60)} min` : `${wait}s`;
      return { ok: false, error: `Slow down — you can post again in ${human}.${ctx.isPremium ? "" : " Premium posts every minute."}` };
    }

    setPosting(true);
    try {
      // insert the post
      const { data: post, error } = await supabase
        .from("posts")
        .insert({ user_id: ctx.userId, body: text, image_url: imageUrl || null, image_status: imageUrl ? "approved" : "none" })
        .select()
        .single();
      if (error) throw error;

      // extract + save tickers so the post shows on each stock page
      const tickers = extractTickers(text);
      if (tickers.length) {
        await supabase.from("post_tickers").insert(
          tickers.map((t) => ({ post_id: post.id, ticker: t }))
        );
      }
      setPosting(false);
      return { ok: true, post: { ...post, tickers } };
    } catch (e) {
      setPosting(false);
      return { ok: false, error: e.message || "Could not post." };
    }
  }, []);

  // Fetch the global feed (newest first), joined with author username/avatar.
  const fetchFeed = useCallback(async (limit = 40) => {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("posts")
      .select("id, body, image_url, image_status, created_at, user_id, profiles(username, avatar_url, avatar_status, tier)")
      .eq("status", "visible")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return [];
    return data || [];
  }, []);

  // Fetch posts that mention a specific ticker (for the stock page Community tab).
  const fetchByTicker = useCallback(async (ticker, limit = 30) => {
    if (!supabase) return [];
    // get post ids for this ticker, then the posts
    const { data: links } = await supabase
      .from("post_tickers")
      .select("post_id")
      .eq("ticker", ticker.toUpperCase())
      .limit(limit);
    const ids = (links || []).map((l) => l.post_id);
    if (!ids.length) return [];
    const { data } = await supabase
      .from("posts")
      .select("id, body, image_url, image_status, created_at, user_id, profiles(username, avatar_url, avatar_status, tier)")
      .in("id", ids)
      .eq("status", "visible")
      .order("created_at", { ascending: false });
    return data || [];
  }, []);

  return { createPost, fetchFeed, fetchByTicker, posting };
}
