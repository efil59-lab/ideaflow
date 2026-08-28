// Notes: the reference lane, ColorNote style. One row per note, + opens a
// full-screen autosaving editor, long-press opens the note menu (colour,
// duplicate, share, trash). Nothing here touches the Inbox funnel or counts.
import { useState, useEffect, useRef } from "react";
import { Icon, IconBtn } from "../ui/Icons";
import { Modal, ModalHeader, Confirm } from "../ui/base";
import Checklist, { hasChecklist, parseChecklist, toggleLine } from "../ui/Checklist";
import NoteEditor from "../ui/NoteEditor";
import { FONT, NOTE_COLORS, NOTE_COLOR_FALLBACK } from "../theme";

export default function Notes({ uid, ideas, th, actions, onCapture, onCreateNote,
  colorNames = [], onSaveNames }) {
  const [color, setColor] = useState(null);              // colour filter, null = all
  const [view, setView] = useState(() => {
    try { return localStorage.getItem("if_notes_view") === "grid" ? "grid" : "rows"; }
    catch { return "rows"; }
  });
  const [byColor, setByColor] = useState(() => {
    try { return localStorage.getItem("if_notes_sort") === "color"; } catch { return false; }
  });
  const [editNames, setEditNames] = useState(false);
  const [pasteErr, setPasteErr] = useState("");
  const [editing, setEditing] = useState(null);          // note object | "new" | null
  const [menuNote, setMenuNote] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  // The FAB's "פתק" route asks us to open a fresh editor — live event when the
  // tab is already mounted, a stored flag when it had to switch tabs first.
  useEffect(() => {
    const open = () => setEditing("new");
    window.addEventListener("if-new-note", open);
    try {
      if (sessionStorage.getItem("if_new_note") === "1") {
        sessionStorage.removeItem("if_new_note");
        setEditing("new");
      }
    } catch { /* ignore */ }
    return () => window.removeEventListener("if-new-note", open);
  }, []);

  const setViewMode = v => {
    setView(v);
    try { localStorage.setItem("if_notes_view", v); } catch { /* ignore */ }
  };
  const setSortMode = b => {
    setByColor(b);
    try { localStorage.setItem("if_notes_sort", b ? "color" : "date"); } catch { /* ignore */ }
  };

  const all = ideas.filter(i => i.status === "note");
  let notes = color === null ? all : all.filter(i => i.colorIdx === color);
  notes = [...notes].sort((a, b) => byColor
    ? ((a.colorIdx ?? 9) - (b.colorIdx ?? 9)) || ((b.createdAt || 0) - (a.createdAt || 0))
    : (b.createdAt || 0) - (a.createdAt || 0));

  const nameOf = i => (colorNames[i] || "").trim() || NOTE_COLOR_FALLBACK[i];
  const used = i => all.some(n => n.colorIdx === i);

  const paste = async () => {
    setPasteErr("");
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) { setPasteErr("הלוח ריק"); return; }
      onCapture({ text: text.trim(), colorIdx: color ?? null });
    } catch {
      setPasteErr("הדפדפן לא נתן גישה ללוח — פתח פתק חדש והדבק בו");
    }
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "2px 2px 12px", direction: "rtl" }}>
        <Icon name="notes" size={19} color={th.accent} />
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: th.text }}>פתקים</h2>
        <span style={{ fontSize: 12.5, color: th.muted }}>{all.length}</span>
        <span style={{ marginRight: "auto", display: "flex", gap: 4, alignItems: "center" }}>
          <IconBtn name="tag" onClick={() => setEditNames(true)} color={th.muted} size={17} pad="6px"
            title="שמות הצבעים" />
          <IconBtn name={view === "rows" ? "copy" : "notes"}
            onClick={() => setViewMode(view === "rows" ? "grid" : "rows")}
            color={th.muted} size={17} pad="6px"
            title={view === "rows" ? "תצוגת רשת" : "תצוגת שורות"} />
          {/* + — a new note, straight into the writing page */}
          <button onClick={() => setEditing("new")} title="פתק חדש"
            style={{ width: 36, height: 36, borderRadius: "50%", border: "none", cursor: "pointer",
              background: th.cta || th.accent, display: "flex", alignItems: "center",
              justifyContent: "center", marginRight: 2,
              boxShadow: th.electric ? "0 0 14px rgba(168,85,247,0.55)" : "none" }}>
            <Icon name="add" size={20} color="#fff" />
          </button>
        </span>
      </div>

      {/* Colour filter + sort-by-colour */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "0 0 10px", direction: "rtl" }}>
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
        <button onClick={() => setSortMode(!byColor)}
          style={{ fontSize: 12, fontWeight: 600, fontFamily: FONT, padding: "6px 12px",
            borderRadius: 18, cursor: "pointer",
            background: byColor ? th.accentSoft : th.surface,
            color: byColor ? th.accentText : th.secondary,
            border: `1px solid ${byColor ? th.accent : th.border}` }}>
          ↕ לפי צבע
        </button>
      </div>

      <button onClick={paste}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          width: "100%", margin: "0 0 12px", background: "transparent", color: th.accentText,
          border: `1px dashed ${th.electric ? "rgba(168,85,247,0.5)" : th.borderStrong}`,
          borderRadius: 12, padding: "9px 0", cursor: "pointer",
          fontSize: 13, fontWeight: 600, fontFamily: FONT }}>
        <Icon name="clip" size={15} color={th.accentText} /> הדבק מהלוח כפתק חדש
      </button>
      {pasteErr && <p style={{ margin: "0 2px 10px", fontSize: 12, color: th.red, direction: "rtl" }}>{pasteErr}</p>}

      {notes.length === 0 ? (
        <div style={{ textAlign: "center", padding: "30px 0", color: th.muted, direction: "rtl" }}>
          <Icon name="notes" size={38} color={th.border} />
          <p style={{ fontSize: 14, marginTop: 8 }}>
            {color === null ? "עוד אין פתקים — לחץ + וכתוב את הראשון" : `אין פתקים בצבע "${nameOf(color)}"`}
          </p>
        </div>
      ) : view === "rows" ? (
        <div data-nokbd>
          {notes.map(n => (
            <NoteRow key={n.id} note={n} th={th}
              onOpen={() => setEditing(n)}
              onMenu={() => setMenuNote(n)} />
          ))}
        </div>
      ) : (
        <div data-nokbd style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, direction: "rtl" }}>
          {notes.map(n => (
            <NoteCard key={n.id} note={n} th={th} actions={actions}
              onOpen={() => setEditing(n)}
              onMenu={() => setMenuNote(n)} />
          ))}
        </div>
      )}

      {editing && (
        <NoteEditor th={th} colorNames={colorNames}
          initial={editing === "new" ? null : editing}
          defaultColor={color ?? 0}
          onCreate={onCreateNote}
          onUpdate={(id, patch) => actions.update?.(id, patch, editing === "new" ? null : editing)}
          onClose={() => setEditing(null)} />
      )}

      {menuNote && (
        <NoteMenu note={menuNote} th={th} colorNames={colorNames}
          onColor={i => { actions.update?.(menuNote.id, { colorIdx: i }, menuNote); setMenuNote(null); }}
          onDuplicate={() => {
            onCapture({ text: menuNote.text, html: menuNote.html || "",
              title: menuNote.title ? `${menuNote.title} (עותק)` : "",
              colorIdx: menuNote.colorIdx ?? null, tags: menuNote.tags || [] });
            setMenuNote(null);
          }}
          onShare={() => { actions.share?.(menuNote); setMenuNote(null); }}
          onDelete={() => { setConfirmDel(menuNote); setMenuNote(null); }}
          onClose={() => setMenuNote(null)} />
      )}

      {confirmDel && (
        <Confirm title="העברה לפח האשפה" icon="delete"
          message={`"${(confirmDel.title || confirmDel.text || "הפתק").slice(0, 40)}" יעבור לפח — אפשר לשחזר משם תוך 30 יום.`}
          confirmLabel="העבר לפח"
          onConfirm={() => { actions.remove?.(confirmDel); setConfirmDel(null); }}
          onCancel={() => setConfirmDel(null)} th={th} />
      )}

      {editNames && (
        <ColorNamesModal th={th} names={colorNames}
          onSave={names => { onSaveNames?.(names); setEditNames(false); }}
          onClose={() => setEditNames(false)} />
      )}
    </>
  );
}

