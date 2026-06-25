// src/community/postUtils.js
// Pure helpers for community posts: extract $TICKERS, block links, detect spam.
// Kept separate so they're easy to test and reuse.

// Extract unique $TICKER symbols from text. Matches $ followed by 1-5 letters.
// e.g. "$ARTV and $aapl" -> ["ARTV","AAPL"]
export function extractTickers(text) {
  const matches = text.match(/\$[A-Za-z]{1,5}\b/g) || [];
  const set = new Set(matches.map((m) => m.slice(1).toUpperCase()));
  return [...set];
}

// Does the text contain a URL / link? We block these in posts.
// Catches http(s)://, www., and bare domains like "site.com/path".
export function containsLink(text) {
  const patterns = [
    /https?:\/\//i,
    /www\.[a-z0-9-]+\.[a-z]{2,}/i,
    /\b[a-z0-9-]+\.(com|net|org|io|co|gg|ly|me|app|xyz|info|biz|tv|link|click|to|us|uk|ca|de|ru|cn)(\/|\b)/i,
  ];
  return patterns.some((re) => re.test(text));
}

// Spam / repetition detection. Returns { spam: boolean, reason: string }.
// Catches: the same word/phrase repeated many times (e.g. "BUY ARTV" x10),
// very low word diversity, and walls of a single repeated character.
export function detectSpam(text) {
  const clean = text.trim();
  if (!clean) return { spam: true, reason: "Post is empty." };

  const words = clean.toLowerCase().split(/\s+/).filter(Boolean);

  // 1) Low unique-word ratio over a reasonable length (repeated phrases).
  if (words.length >= 6) {
    const unique = new Set(words).size;
    const ratio = unique / words.length;
    if (ratio < 0.4) return { spam: true, reason: "Looks like repeated/spammy text." };
  }

  // 2) Same 1-3 word phrase repeated back-to-back many times.
  //    e.g. "buy artv buy artv buy artv ..."
  for (let phraseLen = 1; phraseLen <= 3; phraseLen++) {
    if (words.length < phraseLen * 4) continue;
    let maxRun = 1, run = 1;
    for (let i = phraseLen; i + phraseLen <= words.length; i += phraseLen) {
      const a = words.slice(i - phraseLen, i).join(" ");
      const b = words.slice(i, i + phraseLen).join(" ");
      if (a === b) { run++; maxRun = Math.max(maxRun, run); } else { run = 1; }
    }
    if (maxRun >= 4) return { spam: true, reason: "Repeated phrase detected." };
  }

  // 3) A single character repeated a lot (e.g. "aaaaaaaaaa" or "!!!!!!!!!!").
  if (/(.)\1{9,}/.test(clean)) return { spam: true, reason: "Excessive repeated characters." };

  // 4) ALL CAPS wall over a length.
  const letters = clean.replace(/[^a-z]/gi, "");
  if (letters.length > 20 && letters === letters.toUpperCase() && /[A-Z]/.test(letters)) {
    return { spam: true, reason: "Please don't post in all caps." };
  }

  return { spam: false, reason: "" };
}

// Split a post body into renderable parts, turning $TICKERS into link tokens.
// Returns an array of { type: 'text'|'ticker', value } for the renderer.
export function tokenizePost(text) {
  const parts = [];
  const re = /\$[A-Za-z]{1,5}\b/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: "text", value: text.slice(last, m.index) });
    parts.push({ type: "ticker", value: m[0].slice(1).toUpperCase() });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return parts;
}
