// Full-screen note editor, ColorNote style: lined page in the note's colour,
// title bar with a colour square, and autosave — there is no save button.
// Leaving (✓ / unmount) flushes the last edit; an empty new note saves nothing.
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Icon, IconBtn } from "./Icons";
import { FONT, NOTE_COLORS, NOTE_COLOR_FALLBACK } from "../theme";
import { autoTitle } from "../data/store";

export default function NoteEditor({ initial, defaultColor = 0, colorNames = [], th, onCreate, onUpdate, onClose }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [text, setText] = useState(initial?.text || "");
  const [colorIdx, setColorIdx] = useState(initial?.colorIdx ?? defaultColor ?? 0);
  const [showColors, setShowColors] = useState(false);
  const [saved, setSaved] = useState(false);
  const idRef = useRef(initial?.id || null);
  const creatingRef = useRef(false);
  const taRef = useRef();

  // Opened from a real tap, so this focus raises the keyboard.
  useEffect(() => {
    const t = setTimeout(() => taRef.current?.focus(), 90);
    return () => clearTimeout(t);
  }, []);

  // Autosave: the ref always holds the latest state so the unmount flush and
  // the debounced save read the same truth.
  const stateRef = useRef({ title, text, colorIdx });
  stateRef.current = { title, text, colorIdx };

  const save = async () => {
    const s = stateRef.current;
    if (!idRef.current) {
      if (!s.title.trim() && !s.text.trim()) return;    // nothing to keep
      if (creatingRef.current) return;
      creatingRef.current = true;
      try {
        const n = await onCreate({ title: s.title.trim() || autoTitle(s.text), text: s.text, colorIdx: s.colorIdx });
        idRef.current = n?.id || null;
      } finally { creatingRef.current = false; }
    } else {
      onUpdate(idRef.current, { title: s.title.trim() || autoTitle(s.text), text: s.text, colorIdx: s.colorIdx, html: "" });
    }
    setSaved(true);
  };

  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    setSaved(false);
    const t = setTimeout(save, 800);
    return () => clearTimeout(t);
  }, [title, text, colorIdx]);
  // Any way out flushes the pending edit.
  useEffect(() => () => { save(); }, []);

  const c = NOTE_COLORS[colorIdx];
  const pageBg = th.pastels[colorIdx] || th.surface;
  const line = th.dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.09)";
  const barBg = th.dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.09)";
  const nameOf = i => (colorNames[i] || "").trim() || NOTE_COLOR_FALLBACK[i];

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 700, background: pageBg,
      display: "flex", flexDirection: "column", direction: "rtl", fontFamily: FONT }}>

      {/* Top bar: colour square · title · ✓ done */}
      <div style={{ display: "flex", alignItems: "center", gap: 9,
        padding: "10px 12px calc(10px)", background: barBg }}>
        <button onClick={() => setShowColors(s => !s)} title={nameOf(colorIdx)}
          style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, cursor: "pointer",
            background: c, border: "2px solid rgba(255,255,255,0.65)",
            boxShadow: th.electric ? `0 0 10px ${c}88` : "none" }} />
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="כותרת (אוטומטית מהמילים הראשונות)"
          style={{ flex: 1, minWidth: 0, border: "none", borderRadius: 9, padding: "9px 12px",
            fontSize: 15, fontWeight: 600, fontFamily: FONT, direction: "rtl",
            background: th.inputBg, color: th.text, outline: "none" }} />
        <IconBtn name="check" onClick={onClose} color={th.text} size={20} pad="7px" title="סגור" />
      </div>

      {showColors && (
        <div style={{ display: "flex", gap: 10, padding: "10px 14px", background: barBg,
          borderTop: `1px solid ${line}` }}>
          {NOTE_COLORS.map((cc, i) => (
            <button key={i} onClick={() => { setColorIdx(i); setShowColors(false); }} title={nameOf(i)}
              style={{ width: 30, height: 30, borderRadius: "50%", background: cc, cursor: "pointer",
                border: i === colorIdx ? "3px solid #fff" : "2px solid rgba(255,255,255,0.35)",
                boxShadow: i === colorIdx ? `0 0 0 2px ${cc}` : "none" }} />
          ))}
        </div>
      )}

      {/* The lined page */}
      <textarea ref={taRef} value={text} onChange={e => setText(e.target.value)}
        placeholder="כתוב כאן…"
        style={{ flex: 1, width: "100%", boxSizing: "border-box", border: "none", outline: "none",
          resize: "none", padding: "6px 16px 16px", fontSize: 16.5, fontFamily: FONT,
          direction: "rtl", color: th.text, background: "transparent",
          lineHeight: "30px",
          backgroundImage: `repeating-linear-gradient(transparent, transparent 29px, ${line} 29px, ${line} 30px)`,
          backgroundAttachment: "local" }} />

      <div style={{ padding: "7px 14px calc(7px + env(safe-area-inset-bottom))",
        display: "flex", alignItems: "center", gap: 6,
        fontSize: 11.5, color: th.muted, background: barBg }}>
        <Icon name={saved ? "check" : "refresh"} size={12} color={saved ? th.green : th.muted} />
        {saved ? "נשמר" : "נשמר אוטומטית תוך כדי כתיבה"}
        <span style={{ marginRight: "auto" }}>{nameOf(colorIdx)}</span>
      </div>
    </div>,
    document.body
  );
}
