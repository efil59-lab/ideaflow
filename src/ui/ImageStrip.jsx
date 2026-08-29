import { useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icons";

// A row of small image thumbnails. Tapping one opens it full-screen; the
// optional × removes it (editing surfaces pass onRemove, read-only ones don't).
export default function ImageStrip({ images = [], onRemove, th, size = 54 }) {
  const [open, setOpen] = useState(null);   // url being viewed full-screen
  if (!images.length) return null;

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", direction: "rtl" }}>
      {images.map((im, i) => {
        const url = typeof im === "string" ? im : im.url;
        return (
          <div key={url || i} style={{ position: "relative" }}>
            <button onClick={e => { e.stopPropagation(); setOpen(url); }} title="פתח תמונה"
              style={{ width: size, height: size, borderRadius: 10, overflow: "hidden", padding: 0,
                border: `1px solid ${th.border}`, cursor: "pointer", background: th.surface2 || th.surface }}>
              <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </button>
            {onRemove && (
              <button onClick={e => { e.stopPropagation(); onRemove(i); }} title="הסר"
                style={{ position: "absolute", top: -6, left: -6, width: 20, height: 20, borderRadius: "50%",
                  background: th.red, border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="close" size={11} color="#fff" />
              </button>
            )}
          </div>
        );
      })}

      {open && createPortal(
        <div onClick={() => setOpen(null)}
          style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(0,0,0,0.9)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <img src={open} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8 }} />
          <button onClick={() => setOpen(null)}
            style={{ position: "fixed", top: "calc(12px + env(safe-area-inset-top))", left: 12, width: 40, height: 40,
              borderRadius: "50%", background: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="close" size={20} color="#fff" />
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
