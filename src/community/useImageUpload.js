// src/community/useImageUpload.js
// Uploads an image to Supabase Storage, runs moderation, and returns the
// public URL + status (approved | pending | rejected). Used by post composer
// and profile-picture settings.

import { useState, useCallback } from "react";
import { supabase } from "../auth/supabaseClient.js";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const OK_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function useImageUpload() {
  const [uploading, setUploading] = useState(false);

  // bucket: "post-images" | "avatars"
  const uploadAndModerate = useCallback(async (file, bucket, userId) => {
    if (!supabase) return { ok: false, error: "Not connected." };
    if (!OK_TYPES.includes(file.type)) return { ok: false, error: "Use JPG, PNG, WEBP, or GIF." };
    if (file.size > MAX_BYTES) return { ok: false, error: "Image must be under 5 MB." };

    setUploading(true);
    try {
      // unique path under the user's folder
      const ext = file.name.split(".").pop().toLowerCase();
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600", upsert: false,
      });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
      const imageUrl = pub.publicUrl;

      // run moderation on the public URL
      let status = "pending";
      try {
        const r = await fetch("/api/moderate", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl }),
        });
        const out = await r.json();
        if (out.verdict === "approved") status = "approved";
        else if (out.verdict === "rejected") status = "rejected";
        else status = "pending";
      } catch {
        status = "pending"; // fail safe — hide until reviewed
      }

      // if rejected, delete the file so it never lives in storage
      if (status === "rejected") {
        await supabase.storage.from(bucket).remove([path]).catch(() => {});
        setUploading(false);
        return { ok: false, error: "That image was flagged as inappropriate and can't be used." };
      }

      setUploading(false);
      return { ok: true, imageUrl, status, path };
    } catch (e) {
      setUploading(false);
      return { ok: false, error: e.message || "Upload failed." };
    }
  }, []);

  return { uploadAndModerate, uploading };
}