// One full-width row per note: colour bar, first lines, date. Tap opens the
// editor; a long press (or right-click) opens the menu instead.
function NoteRow({ note, th, onOpen, onMenu }) {
  const c = NOTE_COLORS[note.colorIdx ?? 0];
  const bg = (note.colorIdx != null && th.pastels[note.colorIdx]) || th.surface;
  const timer = useRef(null);
  const fired = useRef(false);
  const start = useRef([0, 0]);

  const down = e => {
    fired.current = false;
    start.current = [e.clientX, e.clientY];
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { fired.current = true; onMenu(); }, 550);
  };
  const move = e => {
    const [x, y] = start.current;
    if (Math.abs(e.clientX - x) > 12 || Math.abs(e.clientY - y) > 12) clearTimeout(timer.current);
  };
  const cancel = () => clearTimeout(timer.current);
  const click = () => {
    if (fired.current) { fired.current = false; return; }
    onOpen();
  };

  const items = hasChecklist(note.text) ? parseChecklist(note.text) : null;
  // An auto-title is the body's first words — printing both reads twice.
  const titleIsEcho = note.title &&
    (note.text || "").trim().replace(/^\s*(?:[-*]\s+|\[[ xX]\]\s*)/, "")
      .startsWith(note.title.replace(/…$/, ""));
  const showTitle = note.title && !titleIsEcho;
  const body = showTitle ? note.text : (note.text || "(מדיה בלבד)");
  const date = note.createdAt
    ? new Date(note.createdAt).toLocaleDateString("he-IL", { day: "numeric", month: "short" })
    : "";

  return (
    <div onPointerDown={down} onPointerMove={move} onPointerUp={cancel} onPointerLeave={cancel}
      onClick={click}
      onContextMenu={e => { e.preventDefault(); if (!fired.current) { fired.current = true; onMenu(); } }}
      style={{ display: "flex", alignItems: "stretch", background: bg,
        border: `1px solid ${th.border}`, borderRight: `4px solid ${c}`,
        boxShadow: th.electric ? `0 0 10px ${c}1e` : "none",
        borderRadius: 13, marginBottom: 8, cursor: "pointer", direction: "rtl",
        userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none",
        overflow: "hidden" }}>
      <div style={{ flex: 1, minWidth: 0, padding: "12px 13px" }}>
        {showTitle && (
          <p style={{ margin: "0 0 2px", fontSize: 14.5, fontWeight: 700, color: th.text,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {note.title}
          </p>
        )}
        {items ? (
          <p style={{ margin: 0, fontSize: 12.5, color: th.secondary }}>
            ☑ {items.filter(i => i.done).length}/{items.length} סומנו
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: showTitle ? 12.5 : 14, color: showTitle ? th.secondary : th.text,
            lineHeight: 1.5, overflow: "hidden", display: "-webkit-box",
            WebkitLineClamp: 2, WebkitBoxOrient: "vertical", wordBreak: "break-word" }}>
            {body}
          </p>
        )}
      </div>
      <div style={{ flexShrink: 0, padding: "12px 10px 12px 13px", display: "flex",
        flexDirection: "column", alignItems: "flex-end", justifyContent: "space-between", gap: 6 }}>
        <span style={{ fontSize: 11, color: th.muted, whiteSpace: "nowrap" }}>{date}</span>
        <span style={{ display: "flex", gap: 5 }}>
          {note.remindAt > Date.now() && <Icon name="bell" size={12} color={th.accentText} />}
          {note.images?.length > 0 && <Icon name="photo" size={12} color={th.muted} />}
          {note.files?.length > 0 && <Icon name="clip" size={12} color={th.muted} />}
        </span>
      </div>
    </div>
  );
}

