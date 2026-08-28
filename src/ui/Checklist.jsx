// Checklist lines inside a note. A line counts as an item when it starts with
// "- ", "* ", "[ ] " or "[x] ". Checking one rewrites the line in the note's own
// text, so the list stays plain text — it survives copy, export and search.
import { Icon } from "./Icons";

const ITEM = /^(\s*)(?:[-*]\s+|\[([ xX])\]\s*)(.*)$/;

export function parseChecklist(text) {
  const lines = (text || "").split(/\r?\n/);
  const items = [];
  lines.forEach((line, i) => {
    const m = line.match(ITEM);
    if (m) items.push({ i, done: (m[2] || "").toLowerCase() === "x", label: m[3] });
  });
  return items;
}

export function hasChecklist(text) {
  return parseChecklist(text).length > 0;
}

// Returns the note text with one line toggled.
export function toggleLine(text, index) {
  const lines = (text || "").split(/\r?\n/);
  const m = (lines[index] || "").match(ITEM);
  if (!m) return text;
  const done = (m[2] || "").toLowerCase() === "x";
  lines[index] = `${m[1]}[${done ? " " : "x"}] ${m[3]}`;
  return lines.join("\n");
}

export default function Checklist({ text, onToggle, th, compact = false, scale = 1 }) {
  const items = parseChecklist(text);
  if (!items.length) return null;
  const left = items.filter(i => !i.done).length;

  return (
    <div style={{ direction: "rtl" }}>
      {items.map(it => (
        <button key={it.i} onClick={e => { e.stopPropagation(); onToggle?.(it.i); }}
          style={{ display: "flex", alignItems: "flex-start", gap: 7, width: "100%",
            background: "transparent", border: "none", padding: "3px 0", cursor: "pointer",
            textAlign: "right", font: "inherit" }}>
          <span style={{ flexShrink: 0, width: 15, height: 15, borderRadius: 5, marginTop: 2,
            border: it.done ? "none" : `1.5px solid ${th.borderStrong}`,
            background: it.done ? th.green : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            {it.done && <Icon name="check" size={10} color="#fff" />}
          </span>
          <span style={{ fontSize: Math.round((compact ? 11.5 : 13.5) * scale), lineHeight: 1.5,
            color: it.done ? th.muted : th.text,
            textDecoration: it.done ? "line-through" : "none" }}>
            {it.label}
          </span>
        </button>
      ))}
      {!compact && (
        <p style={{ margin: "6px 0 0", fontSize: 11.5, color: th.muted }}>
          {left ? `נותרו ${left} מתוך ${items.length}` : "הכל סומן ✓"}
        </p>
      )}
    </div>
  );
}
