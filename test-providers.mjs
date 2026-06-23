// test-providers.mjs
// Quick check that your keys work and the field mappings look right.
// Usage (after putting keys in .env or exporting them):
//   node --env-file=.env test-providers.mjs AAPL
// or:
//   FINNHUB_KEY=xxx ALPACA_KEY_ID=xxx ALPACA_SECRET_KEY=xxx node test-providers.mjs AAPL

import { getQuote, getHistory, getNews, getFilings, search, providerStatus } from "./providers/index.js";

const symbol = (process.argv[2] || "AAPL").toUpperCase();

function show(label, obj) {
  console.log("\n===== " + label + " =====");
  console.log(JSON.stringify(obj, null, 2)?.slice(0, 1500));
}

console.log("Providers configured:", providerStatus());

try {
  const q = await getQuote(symbol);
  show(`QUOTE ${symbol} (source: ${q._source})`, q);
} catch (e) { console.log("QUOTE failed:", e.message); }

try {
  const h = await getHistory(symbol, "1Y");
  console.log(`\n===== HISTORY ${symbol} 1Y =====`);
  console.log("points:", h.length, "| first:", h[0], "| last:", h[h.length - 1]);
  const lows = h.map((c) => c.low ?? c.price);
  console.log("min price in window:", Math.min(...lows).toFixed(2));
} catch (e) { console.log("HISTORY failed:", e.message); }

try { show(`NEWS ${symbol} (first 2)`, (await getNews(symbol)).slice(0, 2)); }
catch (e) { console.log("NEWS failed:", e.message); }

try { show(`FILINGS ${symbol} (first 2)`, (await getFilings(symbol)).slice(0, 2)); }
catch (e) { console.log("FILINGS failed:", e.message); }

try { show(`SEARCH "apple" (first 3)`, (await search("apple")).slice(0, 3)); }
catch (e) { console.log("SEARCH failed:", e.message); }

console.log("\nDone. If a section shows empty fields, check its mapping in providers/index.js");
