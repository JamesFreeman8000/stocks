import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Search, Newspaper, FileText, Landmark, Star, Circle, BarChart3,
  Sparkles, Calendar, AlertCircle, LayoutGrid, ExternalLink, X, Globe,
  ArrowUpRight, Filter, RefreshCw, Info, User, LogOut, MessageSquare, Settings, Shield,
} from "lucide-react";
import { useAuth } from "./auth/AuthContext.jsx";
import AuthModal from "./auth/AuthModal.jsx";
import SettingsModal from "./auth/SettingsModal.jsx";
import { useWatchlist } from "./auth/useWatchlist.js";
import { CommunityPage, TickerPosts, ProfilePage } from "./community/Community.jsx";
import AdminDashboard from "./admin/AdminDashboard.jsx";

/* =================================================================
   DATA SOURCE CONFIG

   This app is deployed as ONE Vercel project: the React frontend and
   the /api serverless functions share the same domain. So the default
   below pulls REAL data from your own backend with zero extra config.

   - LIVE = true, API_BASE = ""  -> calls same-origin /api/* (Vercel default)
   - LIVE = false               -> runs on bundled demo data, no backend
   - To point at a SEPARATE backend (e.g. local dev server), set:
       const LIVE = true; const API_BASE = "http://localhost:8080";
   ================================================================= */
const LIVE = true;          // false = demo data only
const API_BASE = "";        // "" = same-origin /api (Vercel). Or a full URL.

