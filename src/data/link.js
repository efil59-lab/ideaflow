// Social-link helpers: recognise a pasted Instagram / TikTok / Facebook / … URL
// and turn it into a titled card. The server (api/link-title) does the fetching;
// here we only classify and normalise, so the UI stays instant.

const HOSTS = [
  { p: "instagram", re: /(^|\.)instagram\.com$/i, label: "Instagram", color: "#E1306C" },
  { p: "tiktok", re: /(^|\.)tiktok\.com$/i, label: "TikTok", color: "#000000" },
  { p: "facebook", re: /(^|\.)(facebook\.com|fb\.watch|fb\.me)$/i, label: "Facebook", color: "#1877F2" },
  { p: "youtube", re: /(^|\.)(youtube\.com|youtu\.be)$/i, label: "YouTube", color: "#FF0000" },
  { p: "x", re: /(^|\.)(x\.com|twitter\.com)$/i, label: "X", color: "#000000" },
];

export function platformOf(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const h = HOSTS.find((x) => x.re.test(host));
    return h || { p: "link", label: host, color: "#64748B" };
  } catch {
    return { p: "link", label: "קישור", color: "#64748B" };
  }
}

// A social link worth turning into a card — the platforms the user asked for.
export function isSocialUrl(s) {
  const u = (s || "").trim();
  if (!/^https?:\/\/\S+$/i.test(u) || /\s/.test(u)) return false;
  return platformOf(u).p !== "link" ? true : /^https?:\/\//i.test(u);
}

// The first bare URL in a blob of text (used to catch a shared paste).
export function firstUrl(text) {
  const m = (text || "").match(/https?:\/\/[^\s<>"']+/i);
  return m ? m[0].replace(/[.,)]+$/, "") : "";
}

// Ask the server for a title + thumbnail. Always resolves to a card object,
// even offline — the platform/host name is a fine title on its own.
export async function fetchLinkMeta(url) {
  const base = { url, title: "", image: "", author: "", ...platformOf(url) };
  try {
    const r = await fetch(`/api/link-title?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(9000) });
    if (r.ok) {
      const d = await r.json();
      return {
        url, image: d.image || "", author: d.author || "",
        title: (d.title || "").trim() || base.label,
        p: base.p, label: base.label, color: base.color,
      };
    }
  } catch { /* fall through to the offline card */ }
  return { ...base, title: base.label };
}
