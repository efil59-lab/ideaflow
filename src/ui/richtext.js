// Helpers for the rich note body. Notes store formatted HTML (from the editor's
// contentEditable) alongside a plain-text mirror used for titles and search.

// Defence-in-depth for self-authored HTML: strip script/style/embeds, inline
// event handlers, and javascript: URLs before rendering with dangerouslySet.
export function safeHtml(html) {
  if (!html) return "";
  return String(html)
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*\/?>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/((?:href|src)\s*=\s*)(["']?)\s*javascript:[^"'>\s]*/gi, "$1$2#");
}

// Flatten HTML to plain text (line breaks preserved) for the title / search /
// autoTitle, which all expect a plain string.
export function htmlToText(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p|h1|h2|h3|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#0?39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Seed the editor from a plain-text note that has no HTML yet.
export function htmlFromText(text) {
  if (!text) return "";   // empty → let the CSS placeholder show
  const esc = String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc.split(/\r?\n/).map(l => l || "<br>").join("<br>");
}

// Does this note carry real formatting (worth rendering as HTML in the list)?
export function hasRich(html) {
  return !!html && /<(b|strong|i|em|u|s|strike|h1|h2|h3|mark|a|span|font)\b/i.test(html);
}
