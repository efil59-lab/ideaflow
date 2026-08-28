// Notes: the reference lane. Colour is the organising axis here — every note
// carries one of six colours the user can name — and nothing on this screen
// touches the Inbox funnel, the active counts or the nightly digest.
import { useState } from "react";
import CaptureBar from "../ui/CaptureBar";
import IdeaList from "../ui/IdeaList";
import { Icon, IconBtn } from "../ui/Icons";
import { Modal, ModalHeader } from "../ui/base";
import Checklist, { hasChecklist, toggleLine } from "../ui/Checklist";
import { FONT, NOTE_COLORS, NOTE_COLOR_FALLBACK } from "../theme";

export default function Notes({ uid, ideas, th, actions, onCapture, colorNames = [], onSaveNames }) {
  const [color, setColor] = useState(null);          // null = all colours
  const [view, setView] = useState(() => {
    try { return localStorage.getItem("if_notes_view") || "grid"; } catch { return "grid"; }
  });
  const [editNames, setEditNames] = useState(false);
  const [pasteErr, setPasteErr] = useState("");

  const setViewMode = v => {
    setView(v);
    try { localStorage.setItem("if_notes_view", v); } catch { /* ignore */ }
  };

  const all = ideas.filter(i => i.status === "note");
  const notes = color === null ? all : all.filter(i => i.colorIdx === color);
  const nameOf = i => (colorNames[i] || "").trim() || NOTE_COLOR_FALLBACK[i];
  const used = i => all.some(n => n.colorIdx === i);

  // One tap from clipboard to note — the fastest way to park something here.
  const paste = async () => {
    setPasteErr("");
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) { setPasteErr("הלוח ריק"); return; }
      onCapture({ text: text.trim(), colorIdx: color ?? null });
    } catch {
      setPasteErr("הדפדפן לא נתן גישה ללוח — הדבק ידנית בשדה למעלה");
    }
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "2px 2px 12px", direction: "rtl" }}>
        <Icon name="notes" size={19} color={th.accent} />
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: th.text }}>פתקים</h2>
        <span style={{ fontSize: 12.5, color: th.muted }}>{all.length}</span>
        <span style={{ marginRight: "auto", display: "flex", gap: 2 }}>
          <IconBtn name="tag" onClick={() => setEditNames(true)} color={th.muted} size={17} pad="6px"
            title="שמות הצבעים" />
          <IconBtn name={view === "grid" ? "notes" : "copy"} onClick={() => setViewMode(view === "grid" ? "list" : "grid")}
            color={th.muted} size={17} pad="6px" title={view === "grid" ? "תצוגת רשימה" : "תצוגת רשת"} />
        </span>
      </div>

      <CaptureBar uid={uid} th={th} focusOnMount draftKey="if_draft_note"
        placeholder="פתק חדש — הדבק או כתוב…"
        onCapture={data => onCapture({ ...data, colorIdx: color ?? null })} />

      <button onClick={paste}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          width: "100%", marginTop: 8, background: "transparent", color: th.accentText,
          border: `1px dashed ${th.electric ? "rgba(168,85,247,0.5)" : th.borderStrong}`,
          borderRadius: 12, padding: "10px 0", cursor: "pointer",
          fontSize: 13, fontWeight: 600, fontFamily: FONT }}>
        <Icon name="clip" size={15} color={th.accentText} /> הדבק מהלוח כפתק חדש
      </button>
      {pasteErr && <p style={{ margin: "6px 2px 0", fontSize: 12, color: th.red, direction: "rtl" }}>{pasteErr}</p>}

      {/* Colour filter — the organising axis */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "14px 0 12px", direction: "rtl" }}>
        <button onClick={() => setColor(null)}
          style={{ fontSize: 12, fontWeight: 600, fontFamily: FONT, padding: "6px 13px",
            borderRadius: 18, cursor: "pointer", border: "none",
            background: color === null ? th.accent : th.surface,
            color: color === null ? "#fff" : th.secondary }}>
          הכל
        </button>
        {NOTE_COLORS.map((c, i) => (
          <button key={i} onClick={() => setColor(color === i ? null : i)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 12, fontWeight: 600, fontFamily: FONT, padding: "6px 12px",
              borderRadius: 18, cursor: "pointer", opacity: used(i) || color === i ? 1 : 0.45,
              background: color === i ? `${c}26` : th.surface,
              color: color === i ? c : th.secondary,
              border: `1px solid ${color === i ? c : th.border}` }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: c }} />
            {nameOf(i)}
          </button>
        ))}
      </div>

      {notes.length === 0 ? (
        <div style={{ textAlign: "center", padding: "30px 0", color: th.muted, direction: "rtl" }}>
          <Icon name="notes" size={38} color={th.border} />
          <p style={{ fontSize: 14, marginTop: 8 }}>
            {color === null ? "עוד אין פתקים — הדבק או כתוב אחד למעלה" : `אין פתקים בצבע "${nameOf(color)}"`}
          </p>
        </div>
      ) : view === "list" ? (
        <div data-nokbd>
          <IdeaList ideas={notes} projects={[]} th={th} actions={actions} emptyText="אין פתקים" />
        </div>
      ) : (
        <div data-nokbd style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, direction: "rtl" }}>
          {notes.map(n => (
            <NoteCard key={n.id} note={n} th={th} actions={actions} />
          ))}
        </div>
      )}

      {editNames && (
        <ColorNamesModal th={th} names={colorNames}
          onSave={names => { onSaveNames?.(names); setEditNames(false); }}
          onClose={() => setEditNames(false)} />
      )}
    </>
  );
}

