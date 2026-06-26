// providers/moderation.js
// Image moderation via Sightengine. Returns a verdict the app uses to
// auto-approve, auto-reject, or queue for admin review.
//
// Env vars (set in Vercel): SIGHTENGINE_USER, SIGHTENGINE_SECRET
// Free tier: 2,000 checks/month. Get keys at https://sightengine.com (free, no card).
//
// Verdict logic (Option 3 — auto-block obvious, queue uncertain):
//   score >= REJECT  -> "rejected"  (clearly NSFW/violent/etc; never shown)
//   score >= REVIEW  -> "pending"   (uncertain; hidden until admin approves)
//   else             -> "approved"  (clearly clean; shown immediately)

const SE_USER = process.env.SIGHTENGINE_USER || "";
const SE_SECRET = process.env.SIGHTENGINE_SECRET || "";

export const moderationEnabled = !!(SE_USER && SE_SECRET);

const REJECT = 0.7;  // at/above this on any harmful class -> auto-reject
const REVIEW = 0.35; // at/above this -> send to admin review

// Models we check. Each maps to fields in Sightengine's response.
const MODELS = "nudity-2.1,weapon,recreational_drug,offensive-2.0,gore-2.0,self-harm";

export async function moderateImage(imageUrl) {
  // If moderation isn't configured, fail SAFE: queue for review rather than
  // auto-approving unscanned images.
  if (!moderationEnabled) return { verdict: "pending", reason: "moderation-not-configured", scores: {} };

  const params = new URLSearchParams({
    url: imageUrl,
    models: MODELS,
    api_user: SE_USER,
    api_secret: SE_SECRET,
  });

  let data;
  try {
    const r = await fetch(`https://api.sightengine.com/1.0/check.json?${params.toString()}`);
    data = await r.json();
  } catch (e) {
    return { verdict: "pending", reason: "moderation-error", scores: {} };
  }
  if (data.status !== "success") {
    return { verdict: "pending", reason: data.error?.message || "moderation-failed", scores: {} };
  }

  // Pull the worst (highest) harmful score across all checked classes.
  const scores = {};
  const collect = (label, val) => { if (typeof val === "number") scores[label] = val; };

  // nudity-2.1
  if (data.nudity) {
    collect("sexual_activity", data.nudity.sexual_activity);
    collect("sexual_display", data.nudity.sexual_display);
    collect("erotica", data.nudity.erotica);
    collect("very_suggestive", data.nudity.very_suggestive);
  }
  // weapons / drugs / gore / self-harm / offensive
  if (data.weapon?.classes) collect("weapon", Math.max(...Object.values(data.weapon.classes)));
  else if (typeof data.weapon === "number") collect("weapon", data.weapon);
  if (data.recreational_drug?.prob != null) collect("drugs", data.recreational_drug.prob);
  if (data.gore?.prob != null) collect("gore", data.gore.prob);
  if (data["self-harm"]?.prob != null) collect("self_harm", data["self-harm"].prob);
  if (data.offensive) {
    const off = Math.max(
      data.offensive.nazi || 0, data.offensive.confederate || 0,
      data.offensive.supremacist || 0, data.offensive.terrorist || 0,
      data.offensive.middle_finger || 0
    );
    collect("offensive", off);
  }

  const worst = Object.values(scores).length ? Math.max(...Object.values(scores)) : 0;
  let verdict = "approved";
  if (worst >= REJECT) verdict = "rejected";
  else if (worst >= REVIEW) verdict = "pending";

  return { verdict, worst, scores };
}
