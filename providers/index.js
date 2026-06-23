// providers/index.js
// Multi-provider data layer. Each function tries the best provider for that
// data type, then falls back to the next. Configure keys via environment vars:
//   FINNHUB_KEY        — Finnhub (quotes, news, filings, search; 60 req/min free)
//   ALPACA_KEY_ID      — Alpaca (historical bars; 200 req/min free)
//   ALPACA_SECRET_KEY
// If no keys are set, everything falls back to Yahoo (unofficial, no key).

import YahooFinance from "yahoo-finance2";
const yf = new YahooFinance();

const FINNHUB_KEY = process.env.FINNHUB_KEY || "";
const ALPACA_KEY_ID = process.env.ALPACA_KEY_ID || "";
const ALPACA_SECRET_KEY = process.env.ALPACA_SECRET_KEY || "";

const FINNHUB = "https://finnhub.io/api/v1";
const ALPACA_DATA = "https://data.alpaca.markets/v2";

async function getJSON(url, headers = {}) {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

/* ---------------- QUOTE ---------------- */
// Finnhub: /quote + /stock/profile2 + /stock/metric give us everything.
export async function getQuote(symbol) {
  if (FINNHUB_KEY) {
    try {
      const [q, profile, metric] = await Promise.all([
        getJSON(`${FINNHUB}/quote?symbol=${symbol}&token=${FINNHUB_KEY}`),
        getJSON(`${FINNHUB}/stock/profile2?symbol=${symbol}&token=${FINNHUB_KEY}`).catch(() => ({})),
        getJSON(`${FINNHUB}/stock/metric?symbol=${symbol}&metric=all&token=${FINNHUB_KEY}`).catch(() => ({ metric: {} })),
      ]);
      if (q && q.c) {
        const m = metric.metric || {};
        return {
          ticker: symbol,
          name: profile.name || symbol,
          exchange: profile.exchange || "",
          price: q.c,
          change: q.d,
          changePct: q.dp,
          afterHours: null, afterHoursChange: null, afterHoursPct: null,
          prevClose: q.pc, open: q.o, dayLow: q.l, dayHigh: q.h,
          bid: "--", ask: "--",
          wk52Low: m["52WeekLow"] ?? null, wk52High: m["52WeekHigh"] ?? null,
          marketCap: profile.marketCapitalization ? profile.marketCapitalization * 1e6 : null,
          volume: null,
          avgVolume: m["10DayAverageTradingVolume"] ? m["10DayAverageTradingVolume"] * 1e6 : null,
          peRatio: m.peTTM ? m.peTTM.toFixed(2) : "--",
          eps: m.epsTTM ?? null,
          target: null,
          beta: m.beta ? m.beta.toFixed(2) : "--",
          earningsDate: "--",
          _source: "finnhub",
        };
      }
    } catch (e) { /* fall through to Yahoo */ }
  }
  // Yahoo fallback
  try {
    const q = await yf.quote(symbol);
    if (q && q.regularMarketPrice != null) {
      return {
        ticker: q.symbol, name: q.longName || q.shortName, exchange: q.fullExchangeName,
        price: q.regularMarketPrice, change: q.regularMarketChange, changePct: q.regularMarketChangePercent,
        afterHours: q.postMarketPrice ?? null, afterHoursChange: q.postMarketChange ?? null, afterHoursPct: q.postMarketChangePercent ?? null,
        prevClose: q.regularMarketPreviousClose, open: q.regularMarketOpen,
        dayLow: q.regularMarketDayLow, dayHigh: q.regularMarketDayHigh,
        bid: q.bid != null ? `${q.bid} x ${q.bidSize ?? 0}` : "--",
        ask: q.ask != null ? `${q.ask} x ${q.askSize ?? 0}` : "--",
        wk52Low: q.fiftyTwoWeekLow, wk52High: q.fiftyTwoWeekHigh, marketCap: q.marketCap,
        volume: q.regularMarketVolume, avgVolume: q.averageDailyVolume3Month,
        peRatio: q.trailingPE ?? "--", eps: q.epsTrailingTwelveMonths ?? null, target: q.targetMeanPrice ?? null,
        beta: q.beta ?? "--", earningsDate: q.earningsTimestamp ? new Date(q.earningsTimestamp).toDateString() : "--",
        _source: "yahoo",
      };
    }
  } catch (e) { /* fall through to error below */ }
  throw new Error("not found");
}

/* ---------------- HISTORY (chart candles) ---------------- */
// Alpaca has the best free throughput for bars (200/min). Map our ranges to
// Alpaca timeframe + start. Fall back to Yahoo chart if Alpaca isn't configured.
const ALPACA_RANGE = {
  "1D":  { timeframe: "5Min",  days: 1 },
  "5D":  { timeframe: "15Min", days: 5 },
  "1M":  { timeframe: "1Day",  days: 31 },
  "6M":  { timeframe: "1Day",  days: 186 },
  "YTD": { timeframe: "1Day",  days: null }, // computed to Jan 1
  "1Y":  { timeframe: "1Day",  days: 366 },
  "5Y":  { timeframe: "1Week", days: 5 * 366 },
  "All": { timeframe: "1Month", days: 30 * 366 },
};
const YF_RANGE = {
  "1D": { interval: "2m", days: 1 }, "5D": { interval: "15m", days: 5 },
  "1M": { interval: "1d", days: 31 }, "6M": { interval: "1d", days: 186 },
  "YTD": { interval: "1d", days: null }, "1Y": { interval: "1d", days: 366 },
  "5Y": { interval: "1wk", days: 5 * 366 }, "All": { interval: "1mo", days: 30 * 366 },
};
function startDate(days) {
  if (days == null) return new Date(new Date().getFullYear(), 0, 1); // YTD
  return new Date(Date.now() - days * 24 * 3600e3);
}

export async function getHistory(symbol, range) {
  // Try Alpaca first (200 req/min, clean bars). The free plan uses the IEX feed.
  if (ALPACA_KEY_ID && ALPACA_SECRET_KEY) {
    const cfg = ALPACA_RANGE[range] || ALPACA_RANGE["1Y"];
    const start = startDate(cfg.days).toISOString();
    const headers = {
      "APCA-API-KEY-ID": ALPACA_KEY_ID,
      "APCA-API-SECRET-KEY": ALPACA_SECRET_KEY,
    };
    // The free plan only allows the IEX feed; paginate in case of multiple pages.
    try {
      let pageToken = null, bars = [], guard = 0;
      do {
        const u = `${ALPACA_DATA}/stocks/${symbol}/bars?timeframe=${cfg.timeframe}`
          + `&start=${start}&limit=10000&adjustment=split&feed=iex`
          + (pageToken ? `&page_token=${encodeURIComponent(pageToken)}` : "");
        const data = await getJSON(u, headers);
        if (Array.isArray(data.bars)) bars = bars.concat(data.bars);
        pageToken = data.next_page_token || null;
      } while (pageToken && ++guard < 5);
      if (bars.length) {
        return bars.map((b) => ({
          ts: new Date(b.t).getTime(), price: +b.c.toFixed(2),
          open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v,
        }));
      }
      // empty -> fall through to Yahoo
    } catch (e) { /* fall through to Yahoo */ }
  }
  // Yahoo fallback (more complete coverage; good for charts when Alpaca is thin)
  try {
    const cfg = YF_RANGE[range] || YF_RANGE["1Y"];
    const result = await yf.chart(symbol, { period1: startDate(cfg.days), interval: cfg.interval });
    const out = (result?.quotes || []).filter((q) => q.close != null).map((q) => ({
      ts: new Date(q.date).getTime(), price: +q.close.toFixed(2),
      open: q.open, high: q.high, low: q.low, close: q.close, volume: q.volume,
    }));
    if (out.length) return out;
  } catch (e) { /* fall through */ }
  // Nothing worked: return empty so the frontend can show its own state.
  return [];
}

/* ---------------- NEWS (per symbol) ---------------- */
export async function getNews(symbol) {
  if (FINNHUB_KEY) {
    try {
      const to = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - 14 * 24 * 3600e3).toISOString().slice(0, 10);
      const arr = await getJSON(`${FINNHUB}/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${FINNHUB_KEY}`);
      if (Array.isArray(arr) && arr.length) {
        return arr.slice(0, 12).map((n) => ({
          title: n.headline, source: n.source,
          time: n.datetime ? new Date(n.datetime * 1000).toLocaleString() : "",
          summary: n.summary || "", url: n.url, tickers: [symbol],
        }));
      }
    } catch (e) { /* fall through */ }
  }
  const r = await yf.search(symbol, { newsCount: 12, quotesCount: 0 });
  return (r.news || []).map((n) => ({
    title: n.title, source: n.publisher,
    time: n.providerPublishTime ? new Date(n.providerPublishTime).toLocaleString() : "",
    url: n.link, tickers: n.relatedTickers || [symbol],
  }));
}