// Compact colour card for the grid. Tap opens the full editor; checklist items
// stay tappable in place so a shopping list works without opening anything.
function NoteCard({ note, th, actions }) {
  const c = NOTE_COLORS[note.colorIdx ?? 0];
  const bg = (note.colorIdx != null && th.pastels[note.colorIdx]) || th.surface;
  const list = hasChecklist(note.text);

  return (
    <div onClick={() => actions.edit?.(note)}
      style={{ background: bg, borderRadius: 13, padding: "11px 12px", cursor: "pointer",
        border: `1px solid ${th.border}`, borderRight: `4px solid ${c}`,
        boxShadow: th.electric ? `0 0 12px ${c}22` : "none",
        direction: "rtl", overflow: "hidden" }}>
      {note.title && (
        <p style={{ margin: "0 0 5px", fontSize: 13, fontWeight: 700, color: th.text,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {note.title}
        </p>
      )}
      {list ? (
        <Checklist text={note.text} th={th} compact
          onToggle={i => actions.update?.(note.id, { text: toggleLine(note.text, i), html: "" }, note)} />
      ) : (
        <p style={{ margin: 0, fontSize: 12, color: th.secondary, lineHeight: 1.55,
          overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical",
          wordBreak: "break-word" }}>
          {note.text || "(מדיה בלבד)"}
        </p>
      )}
      {(note.images?.length > 0 || note.files?.length > 0 || note.remindAt) && (
        <div style={{ display: "flex", gap: 7, marginTop: 7, color: th.muted }}>
          {note.images?.length > 0 && <Icon name="photo" size={12} color={th.muted} />}
          {note.files?.length > 0 && <Icon name="clip" size={12} color={th.muted} />}
          {note.remindAt > Date.now() && <Icon name="bell" size={12} color={th.accentText} />}
        </div>
      )}
    </div>
  );
}

function ColorNamesModal({ names, onSave, onClose, th }) {
  const [vals, setVals] = useState(() =>
    NOTE_COLORS.map((_, i) => names[i] || ""));

  return (
    <Modal onClose={onClose} maxWidth={360} th={th}>
      <ModalHeader title="שמות הצבעים" icon="tag" onClose={onClose} th={th} />
      <p style={{ margin: "0 0 12px", fontSize: 12.5, color: th.muted, direction: "rtl", lineHeight: 1.6 }}>
        תן לכל צבע שם משלך — "קניות", "טיולים", "עבודה" — והוא יהפוך לקטגוריה אמיתית בסינון.
      </p>
      {NOTE_COLORS.map((c, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8, direction: "rtl" }}>
          <span style={{ width: 22, height: 22, borderRadius: 7, background: c, flexShrink: 0 }} />
          <input value={vals[i]} onChange={e => setVals(v => v.map((x, j) => j === i ? e.target.value : x))}
            placeholder={NOTE_COLOR_FALLBACK[i]} maxLength={14}
            style={{ flex: 1, border: `1px solid ${th.border}`, borderRadius: 10, padding: "9px 12px",
              fontSize: 14, fontFamily: FONT, direction: "rtl", background: th.inputBg, color: th.text }} />
        </div>
      ))}
      <button onClick={() => onSave(vals.map(v => v.trim().slice(0, 14)))}
        style={{ width: "100%", marginTop: 8, height: 44, background: th.cta || th.accent, color: "#fff",
          border: "none", borderRadius: 12, cursor: "pointer",
          fontSize: 15, fontWeight: 700, fontFamily: FONT }}>
        שמור
      </button>
    </Modal>
  );
}
