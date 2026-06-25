// src/community/Community.jsx
// UI for community posts: composer, post cards with clickable $TICKERS,
// the main Community page, and a compact ticker-filtered list for stock pages.

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import { usePosts } from "./usePosts.js";
import { tokenizePost } from "./postUtils.js";
import { MessageSquare, Send, AlertCircle, Loader2, BadgeCheck, Image as ImageIcon } from "lucide-react";

const timeAgo = (ts) => {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

// Renders post text with $TICKERS as blue clickable links.
function PostBody({ text, onOpenTicker }) {
  const parts = tokenizePost(text);
  return (
    <div style={{ fontSize: 14, lineHeight: 1.55, color: "#e2e8f0", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
      {parts.map((p, i) =>
        p.type === "ticker" ? (
          <span key={i} onClick={() => onOpenTicker(p.value)}
            style={{ color: "#60a5fa", fontWeight: 700, cursor: "pointer" }}>
            ${p.value}
          </span>
        ) : (
          <span key={i}>{p.value}</span>
        )
      )}
    </div>
  );
}

export function PostCard({ post, onOpenTicker }) {
  const prof = post.profiles || {};
  const isPremium = prof.tier === "premium";
  return (
    <div style={{ background: "#0f141c", border: "1px solid #1a2230", borderRadius: 13, padding: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: "50%", overflow: "hidden", background: "#1e3a8a", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
          {prof.avatar_url && prof.avatar_status === "approved"
            ? <img src={prof.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : (prof.username?.[0]?.toUpperCase() || "?")}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700 }}>{prof.username || "user"}</span>
          {isPremium && <BadgeCheck size={14} color="#fbbf24" />}
        </div>
        <span style={{ fontSize: 12, color: "#64748b", marginLeft: "auto" }}>{timeAgo(post.created_at)}</span>
      </div>
      <PostBody text={post.body} onOpenTicker={onOpenTicker} />
      {post.image_url && post.image_status === "approved" && (
        <img src={post.image_url} alt="" style={{ width: "100%", borderRadius: 10, marginTop: 10, border: "1px solid #1a2230" }} />
      )}
    </div>
  );
}

// Composer — the box to write a new post.
function Composer({ onPosted, onOpenAuth }) {
  const { user, profile, isPremium, accountAgeMinutes } = useAuth();
  const { createPost, posting } = usePosts();
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [lastPostAt, setLastPostAt] = useState(null);

  if (!user) {
    return (
      <div style={{ background: "#0f141c", border: "1px solid #1a2230", borderRadius: 13, padding: 18, marginBottom: 16, textAlign: "center" }}>
        <div style={{ fontSize: 14, color: "#94a3b8", marginBottom: 10 }}>Log in to join the conversation.</div>
        <button onClick={onOpenAuth} style={{ background: "#10b981", color: "#04130c", border: "none", borderRadius: 9, padding: "9px 18px", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>Log in</button>
      </div>
    );
  }

  async function submit() {
    setError("");
    const res = await createPost({
      body,
      ctx: { userId: user.id, accountAgeMinutes, isPremium, lastPostAt },
    });
    if (!res.ok) { setError(res.error); return; }
    setBody(""); setLastPostAt(Date.now());
    // attach the current user's profile so the new post shows the right name/avatar
    onPosted({
      ...res.post,
      profiles: {
        username: profile?.username,
        avatar_url: profile?.avatar_url,
        avatar_status: profile?.avatar_status,
        tier: profile?.tier,
      },
    });
  }

  return (
    <div style={{ background: "#0f141c", border: "1px solid #1a2230", borderRadius: 13, padding: 16, marginBottom: 16 }}>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3}
        placeholder="Share your take… use $TICKER to tag a stock (e.g. $ARTV). No links."
        style={{ width: "100%", background: "#11151d", border: "1px solid #232b38", borderRadius: 10, padding: "11px 13px", color: "#e2e8f0", fontSize: 14, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
      {error && (
        <div style={{ display: "flex", gap: 7, alignItems: "center", color: "#fca5a5", fontSize: 12.5, marginTop: 8 }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
        <span style={{ fontSize: 11.5, color: "#475569" }}>{body.length}/1000{!isPremium && " · Free: 1 post / 5 min"}</span>
        <button onClick={submit} disabled={posting} style={{ display: "flex", alignItems: "center", gap: 7, background: "#10b981", color: "#04130c", border: "none", borderRadius: 9, padding: "9px 16px", fontWeight: 700, fontSize: 13.5, cursor: posting ? "default" : "pointer", opacity: posting ? 0.6 : 1 }}>
          {posting ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={15} />} Post
        </button>
      </div>
    </div>
  );
}

// Full Community page (the top-nav tab).
export function CommunityPage({ onOpenTicker, onOpenAuth }) {
  const { fetchFeed } = usePosts();
  const [posts, setPosts] = useState(null);

  const load = useCallback(async () => { setPosts(await fetchFeed()); }, [fetchFeed]);
  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "26px 28px" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 18px", letterSpacing: "-.02em", display: "flex", alignItems: "center", gap: 10 }}>
        <MessageSquare size={24} color="#10b981" /> Community
      </h1>
      <Composer onPosted={(p) => setPosts((cur) => [p, ...(cur || [])])} onOpenAuth={onOpenAuth} />
      {posts === null && <div style={{ padding: 30, textAlign: "center", color: "#64748b" }}><Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} /></div>}
      {posts && posts.length === 0 && <div style={{ padding: 30, textAlign: "center", color: "#64748b", fontSize: 13.5 }}>No posts yet. Be the first.</div>}
      {posts && posts.map((p) => <PostCard key={p.id} post={p} onOpenTicker={onOpenTicker} />)}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// Compact list for a stock page's "Community" tab — only posts mentioning `ticker`.
export function TickerPosts({ ticker, onOpenTicker }) {
  const { fetchByTicker } = usePosts();
  const [posts, setPosts] = useState(null);
  useEffect(() => { let on = true; fetchByTicker(ticker).then((p) => on && setPosts(p)); return () => { on = false; }; }, [ticker, fetchByTicker]);

  if (posts === null) return <div style={{ padding: 24, textAlign: "center", color: "#64748b" }}><Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /></div>;
  if (!posts.length) return <div style={{ padding: 24, textAlign: "center", color: "#64748b", fontSize: 13 }}>No community posts mention ${ticker} yet.</div>;
  return <div>{posts.map((p) => <PostCard key={p.id} post={p} onOpenTicker={onOpenTicker} />)}</div>;
}