/* ---------------- MARKET NEWS (general) ---------------- */
export async function getMarketNews() {
  if (FINNHUB_KEY) {
    try {
      const arr = await getJSON(`${FINNHUB}/news?category=general&token=${FINNHUB_KEY}`);
      if (Array.isArray(arr) && arr.length) {
        return arr.slice(0, 24).map((n) => ({
          title: n.headline, source: n.source,
          time: n.datetime ? new Date(n.datetime * 1000).toLocaleString() : "",
          summary: n.summary || "", url: n.url, tickers: n.related ? n.related.split(",").filter(Boolean).slice(0, 4) : [],
        }));
      }
    } catch (e) { /* fall through */ }
  }
  const r = await yf.search("stock market", { newsCount: 20, quotesCount: 0 });
  return (r.news || []).map((n) => ({
    title: n.title, source: n.publisher,
    time: n.providerPublishTime ? new Date(n.providerPublishTime).toLocaleString() : "",
    url: n.link, tickers: n.relatedTickers || [],
  }));
}

/* ---------------- SEC FILINGS ---------------- */
export async function getFilings(symbol) {
  if (FINNHUB_KEY) {
    try {
      const arr = await getJSON(`${FINNHUB}/stock/filings?symbol=${symbol}&token=${FINNHUB_KEY}`);
      if (Array.isArray(arr) && arr.length) {
        return arr.slice(0, 8).map((f) => ({
          form: f.form, title: f.form + " filing", date: f.filedDate ? f.filedDate.slice(0, 10) : "",
          summary: f.accessNumber ? `Access #${f.accessNumber}` : "", url: f.reportUrl || f.filingUrl,
        }));
      }
    } catch (e) { /* fall through */ }
  }
  const r = await yf.quoteSummary(symbol, { modules: ["secFilings"] }).catch(() => ({}));
  return (r?.secFilings?.filings || []).map((f) => ({
    form: f.type, title: f.title, date: f.date,
    url: (f.exhibits && f.exhibits[0]?.url) || "https://www.sec.gov/cgi-bin/browse-edgar",
  }));
}

