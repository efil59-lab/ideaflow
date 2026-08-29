import React, { useState } from "react";
import { Icon } from "./Icons";
import { Confirm } from "./base";
import { platformOf } from "../data/link";

const FONT = "'Rubik', system-ui, sans-serif";

// A saved social link, shown as a card: platform badge + title (+ thumbnail),
// the whole card opening the URL in a new tab. Used inside the note editor and,
// read-only (onRemove omitted), on the note rows/cards in the list.
export function LinkCard({ link, th, onRemove, compact = false }) {
  const meta = platformOf(link.url);
  const badge = link.color || meta.color;
  const label = link.label || meta.label;
  const open = () => { try { window.open(link.url, "_blank", "noopener,noreferrer"); } catch { /* ignore */ } };

  return (
    <div onClick={open} title={link.url}
      style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
        background: th.dark ? "rgba(255,255,255,0.05)" : "#fff",
        border: `1px solid ${th.border}`, borderRadius: 12, overflow: "hidden",
        padding: compact ? "7px 9px" : "8px 10px", direction: "rtl" }}>
      {link.image
        ? <img src={link.image} alt="" loading="lazy"
            style={{ width: compact ? 34 : 42, height: compact ? 34 : 42, borderRadius: 8,
              objectFit: "cover", flexShrink: 0, background: th.surface2 }} />
        : <span style={{ width: compact ? 34 : 42, height: compact ? 34 : 42, borderRadius: 8, flexShrink: 0,
            background: badge, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="link" size={compact ? 17 : 20} color="#fff" />
          </span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: compact ? 12.5 : 13.5, fontWeight: 600, color: th.text,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{link.title || label}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 1 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: badge, flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: th.muted,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        </div>
      </div>
      {onRemove && (
        <button onClick={e => { e.stopPropagation(); onRemove(); }} title="הסר קישור"
          style={{ flexShrink: 0, background: "transparent", border: "none", cursor: "pointer",
            padding: 4, display: "flex", color: th.muted }}>
          <Icon name="close" size={15} color={th.muted} />
        </button>
      )}
    </div>
  );
}

export default function LinkStrip({ links = [], th, onRemove }) {
  const [confirm, setConfirm] = useState(null);
  if (!links.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {links.map((lk, i) => (
        <LinkCard key={lk.url + i} link={lk} th={th}
          onRemove={onRemove ? () => setConfirm(i) : undefined} />
      ))}
      {confirm !== null && (
        <Confirm th={th} title="הסרת קישור" message="להסיר את הקישור מהפתק?"
          confirmLabel="הסר" icon="link"
          onConfirm={() => { onRemove(confirm); setConfirm(null); }}
          onCancel={() => setConfirm(null)} />
      )}
    </div>
  );
}
