// Full-screen note editor, ColorNote style: lined page in the note's colour,
// title bar with a colour square, and autosave — there is no save button.
// Leaving (✓ / unmount) flushes the last edit; an empty new note saves nothing.
import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Icon, IconBtn } from "./Icons";
import { FONT, NOTE_COLORS, NOTE_COLOR_FALLBACK } from "../theme";
import { autoTitle } from "../data/store";
import { pushBackLayer } from "./backstack";

// A checklist item field that wraps to as many lines as its text needs (a plain
// input would clip the tail of a long item). Grows to fit its content.
function GrowTextarea({ value, onChange, onKeyDown, placeholder, style, taRef }) {
  const ref = useRef(null);
  const attach = el => { ref.current = el; taRef?.(el); };
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [value]);
  return (
    <textarea ref={attach} value={value} onChange={onChange} onKeyDown={onKeyDown}
      placeholder={placeholder} rows={1} style={style} />
  );
}

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
  const [focusIdx, setFocusIdx] = useState(-1);   // checklist row to focus after add/remove
  const idRef = useRef(initial?.id || null);
  const creatingRef = useRef(false);
  const taRef = useRef();
  const inputs = useRef({});

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

  // Undo / redo for the note body. A controlled textarea loses the browser's
  // native history, so we keep our own: typing commits a snapshot after a short
  // pause, undo/redo walk the stack. All body edits go through changeText.
  const hist = useRef([initial?.text || ""]);
  const hp = useRef(0);
  const commitTimer = useRef();
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const commit = val => {
    if (val === hist.current[hp.current]) return;
    hist.current = hist.current.slice(0, hp.current + 1);
    hist.current.push(val);
    hp.current = hist.current.length - 1;
    setCanUndo(true); setCanRedo(false);
  };
  const changeText = val => {
    setText(val);
    clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => commit(val), 450);
  };
  const undo = () => {
    clearTimeout(commitTimer.current);
    commit(stateRef.current.text);            // fold in any uncommitted typing
    if (hp.current <= 0) return;
    hp.current -= 1;
    setText(hist.current[hp.current]);
    setCanUndo(hp.current > 0); setCanRedo(true);
    requestAnimationFrame(() => taRef.current?.focus());
  };
  const redo = () => {
    clearTimeout(commitTimer.current);
    if (hp.current >= hist.current.length - 1) return;
    hp.current += 1;
    setText(hist.current[hp.current]);
    setCanUndo(true); setCanRedo(hp.current < hist.current.length - 1);
    requestAnimationFrame(() => taRef.current?.focus());
  };

  // Track the visual viewport so the footer (undo/redo) floats just above the
  // on-screen keyboard instead of hiding behind it.
  const [vp, setVp] = useState(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onR = () => setVp({ h: vv.height, top: vv.offsetTop });
    onR();
    vv.addEventListener("resize", onR);
    vv.addEventListener("scroll", onR);
    return () => { vv.removeEventListener("resize", onR); vv.removeEventListener("scroll", onR); };
  }, []);

  // "רשימת סימון": turn every line into a checkbox item, or strip the markers off
  // if the note is already a list. Autosave picks up the change.
  const PREFIX = /^\s*(?:[-*]\s+|\[[ xX]\]\s*)/;
  const toggleChecklist = () => {
    const lines = (stateRef.current.text || "").split(/\r?\n/);
    const filled = lines.filter(l => l.trim());
    const allItems = filled.length > 0 && filled.every(l => PREFIX.test(l));
    if (allItems) {                                   // list → plain text
      changeText(lines.map(l => l.replace(PREFIX, "")).join("\n"));
    } else {                                          // plain text → checkbox list
      const items = filled.map(l => "[ ] " + l.replace(PREFIX, ""));
      changeText((items.length ? items : ["[ ] "]).join("\n"));
    }
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

  // Checklist mode: on when every non-empty line is an item. Each line stays
  // plain text ("[ ] label" / "[x] label") so the list view, search and export
  // all keep working — this is just an interactive way to edit that text.
  const rawLines = (text || "").split(/\r?\n/);
  const filledLines = rawLines.filter(l => l.trim());
  const isChecklist = filledLines.length > 0 && filledLines.every(l => PREFIX.test(l));
  const PARSE = /^\s*(?:\[([ xX])\]\s?|[-*]\s+)?(.*)$/;
  const items = rawLines.map((l, i) => {
    const m = l.match(PARSE);
    return { i, done: (m?.[1] || "").toLowerCase() === "x", label: m?.[2] ?? l };
  });
  const rebuild = arr => changeText(arr.join("\n"));
  const setItemLine = (i, done, label) => {
    const a = [...rawLines]; a[i] = `[${done ? "x" : " "}] ${label}`; rebuild(a);
  };
  const toggleItem = i => setItemLine(i, !items[i].done, items[i].label);
  const editItem = (i, val) => setItemLine(i, items[i].done, val);
  const addItem = i => { const a = [...rawLines]; a.splice(i + 1, 0, "[ ] "); rebuild(a); setFocusIdx(i + 1); };
  const removeItem = i => {
    if (rawLines.length <= 1) { rebuild(["[ ] "]); setFocusIdx(0); return; }
    const a = [...rawLines]; a.splice(i, 1); rebuild(a); setFocusIdx(Math.max(0, i - 1));
  };

  // After add/remove, put the caret in the target row.
  useEffect(() => {
    if (focusIdx < 0) return;
    const el = inputs.current[focusIdx];
    if (el) { el.focus(); const v = el.value; el.setSelectionRange(v.length, v.length); }
    setFocusIdx(-1);
  }, [focusIdx]);

  // Only trust the visual-viewport height when it's clearly real (a collapsed or
  // zero value would otherwise shrink the whole editor to nothing).
  const vpSafe = vp && vp.h > 200;

  const c = NOTE_COLORS[colorIdx];
  const pageBg = th.pastels[colorIdx] || th.surface;
  const line = th.dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.09)";
  const fs = Math.round(16.5 * scale);
  const lh = Math.round(30 * scale);
  const barBg = th.dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.09)";
  const nameOf = i => (colorNames[i] || "").trim() || NOTE_COLOR_FALLBACK[i];

  return createPortal(
    <div style={{ position: "fixed", left: 0, right: 0, zIndex: 700, background: pageBg,
      // Track the visual viewport so the footer rides above the keyboard — but
      // only when it reports a sane height (some webviews report 0), else fill.
      top: vpSafe ? vp.top : 0,
      height: vpSafe ? vp.h + "px" : "100dvh",
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
                {MENU.map((m, i) => {
                  const active = m.k === "checklist" && isChecklist;
                  return (
                    <button key={m.k} onClick={() => doMenu(m.k)}
                      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%",
                        background: "transparent", border: "none", cursor: "pointer", fontFamily: FONT,
                        padding: "12px 15px", fontSize: 14.5, fontWeight: active ? 700 : 500,
                        color: m.danger ? th.red : active ? th.accentText : th.text,
                        borderTop: i ? `1px solid ${th.border}` : "none" }}>
                      <span style={{ flex: 1, textAlign: "right" }}>{m.label}</span>
                      <Icon name={m.icon} size={18}
                        color={m.danger ? th.red : active ? th.accentText : th.secondary} />
                    </button>
                  );
                })}
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
          {NOTE_COLORS.slice(0, 4).map((cc, i) => (
            <button key={i} onClick={() => { setColorIdx(i); setShowColors(false); }} title={nameOf(i)}
              style={{ width: 30, height: 30, borderRadius: "50%", background: cc, cursor: "pointer",
                border: i === colorIdx ? "3px solid #fff" : "2px solid rgba(255,255,255,0.35)",
                boxShadow: i === colorIdx ? `0 0 0 2px ${cc}` : "none" }} />
          ))}
        </div>
      )}

      {/* The page — a plain lined textarea, or an interactive checklist */}
      {isChecklist ? (
        <div data-noswipe style={{ flex: 1, overflowY: "auto", padding: "6px 0 16px", background: pageBg }}>
          {items.map(it => (
            <div key={it.i} style={{ display: "flex", alignItems: "flex-start", gap: 11,
              padding: "0 16px", minHeight: lh, borderBottom: `1px solid ${line}` }}>
              <button onClick={() => toggleItem(it.i)} title={it.done ? "בטל סימון" : "סמן כבוצע"}
                style={{ flexShrink: 0, width: 23, height: 23, borderRadius: 6, cursor: "pointer",
                  marginTop: Math.round((lh - 23) / 2) + 4,
                  border: it.done ? "none" : `2px solid ${th.dark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)"}`,
                  background: it.done ? th.green : (th.dark ? "rgba(255,255,255,0.14)" : "#fff"),
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                {it.done && <Icon name="check" size={15} color="#fff" />}
              </button>
              <GrowTextarea taRef={el => { inputs.current[it.i] = el; }} value={it.label}
                onChange={e => editItem(it.i, e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") { e.preventDefault(); addItem(it.i); }
                  else if (e.key === "Backspace" && !it.label && e.target.selectionStart === 0) {
                    e.preventDefault(); removeItem(it.i);
                  }
                }}
                placeholder="פריט…"
                style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent",
                  resize: "none", overflow: "hidden", boxSizing: "border-box",
                  fontSize: fs, lineHeight: lh + "px", fontFamily: FONT, direction: "rtl",
                  padding: "4px 0", wordBreak: "break-word",
                  color: it.done ? th.muted : th.text,
                  textDecoration: it.done ? "line-through" : "none" }} />
            </div>
          ))}
          <button onClick={() => addItem(items.length - 1)}
            style={{ display: "flex", alignItems: "center", gap: 11, width: "100%",
              padding: "11px 16px", background: "transparent", border: "none", cursor: "pointer",
              fontFamily: FONT, fontSize: fs - 1, color: th.muted }}>
            <span style={{ width: 23, textAlign: "center", fontSize: 22, lineHeight: "20px" }}>+</span>
            פריט חדש
          </button>
        </div>
      ) : (
        <textarea ref={taRef} value={text} onChange={e => changeText(e.target.value)}
          placeholder="כתוב כאן…"
          style={{ flex: 1, width: "100%", boxSizing: "border-box", border: "none", outline: "none",
            resize: "none", padding: "6px 16px 16px", fontSize: fs, fontFamily: FONT,
            direction: "rtl", color: th.text, background: "transparent",
            lineHeight: lh + "px",
            backgroundImage: `repeating-linear-gradient(transparent, transparent ${lh - 1}px, ${line} ${lh - 1}px, ${line} ${lh}px)`,
            backgroundAttachment: "local" }} />
      )}

      {/* Footer: undo / redo (kept above the keyboard by the viewport tracking)
          plus the autosave status. preventDefault on pointer-down keeps the
          textarea focused, so tapping an arrow doesn't dismiss the keyboard. */}
      <div style={{ padding: "5px 10px calc(5px + env(safe-area-inset-bottom))",
        display: "flex", alignItems: "center", gap: 4, background: barBg,
        borderTop: `1px solid ${line}` }}>
        {[["undo", undo, canUndo, "בטל"], ["redo", redo, canRedo, "החזר"]].map(([ic, fn, on, t]) => (
          <button key={ic} title={t} disabled={!on}
            onPointerDown={e => e.preventDefault()} onMouseDown={e => e.preventDefault()}
            onClick={fn}
            style={{ background: "transparent", border: "none", borderRadius: 9, padding: "8px",
              cursor: on ? "pointer" : "default", opacity: on ? 1 : 0.3,
              display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name={ic} size={21} color={th.text} />
          </button>
        ))}
        <span style={{ marginRight: "auto", display: "flex", alignItems: "center", gap: 6,
          fontSize: 11.5, color: th.muted }}>
          <Icon name={saved ? "check" : "refresh"} size={12} color={saved ? th.green : th.muted} />
          {saved ? "נשמר" : "נשמר אוטומטית"}
        </span>
      </div>
    </div>,
    document.body
  );
}
