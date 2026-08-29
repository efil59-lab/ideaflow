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

const decode = (s = "") =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").trim();

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

  try {
    // TikTok has a public, reliable oEmbed — use it before scraping.
    if (plat.p === "tiktok") {
      const r = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
        { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6000) });
      if (r.ok) {
        const d = await r.json();
        return json({ ...fallback, title: decode(d.title || ""), image: d.thumbnail_url || "", author: d.author_name || "" });
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
const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json", "Cache-Control": "s-maxage=86400" } });