// Fetch real historical candles when API is configured; returns null otherwise.
function useLiveHistory(symbol, range) {
  const [candles, setCandles] = useState(null);
  useEffect(() => {
    if (!LIVE || !symbol) { setCandles(null); return; }
    let cancelled = false;
    setCandles(undefined); // loading
    fetch(`${API_BASE}/api/history/${symbol}?range=${range}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setCandles(d.candles || []); })
      .catch(() => { if (!cancelled) setCandles([]); });
    return () => { cancelled = true; };
  }, [symbol, range]);
  return candles; // null = no API, undefined = loading, array = data
}

// Generic live fetch: returns null (no API), undefined (loading), or data.
function useLive(path, deps, enabled = true) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!LIVE || !enabled) { setData(null); return; }
    let cancelled = false;
    setData(undefined);
    fetch(`${API_BASE}${path}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setData(false); }); // false = error
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return data;
}


/* =================================================================
   StockScope — fast, self-contained demo build.
   All data here is bundled sample data so the prototype is instant
   and never fails. The "Go live" notes below explain exactly which
   call to swap in for real Yahoo/news data via your own backend.
   ================================================================= */

/* ---------------- bundled stock universe ---------------- */
// price, prevClose, open, dayLow, dayHigh, wk52Low, wk52High, mktCap, vol, avgVol,
// pe, eps, target, beta, bid, ask, earnings, events
const STOCKS = {
  ARTV: { name: "Artiva Biotherapeutics, Inc.", ex: "NasdaqGM", price: 9.82, change: -0.12, prevClose: 9.94, open: 10.00, dayLow: 9.48, dayHigh: 10.50, lo52: 1.47, hi52: 14.53, cap: "477.14M", vol: 1745397, avgVol: 531453, pe: "--", eps: -3.55, target: 35.80, beta: "--", bid: "7.38 x 200", ask: "12.28 x 200", earn: "Aug 12, 2026", ah: 9.99, ahChg: 0.17, sector: "Biotechnology",
    events: [{ kind: "earnings", label: "Q1 earnings beat", posPct: 0.28, quarter: "Q1 2026", epsEst: -0.98, epsAct: -0.84, revEst: "12.1M", revAct: "14.6M" }, { kind: "analyst", label: "Upgrade: Buy $36", posPct: 0.62, firm: "H.C. Wainwright", rating: "Buy", prevRating: "Neutral", target: 36.00, prevTarget: 22.00 }] },
  AAPL: { name: "Apple Inc.", ex: "NasdaqGS", price: 213.55, change: 1.82, prevClose: 211.73, open: 212.10, dayLow: 211.30, dayHigh: 214.80, lo52: 164.08, hi52: 260.10, cap: "3.18T", vol: 41200000, avgVol: 54800000, pe: "33.1", eps: 6.45, target: 245.00, beta: "1.18", bid: "213.50 x 800", ask: "213.58 x 500", earn: "Jul 31, 2026", ah: 213.90, ahChg: 0.35, sector: "Consumer Electronics",
    events: [{ kind: "earnings", label: "Q3 results", posPct: 0.4, quarter: "Q3 2026", epsEst: 1.42, epsAct: 1.51, revEst: "89.2B", revAct: "91.8B" }, { kind: "analyst", label: "PT raised to $245", posPct: 0.75, firm: "Morgan Stanley", rating: "Overweight", prevRating: "Overweight", target: 245.00, prevTarget: 235.00 }] },
  NVDA: { name: "NVIDIA Corporation", ex: "NasdaqGS", price: 174.20, change: 4.10, prevClose: 170.10, open: 170.80, dayLow: 169.90, dayHigh: 175.60, lo52: 86.62, hi52: 195.95, cap: "4.25T", vol: 188000000, avgVol: 210000000, pe: "54.8", eps: 3.18, target: 200.00, beta: "1.65", bid: "174.18 x 1200", ask: "174.22 x 900", earn: "Aug 27, 2026", ah: 175.05, ahChg: 0.85, sector: "Semiconductors",
    events: [{ kind: "earnings", label: "Record data-center rev", posPct: 0.35, quarter: "Q1 FY27", epsEst: 0.88, epsAct: 0.96, revEst: "41.0B", revAct: "44.1B" }, { kind: "analyst", label: "Reiterate Buy $200", posPct: 0.7, firm: "Goldman Sachs", rating: "Buy", prevRating: "Buy", target: 200.00, prevTarget: 185.00 }] },
  TSLA: { name: "Tesla, Inc.", ex: "NasdaqGS", price: 333.10, change: -6.40, prevClose: 339.50, open: 338.20, dayLow: 329.40, dayHigh: 341.00, lo52: 182.00, hi52: 488.54, cap: "1.07T", vol: 92000000, avgVol: 108000000, pe: "58.2", eps: 5.72, target: 310.00, beta: "2.10", bid: "333.05 x 300", ask: "333.15 x 400", earn: "Jul 23, 2026", ah: 331.80, ahChg: -1.30, sector: "Auto Manufacturers",
    events: [{ kind: "earnings", label: "Deliveries miss", posPct: 0.3, quarter: "Q2 2026", epsEst: 0.62, epsAct: 0.54, revEst: "25.1B", revAct: "23.8B" }, { kind: "analyst", label: "Downgrade: Hold", posPct: 0.66, firm: "UBS", rating: "Neutral", prevRating: "Buy", target: 310.00, prevTarget: 360.00 }] },
  AMZN: { name: "Amazon.com, Inc.", ex: "NasdaqGS", price: 221.40, change: 2.05, prevClose: 219.35, open: 219.90, dayLow: 218.70, dayHigh: 222.60, lo52: 151.61, hi52: 242.52, cap: "2.34T", vol: 38000000, avgVol: 45000000, pe: "37.4", eps: 5.92, target: 260.00, beta: "1.32", bid: "221.36 x 600", ask: "221.44 x 700", earn: "Jul 30, 2026", ah: 221.90, ahChg: 0.50, sector: "Internet Retail",
    events: [{ kind: "earnings", label: "AWS reaccelerates", posPct: 0.42, quarter: "Q2 2026", epsEst: 1.28, epsAct: 1.46, revEst: "162.0B", revAct: "167.7B" }, { kind: "analyst", label: "Top pick $260", posPct: 0.72, firm: "JPMorgan", rating: "Overweight", prevRating: "Overweight", target: 260.00, prevTarget: 240.00 }] },
  MSFT: { name: "Microsoft Corporation", ex: "NasdaqGS", price: 468.90, change: 3.25, prevClose: 465.65, open: 466.00, dayLow: 464.20, dayHigh: 470.80, lo52: 385.58, hi52: 500.76, cap: "3.48T", vol: 19000000, avgVol: 22000000, pe: "37.9", eps: 12.38, target: 520.00, beta: "0.92", bid: "468.85 x 300", ask: "468.95 x 200", earn: "Jul 28, 2026", ah: 469.50, ahChg: 0.60, sector: "Software",
    events: [{ kind: "earnings", label: "Cloud growth 31%", posPct: 0.38, quarter: "Q4 FY26", epsEst: 3.42, epsAct: 3.61, revEst: "73.8B", revAct: "76.4B" }, { kind: "analyst", label: "PT $520", posPct: 0.74, firm: "Wedbush", rating: "Outperform", prevRating: "Outperform", target: 520.00, prevTarget: 500.00 }] },
  GOOGL:{ name: "Alphabet Inc.", ex: "NasdaqGS", price: 182.30, change: 1.10, prevClose: 181.20, open: 181.40, dayLow: 180.50, dayHigh: 183.70, lo52: 142.66, hi52: 208.70, cap: "2.22T", vol: 27000000, avgVol: 31000000, pe: "26.5", eps: 6.88, target: 210.00, beta: "1.05", bid: "182.26 x 400", ask: "182.34 x 500", earn: "Jul 29, 2026", ah: 182.70, ahChg: 0.40, sector: "Internet Content",
    events: [{ kind: "earnings", label: "Search + Cloud beat", posPct: 0.4, quarter: "Q2 2026", epsEst: 2.18, epsAct: 2.36, revEst: "94.1B", revAct: "97.0B" }, { kind: "analyst", label: "Buy $210", posPct: 0.7, firm: "BofA", rating: "Buy", prevRating: "Neutral", target: 210.00, prevTarget: 180.00 }] },
  META: { name: "Meta Platforms, Inc.", ex: "NasdaqGS", price: 712.50, change: -4.80, prevClose: 717.30, open: 716.00, dayLow: 708.90, dayHigh: 719.40, lo52: 442.65, hi52: 740.91, cap: "1.81T", vol: 14000000, avgVol: 16500000, pe: "28.7", eps: 24.82, target: 800.00, beta: "1.21", bid: "712.40 x 200", ask: "712.60 x 300", earn: "Jul 30, 2026", ah: 711.20, ahChg: -1.30, sector: "Internet Content",
    events: [{ kind: "earnings", label: "Ad revenue strong", posPct: 0.36, quarter: "Q2 2026", epsEst: 6.22, epsAct: 6.81, revEst: "44.8B", revAct: "47.5B" }, { kind: "analyst", label: "PT $800", posPct: 0.68, firm: "Citi", rating: "Buy", prevRating: "Buy", target: 800.00, prevTarget: 720.00 }] },
  AMD:  { name: "Advanced Micro Devices, Inc.", ex: "NasdaqGS", price: 168.40, change: 3.90, prevClose: 164.50, open: 165.10, dayLow: 163.80, dayHigh: 170.20, lo52: 76.48, hi52: 187.28, cap: "272.5B", vol: 44000000, avgVol: 50000000, pe: "118.6", eps: 1.42, target: 195.00, beta: "1.74", bid: "168.36 x 500", ask: "168.44 x 600", earn: "Aug 04, 2026", ah: 169.10, ahChg: 0.70, sector: "Semiconductors",
    events: [{ kind: "earnings", label: "MI400 ramp", posPct: 0.38, quarter: "Q2 2026", epsEst: 0.48, epsAct: 0.55, revEst: "7.4B", revAct: "7.9B" }, { kind: "analyst", label: "Outperform $195", posPct: 0.72, firm: "Stifel", rating: "Buy", prevRating: "Hold", target: 195.00, prevTarget: 150.00 }] },
  PLTR: { name: "Palantir Technologies Inc.", ex: "NasdaqGS", price: 142.80, change: 5.60, prevClose: 137.20, open: 138.00, dayLow: 136.50, dayHigh: 145.30, lo52: 21.23, hi52: 155.92, cap: "335.9B", vol: 78000000, avgVol: 85000000, pe: "412.0", eps: 0.35, target: 130.00, beta: "2.55", bid: "142.74 x 700", ask: "142.86 x 800", earn: "Aug 05, 2026", ah: 143.60, ahChg: 0.80, sector: "Software",
    events: [{ kind: "earnings", label: "Gov + commercial beat", posPct: 0.4, quarter: "Q2 2026", epsEst: 0.10, epsAct: 0.13, revEst: "1.01B", revAct: "1.09B" }, { kind: "analyst", label: "Hold — valuation", posPct: 0.7, firm: "Jefferies", rating: "Hold", prevRating: "Hold", target: 130.00, prevTarget: 110.00 }] },
  COIN: { name: "Coinbase Global, Inc.", ex: "NasdaqGS", price: 298.60, change: -8.20, prevClose: 306.80, open: 305.00, dayLow: 292.40, dayHigh: 308.90, lo52: 142.58, hi52: 349.75, cap: "75.8B", vol: 12000000, avgVol: 14000000, pe: "44.2", eps: 6.76, target: 320.00, beta: "3.12", bid: "298.50 x 200", ask: "298.70 x 200", earn: "Aug 06, 2026", ah: 296.90, ahChg: -1.70, sector: "Capital Markets",
    events: [{ kind: "earnings", label: "Trading volume up", posPct: 0.35, quarter: "Q2 2026", epsEst: 1.42, epsAct: 1.18, revEst: "1.6B", revAct: "1.5B" }, { kind: "analyst", label: "Neutral $320", posPct: 0.68, firm: "Barclays", rating: "Neutral", prevRating: "Neutral", target: 320.00, prevTarget: 300.00 }] },
  SOFI: { name: "SoFi Technologies, Inc.", ex: "NasdaqGS", price: 22.85, change: 0.95, prevClose: 21.90, open: 22.00, dayLow: 21.80, dayHigh: 23.40, lo52: 6.01, hi52: 24.95, cap: "25.1B", vol: 62000000, avgVol: 70000000, pe: "55.7", eps: 0.41, target: 20.00, beta: "1.88", bid: "22.82 x 900", ask: "22.88 x 800", earn: "Jul 28, 2026", ah: 23.05, ahChg: 0.20, sector: "Credit Services",
    events: [{ kind: "earnings", label: "Member growth strong", posPct: 0.4, quarter: "Q2 2026", epsEst: 0.06, epsAct: 0.09, revEst: "740M", revAct: "812M" }, { kind: "analyst", label: "PT raised $24", posPct: 0.7, firm: "Mizuho", rating: "Buy", prevRating: "Neutral", target: 24.00, prevTarget: 16.00 }] },
};

const TICKERS = Object.keys(STOCKS);

/* ---------------- bundled news ---------------- */
const NEWS = {
  "Top Stories": [
    { title: "S&P 500 notches record close as megacap tech leads broad rally", source: "Reuters", time: "1h ago", sentiment: "positive", tickers: ["NVDA","AAPL","MSFT"], url: "https://www.reuters.com/markets/us/", summary: "Index closed at an all-time high, powered by semiconductor and software names." },
    { title: "Fed minutes signal patience on rate cuts amid sticky services inflation", source: "Bloomberg", time: "2h ago", sentiment: "neutral", tickers: [], url: "https://www.bloomberg.com/markets", summary: "Officials want more data before easing, keeping markets guessing on timing." },
    { title: "Nvidia extends gains as data-center demand outlook stays robust", source: "CNBC", time: "3h ago", sentiment: "positive", tickers: ["NVDA","AMD"], url: "https://www.cnbc.com/markets/", summary: "Analysts see continued AI infrastructure spend through next year." },
    { title: "Tesla slips after quarterly deliveries come in below estimates", source: "AP News", time: "4h ago", sentiment: "negative", tickers: ["TSLA"], url: "https://apnews.com/hub/business", summary: "Volume softness in key markets weighed on the stock in early trading." },
    { title: "Biotech rallies on M&A speculation; small caps see unusual volume", source: "MarketWatch", time: "5h ago", sentiment: "positive", tickers: ["ARTV"], url: "https://www.marketwatch.com/markets", summary: "Several clinical-stage names jumped on takeover chatter." },
    { title: "Treasury yields ease as investors weigh growth and inflation mix", source: "WSJ", time: "6h ago", sentiment: "neutral", tickers: [], url: "https://www.wsj.com/finance", summary: "The 10-year drifted lower after mixed economic readings." },
  ],
  "Markets": [
    { title: "Megacap breadth widens as rally broadens beyond AI leaders", source: "Bloomberg", time: "1h ago", sentiment: "positive", tickers: ["AMZN","GOOGL","META"], url: "https://www.bloomberg.com/markets", summary: "Participation improved across sectors in the latest session." },
    { title: "Volatility gauge drops to multi-month low as fear recedes", source: "Reuters", time: "3h ago", sentiment: "positive", tickers: [], url: "https://www.reuters.com/markets/", summary: "The VIX slid as equity markets stabilized." },
    { title: "Energy and financials lag while tech carries the tape", source: "CNBC", time: "4h ago", sentiment: "neutral", tickers: [], url: "https://www.cnbc.com/markets/", summary: "Rotation favored growth over value on the day." },
    { title: "Options activity spikes in semiconductors ahead of earnings", source: "MarketWatch", time: "5h ago", sentiment: "neutral", tickers: ["NVDA","AMD"], url: "https://www.marketwatch.com/markets", summary: "Traders positioned for outsized moves into chip results." },
  ],
  "Earnings": [
    { title: "Microsoft cloud growth tops estimates as Azure reaccelerates", source: "CNBC", time: "2h ago", sentiment: "positive", tickers: ["MSFT"], url: "https://www.cnbc.com/markets/", summary: "Commercial cloud strength drove an upside quarter." },
    { title: "Amazon AWS margins expand, retail holds steady", source: "Reuters", time: "3h ago", sentiment: "positive", tickers: ["AMZN"], url: "https://www.reuters.com/technology/", summary: "Operating income beat as cloud profitability improved." },
    { title: "Coinbase revenue dips on lower volatility trading", source: "Bloomberg", time: "5h ago", sentiment: "negative", tickers: ["COIN"], url: "https://www.bloomberg.com/markets", summary: "Softer transaction revenue pressured the quarter." },
    { title: "Palantir lifts guidance on commercial momentum", source: "WSJ", time: "6h ago", sentiment: "positive", tickers: ["PLTR"], url: "https://www.wsj.com/finance", summary: "US commercial bookings accelerated again." },
  ],
  "Tech": [
    { title: "AI chip demand keeps supply chains stretched into 2027", source: "Bloomberg", time: "2h ago", sentiment: "positive", tickers: ["NVDA","AMD"], url: "https://www.bloomberg.com/technology", summary: "Foundry capacity remains the key bottleneck." },
    { title: "Apple's services segment hits fresh revenue record", source: "CNBC", time: "3h ago", sentiment: "positive", tickers: ["AAPL"], url: "https://www.cnbc.com/technology/", summary: "Recurring revenue continues to grow double digits." },
    { title: "Meta ramps AI infrastructure spend, eyes efficiency gains", source: "Reuters", time: "4h ago", sentiment: "neutral", tickers: ["META"], url: "https://www.reuters.com/technology/", summary: "Capex guidance edged higher for the year." },
  ],
  "Crypto": [
    { title: "Bitcoin holds key level as ETF inflows resume", source: "CoinDesk", time: "1h ago", sentiment: "positive", tickers: ["COIN"], url: "https://www.coindesk.com/markets/", summary: "Spot ETF demand picked back up this week." },
    { title: "Coinbase expands institutional custody offering", source: "The Block", time: "4h ago", sentiment: "positive", tickers: ["COIN"], url: "https://www.theblock.co/", summary: "New services target large asset managers." },
  ],
  "Economy": [
    { title: "Jobs report shows resilient labor market, wages cool slightly", source: "AP News", time: "2h ago", sentiment: "neutral", tickers: [], url: "https://apnews.com/hub/economy", summary: "Hiring stayed solid while wage growth moderated." },
    { title: "Consumer sentiment ticks up as gas prices fall", source: "Reuters", time: "5h ago", sentiment: "positive", tickers: [], url: "https://www.reuters.com/markets/us/", summary: "Households grew more optimistic in the latest survey." },
  ],
  "Federal Reserve": [
    { title: "Fed officials split on timing of first rate cut", source: "WSJ", time: "1h ago", sentiment: "neutral", tickers: [], url: "https://www.wsj.com/economy/central-banking", summary: "Policymakers diverged on how soon to ease." },
    { title: "Chair signals data-dependent path in latest remarks", source: "Bloomberg", time: "3h ago", sentiment: "neutral", tickers: [], url: "https://www.bloomberg.com/markets/economics", summary: "No commitment on the next move." },
  ],
  "Congress & Policy": [
    { title: "Senate hearing scrutinizes AI chip export controls", source: "Reuters", time: "2h ago", sentiment: "neutral", tickers: ["NVDA","AMD"], url: "https://www.reuters.com/legal/government/", summary: "Lawmakers debated tightening rules on advanced semiconductors." },
    { title: "House panel advances bill on biotech R&D incentives", source: "Politico", time: "4h ago", sentiment: "positive", tickers: ["ARTV"], url: "https://www.politico.com/", summary: "Proposed credits could benefit clinical-stage developers." },
  ],
};
const NEWS_CATS = Object.keys(NEWS);

/* ---------------- bundled SEC filings & events per stock ---------------- */
const filingsFor = (s) => [
  { form: "8-K", title: `${s.name} — Results of Operations`, date: "Jun 14, 2026", summary: "Current report disclosing quarterly financial results.", url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany" },
  { form: "10-Q", title: `${s.name} — Quarterly Report`, date: "May 09, 2026", summary: "Unaudited financial statements for the most recent quarter.", url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany" },
  { form: "Form 4", title: "Insider — Statement of Changes in Beneficial Ownership", date: "May 02, 2026", summary: "An officer or director reported a change in holdings.", url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany" },
  { form: "10-K", title: `${s.name} — Annual Report`, date: "Feb 21, 2026", summary: "Audited annual financial statements and risk factors.", url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany" },
];
const eventsFor = (s) => [
  { event: `${s.name} Q2 Earnings Call`, type: "earnings", date: s.earn, impact: "high", summary: "Management will discuss quarterly results and guidance." },
  { event: "Sector hearing in Congress", type: "congress", date: "Jul 09, 2026", impact: "medium", summary: "Policy discussion that could affect the broader industry." },
  { event: "Regulatory decision window", type: "regulatory", date: "Jul 18, 2026", impact: "medium", summary: "Pending agency action relevant to the company." },
  { event: "Industry conference presentation", type: "conference", date: "Aug 01, 2026", impact: "low", summary: "Company slated to present to investors." },
  { event: "Fed rate decision", type: "macro", date: "Jul 29, 2026", impact: "high", summary: "Broad market-moving macro event." },
];

/* ---------------- screener logic over bundled universe ---------------- */
function screen(cat) {
  const all = TICKERS.map((t) => ({ ticker: t, ...STOCKS[t], changePct: (STOCKS[t].change / STOCKS[t].prevClose) * 100 }));
  const note = (s, txt) => ({ ...s, _note: txt });
  let rows = all.map((s) => note(s, s.sector));
  switch (cat) {
    case "Top gainers": rows = [...all].sort((a,b)=>b.changePct-a.changePct).filter(s=>s.changePct>0).map(s=>note(s,`${s.changePct.toFixed(2)}% today`)); break;
    case "Biggest losers": rows = [...all].sort((a,b)=>a.changePct-b.changePct).filter(s=>s.changePct<0).map(s=>note(s,`${s.changePct.toFixed(2)}% today`)); break;
    case "Most active": rows = [...all].sort((a,b)=>b.vol-a.vol).map(s=>note(s,`${(s.vol/1e6).toFixed(1)}M shares`)); break;
    case "Most volatile": rows = [...all].sort((a,b)=>((b.dayHigh-b.dayLow)/b.price)-((a.dayHigh-a.dayLow)/a.price)).map(s=>note(s,`${(((s.dayHigh-s.dayLow)/s.price)*100).toFixed(1)}% intraday range`)); break;
    case "High beta": rows = [...all].filter(s=>s.beta!=="--").sort((a,b)=>parseFloat(b.beta)-parseFloat(a.beta)).map(s=>note(s,`Beta ${s.beta}`)); break;
    case "Penny stocks": rows = all.filter(s=>s.price<5).map(s=>note(s,"Under $5")); break;
    case "Most expensive": rows = [...all].sort((a,b)=>b.price-a.price).map(s=>note(s,`$${s.price.toFixed(2)}`)); break;
    case "Large-cap": rows = all.filter(s=>/T$|[0-9]{3}B/.test(s.cap)).map(s=>note(s,`Cap ${s.cap}`)); break;
    case "Small-cap": rows = all.filter(s=>/M$/.test(s.cap)).map(s=>note(s,`Cap ${s.cap}`)); break;
    case "52-week high": rows = [...all].sort((a,b)=>(b.price/b.hi52)-(a.price/a.hi52)).map(s=>note(s,`${((s.price/s.hi52)*100).toFixed(0)}% of 52w high`)); break;
    case "52-week low": rows = [...all].sort((a,b)=>(a.price/a.hi52)-(b.price/b.hi52)).map(s=>note(s,`Near 52w low`)); break;
    case "Pre-market gainers": case "After-hours gainers": rows = [...all].filter(s=>s.ahChg>0).sort((a,b)=>b.ahChg-a.ahChg).map(s=>note(s,`+${s.ahChg} after hours`)); break;
    case "Pre-market losers": case "After-hours losers": rows = [...all].filter(s=>s.ahChg<0).sort((a,b)=>a.ahChg-b.ahChg).map(s=>note(s,`${s.ahChg} after hours`)); break;
    case "Highest revenue": case "Highest net income": case "Largest employers": case "Highest cash":
      rows = [...all].sort((a,b)=>b.vol-a.vol).map(s=>note(s,s.sector)); break;
    default: rows = all.map(s=>note(s, s.sector));
  }
  return rows.slice(0, 20);
}

const fmt = (n) => (n == null || n === "" ? "--" : Number(n).toLocaleString());

/* ---------------- deterministic spiky chart series ----------------
   Bars are generated on a real trading clock (skipping weekends), one
   point per real interval — minutes (1D), hours (5D), or trading days
   (1M+) — so spacing matches Yahoo / TradingView instead of smearing
   evenly across calendar time.
   bar: "min" | "hour" | "day"
   step: interval size; count: how many bars; vol: drift envelope;
   jit: per-bar spikiness                                            */
const RANGE_META = {
  "1D": { bar: "min",  stepMin: 2,  count: 195, vol: 0.05, jit: 1.0,  intraday: true },  // 6.5h / 2min ≈ 195 bars
  "5D": { bar: "min",  stepMin: 10, count: 195, vol: 0.10, jit: 0.95, intraday: true },  // ~39 bars/day * 5
  "1M": { bar: "day",  count: 23,  vol: 0.16, jit: 0.9 },   // ~23 trading days
  "6M": { bar: "day",  count: 128, vol: 0.28, jit: 0.8 },   // ~128 trading days
  "YTD":{ bar: "day",  count: 116, vol: 0.30, jit: 0.8 },
  "1Y": { bar: "day",  count: 252, vol: 0.38, jit: 0.75 },  // ~252 trading days/yr
  "5Y": { bar: "week", count: 261, vol: 0.62, jit: 0.66 },  // 52 weeks * 5
  "All":{ bar: "week", count: 417, vol: 0.8,  jit: 0.6 },   // ~8 yrs of weeks
};
const NOW = new Date("2026-06-18T16:00:00"); // demo "as of" close
const isWeekend = (d) => { const g = d.getDay(); return g === 0 || g === 6; };
function seedFrom(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function fmtTime(d, intraday) {
  const opts = intraday
    ? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
    : { weekday: "short", year: "numeric", month: "short", day: "numeric" };
  return d.toLocaleString("en-US", opts);
}
function axisLabel(d, range) {
  if (range === "1D") return d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });
  if (range === "5D") return d.toLocaleString("en-US", { weekday: "short" });
  if (range === "1M") return d.toLocaleString("en-US", { month: "short", day: "numeric" });
  if (range === "5Y" || range === "All") return String(d.getFullYear());
  return d.toLocaleString("en-US", { month: "short", day: "numeric" });
}
// Build timestamps oldest->newest, stepping exactly one unit (minute/day/week) at a time.
function buildTimeline(m) {
  const stamps = [];
  if (m.bar === "min") {
    const open = 9 * 60 + 30, close = 16 * 60;
    let d = new Date(NOW);
    // normalize NOW down onto a step boundary at/under the close
    while (stamps.length < m.count) {
      const mins = d.getHours() * 60 + d.getMinutes();
      if (!isWeekend(d) && mins >= open && mins <= close) stamps.push(d.getTime());
      d = new Date(d.getTime() - m.stepMin * 60e3);
      const mm = d.getHours() * 60 + d.getMinutes();
      if (mm < open) { // jump to prior trading day's close
        d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 16, 0, 0);
        while (isWeekend(d)) d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 16, 0, 0);
      }
    }
  } else if (m.bar === "day") {
    let d = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate(), 16, 0, 0);
    while (stamps.length < m.count) {
      if (!isWeekend(d)) stamps.push(d.getTime());        // one trading day at a time
      d = new Date(d.getTime() - 24 * 3600e3);
    }
  } else { // week — one week at a time
    let d = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate(), 16, 0, 0);
    while (stamps.length < m.count) {
      stamps.push(d.getTime());
      d = new Date(d.getTime() - 7 * 24 * 3600e3);
    }
  }
  return stamps.reverse();
}
function buildSeries(stock, range) {
  const m = RANGE_META[range] || RANGE_META["1D"];
  const base = stock.price;
  const span = Math.max(stock.dayHigh - stock.dayLow, base * 0.015);
  const dir = stock.change >= 0 ? 1 : -1;
  const totalMove = base * m.vol * dir * 0.6;
  const startPrice = base - totalMove;

  let rnd = seedFrom(stock.name + range);
  const rand = () => { rnd = (rnd * 1103515245 + 12345) & 0x7fffffff; return rnd / 0x7fffffff; };
  const gauss = () => {
    let u = 0, v = 0; while (u === 0) u = rand(); while (v === 0) v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const stamps = buildTimeline(m);
  const n = stamps.length;
  const stepVol = (span / Math.sqrt(n)) * m.jit * 1.6;
  const out = [];
  let price = startPrice;
  let momentum = 0;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const burst = rand() < 0.12 ? 2.4 : 1;          // volatility clustering
    momentum = momentum * 0.6 + gauss() * stepVol * burst;
    const pull = ((startPrice + totalMove * t) - price) * 0.06;
    price = price + momentum + pull;
    const d = new Date(stamps[i]);
    out.push({
      i, price: +price.toFixed(2),
      ts: stamps[i],
      label: axisLabel(d, range),
      full: fmtTime(d, m.intraday),
    });
  }
  out[out.length - 1].price = base;
  out[0].price = +startPrice.toFixed(2);
  if (range === "1D") (stock.events || []).forEach((ev) => {
    const idx = Math.round((ev.posPct ?? 0.5) * (out.length - 1));
    if (out[idx]) out[idx] = { ...out[idx], event: ev };
  });

  out._ticks = computeTicks(out, range);
  return out;
}

