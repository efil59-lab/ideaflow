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

  useEffect(() => {
    if (ref.current && !ref.current.innerHTML) ref.current.innerHTML = html || "";
  }, []);

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
  };

  const btn = (active = false) => ({
    background: active ? th.accentSoft : "transparent",
    border: "none", cursor: "pointer", borderRadius: 7, padding: "6px 9px",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 14, fontWeight: 700, color: th.text, minWidth: 30, fontFamily: "Georgia,serif",
  });

  return (
    <div style={{ border: `1px solid ${th.border}`, borderRadius: 13, overflow: "hidden", background: th.inputBg }}>
      <div style={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap",
        padding: "5px 8px", background: th.surface2, borderBottom: `1px solid ${th.border}`, position: "relative" }}>
        <button type="button" onPointerDown={e => { e.preventDefault(); exec("bold"); }} style={btn()}>B</button>
        <button type="button" onPointerDown={e => { e.preventDefault(); exec("underline"); }} style={{ ...btn(), textDecoration: "underline" }}>U</button>
        <button type="button" onPointerDown={e => { e.preventDefault(); exec("italic"); }} style={{ ...btn(), fontStyle: "italic" }}>I</button>
        <div style={{ width: 1, height: 16, background: th.border, margin: "0 3px" }} />
        <button type="button" onPointerDown={e => { e.preventDefault(); exec("insertUnorderedList"); }} style={btn()}>
          <Icon name="more" size={15} color={th.text} />
        </button>
        <div style={{ width: 1, height: 16, background: th.border, margin: "0 3px" }} />
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
          <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 8, left: 8, zIndex: 50,
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
          <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 8, left: 8, zIndex: 50,
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

      <div ref={ref} contentEditable suppressContentEditableWarning
        onInput={emit} onKeyUp={saveSel} onMouseUp={saveSel} onTouchEnd={saveSel}
        data-ph={placeholder}
        style={{ minHeight, maxHeight: 260, overflowY: "auto", padding: "20px 14px 12px",
          fontSize: 15.5, fontFamily: "'Rubik',sans-serif", direction: "rtl", textAlign: "right",
          lineHeight: 1.65, color: th.text, outline: "none" }} />
      <style>{`[contenteditable][data-ph]:empty:before{content:attr(data-ph);color:${th.muted};pointer-events:none;}`}</style>
    </div>
  );
}
