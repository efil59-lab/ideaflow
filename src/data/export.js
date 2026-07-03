// Export open ideas of a category as plain text — built to paste into Claude.
export function buildExportText(name, ideas) {
  const d = new Date().toLocaleDateString("he-IL");
  const lines = [`רעיונות — ${name} (יוצא מ-IdeaFlow, ${d})`, ""];
  ideas.forEach((i, n) => {
    const title = (i.title || "").trim();
    const text = (i.text || "").trim();
    lines.push(`${n + 1}. ${title || text.split("\n")[0] || "(מדיה בלבד)"}`);
    if (text && text !== title) lines.push(text);
    if (i.tags?.length) lines.push("תגיות: " + i.tags.map(t => "#" + t).join(" "));
    lines.push("");
  });
  return lines.join("\n").trim() + "\n";
}

// Copies to clipboard AND downloads a .txt — clipboard is the main goal
// (paste into Claude); the file is a bonus.
export async function exportIdeas(name, ideas) {
  const text = buildExportText(name, ideas);

  let copied = false;
  try {
    await navigator.clipboard.writeText(text);
    copied = true;
  } catch { /* clipboard blocked — file still downloads */ }

  try {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/[^\w֐-׿ -]/g, "").trim() || "ideas"}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  } catch { /* ignore */ }

  return copied;
}
