// api/index.js — Vercel serverless version (multi-provider).
// Same providers as server.js. CORS locked to ALLOWED_ORIGINS, light per-IP
// rate limiting (note: serverless instances don't share memory, so for strict
// global limits use Upstash Redis — see README).

import {
  getQuote, getHistory, getNews, getMarketNews, getFilings,
  search, getScreener, providerStatus,
} from "../providers/index.js";

const cache = new Map();
function cacheGet(k){const h=cache.get(k);if(!h)return null;if(Date.now()>h.expires){cache.delete(k);return null;}return h.value;}
function cacheSet(k,v,ttl){cache.set(k,{value:v,expires:Date.now()+ttl});}
async function cached(k,ttl,fn){const h=cacheGet(k);if(h)return h;const v=await fn();cacheSet(k,v,ttl);return v;}

const ALLOWED = (process.env.ALLOWED_ORIGINS || "").split(",").map(s=>s.trim()).filter(Boolean);
function setCors(req, res) {
  const origin = req.headers.origin;
  if (!origin) { res.setHeader("Access-Control-Allow-Origin", "*"); return; }
  const devOk = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if (ALLOWED.includes(origin) || devOk) res.setHeader("Access-Control-Allow-Origin", origin);
}

// best-effort per-instance rate limit
const RATE_MAX = Number(process.env.RATE_MAX || 120);
const RATE_WINDOW_MS = Number(process.env.RATE_WINDOW_MS || 60000);
const hits = new Map();
function limited(req) {
  const ip = (req.headers["x-forwarded-for"]?.split(",")[0] || "unknown").trim();
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) return true;
  arr.push(now); hits.set(ip, arr); return false;
}

const TTL = { quote:15000, intraday:30000, daily:3600000, news:300000, sec:3600000, search:86400000 };

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (limited(req)) return res.status(429).json({ error: "Rate limit exceeded. Slow down." });

  const url = new URL(req.url, `http://${req.headers.host}`);
  const searchParams = url.searchParams;
  // Parse /api/<route>/<arg> from the path. Works with the vercel.json rewrite
  // because req.url preserves the original request path.
  const parts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const route = parts[0], arg = parts[1];

  try {
    if (route === "health") return res.status(200).json({ ok: true, providers: providerStatus() });

    if (route === "quote") {
      const s = arg.toUpperCase();
      return res.status(200).json(await cached(`quote:${s}`, TTL.quote, () => getQuote(s)));
    }
    if (route === "history") {
      const s = arg.toUpperCase(); const range = searchParams.get("range") || "1Y";
      const ttl = ["1D","5D"].includes(range) ? TTL.intraday : TTL.daily;
      return res.status(200).json({ symbol: s, range, candles: await cached(`hist:${s}:${range}`, ttl, () => getHistory(s, range)) });
    }
    if (route === "news" && arg) {
      const s = arg.toUpperCase();
      return res.status(200).json({ symbol: s, items: await cached(`news:${s}`, TTL.news, () => getNews(s)) });
    }
    if (route === "news") {
      return res.status(200).json({ items: await cached("news:market", TTL.news, () => getMarketNews()) });
    }
    if (route === "sec") {
      const s = arg.toUpperCase();
      return res.status(200).json({ symbol: s, items: await cached(`sec:${s}`, TTL.sec, () => getFilings(s)) });
    }
    if (route === "search") {
      const q = (searchParams.get("q")||"").trim();
      if (!q) return res.status(200).json({ results: [] });
      return res.status(200).json({ results: await cached(`search:${q.toLowerCase()}`, TTL.search, () => search(q)) });
    }
    if (route === "screener") {
      const cat = searchParams.get("cat") || "Top gainers";
      return res.status(200).json({ cat, rows: await cached(`screen:${cat}`, TTL.quote, () => getScreener(cat)) });
    }
    return res.status(404).json({ error: "Unknown route" });
  } catch (e) {
    const code = String(e.message||"").includes("not found") ? 404 : 500;
    return res.status(code).json({ error: String(e.message || e) });
  }
}
