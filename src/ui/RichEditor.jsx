import { useRef, useState, useEffect } from "react";
import { Icon } from "./Icons";

const RICH_COLORS = ["#14181F", "#DC2626", "#EA580C", "#CA8A04", "#16A34A", "#0E9488", "#2E5BE6", "#7C3AED", "#DB2777"];
const HILITE_COLORS = ["transparent", "#FEF08A", "#BBF7D0", "#BFDBFE", "#FBCFE8", "#DDD6FE"];

export function isHtml(s) {
  return typeof s === "string" && /<(b|strong|u|i|em|span|ul|ol|li|div|br)[\s>]/i.test(s);
}

export function htmlToText(h) {
  const tmp = document.createElement("div");
  tmp.innerHTML = h || "";
  return (tmp.textContent || tmp.innerText || "").trim();
}

export default function RichEditor({ html, onChange, th, placeholder, minHeight = 110 }) {
  const ref = useRef(null);
  const [showColors, setShowColors] = useState(false);
  const [showHilite, setShowHilite] = useState(false);
  const savedRange = useRef(null);

  // ── Undo / redo — a custom snapshot stack, not the browser's native one.
  // Native undo breaks the moment our Range-API color/highlight surgery runs,
  // so we keep our own [{html, caret}] history: every change flows through
  // record(), and undo/redo restore a snapshot (+ caret) exactly.
  const history = useRef([]);   // [{ html, caret }] — caret is a char offset
  const hIndex = useRef(-1);
  const pushTimer = useRef(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    if (ref.current && !ref.current.innerHTML) ref.current.innerHTML = html || "";
    history.current = [{ html: ref.current?.innerHTML || "", caret: 0 }];
    hIndex.current = 0;
    return () => clearTimeout(pushTimer.current);
  }, []);

  // Caret as a plain character offset from the start of the editable — survives
  // an innerHTML swap (a DOM Range wouldn't). Both getters count text chars only.
  const getCaret = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !ref.current) return null;
    const range = sel.getRangeAt(0);
    if (!ref.current.contains(range.endContainer)) return null;
    const pre = range.cloneRange();
    pre.selectNodeContents(ref.current);
    pre.setEnd(range.endContainer, range.endOffset);
    return pre.toString().length;
  };
  const setCaret = offset => {
    if (!ref.current) return;
    const range = document.createRange();
    let remaining = offset, done = false;
    const walk = node => {
      if (done) return;
      if (node.nodeType === 3) {
        const len = node.textContent.length;
        if (remaining <= len) { range.setStart(node, remaining); range.collapse(true); done = true; }
        else remaining -= len;
      } else for (const child of node.childNodes) { walk(child); if (done) break; }
    };
    walk(ref.current);
    if (!done) { range.selectNodeContents(ref.current); range.collapse(false); }
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  };

  const updateButtons = () => {
    setCanUndo(hIndex.current > 0);
    setCanRedo(hIndex.current < history.current.length - 1);
  };

  // Capture the current state. Typing debounces (a burst → one undo step, so a
  // pause is the natural boundary); formatting ops pass immediate=true.
  const record = (immediate = false) => {
    const snap = () => {
      const cur = ref.current?.innerHTML ?? "";
      if (history.current[hIndex.current]?.html === cur) return; // no change
      history.current = history.current.slice(0, hIndex.current + 1); // drop redo branch
      history.current.push({ html: cur, caret: getCaret() ?? cur.length });
      if (history.current.length > 120) history.current.shift();     // cap memory
      hIndex.current = history.current.length - 1;
      updateButtons();
    };
    clearTimeout(pushTimer.current);
    if (immediate) snap();
    else pushTimer.current = setTimeout(snap, 400);
  };

  const applySnapshot = () => {
    const s = history.current[hIndex.current];
    if (!s || !ref.current) return;
    ref.current.innerHTML = s.html;
    onChange(s.html);
    ref.current.focus();
    setCaret(s.caret);
    updateButtons();
  };
  const undo = () => {
    clearTimeout(pushTimer.current);
    // Fold any un-snapshotted typing into history first, so redo can reach it.
    if (history.current[hIndex.current]?.html !== (ref.current?.innerHTML ?? "")) record(true);
    if (hIndex.current <= 0) return;
    hIndex.current -= 1;
    applySnapshot();
  };
  const redo = () => {
    clearTimeout(pushTimer.current);
    if (hIndex.current >= history.current.length - 1) return;
    hIndex.current += 1;
    applySnapshot();
  };

  const saveSel = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && ref.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  };

  // Prefer the live selection; fall back to the last saved range only when
  // there is none (never clobber a valid selection with a stale one).
  const ensureSel = () => {
    const sel = window.getSelection();
    const liveInside = sel && sel.rangeCount > 0 && ref.current?.contains(sel.anchorNode);
    if (liveInside) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
      return sel;
    }
    ref.current?.focus();
    if (savedRange.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    return sel;
  };

  const emit = () => { if (ref.current) onChange(ref.current.innerHTML); };

  const exec = (cmd, val = null) => {
    ensureSel();
    try { document.execCommand("styleWithCSS", false, true); } catch { /* older engines */ }
    document.execCommand(cmd, false, val);
    saveSel();
    emit();
    record(true);
  };

  const onKeyDown = e => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    const k = e.key.toLowerCase();
    if (k === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (k === "y") { e.preventDefault(); redo(); }
  };

  // Range-API styling — works on iOS Safari where execCommand color ops fail.
  const applyStyle = (styleProp, value) => {
    const sel = ensureSel();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed || !ref.current?.contains(range.commonAncestorContainer)) return;
    const span = document.createElement("span");
    span.style[styleProp] = value;
    try {
      span.appendChild(range.extractContents());
      range.insertNode(span);
      const nr = document.createRange();
      nr.selectNodeContents(span);
      sel.removeAllRanges();
      sel.addRange(nr);
      savedRange.current = nr.cloneRange();
    } catch {
      document.execCommand(styleProp === "backgroundColor" ? "hiliteColor" : "foreColor", false, value);
    }
    emit();
    record(true);
  };

  const btn = (active = false) => ({
    background: active ? th.accentSoft : "transparent",
    border: "none", cursor: "pointer", borderRadius: 7, padding: "6px 6px",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 14, fontWeight: 700, color: th.text, minWidth: 26, fontFamily: "Georgia,serif",
  });

  return (
    <div style={{ border: `1px solid ${th.border}`, borderRadius: 13, overflow: "hidden", background: th.inputBg }}>
      {/* Editable area first — the format toolbar sits BELOW it so Android's
          floating selection menu (which appears above the text) never covers it. */}
      <div ref={ref} contentEditable suppressContentEditableWarning
        onInput={() => { emit(); record(false); }} onKeyDown={onKeyDown}
        onKeyUp={saveSel} onMouseUp={saveSel} onTouchEnd={saveSel}
        data-ph={placeholder}
        style={{ minHeight, maxHeight: 260, overflowY: "auto", padding: "12px 14px",
          fontSize: 15.5, fontFamily: "'Rubik',sans-serif", direction: "rtl", textAlign: "right",
          lineHeight: 1.65, color: th.text, outline: "none" }} />

      <div style={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap",
        padding: "5px 6px", background: th.surface2, borderTop: `1px solid ${th.border}`, position: "relative" }}>
        <button type="button" title="חזרה" disabled={!canUndo}
          onPointerDown={e => { e.preventDefault(); if (canUndo) undo(); }}
          style={{ ...btn(), opacity: canUndo ? 1 : 0.3, cursor: canUndo ? "pointer" : "default" }}>
          <Icon name="undo" size={16} color={th.text} />
        </button>
        <button type="button" title="קדימה" disabled={!canRedo}
          onPointerDown={e => { e.preventDefault(); if (canRedo) redo(); }}
          style={{ ...btn(), opacity: canRedo ? 1 : 0.3, cursor: canRedo ? "pointer" : "default" }}>
          <Icon name="redo" size={16} color={th.text} />
        </button>
        <div style={{ width: 1, height: 16, background: th.border, margin: "0 2px" }} />
        <button type="button" onPointerDown={e => { e.preventDefault(); exec("bold"); }} style={btn()}>B</button>
        <button type="button" onPointerDown={e => { e.preventDefault(); exec("underline"); }} style={{ ...btn(), textDecoration: "underline" }}>U</button>
        <button type="button" onPointerDown={e => { e.preventDefault(); exec("italic"); }} style={{ ...btn(), fontStyle: "italic" }}>I</button>
        <div style={{ width: 1, height: 16, background: th.border, margin: "0 2px" }} />
        <button type="button" onPointerDown={e => { e.preventDefault(); exec("insertUnorderedList"); }} style={btn()}>
          <Icon name="more" size={15} color={th.text} />
        </button>
        <div style={{ width: 1, height: 16, background: th.border, margin: "0 2px" }} />
        <button type="button" onPointerDown={e => { e.preventDefault(); setShowColors(s => !s); setShowHilite(false); }}
          style={btn(showColors)}>
          <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ fontSize: 13, lineHeight: 1 }}>A</span>
            <span style={{ width: 15, height: 3, background: "linear-gradient(90deg,#DC2626,#2E5BE6,#16A34A)", borderRadius: 2, marginTop: 1 }} />
          </span>
        </button>
        <button type="button" onPointerDown={e => { e.preventDefault(); setShowHilite(s => !s); setShowColors(false); }}
          style={btn(showHilite)}>
          <span style={{ width: 14, height: 14, borderRadius: 4, background: "#FEF08A", border: `1px solid ${th.border}` }} />
        </button>

        {showColors && (
          <div style={{ position: "absolute", bottom: "calc(100% + 4px)", right: 8, left: 8, zIndex: 50,
            background: th.surface, border: `1px solid ${th.border}`, borderRadius: 10,
            padding: 10, display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
            {RICH_COLORS.map(c => (
              <div key={c} onPointerDown={e => { e.preventDefault(); applyStyle("color", c); setShowColors(false); }}
                style={{ width: 28, height: 28, borderRadius: "50%", background: c, cursor: "pointer",
                  border: `2px solid ${th.border}`, flexShrink: 0 }} />
            ))}
          </div>
        )}
        {showHilite && (
          <div style={{ position: "absolute", bottom: "calc(100% + 4px)", right: 8, left: 8, zIndex: 50,
            background: th.surface, border: `1px solid ${th.border}`, borderRadius: 10,
            padding: 10, display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
            {HILITE_COLORS.map(c => (
              <div key={c} onPointerDown={e => { e.preventDefault(); applyStyle("backgroundColor", c); setShowHilite(false); }}
                style={{ width: 28, height: 28, borderRadius: 8,
                  background: c === "transparent" ? th.inputBg : c, cursor: "pointer",
                  border: `2px solid ${th.border}`, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                {c === "transparent" && <Icon name="close" size={13} color={th.muted} />}
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`[contenteditable][data-ph]:empty:before{content:attr(data-ph);color:${th.muted};pointer-events:none;}`}</style>
    </div>
  );
}