// Long-press menu: colour first (the main ask), then the actions.
function NoteMenu({ note, th, colorNames, onColor, onDuplicate, onShare, onDelete, onClose }) {
  const nameOf = i => (colorNames[i] || "").trim() || NOTE_COLOR_FALLBACK[i];
  const label = (note.title || note.text || "פתק").slice(0, 28);
  const row = { display: "flex", alignItems: "center", gap: 10, width: "100%",
    background: th.surface2, color: th.text, border: `1px solid ${th.border}`,
    borderRadius: 12, padding: "12px 14px", marginBottom: 7, cursor: "pointer",
    fontFamily: FONT, fontSize: 14, fontWeight: 500, direction: "rtl", textAlign: "right" };

  return (
    <Modal onClose={onClose} maxWidth={340} th={th}>
      <ModalHeader title={label} icon="notes" onClose={onClose} th={th} />

      <p style={{ margin: "0 0 7px", fontSize: 12, fontWeight: 600, color: th.muted, direction: "rtl" }}>צבע</p>
      <div style={{ display: "flex", gap: 9, marginBottom: 14, direction: "rtl" }}>
        {NOTE_COLORS.map((c, i) => (
          <button key={i} onClick={() => onColor(i)} title={nameOf(i)}
            style={{ width: 32, height: 32, borderRadius: "50%", background: c, cursor: "pointer",
              border: i === (note.colorIdx ?? 0) ? "3px solid #fff" : "2px solid rgba(127,127,127,0.3)",
              boxShadow: i === (note.colorIdx ?? 0) ? `0 0 0 2px ${c}` : "none" }} />
        ))}
      </div>

      <button onClick={onDuplicate} style={row}>
        <Icon name="copy" size={17} color={th.accentText} /> שכפל
      </button>
      <button onClick={onShare} style={row}>
        <Icon name="share" size={17} color={th.accentText} /> שתף
      </button>
      <button onClick={onDelete} style={{ ...row, color: th.red, marginBottom: 0 }}>
        <Icon name="delete" size={17} color={th.red} /> העבר לפח
      </button>
    </Modal>
  );
}

// Compact colour card for the grid view (kept as an option). Checklist items
// stay tappable in place so a shopping list works without opening anything.
function NoteCard({ note, th, actions, onOpen, onMenu }) {
  const c = NOTE_COLORS[note.colorIdx ?? 0];
  const bg = (note.colorIdx != null && th.pastels[note.colorIdx]) || th.surface;
  const list = hasChecklist(note.text);

  return (
    <div onClick={onOpen}
      onContextMenu={e => { e.preventDefault(); onMenu(); }}
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
    </div>
  );
}

function ColorNamesModal({ names, onSave, onClose, th }) {
  const [vals, setVals] = useState(() => NOTE_COLORS.map((_, i) => names[i] || ""));

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
