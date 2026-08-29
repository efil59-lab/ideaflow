export const config = { runtime: "edge" };

// Resolve a shared social link into a human title (+ thumbnail + platform), so
// a pasted Instagram / TikTok / Facebook / YouTube URL is saved as a readable
// card instead of a bare address. Best-effort: on any failure we still return a
// usable title (the platform name or the host), never an error the UI must handle.

const HOSTS = [
  { p: "instagram", re: /(^|\.)instagram\.com$/i, label: "Instagram" },
  { p: "tiktok", re: /(^|\.)tiktok\.com$/i, label: "TikTok" },
  { p: "facebook", re: /(^|\.)(facebook\.com|fb\.watch|fb\.me)$/i, label: "Facebook" },
  { p: "youtube", re: /(^|\.)(youtube\.com|youtu\.be)$/i, label: "YouTube" },
  { p: "x", re: /(^|\.)(x\.com|twitter\.com)$/i, label: "X" },
];

const platformOf = (host) => HOSTS.find((h) => h.re.test(host)) || { p: "link", label: host };

// Full HTML-entity decode. Instagram/Facebook return og:title with the Hebrew
// letters and emoji as NUMERIC entities (&#x5db; &#x1f4e9; …); without this the
// title saved as gibberish. fromCodePoint handles astral emoji (> 0xFFFF).
const cp = (n) => { try { return String.fromCodePoint(n); } catch { return ""; } };
const decode = (s = "") =>
  (s || "")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => cp(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => cp(parseInt(d, 10)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();

const meta = (html, prop) => {
  // property="og:title" or name="twitter:title", attribute order-independent.
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, "i");
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, "i");
  const m = html.match(re) || html.match(re2);
  return m ? decode(m[1]) : "";
};

export default async function handler(req) {
  const url = new URL(req.url).searchParams.get("url");
  if (!url || !/^https?:\/\//i.test(url)) {
    return json({ error: "bad url" }, 400);
  }

  let host = "";
  try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { /* keep empty */ }
  const plat = platformOf(host);
  const fallback = { url, title: "", image: "", author: "", platform: plat.p, site: plat.label };

  // Public, reliable oEmbed endpoints — no consent wall, real title + thumbnail.
  const OEMBED = {
    tiktok: (u) => `https://www.tiktok.com/oembed?url=${encodeURIComponent(u)}`,
    youtube: (u) => `https://www.youtube.com/oembed?url=${encodeURIComponent(u)}&format=json`,
  };

  try {
    if (OEMBED[plat.p]) {
      const r = await fetch(OEMBED[plat.p](url),
        { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6000) });
      if (r.ok) {
        const d = await r.json();
        const title = decode(d.title || "");
        // TikTok's generic "TikTok - Make Your Day" means the URL didn't resolve
        // to a real post — fall through to a scrape rather than save the filler.
        if (title && !/^tiktok - make your day$/i.test(title)) {
          return json({ ...fallback, title, image: d.thumbnail_url || "", author: d.author_name || "" });
        }
      }
    }

    const r = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "he,en;q=0.8" },
      redirect: "follow",
      signal: AbortSignal.timeout(7000),
    });
    const html = (await r.text()).slice(0, 400_000);
    const title = meta(html, "og:title") || meta(html, "twitter:title")
      || decode((html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || "");
    const image = meta(html, "og:image") || meta(html, "twitter:image");
    return json({ ...fallback, title, image });
  } catch {
    return json(fallback);
  }
}

const UA = "Mozilla/5.0 (compatible; IdeaFlowBot/1.0; +https://ideaflow-lemon.vercel.app)";
// Cache a resolved title for a day; cache a miss for only two minutes, so a
// temporary block (consent wall, rate limit) can succeed on the next save
// instead of being pinned to the platform-name fallback for 24h.
const json = (o, status = 200) => {
  const secs = o && o.title ? 86400 : 120;
  return new Response(JSON.stringify(o), {
    status, headers: { "Content-Type": "application/json", "Cache-Control": `s-maxage=${secs}` },
  });
};
