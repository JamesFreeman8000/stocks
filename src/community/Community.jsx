// src/community/Community.jsx
// UI for community posts: composer, post cards with clickable $TICKERS,
// the main Community page, and a compact ticker-filtered list for stock pages.

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import { usePosts } from "./usePosts.js";
import { useImageUpload } from "./useImageUpload.js";
import { tokenizePost } from "./postUtils.js";
import { MessageSquare, Send, AlertCircle, Loader2, BadgeCheck, Image as ImageIcon, Trash2, ArrowLeft, X } from "lucide-react";

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

export function PostCard({ post, onOpenTicker, onOpenProfile, onDeleted }) {
  const { user, isAdmin } = useAuth();
  const { deletePost } = usePosts();
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const prof = post.profiles || {};
  const isPremium = prof.tier === "premium";
  const canDelete = user && (user.id === post.user_id || isAdmin);

  async function handleDelete() {
    setDeleting(true);
    const res = await deletePost(post.id);
    setDeleting(false);
    if (res.ok && onDeleted) onDeleted(post.id);
  }

  return (
    <div style={{ background: "#0f141c", border: "1px solid #1a2230", borderRadius: 13, padding: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div onClick={() => onOpenProfile && onOpenProfile(post.user_id)}
          style={{ width: 34, height: 34, borderRadius: "50%", overflow: "hidden", background: "#1e3a8a", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0, cursor: onOpenProfile ? "pointer" : "default" }}>
          {prof.avatar_url && prof.avatar_status === "approved"
            ? <img src={prof.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : (prof.username?.[0]?.toUpperCase() || "?")}
        </div>
        <div onClick={() => onOpenProfile && onOpenProfile(post.user_id)} style={{ display: "flex", alignItems: "center", gap: 6, cursor: onOpenProfile ? "pointer" : "default" }}>
          <span style={{ fontSize: 13.5, fontWeight: 700 }}>{prof.username || "user"}</span>
          {isPremium && <BadgeCheck size={14} color="#fbbf24" />}
        </div>
        <span style={{ fontSize: 12, color: "#64748b", marginLeft: "auto" }}>{timeAgo(post.created_at)}</span>
        {canDelete && (
          confirm ? (
            <span style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8 }}>
              <button onClick={handleDelete} disabled={deleting} style={{ background: "#4c1d1d", color: "#fca5a5", border: "none", borderRadius: 6, padding: "3px 9px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>{deleting ? "…" : "Delete"}</button>
              <button onClick={() => setConfirm(false)} style={{ background: "none", border: "none", color: "#64748b", fontSize: 11.5, cursor: "pointer" }}>Cancel</button>
            </span>
          ) : (
            <Trash2 size={15} color="#475569" onClick={() => setConfirm(true)} style={{ cursor: "pointer", marginLeft: 8 }} />
          )
        )}
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
  const { uploadAndModerate, uploading } = useImageUpload();
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [lastPostAt, setLastPostAt] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

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
    let imageUrl = null, imageStatus = "none";
    if (imageFile) {
      const up = await uploadAndModerate(imageFile, "post-images", user.id);
      if (!up.ok) { setError(up.error); return; }
      imageUrl = up.imageUrl; imageStatus = up.status;
    }
    const res = await createPost({
      body, imageUrl, imageStatus,
      ctx: { userId: user.id, accountAgeMinutes, isPremium, lastPostAt },
    });
    if (!res.ok) { setError(res.error); return; }
    setBody(""); setImageFile(null); setImagePreview(null); setLastPostAt(Date.now());
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

  function pickImage(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
    setError("");
  }

  return (
    <div style={{ background: "#0f141c", border: "1px solid #1a2230", borderRadius: 13, padding: 16, marginBottom: 16 }}>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3}
        placeholder="Share your take… use $TICKER to tag a stock (e.g. $ARTV). No links."
        style={{ width: "100%", background: "#11151d", border: "1px solid #232b38", borderRadius: 10, padding: "11px 13px", color: "#e2e8f0", fontSize: 14, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
      {imagePreview && (
        <div style={{ position: "relative", marginTop: 10, display: "inline-block" }}>
          <img src={imagePreview} alt="" style={{ maxHeight: 160, borderRadius: 10, border: "1px solid #232b38" }} />
          <div onClick={() => { setImageFile(null); setImagePreview(null); }} style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.7)", borderRadius: "50%", width: 24, height: 24, display: "grid", placeItems: "center", cursor: "pointer" }}>
            <X size={14} color="#fff" />
          </div>
        </div>
      )}
      {error && (
        <div style={{ display: "flex", gap: 7, alignItems: "center", color: "#fca5a5", fontSize: 12.5, marginTop: 8 }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#64748b", cursor: "pointer" }}>
            <ImageIcon size={16} /> Photo
            <input type="file" accept="image/*" onChange={pickImage} style={{ display: "none" }} />
          </label>
          <span style={{ fontSize: 11.5, color: "#475569" }}>{body.length}/1000{!isPremium && " · Free: 1 post / 5 min"}</span>
        </div>
        <button onClick={submit} disabled={posting || uploading} style={{ display: "flex", alignItems: "center", gap: 7, background: "#10b981", color: "#04130c", border: "none", borderRadius: 9, padding: "9px 16px", fontWeight: 700, fontSize: 13.5, cursor: (posting||uploading) ? "default" : "pointer", opacity: (posting||uploading) ? 0.6 : 1 }}>
          {(posting || uploading) ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={15} />} {uploading ? "Checking image…" : "Post"}
        </button>
      </div>
    </div>
  );
}

// Full Community page (the top-nav tab).
export function CommunityPage({ onOpenTicker, onOpenAuth, onOpenProfile }) {
  const { fetchFeed } = usePosts();
  const [posts, setPosts] = useState(null);

  const load = useCallback(async () => { setPosts(await fetchFeed()); }, [fetchFeed]);
  useEffect(() => { load(); }, [load]);

  const removeFromList = (id) => setPosts((cur) => (cur || []).filter((p) => p.id !== id));

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "26px 28px" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 18px", letterSpacing: "-.02em", display: "flex", alignItems: "center", gap: 10 }}>
        <MessageSquare size={24} color="#10b981" /> Community
      </h1>
      <Composer onPosted={(p) => setPosts((cur) => [p, ...(cur || [])])} onOpenAuth={onOpenAuth} />
      {posts === null && <div style={{ padding: 30, textAlign: "center", color: "#64748b" }}><Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} /></div>}
      {posts && posts.length === 0 && <div style={{ padding: 30, textAlign: "center", color: "#64748b", fontSize: 13.5 }}>No posts yet. Be the first.</div>}
      {posts && posts.map((p) => <PostCard key={p.id} post={p} onOpenTicker={onOpenTicker} onOpenProfile={onOpenProfile} onDeleted={removeFromList} />)}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// A user's profile page: header + all their posts.
export function ProfilePage({ userId, onOpenTicker, onOpenProfile, onBack }) {
  const { fetchUserPosts, fetchProfile } = usePosts();
  const { user } = useAuth();
  const [prof, setProf] = useState(null);
  const [posts, setPosts] = useState(null);

  useEffect(() => {
    let on = true;
    fetchProfile(userId).then((p) => on && setProf(p));
    fetchUserPosts(userId).then((p) => on && setPosts(p));
    return () => { on = false; };
  }, [userId, fetchProfile, fetchUserPosts]);

  const removeFromList = (id) => setPosts((cur) => (cur || []).filter((p) => p.id !== id));
  const isMe = user?.id === userId;
  const isPremium = prof?.tier === "premium";

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "26px 28px" }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#64748b", fontSize: 13.5, fontWeight: 600, cursor: "pointer", marginBottom: 18, padding: 0 }}>
        <ArrowLeft size={16} /> Back to Community
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", overflow: "hidden", background: "#1e3a8a", display: "grid", placeItems: "center", fontSize: 26, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
          {prof?.avatar_url && prof?.avatar_status === "approved"
            ? <img src={prof.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : (prof?.username?.[0]?.toUpperCase() || "?")}
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
            {prof?.username || "…"}
            {isPremium && <span style={{ fontSize: 10, fontWeight: 700, color: "#fbbf24", background: "#2a210a", padding: "2px 7px", borderRadius: 5, display: "inline-flex", alignItems: "center", gap: 3 }}><BadgeCheck size={11} /> PREMIUM</span>}
            {isMe && <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>(you)</span>}
          </div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>
            {posts === null ? "…" : `${posts.length} post${posts.length === 1 ? "" : "s"}`}
            {prof?.created_at && ` · joined ${new Date(prof.created_at).toLocaleDateString()}`}
          </div>
        </div>
      </div>

      {posts === null && <div style={{ padding: 30, textAlign: "center", color: "#64748b" }}><Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} /></div>}
      {posts && posts.length === 0 && <div style={{ padding: 30, textAlign: "center", color: "#64748b", fontSize: 13.5 }}>No posts yet.</div>}
      {posts && posts.map((p) => <PostCard key={p.id} post={p} onOpenTicker={onOpenTicker} onOpenProfile={onOpenProfile} onDeleted={removeFromList} />)}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// Compact list for a stock page's "Community" tab — only posts mentioning `ticker`.
export function TickerPosts({ ticker, onOpenTicker, onOpenProfile }) {
  const { fetchByTicker } = usePosts();
  const [posts, setPosts] = useState(null);
  useEffect(() => { let on = true; fetchByTicker(ticker).then((p) => on && setPosts(p)); return () => { on = false; }; }, [ticker, fetchByTicker]);

  const removeFromList = (id) => setPosts((cur) => (cur || []).filter((p) => p.id !== id));

  if (posts === null) return <div style={{ padding: 24, textAlign: "center", color: "#64748b" }}><Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /></div>;
  if (!posts.length) return <div style={{ padding: 24, textAlign: "center", color: "#64748b", fontSize: 13 }}>No community posts mention ${ticker} yet.</div>;
  return <div>{posts.map((p) => <PostCard key={p.id} post={p} onOpenTicker={onOpenTicker} onOpenProfile={onOpenProfile} onDeleted={removeFromList} />)}</div>;
}
