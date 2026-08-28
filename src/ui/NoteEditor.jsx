// Full-screen note editor, ColorNote style: lined page in the note's colour,
// title bar with a colour square, and autosave — there is no save button.
// Leaving (✓ / unmount) flushes the last edit; an empty new note saves nothing.
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Icon, IconBtn } from "./Icons";
import { FONT, NOTE_COLORS, NOTE_COLOR_FALLBACK } from "../theme";
import { autoTitle } from "../data/store";
import { pushBackLayer } from "./backstack";

const MENU = [
  { k: "checklist", label: "רשימת סימון", icon: "check" },
  { k: "share",     label: "שיתוף",        icon: "share" },
  { k: "remind",    label: "תזכורת",       icon: "bell" },
  { k: "move",      label: "העבר לפרויקט", icon: "folder" },
  { k: "archive",   label: "לארכיון",      icon: "download" },
  { k: "delete",    label: "מחיקה",        icon: "delete", danger: true },
];

export default function NoteEditor({ initial, defaultColor = 0, colorNames = [], scale = 1, th, onCreate, onUpdate, onAction, onClose }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [text, setText] = useState(initial?.text || "");
  const [colorIdx, setColorIdx] = useState(initial?.colorIdx ?? defaultColor ?? 0);
  const [showColors, setShowColors] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const idRef = useRef(initial?.id || null);
  const creatingRef = useRef(false);
  const taRef = useRef();

  // Hardware back closes the editor (autosave already flushed on unmount)
  // instead of dropping the user out of the notes tab.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => pushBackLayer(() => closeRef.current?.()), []);

  // Opened from a real tap, so this focus raises the keyboard.
  useEffect(() => {
    const t = setTimeout(() => taRef.current?.focus(), 90);
    return () => clearTimeout(t);
  }, []);

  // Autosave: the ref always holds the latest state so the unmount flush and
  // the debounced save read the same truth.
  const stateRef = useRef({ title, text, colorIdx });
  stateRef.current = { title, text, colorIdx };

  // What's already persisted. A pure read (or the no-op flush on unmount) must
  // NOT rewrite the note — that would bump updatedAt and jump it to the top of
  // the modified-sorted list. So we only write when something actually changed.
  const savedRef = useRef({
    title: initial?.title || "",
    text: initial?.text || "",
    colorIdx: initial?.colorIdx ?? defaultColor ?? 0,
  });

  const save = async () => {
    const s = stateRef.current;
    const unchanged = s.title === savedRef.current.title
      && s.text === savedRef.current.text
      && s.colorIdx === savedRef.current.colorIdx;
    if (!idRef.current) {
      if (!s.title.trim() && !s.text.trim()) return;    // nothing to keep
      if (creatingRef.current) return;
      creatingRef.current = true;
      try {
        const n = await onCreate({ title: s.title.trim() || autoTitle(s.text), text: s.text, colorIdx: s.colorIdx });
        idRef.current = n?.id || null;
        savedRef.current = { title: s.title, text: s.text, colorIdx: s.colorIdx };
      } finally { creatingRef.current = false; }
    } else {
      if (unchanged) return;                            // read-only visit — leave it in place
      onUpdate(idRef.current, { title: s.title.trim() || autoTitle(s.text), text: s.text, colorIdx: s.colorIdx, html: "" });
      savedRef.current = { title: s.title, text: s.text, colorIdx: s.colorIdx };
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

  // "רשימת סימון": turn every non-empty line into a checklist item, or strip the
  // markers back off if the note is already a list. Autosave picks up the change.
  const toggleChecklist = () => {
    const lines = (stateRef.current.text || "").split(/\r?\n/);
    const ITEM = /^\s*(?:[-*]\s+|\[[ xX]\]\s*)/;
    const filled = lines.filter(l => l.trim());
    const allItems = filled.length > 0 && filled.every(l => ITEM.test(l));
    setText(lines.map(l => !l.trim() ? l
      : allItems ? l.replace(ITEM, "")
      : ITEM.test(l) ? l : "- " + l).join("\n"));
  };

  // The overflow menu. Checklist edits in place; the rest flush a save (so the
  // note has an id), leave the editor, then hand the note to the parent action.
  const doMenu = async kind => {
    setMenuOpen(false);
    if (kind === "checklist") { toggleChecklist(); return; }
    await save();
    const s = stateRef.current, id = idRef.current;
    if (!id) { onClose?.(); return; }          // empty new note — nothing to act on
    const obj = { ...(initial || {}), id, status: "note", noCheck: true,
      title: s.title.trim() || autoTitle(s.text), text: s.text, colorIdx: s.colorIdx };
    onClose?.();
    onAction?.(kind, obj);
  };

  const c = NOTE_COLORS[colorIdx];
  const pageBg = th.pastels[colorIdx] || th.surface;
  const line = th.dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.09)";
  const fs = Math.round(16.5 * scale);
  const lh = Math.round(30 * scale);
  const barBg = th.dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.09)";
  const nameOf = i => (colorNames[i] || "").trim() || NOTE_COLOR_FALLBACK[i];

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 700, background: pageBg,
      display: "flex", flexDirection: "column", direction: "rtl", fontFamily: FONT }}>

      {/* Top bar: ⋮ menu · colour square · title · ✓ done */}
      <div style={{ display: "flex", alignItems: "center", gap: 9,
        padding: "10px 12px calc(10px)", background: barBg }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <IconBtn name="more" onClick={() => setMenuOpen(o => !o)} color={th.text} size={20} pad="7px" title="אפשרויות" />
          {menuOpen && (
            <>
              <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 5 }} />
              <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 6,
                minWidth: 208, background: th.surface, borderRadius: 12,
                border: `1px solid ${th.border}`, boxShadow: "0 12px 34px rgba(0,0,0,0.3)",
                overflow: "hidden", direction: "rtl" }}>
                {MENU.map((m, i) => (
                  <button key={m.k} onClick={() => doMenu(m.k)}
                    style={{ display: "flex", alignItems: "center", gap: 12, width: "100%",
                      background: "transparent", border: "none", cursor: "pointer", fontFamily: FONT,
                      padding: "12px 15px", fontSize: 14.5, fontWeight: 500,
                      color: m.danger ? th.red : th.text,
                      borderTop: i ? `1px solid ${th.border}` : "none" }}>
                    <span style={{ flex: 1, textAlign: "right" }}>{m.label}</span>
                    <Icon name={m.icon} size={18} color={m.danger ? th.red : th.secondary} />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
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
          resize: "none", padding: "6px 16px 16px", fontSize: fs, fontFamily: FONT,
          direction: "rtl", color: th.text, background: "transparent",
          lineHeight: lh + "px",
          backgroundImage: `repeating-linear-gradient(transparent, transparent ${lh - 1}px, ${line} ${lh - 1}px, ${line} ${lh}px)`,
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