// Clean, evenly-spaced axis ticks like Yahoo: pick indices whose label
// changes on a natural boundary (hour / day / month / year) for the range.
function computeTicks(out, range) {
  const ticks = [];
  const want = { "1D": 7, "5D": 5, "1M": 6, "6M": 6, "YTD": 6, "1Y": 6, "5Y": 6, "All": 6 }[range] || 6;
  let lastKey = null;
  const keyOf = (d) => {
    if (range === "1D") return d.getHours();
    if (range === "5D") return d.toDateString();
    if (range === "1M" || range === "6M" || range === "YTD") return d.getMonth() + "-" + Math.floor(d.getDate() / 8);
    if (range === "1Y") return d.getMonth();
    return d.getFullYear();
  };
  const boundaries = [];
  out.forEach((pt, idx) => {
    const k = keyOf(new Date(pt.ts));
    if (k !== lastKey) { boundaries.push(idx); lastKey = k; }
  });
  const stepB = Math.max(1, Math.round(boundaries.length / want));
  for (let b = 0; b < boundaries.length; b += stepB) ticks.push(boundaries[b]);
  if (boundaries.length && ticks[ticks.length - 1] !== out.length - 1) ticks.push(out.length - 1);
  return ticks;
}

/* ---------------- small UI bits ---------------- */
function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const ev = p.event;
  return (
    <div style={{ background: "rgba(16,20,28,0.98)", border: "1px solid #2b3340", borderRadius: 9, padding: "10px 13px", fontSize: 12, minWidth: 150, boxShadow: "0 10px 30px rgba(0,0,0,0.55)" }}>
      <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 14 }}>${p.price.toFixed(2)}</div>
      <div style={{ color: "#94a3b8", fontSize: 11.5, marginTop: 1 }}>{p.full}</div>
      {ev && ev.kind === "earnings" && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #2b3340" }}>
          <div style={{ color: "#fbbf24", fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>📊 Earnings{ev.quarter ? ` · ${ev.quarter}` : ""}</div>
          <div style={{ color: "#cbd5e1", marginTop: 5, lineHeight: 1.55 }}>
            {ev.epsAct != null && ev.epsEst != null && (
              <div>EPS: <b style={{ color: ev.epsAct >= ev.epsEst ? "#34d399" : "#f87171" }}>{ev.epsAct >= 0 ? "$" : "-$"}{Math.abs(ev.epsAct).toFixed(2)}</b> <span style={{ color: "#64748b" }}>est ${ev.epsEst.toFixed(2)}</span></div>
            )}
            {ev.revAct && <div>Revenue: <b>{ev.revAct}</b> {ev.revEst ? <span style={{ color: "#64748b" }}>est {ev.revEst}</span> : null}</div>}
            {ev.epsAct != null && ev.epsEst != null && (
              <div style={{ marginTop: 3, color: ev.epsAct >= ev.epsEst ? "#34d399" : "#f87171", fontWeight: 600 }}>
                {ev.epsAct >= ev.epsEst ? "Beat" : "Miss"}{ev.label ? ` · ${ev.label}` : ""}
              </div>
            )}
          </div>
        </div>
      )}
      {ev && ev.kind === "analyst" && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #2b3340" }}>
          <div style={{ color: "#60a5fa", fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>⭐ Analyst · {ev.firm}</div>
          <div style={{ color: "#cbd5e1", marginTop: 5, lineHeight: 1.55 }}>
            <div>Consensus: <b>{ev.rating}</b>{ev.prevRating && ev.prevRating !== ev.rating ? <span style={{ color: "#64748b" }}> (was {ev.prevRating})</span> : null}</div>
            {ev.target != null && <div>Mean target: <b style={{ color: "#34d399" }}>${Number(ev.target).toFixed(2)}</b>{ev.targetLow != null && ev.targetHigh != null ? <span style={{ color: "#64748b" }}> (${Number(ev.targetLow).toFixed(0)}–${Number(ev.targetHigh).toFixed(0)})</span> : null}</div>}
            {ev.breakdown && (
              <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>
                Buy {(ev.breakdown.strongBuy || 0) + (ev.breakdown.buy || 0)} · Hold {ev.breakdown.hold || 0} · Sell {(ev.breakdown.sell || 0) + (ev.breakdown.strongSell || 0)}
              </div>
            )}
            {ev.source && <div style={{ marginTop: 5, color: "#60a5fa", fontSize: 11, fontWeight: 600 }}>Click dot to view source →</div>}
          </div>
        </div>
      )}
    </div>
  );
}
function EventDot({ cx, cy, payload }) {
  if (!payload.event) return null;
  const ev = payload.event;
  const c = ev.kind === "earnings" ? "#fbbf24" : "#60a5fa";
  const clickable = !!ev.source;
  const handleClick = () => { if (ev.source) window.open(ev.source, "_blank", "noopener"); };
  return (
    <g style={{ cursor: clickable ? "pointer" : "default" }} onClick={handleClick}>
      <circle cx={cx} cy={cy} r={10} fill={c} opacity={0.16} />
      <circle cx={cx} cy={cy} r={5} fill={c} stroke="#0b0e14" strokeWidth={1.6} />
      {clickable && <circle cx={cx} cy={cy} r={13} fill="transparent" />}
    </g>
  );
}
// TradingView-style crosshair: dashed vertical + horizontal lines through the hovered point,
// with a price tag pinned to the right axis. Recharts passes points[] + plot width/height.
function Crosshair(props) {
  const { points, width, height } = props;
  if (!points || !points.length) return null;
  const x = points[0].x;
  const y = points[0].y;
  // plot area origin: Recharts cursor receives the inner chart box via points relative to it,
  // but width/height are the plot dimensions. Use the second point if provided for bounds.
  const topY = props.top != null ? props.top : 10;
  const botY = props.top != null ? props.top + height : height + 10;
  const leftX = props.left != null ? props.left : 0;
  const rightX = (props.left != null ? props.left : 0) + (width || 0);
  const price = points[0]?.payload?.price;
  return (
    <g pointerEvents="none">
      <line x1={x} y1={topY} x2={x} y2={botY} stroke="#3b475a" strokeWidth={1} strokeDasharray="4 3" />
      <line x1={leftX} y1={y} x2={rightX} y2={y} stroke="#3b475a" strokeWidth={1} strokeDasharray="4 3" />
      {price != null && (
        <g>
          <rect x={rightX} y={y - 10} width={50} height={20} rx={3} fill="#1e3a8a" />
          <text x={rightX + 25} y={y + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff">{price.toFixed(2)}</text>
        </g>
      )}
    </g>
  );
}
const sentColor = (s) => s === "positive" ? "#10b981" : s === "negative" ? "#f87171" : "#64748b";

/* ============================ MAIN ============================ */
export default function StockScope() {
  const [page, setPage] = useState("markets");
  const [active, setActive] = useState("ARTV");
  const { tickers: watchlist, addTicker, removeTicker, toggleTicker } = useWatchlist();
  const [notFound, setNotFound] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileUserId, setProfileUserId] = useState(null);
  const { user, profile, signOut, supabaseEnabled, isAdmin } = useAuth();

  // open a user's profile page
  const openProfile = (uid) => { setProfileUserId(uid); setPage("profile"); };

  const open = (t) => {
    const T = String(t || "").trim().toUpperCase();
    if (!T) return;
    // With a live backend, any ticker is valid (the quote fetch decides).
    // In demo mode, only bundled tickers resolve.
    if (LIVE || STOCKS[T]) { setActive(T); setNotFound(""); setPage("markets"); }
    else { setNotFound(T); setPage("markets"); }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0b0e14", color: "#e2e8f0", fontFamily: "'Inter',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap');
        *{box-sizing:border-box;} ::selection{background:#14532d;}
        .pill{transition:all .12s ease;cursor:pointer;}
        .pill:hover{filter:brightness(1.22);}
        .row:hover{background:rgba(255,255,255,0.025);}
        .wl:hover{background:#161b24!important;}
        .navitem:hover{color:#e2e8f0!important;}
        .card{transition:all .12s ease;}
        .card:hover{border-color:#2b3a4a!important;transform:translateY(-1px);}
        input::placeholder{color:#475569;}
        a{color:inherit;text-decoration:none;}
        .scrollx::-webkit-scrollbar{height:6px;} .scrollx::-webkit-scrollbar-thumb{background:#232b38;border-radius:3px;}
      `}</style>

      <div style={{ borderBottom: "1px solid #161b24", padding: "14px 28px", display: "flex", alignItems: "center", gap: 26, position: "sticky", top: 0, background: "rgba(11,14,20,0.93)", backdropFilter: "blur(12px)", zIndex: 30 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, display: "grid", placeItems: "center", background: "linear-gradient(135deg,#10b981,#0ea5e9)" }}>
            <BarChart3 size={18} color="#0b0e14" />
          </div>
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: "-0.02em" }}>
            Stock<span style={{ color: "#10b981" }}>Scope</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 22 }}>
          {[["markets", "Markets", BarChart3], ["news", "News", Newspaper], ["screener", "Screener", LayoutGrid], ["community", "Community", MessageSquare], ...(isAdmin ? [["admin", "Admin", Shield]] : [])].map(([id, label, Icon]) => (
            <div key={id} className="navitem" onClick={() => setPage(id)} style={{
              cursor: "pointer", fontSize: 14.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 7,
              color: page === id ? "#10b981" : "#64748b",
            }}><Icon size={16} /> {label}</div>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <GlobalSearch onPick={open} />
        {supabaseEnabled && (
          user ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: 14 }}>
              <div onClick={() => openProfile(user.id)} title="My profile" style={{ width: 32, height: 32, borderRadius: "50%", overflow: "hidden", background: "#1e3a8a", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" }}>
                {profile?.avatar_url && profile?.avatar_status === "approved"
                  ? <img src={profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : (profile?.username?.[0]?.toUpperCase() || <User size={16} />)}
              </div>
              <span onClick={() => openProfile(user.id)} style={{ fontSize: 13.5, fontWeight: 600, color: "#cbd5e1", cursor: "pointer" }} title="My profile">{profile?.username || "Account"}</span>
              <Settings size={16} color="#64748b" onClick={() => setSettingsOpen(true)} style={{ cursor: "pointer" }} title="Settings" />
              <LogOut size={16} color="#64748b" onClick={signOut} style={{ cursor: "pointer" }} title="Log out" />
            </div>
          ) : (
            <button onClick={() => setAuthOpen(true)} style={{ marginLeft: 14, background: "#10b981", color: "#04130c", border: "none", borderRadius: 9, padding: "9px 16px", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>
              Log in
            </button>
          )
        )}
      </div>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {page === "markets" && <MarketsPage active={active} notFound={notFound} open={open} watchlist={watchlist} addTicker={addTicker} removeTicker={removeTicker} toggleTicker={toggleTicker} openProfile={openProfile} />}
      {page === "news" && <NewsPage open={open} />}
      {page === "screener" && <ScreenerPage open={open} />}
      {page === "community" && <CommunityPage onOpenTicker={open} onOpenAuth={() => setAuthOpen(true)} onOpenProfile={openProfile} />}
      {page === "profile" && profileUserId && <ProfilePage userId={profileUserId} onOpenTicker={open} onOpenProfile={openProfile} onBack={() => setPage("community")} />}
      {page === "admin" && <AdminDashboard />}

      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "10px 28px 40px", display: "flex", alignItems: "center", gap: 8, color: "#475569", fontSize: 11.5 }}>
        <Info size={13} /> {LIVE
          ? "Live mode — real market data via Finnhub, Alpaca, and Yahoo."
          : "Demo mode — sample data. Set LIVE = true at the top of the file to use the backend."}
      </div>
    </div>
  );
}

function GlobalSearch({ onPick }) {
  const [v, setV] = useState("");
  const [remote, setRemote] = useState([]);

  // Live autocomplete (debounced) when API is set.
  useEffect(() => {
    if (!LIVE || !v.trim()) { setRemote([]); return; }
    const id = setTimeout(() => {
      fetch(`${API_BASE}/api/search?q=${encodeURIComponent(v.trim())}`)
        .then((r) => r.json())
        .then((d) => setRemote(d.results || []))
        .catch(() => setRemote([]));
    }, 220);
    return () => clearTimeout(id);
  }, [v]);

  const bundledMatches = v.trim()
    ? TICKERS.filter((t) => t.includes(v.toUpperCase()) || STOCKS[t].name.toUpperCase().includes(v.toUpperCase()))
        .slice(0, 6).map((t) => ({ ticker: t, name: STOCKS[t].name }))
    : [];
  const matches = (LIVE && remote.length ? remote : bundledMatches).slice(0, 7);

  return (
    <div style={{ position: "relative", width: 340 }}>
      <Search size={16} style={{ position: "absolute", left: 13, top: 11, color: "#475569", zIndex: 2 }} />
      <input value={v} onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && v.trim()) { onPick(v.trim()); setV(""); setRemote([]); } }}
        placeholder="Search any stock — ARTV, NVDA, Tesla…"
        style={{ width: "100%", background: "#11151d", border: "1px solid #232b38", borderRadius: 10, padding: "9px 13px 9px 38px", color: "#e2e8f0", fontSize: 13.5, outline: "none" }} />
      {matches.length > 0 && (
        <div style={{ position: "absolute", top: 42, left: 0, right: 0, background: "#11151d", border: "1px solid #232b38", borderRadius: 10, overflow: "hidden", zIndex: 40 }}>
          {matches.map((m) => (
            <div key={m.ticker} className="row" onClick={() => { onPick(m.ticker); setV(""); setRemote([]); }} style={{ padding: "9px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ fontWeight: 700, color: "#7dd3fc" }}>{m.ticker}</span>
              <span style={{ color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginLeft: 10 }}>{m.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================ MARKETS ============================ */
function MarketsPage({ active, notFound, open, watchlist, addTicker, removeTicker, toggleTicker, openProfile }) {
  const { user } = useAuth();
  const [range, setRange] = useState("1D");
  const [tab, setTab] = useState("news");
  const bundled = STOCKS[active];

  // Live quote (falls back to bundled). Normalized to the bundled field names.
  const liveQuote = useLive(`/api/quote/${active}`, [active]);
  const quoteLoading = liveQuote === undefined;
  const fmtCap = (n) => {
    if (n == null) return "--";
    if (typeof n === "string") return n;
    if (n >= 1e12) return (n / 1e12).toFixed(2) + "T";
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
    return String(n);
  };
  const stock = useMemo(() => {
    if (liveQuote && liveQuote.price != null) {
      const q = liveQuote;
      return {
        name: q.name, ex: q.exchange, price: q.price, change: q.change,
        prevClose: q.prevClose, open: q.open, dayLow: q.dayLow, dayHigh: q.dayHigh,
        lo52: q.wk52Low, hi52: q.wk52High, cap: fmtCap(q.marketCap), vol: q.volume,
        avgVol: q.avgVolume, pe: q.peRatio ?? "--", eps: q.eps, target: q.target,
        beta: q.beta ?? "--", bid: q.bid, ask: q.ask, earn: q.earningsDate,
        ah: q.afterHours, ahChg: q.afterHoursChange,
        events: bundled?.events, // dots still from bundled/events endpoint
        _live: true,
      };
    }
    return bundled;
  }, [liveQuote, bundled]);

  const liveCandles = useLiveHistory(active, range);
  const liveEvents = useLive(`/api/events/${active}`, [active]);
  const series = useMemo(() => {
    // Real data path: map candles into chart points with axis ticks.
    if (Array.isArray(liveCandles) && liveCandles.length) {
      const m = RANGE_META[range] || RANGE_META["1D"];
      const pts = liveCandles.map((c, i) => {
        const d = new Date(c.ts);
        return { i, price: c.price, ts: c.ts, label: axisLabel(d, range), full: fmtTime(d, !!m.intraday) };
      });
      // Attach LIVE events to the nearest candle, but ONLY if the event's date
      // actually falls within this chart's visible time window.
      const evs = (liveEvents && Array.isArray(liveEvents.items)) ? liveEvents.items : [];
      const firstTs = pts[0].ts, lastTs = pts[pts.length - 1].ts;
      const tol = (lastTs - firstTs) * 0.02; // small edge tolerance
      evs.forEach((ev) => {
        if (!ev.ts) return;
        if (ev.ts < firstTs - tol || ev.ts > lastTs + tol) return; // outside window
        let best = 0, bestDiff = Infinity;
        for (let k = 0; k < pts.length; k++) {
          const diff = Math.abs(pts[k].ts - ev.ts);
          if (diff < bestDiff) { bestDiff = diff; best = k; }
        }
        pts[best] = { ...pts[best], event: ev };
      });
      // Fallback: bundled demo events on 1D if no live events
      if (!evs.length && range === "1D" && stock?.events) stock.events.forEach((ev) => {
        const idx = Math.round((ev.posPct ?? 0.5) * (pts.length - 1));
        if (pts[idx]) pts[idx] = { ...pts[idx], event: ev };
      });
      pts._ticks = computeTicks(pts, range);
      return pts;
    }
    // Demo path: synthetic spiky series.
    return stock ? buildSeries(stock, range) : [];
  }, [active, range, stock, liveCandles, liveEvents]);
  const chartLoading = liveCandles === undefined;
  // Y-axis domain that hugs the actual price range, so the line fills the chart
  // instead of looking flat. Pad by ~8% of the high-low spread (min 0.5% of price).
  const yDomain = useMemo(() => {
    const prices = series.map((p) => p.price).filter((v) => typeof v === "number");
    if (!prices.length) return ["dataMin", "dataMax"];
    const lo = Math.min(...prices), hi = Math.max(...prices);
    const spread = hi - lo;
    const pad = Math.max(spread * 0.08, hi * 0.005); // proportional, never zero
    return [+(lo - pad).toFixed(2), +(hi + pad).toFixed(2)];
  }, [series]);
  const changePct = stock ? (stock.change / stock.prevClose) * 100 : 0;
  const up = stock && stock.change >= 0;
  const inWatch = watchlist.includes(active);
  const toggleWatch = () => toggleTicker(active);

  // Per-stock news (live or bundled-filtered).
  const liveNews = useLive(`/api/news/${active}`, [active]);
  const stockNews = useMemo(() => {
    if (liveNews && Array.isArray(liveNews.items)) return liveNews.items;
    const all = Object.values(NEWS).flat();
    const seen = new Set();
    return all.filter((n) => {
      if (!(n.tickers || []).includes(active)) return false;
      if (seen.has(n.title)) return false;
      seen.add(n.title);
      return true;
    });
  }, [active, liveNews]);
  const newsLoading = liveNews === undefined;

  // SEC filings (live or bundled).
  const liveSec = useLive(`/api/sec/${active}`, [active]);
  const filings = (liveSec && Array.isArray(liveSec.items) && liveSec.items.length) ? liveSec.items : (stock ? filingsFor(stock) : []);
  const secLoading = liveSec === undefined;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "232px 1fr", maxWidth: 1320, margin: "0 auto" }}>
      <div style={{ borderRight: "1px solid #161b24", padding: "20px 14px", minHeight: "78vh" }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", color: "#64748b", fontWeight: 700, marginBottom: 12, paddingLeft: 6, display: "flex", justifyContent: "space-between" }}>
          <span>Watchlist</span><span style={{ color: "#334155" }}>{watchlist.length}</span>
        </div>
        {!user && (
          <div style={{ padding: "8px 10px", margin: "0 0 8px", fontSize: 11, color: "#64748b", background: "#0f141c", border: "1px solid #1a2230", borderRadius: 8, lineHeight: 1.5 }}>
            Log in to save your watchlist across devices.
          </div>
        )}
        {watchlist.length === 0 && <div style={{ padding: "10px 8px", fontSize: 12, color: "#475569" }}>Empty — open a stock and tap ★ to add.</div>}
        {watchlist.map((w) => (
          <WatchRow key={w} w={w} active={active} open={open} remove={() => removeTicker(w)} />
        ))}
        <div style={{ marginTop: 22, padding: "14px 12px", background: "#0f141c", borderRadius: 11, border: "1px solid #1a2230" }}>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><Circle size={8} fill="#fbbf24" color="#fbbf24" /> Earnings</div>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><Circle size={8} fill="#60a5fa" color="#60a5fa" /> Analyst rating</div>
          <div style={{ fontSize: 10.5, color: "#475569", marginTop: 10, lineHeight: 1.5 }}>Dots mark events on the price chart (shown on 1D).</div>
        </div>
      </div>

      <div style={{ padding: "24px 28px" }}>
        {notFound && (
          <div style={{ display: "flex", gap: 10, background: "#1f1416", border: "1px solid #4c1d1d", color: "#fca5a5", padding: "14px 18px", borderRadius: 11, fontSize: 14, marginBottom: 18 }}>
            <AlertCircle size={18} /> "{notFound}" isn't in this demo's sample set. Try ARTV, AAPL, NVDA, TSLA, AMZN, MSFT, GOOGL, META, AMD, PLTR, COIN, or SOFI.
          </div>
        )}
        {LIVE && !stock && quoteLoading && (
          <div style={{ padding: "80px 20px", textAlign: "center", color: "#64748b", fontSize: 14 }}>Loading {active}…</div>
        )}
        {LIVE && !stock && liveQuote === false && (
          <div style={{ display: "flex", gap: 10, background: "#1f1416", border: "1px solid #4c1d1d", color: "#fca5a5", padding: "14px 18px", borderRadius: 11, fontSize: 14 }}>
            <AlertCircle size={18} /> Couldn't load "{active}". It may be an invalid symbol, or the backend is unreachable.
          </div>
        )}
        {stock && (<>
          <div style={{ fontSize: 11.5, color: "#64748b", marginBottom: 4, letterSpacing: ".04em" }}>{stock.ex} · Real Time Price · USD</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>{stock.name} <span style={{ color: "#64748b", fontWeight: 600 }}>({active})</span></h1>
            <Star size={20} color={inWatch ? "#fbbf24" : "#475569"} fill={inWatch ? "#fbbf24" : "none"} onClick={toggleWatch} style={{ cursor: "pointer" }} />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 22, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontSize: 38, fontWeight: 700, fontFamily: "'Space Grotesk',sans-serif" }}>{stock.price.toFixed(2)}</span>
              <span style={{ fontSize: 17, fontWeight: 600, color: up ? "#34d399" : "#f87171" }}>{up ? "+" : ""}{stock.change.toFixed(2)} ({up ? "+" : ""}{changePct.toFixed(2)}%)</span>
            </div>
            {stock.ah ? (<div style={{ display: "flex", alignItems: "baseline", gap: 8, opacity: .92 }}>
              <span style={{ fontSize: 23, fontWeight: 600, fontFamily: "'Space Grotesk',sans-serif" }}>{stock.ah.toFixed(2)}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: stock.ahChg >= 0 ? "#34d399" : "#f87171" }}>{stock.ahChg >= 0 ? "+" : ""}{stock.ahChg.toFixed(2)} ({((stock.ahChg/stock.price)*100).toFixed(2)}%)</span>
              <span style={{ fontSize: 11.5, color: "#64748b" }}>After hours</span></div>) : null}
          </div>

          <div style={{ display: "flex", gap: 4, margin: "18px 0 8px" }}>
            {Object.keys(RANGE_META).map((r) => (
              <div key={r} className="pill" onClick={() => setRange(r)} style={{ padding: "6px 13px", borderRadius: 7, fontSize: 13, fontWeight: 600, color: range === r ? "#fff" : "#64748b", background: range === r ? "#1e3a8a" : "transparent" }}>{r}</div>
            ))}
          </div>

          <div style={{ background: "#0a0d13", border: "1px solid #161b24", borderRadius: 14, padding: "16px 8px 8px", marginBottom: 22, position: "relative" }}>
            <div style={{ position: "absolute", top: 12, left: 16, zIndex: 2, fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em", padding: "3px 8px", borderRadius: 6, background: LIVE ? "#0d1f1a" : "#1a1f29", color: LIVE ? "#34d399" : "#64748b", border: `1px solid ${LIVE ? "#16332b" : "#232b38"}` }}>
              {LIVE ? "● LIVE DATA" : "○ DEMO DATA"}
            </div>
            {chartLoading && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#64748b", fontSize: 13, zIndex: 3 }}>Loading real candles…</div>}
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={series} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
                <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={up ? "#10b981" : "#f87171"} stopOpacity={.32} /><stop offset="100%" stopColor={up ? "#10b981" : "#f87171"} stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke="#161b24" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="i" type="number" domain={[0, series.length - 1]} ticks={series._ticks || []} tickFormatter={(idx) => series[idx]?.label ?? ""} tick={{ fill: "#475569", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis orientation="right" domain={yDomain} tick={{ fill: "#475569", fontSize: 11 }} axisLine={false} tickLine={false} width={56} tickFormatter={(v) => v.toFixed(2)} />
                <Tooltip content={<ChartTooltip />} cursor={<Crosshair />} />
                <Area type="linear" dataKey="price" stroke={up ? "#10b981" : "#f87171"} strokeWidth={1.3} fill="url(#g)" dot={<EventDot />} activeDot={{ r: 4, fill: up ? "#10b981" : "#f87171", stroke: "#0b0e14", strokeWidth: 2 }} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", border: "1px solid #161b24", borderRadius: 12, overflow: "hidden", marginBottom: 26 }}>
            {[["Previous Close", fmt(stock.prevClose)], ["Open", fmt(stock.open)], ["Bid", stock.bid], ["Ask", stock.ask],
              ["Day's Range", `${fmt(stock.dayLow)} - ${fmt(stock.dayHigh)}`], ["52 Week Range", `${fmt(stock.lo52)} - ${fmt(stock.hi52)}`], ["Volume", fmt(stock.vol)], ["Avg. Volume", fmt(stock.avgVol)],
              ["Market Cap", stock.cap], ["Beta (5Y)", stock.beta], ["PE Ratio (TTM)", stock.pe], ["EPS (TTM)", fmt(stock.eps)],
              ["Earnings Date", stock.earn], ["Forward Div & Yield", "--"], ["Ex-Dividend Date", "--"], ["1y Target Est", fmt(stock.target)]].map(([k, v], idx) => (
              <div key={k} className="row" style={{ padding: "12px 16px", borderBottom: idx < 12 ? "1px solid #161b24" : "none", borderRight: (idx + 1) % 4 !== 0 ? "1px solid #161b24" : "none" }}>
                <div style={{ fontSize: 11.5, color: "#64748b", marginBottom: 4 }}>{k}</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{v}</div>
              </div>))}
          </div>

          <div style={{ display: "flex", gap: 6, marginBottom: 14, borderBottom: "1px solid #161b24" }}>
            {[["news", "News", Newspaper], ["sec", "SEC Filings", FileText], ["events", "Live Events", Landmark], ["community", "Community", MessageSquare]].map(([id, label, Icon]) => (
              <div key={id} onClick={() => setTab(id)} style={{ padding: "10px 16px", cursor: "pointer", fontSize: 14, fontWeight: 600, color: tab === id ? "#10b981" : "#64748b", borderBottom: tab === id ? "2px solid #10b981" : "2px solid transparent", display: "flex", alignItems: "center", gap: 7, marginBottom: -1 }}><Icon size={15} /> {label}</div>
            ))}
          </div>

          {tab === "news" && newsLoading && <div style={{ padding: "30px 14px", textAlign: "center", color: "#64748b", fontSize: 13 }}>Loading {active} news…</div>}
          {tab === "news" && !newsLoading && stockNews.length > 0 && stockNews.map((n, i) => <ArticleRow key={i} n={n} />)}
          {tab === "news" && !newsLoading && stockNews.length === 0 && (
            <div style={{ padding: "30px 14px", textAlign: "center", color: "#64748b", fontSize: 13 }}>
              No recent {active}-specific articles{LIVE ? "" : " in this demo set"}. Check the <b style={{ color: "#94a3b8" }}>News</b> tab up top for the full market feed.
            </div>
          )}
          {tab === "sec" && secLoading && <div style={{ padding: "30px 14px", textAlign: "center", color: "#64748b", fontSize: 13 }}>Loading filings…</div>}
          {tab === "sec" && !secLoading && filings.map((f, i) => (
            <a key={i} href={f.url} target="_blank" rel="noreferrer" className="row" style={{ display: "flex", gap: 12, padding: "14px", borderBottom: "1px solid #11151d", borderRadius: 9, alignItems: "flex-start" }}>
              <div style={{ background: "#1e293b", color: "#7dd3fc", fontSize: 11, fontWeight: 700, padding: "4px 9px", borderRadius: 6, flexShrink: 0 }}>{f.form}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>{f.title}<ExternalLink size={13} color="#475569" /></div>
                {f.summary && <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.5, marginBottom: 5 }}>{f.summary}</div>}
                <div style={{ fontSize: 11.5, color: "#64748b" }}>Filed {f.date}</div>
              </div>
            </a>
          ))}
          {tab === "events" && eventsFor(stock).map((ev, i) => <EventRow key={i} ev={ev} />)}
          {tab === "community" && <TickerPosts ticker={active} onOpenTicker={open} onOpenProfile={openProfile} />}
        </>)}
      </div>
    </div>
  );
}

function WatchRow({ w, active, open, remove }) {
  const live = useLive(`/api/quote/${w}`, [w]);
  const bundled = STOCKS[w];
  let pct = null;
  if (live && live.changePct != null) pct = live.changePct;
  else if (bundled) pct = (bundled.change / bundled.prevClose) * 100;
  return (
    <div className="wl" style={{ padding: "9px 12px", borderRadius: 9, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2, cursor: "pointer", background: active === w ? "#161b24" : "transparent" }}>
      <span onClick={() => open(w)} style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{w}</span>
      {pct != null && <span style={{ fontSize: 12, fontWeight: 600, color: pct >= 0 ? "#34d399" : "#f87171", marginRight: 8 }}>{pct >= 0 ? "+" : ""}{pct.toFixed(1)}%</span>}
      <X size={13} color="#475569" onClick={remove} />
    </div>
  );
}
function ArticleRow({ n }) {
  return (
    <a href={n.url} target="_blank" rel="noreferrer" className="row card" style={{ display: "flex", gap: 12, padding: "14px", borderBottom: "1px solid #11151d", borderRadius: 9, cursor: "pointer" }}>
      <div style={{ width: 4, borderRadius: 4, background: sentColor(n.sentiment), flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 4, color: "#e2e8f0", display: "flex", alignItems: "center", gap: 6 }}>{n.title}<ExternalLink size={13} color="#475569" /></div>
        {n.summary && <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.5, marginBottom: 6 }}>{n.summary}</div>}
        <div style={{ fontSize: 11.5, color: "#64748b", display: "flex", alignItems: "center", gap: 6 }}><Globe size={11} /> {n.source}{n.time ? ` · ${n.time}` : ""}</div>
      </div>
    </a>
  );
}
function EventRow({ ev }) {
  const colors = { earnings: "#fbbf24", congress: "#a78bfa", regulatory: "#f472b6", conference: "#60a5fa", macro: "#34d399" };
  const c = colors[ev.type] || "#94a3b8";
  return (
    <div className="row" style={{ display: "flex", gap: 12, padding: "14px", borderBottom: "1px solid #11151d", borderRadius: 9 }}>
      <Calendar size={17} color={c} style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14.5, fontWeight: 600 }}>{ev.event}</span>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: c, background: `${c}22`, padding: "2px 7px", borderRadius: 5 }}>{ev.type}</span>
          {ev.impact === "high" && <span style={{ fontSize: 10, fontWeight: 700, color: "#f87171" }}>● HIGH IMPACT</span>}
        </div>
        <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.5, marginBottom: 5 }}>{ev.summary}</div>
        <div style={{ fontSize: 11.5, color: "#64748b" }}>{ev.date}</div>
      </div>
    </div>
  );
}

/* ============================ NEWS ============================ */
function NewsPage({ open }) {
  const [cat, setCat] = useState("Top Stories");
  const live = useLive(`/api/news`, []);
  const liveLoading = live === undefined;
  // Live feed is a single market stream; bundled has categories. When live,
  // we show the live items for every category (Yahoo doesn't split by these).
  const items = (live && Array.isArray(live.items) && live.items.length) ? live.items : (NEWS[cat] || []);
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "26px 28px" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 18px", letterSpacing: "-.02em", display: "flex", alignItems: "center", gap: 10 }}><Newspaper size={24} color="#10b981" /> Market News</h1>
      <div className="scrollx" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 14, marginBottom: 8 }}>
        {NEWS_CATS.map((c) => (
          <div key={c} className="pill" onClick={() => setCat(c)} style={{ whiteSpace: "nowrap", padding: "7px 15px", borderRadius: 999, fontSize: 13, fontWeight: 600, border: "1px solid", borderColor: cat === c ? "#10b981" : "#232b38", color: cat === c ? "#10b981" : "#94a3b8", background: cat === c ? "#0d1f1a" : "#11151d" }}>{c}</div>
        ))}
      </div>
      {liveLoading && <div style={{ padding: "40px", textAlign: "center", color: "#64748b", fontSize: 14 }}>Loading market news…</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {items.map((n, i) => (
          <a key={i} href={n.url} target="_blank" rel="noreferrer" className="card" style={{ display: "block", background: "#0f141c", border: "1px solid #1a2230", borderRadius: 13, padding: "16px", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: sentColor(n.sentiment) }} />
              <span style={{ fontSize: 11.5, color: "#64748b", fontWeight: 600 }}>{n.source}</span>
              {n.time && <span style={{ fontSize: 11.5, color: "#475569" }}>· {n.time}</span>}
              <ExternalLink size={12} color="#475569" style={{ marginLeft: "auto" }} />
            </div>
            <div style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.35, marginBottom: 8, color: "#e2e8f0" }}>{n.title}</div>
            {n.summary && <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.55, marginBottom: 11 }}>{n.summary}</div>}
            {(n.tickers || []).length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                {n.tickers.slice(0, 4).map((t) => (
                  <span key={t} onClick={(e) => { e.preventDefault(); open(t); }} style={{ fontSize: 11.5, fontWeight: 700, color: "#7dd3fc", background: "#11202b", padding: "3px 9px", borderRadius: 6, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}><ArrowUpRight size={11} /> {t}</span>
                ))}
              </div>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}

/* ============================ SCREENER ============================ */
const SCREENER_CATS = [
  "All stocks","Top gainers","Biggest losers","Large-cap","Small-cap","Largest employers",
  "High-dividend","Highest net income","Highest cash","Highest profit per employee",
  "Highest revenue per employee","Most active","Pre-market gainers","Pre-market losers",
  "Pre-market most active","Pre-market gap","After-hours gainers","After-hours losers",
  "After-hours most active","Unusual volume","Most volatile","High beta","Best performing",
  "Highest revenue","Most expensive","Penny stocks","Pink sheet","Overbought","Oversold",
  "All-time high","All-time low","52-week high","52-week low",
];
function ScreenerPage({ open }) {
  const [cat, setCat] = useState("Top gainers");
  const live = useLive(`/api/screener?cat=${encodeURIComponent(cat)}`, [cat]);
  const liveLoading = live === undefined;
  const fmtCap = (n) => {
    if (n == null) return "--";
    if (typeof n === "string") return n;
    if (n >= 1e12) return (n / 1e12).toFixed(2) + "T";
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
    return String(n);
  };
  const rows = useMemo(() => {
    if (live && Array.isArray(live.rows) && live.rows.length) {
      return live.rows.map((r) => ({
        ticker: r.ticker, name: r.name, price: r.price, changePct: r.changePct,
        cap: fmtCap(r.marketCap), vol: r.volume || 0, _note: "",
      }));
    }
    return screen(cat); // bundled fallback (already has cap/vol/_note)
  }, [cat, live]);
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "26px 28px" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 16px", letterSpacing: "-.02em", display: "flex", alignItems: "center", gap: 10 }}><Filter size={23} color="#10b981" /> Stock Screener</h1>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
        {SCREENER_CATS.map((c) => (
          <div key={c} className="pill" onClick={() => setCat(c)} style={{ padding: "7px 15px", borderRadius: 999, fontSize: 13, fontWeight: 600, border: "1px solid", borderColor: cat === c ? "transparent" : "#232b38", color: cat === c ? "#0b0e14" : "#cbd5e1", background: cat === c ? "#f8fafc" : "#1a1f29" }}>{c}</div>
        ))}
      </div>
      {liveLoading && <div style={{ padding: "40px", textAlign: "center", color: "#64748b", fontSize: 14 }}>Screening {cat}…</div>}
      <div style={{ border: "1px solid #161b24", borderRadius: 13, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 110px 100px 120px 110px 1.4fr", padding: "11px 18px", background: "#0f141c", fontSize: 11.5, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em" }}>
          <span>Symbol</span><span>Name</span><span style={{ textAlign: "right" }}>Price</span><span style={{ textAlign: "right" }}>Change</span><span style={{ textAlign: "right" }}>Mkt Cap</span><span style={{ textAlign: "right" }}>Volume</span><span style={{ paddingLeft: 16 }}>Note</span>
        </div>
        {!liveLoading && rows.length === 0 && <div style={{ padding: 28, textAlign: "center", color: "#64748b", fontSize: 13 }}>No stocks match "{cat}"{LIVE ? "" : " in this demo set"}.</div>}
        {rows.map((r, i) => {
          const up = (r.changePct || 0) >= 0;
          return (
            <div key={i} className="row" onClick={() => open(r.ticker)} style={{ display: "grid", gridTemplateColumns: "90px 1fr 110px 100px 120px 110px 1.4fr", padding: "12px 18px", borderTop: "1px solid #11151d", fontSize: 13.5, alignItems: "center", cursor: "pointer" }}>
              <span style={{ fontWeight: 700, color: "#7dd3fc" }}>{r.ticker}</span>
              <span style={{ color: "#cbd5e1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 10 }}>{r.name}</span>
              <span style={{ textAlign: "right", fontWeight: 600 }}>${fmt(r.price)}</span>
              <span style={{ textAlign: "right", fontWeight: 600, color: up ? "#34d399" : "#f87171" }}>{up ? "+" : ""}{(r.changePct || 0).toFixed(2)}%</span>
              <span style={{ textAlign: "right", color: "#94a3b8" }}>{r.cap}</span>
              <span style={{ textAlign: "right", color: "#94a3b8" }}>{r.vol ? (r.vol/1e6).toFixed(1) + "M" : "--"}</span>
              <span style={{ paddingLeft: 16, color: "#64748b", fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r._note}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