/* ---------------- ANALYST EVENTS (for chart dots) ---------------- */
// Finnhub free tier gives recommendation trends + price target (aggregated,
// not individual notes). We return dots the chart can plot, each with a
// "source" link to a public ratings page so users can verify.
export async function getAnalystEvents(symbol) {
  const out = [];
  if (FINNHUB_KEY) {
    try {
      const [recs, pt] = await Promise.all([
        getJSON(`${FINNHUB}/stock/recommendation?symbol=${symbol}&token=${FINNHUB_KEY}`).catch(() => []),
        getJSON(`${FINNHUB}/stock/price-target?symbol=${symbol}&token=${FINNHUB_KEY}`).catch(() => ({})),
      ]);
      // Most recent recommendation snapshot becomes an "analyst" dot.
      if (Array.isArray(recs) && recs.length) {
        const latest = recs[0]; // Finnhub returns newest first
        const total = (latest.strongBuy || 0) + (latest.buy || 0) + (latest.hold || 0) + (latest.sell || 0) + (latest.strongSell || 0);
        const bullish = (latest.strongBuy || 0) + (latest.buy || 0);
        const consensus = bullish > total / 2 ? "Buy" : (latest.hold || 0) >= bullish ? "Hold" : "Sell";
        out.push({
          kind: "analyst",
          ts: latest.period ? new Date(latest.period).getTime() : Date.now(),
          firm: `${total} analysts`,
          rating: consensus,
          target: pt?.targetMean ?? null,
          targetHigh: pt?.targetHigh ?? null,
          targetLow: pt?.targetLow ?? null,
          breakdown: { strongBuy: latest.strongBuy, buy: latest.buy, hold: latest.hold, sell: latest.sell, strongSell: latest.strongSell },
          // public verification page (real source the user can open)
          source: `https://www.marketbeat.com/stocks/NASDAQ/${symbol}/price-target/`,
        });
      }
    } catch (e) { /* fall through to empty */ }
  }
  return out;
}


/* ---------------- SEARCH ---------------- */
export async function search(q) {
  if (FINNHUB_KEY) {
    try {
      const r = await getJSON(`${FINNHUB}/search?q=${encodeURIComponent(q)}&token=${FINNHUB_KEY}`);
      if (r && Array.isArray(r.result) && r.result.length) {
        return r.result
          .filter((x) => x.symbol && !x.symbol.includes(".") && x.type === "Common Stock")
          .slice(0, 8)
          .map((x) => ({ ticker: x.symbol, name: x.description, exchange: x.displaySymbol }));
      }
    } catch (e) { /* fall through */ }
  }
  const r = await yf.search(q, { quotesCount: 8, newsCount: 0 });
  return (r.quotes || []).filter((x) => x.symbol && (x.shortname || x.longname))
    .map((x) => ({ ticker: x.symbol, name: x.longname || x.shortname, exchange: x.exchDisp }));
}

/* ---------------- SCREENER ---------------- */
// Finnhub has no general screener on free tier; Yahoo's predefined screeners
// power the category pills.
const SCREEN_MAP = {
  "Top gainers": "day_gainers", "Biggest losers": "day_losers", "Most active": "most_actives",
  "Small-cap": "small_cap_gainers", "Overbought": "day_gainers", "Oversold": "day_losers",
  "52-week high": "day_gainers", "52-week low": "day_losers",
};
export async function getScreener(cat) {
  const scrId = SCREEN_MAP[cat] || "day_gainers";
  const r = await yf.screener({ scrIds: scrId, count: 25 });
  return (r?.quotes || []).map((q) => ({
    ticker: q.symbol, name: q.shortName || q.longName, price: q.regularMarketPrice,
    changePct: q.regularMarketChangePercent, marketCap: q.marketCap, volume: q.regularMarketVolume,
  }));
}

export function providerStatus() {
  return {
    finnhub: !!FINNHUB_KEY,
    alpaca: !!(ALPACA_KEY_ID && ALPACA_SECRET_KEY),
    yahooFallback: true,
  };
}
