import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icons";
import { Confirm } from "./base";

const urlOf = im => (typeof im === "string" ? im : im?.url);

// A row of small image thumbnails. Tapping one opens a full-screen viewer that
// pages through every image (arrows · swipe · counter). The optional × removes
// one (editing surfaces pass onRemove, read-only ones don't).
export default function ImageStrip({ images = [], onRemove, th, size = 54 }) {
  const [idx, setIdx] = useState(null);         // index being viewed full-screen
  const [confirm, setConfirm] = useState(null); // index pending removal
  const swipe = useRef({ x: 0, moved: false });
  if (!images.length) return null;

  const n = images.length;
  const go = d => setIdx(i => (i + d + n) % n);
  const onTouchStart = e => { swipe.current = { x: e.touches[0].clientX, moved: false }; };
  const onTouchMove = e => { if (Math.abs(e.touches[0].clientX - swipe.current.x) > 12) swipe.current.moved = true; };
  const onTouchEnd = e => {
    const dx = e.changedTouches[0].clientX - swipe.current.x;
    if (Math.abs(dx) > 45) go(dx < 0 ? 1 : -1);   // swipe left → next, right → prev
  };

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", direction: "rtl" }}>
      {images.map((im, i) => (
        <div key={urlOf(im) || i} style={{ position: "relative" }}>
          <button onClick={e => { e.stopPropagation(); setIdx(i); }} title="פתח תמונה"
            style={{ width: size, height: size, borderRadius: 10, overflow: "hidden", padding: 0,
              border: `1px solid ${th.border}`, cursor: "pointer", background: th.surface2 || th.surface }}>
            <img src={urlOf(im)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </button>
          {onRemove && (
            <button onClick={e => { e.stopPropagation(); setConfirm(i); }} title="הסר"
              style={{ position: "absolute", top: -6, left: -6, width: 20, height: 20, borderRadius: "50%",
                background: th.red, border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="close" size={11} color="#fff" />
            </button>
          )}
        </div>
      ))}

      {idx !== null && createPortal(
        <div onClick={() => { if (!swipe.current.moved) setIdx(null); }}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
          style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(0,0,0,0.92)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16, touchAction: "pan-y" }}>
          <img src={urlOf(images[idx])} alt="" onClick={e => e.stopPropagation()}
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8 }} />

          <button onClick={e => { e.stopPropagation(); setIdx(null); }}
            style={{ position: "fixed", top: "calc(12px + env(safe-area-inset-top))", left: 12, width: 40, height: 40,
              borderRadius: "50%", background: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="close" size={20} color="#fff" />
          </button>

          {n > 1 && (
            <>
              {/* RTL: right-side arrow → previous, left-side arrow → next.
                  The "back" glyph points right; the span flips it for the left. */}
              <button onClick={e => { e.stopPropagation(); go(-1); }} title="הקודמת"
                style={{ ...navBtn, right: 10 }}>
                <Icon name="back" size={22} color="#fff" />
              </button>
              <button onClick={e => { e.stopPropagation(); go(1); }} title="הבאה"
                style={{ ...navBtn, left: 10 }}>
                <span style={{ display: "inline-flex", transform: "scaleX(-1)" }}>
                  <Icon name="back" size={22} color="#fff" />
                </span>
              </button>
              <div style={{ position: "fixed", bottom: "calc(16px + env(safe-area-inset-bottom))", left: 0, right: 0,
                textAlign: "center", color: "#fff", fontSize: 13, fontWeight: 600, letterSpacing: 1 }}>
                {idx + 1} / {n}
              </div>
            </>
          )}
        </div>,
        document.body
      )}

      {confirm !== null && (
        <Confirm title="מחיקת תמונה" icon="photo"
          message="התמונה תוסר מהפתק. לא ניתן לשחזר."
          confirmLabel="מחק תמונה"
          onConfirm={() => { onRemove(confirm); setConfirm(null); }}
          onCancel={() => setConfirm(null)} th={th} />
      )}
    </div>
  );
}

const navBtn = {
  position: "fixed", top: "50%", transform: "translateY(-50%)", width: 46, height: 46,
  borderRadius: "50%", background: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
};
