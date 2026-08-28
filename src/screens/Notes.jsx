// Notes: the reference lane, ColorNote style. Sort bar on top, one row per
// note, + opens a full-screen autosaving editor. Long-press starts multi-select
// (colour / archive / delete the whole selection); nothing here touches the
// Inbox funnel or the active counts.
import { useState, useEffect, useRef } from "react";
import { Icon, IconBtn } from "../ui/Icons";
import { Modal, ModalHeader, Confirm } from "../ui/base";
import Checklist, { hasChecklist, parseChecklist, toggleLine } from "../ui/Checklist";
import NoteEditor from "../ui/NoteEditor";
import { pushBackLayer } from "../ui/backstack";
import { FONT, NOTE_COLORS, NOTE_COLOR_FALLBACK } from "../theme";

// Colours offered for new notes / filtering — kept to four so the chips fit one
// row. The full NOTE_COLORS array stays intact so notes already coloured orange
// or pink still render their colour.
const PALETTE = NOTE_COLORS.slice(0, 4);

// The sort menu, ColorNote style.
const SORTS = [
  ["modified", "לפי זמן שינוי", "time"],
  ["created", "לפי הזמן שנוצר", "add"],
  ["alpha", "אלפביתי", "notes"],
  ["color", "לפי צבע", "tag"],
  ["reminder", "לפי זמן תזכורת", "bell"],
];

// Tap vs long-press on one element, with scroll-cancel and click suppression.
function usePress(onTap, onLong) {
  const t = useRef(); const fired = useRef(false); const start = useRef([0, 0]);
  return {
    onPointerDown: e => {
      fired.current = false; start.current = [e.clientX, e.clientY];
      clearTimeout(t.current);
      t.current = setTimeout(() => { fired.current = true; onLong(); }, 550);
    },
    onPointerMove: e => {
      const [x, y] = start.current;
      if (Math.abs(e.clientX - x) > 12 || Math.abs(e.clientY - y) > 12) clearTimeout(t.current);
    },
    onPointerUp: () => clearTimeout(t.current),
    onPointerLeave: () => clearTimeout(t.current),
    onClick: () => { if (fired.current) { fired.current = false; return; } onTap(); },
    onContextMenu: e => { e.preventDefault(); if (!fired.current) { fired.current = true; onLong(); } },
  };
}

export default function Notes({ uid, ideas, th, actions, onCapture, onCreateNote,
  projects = [], onMoveToProject, noteFont = 0, colorNames = [], onSaveNames }) {
  const [color, setColor] = useState(null);              // colour filter, null = all
  const [view, setView] = useState(() => {
    try { return localStorage.getItem("if_notes_view") === "grid" ? "grid" : "rows"; }
    catch { return "rows"; }
  });
  const [sortBy, setSortBy] = useState(() => {
    try { return localStorage.getItem("if_notes_sortby") || "modified"; } catch { return "modified"; }
  });
  // Note-text size (0/1/2) is chosen in the profile sheet; here we just apply it.
  const scale = [1, 1.2, 1.42][noteFont] || 1;
  const [showSort, setShowSort] = useState(false);
  const [showArch, setShowArch] = useState(false);
  const [editNames, setEditNames] = useState(false);
  const [editing, setEditing] = useState(null);          // note object | "new" | null
  const [selected, setSelected] = useState(null);        // Set<id> | null = not selecting
  const [pickColor, setPickColor] = useState(false);     // bulk colour picker
  const [confirmDel, setConfirmDel] = useState(null);    // array of notes to trash
  const [selMenu, setSelMenu] = useState(false);         // "more" menu in the selection bar
  const [pasteHint, setPasteHint] = useState(false);     // opened via clip but clipboard was blocked

  // Reading a note opens a full-screen editor; keep the list exactly where it
  // was. We snapshot the scroll when it opens (before the textarea autofocus
  // pulls the page to the top behind the overlay) and restore it on close, so
  // going back lands on the same item. Covers every path: tap, FAB, back.
  const scrollRef = useRef(0);
  const wasEditing = useRef(false);
  useEffect(() => {
    if (!wasEditing.current && editing) {
      scrollRef.current = window.scrollY || document.documentElement.scrollTop || 0;
    } else if (wasEditing.current && !editing) {
      const y = scrollRef.current;
      requestAnimationFrame(() => window.scrollTo(0, y));
      setTimeout(() => window.scrollTo(0, y), 80);   // re-assert after keyboard/viewport settles
    }
    wasEditing.current = !!editing;
  }, [editing]);

  // The FAB's "פתק" route asks us to open a fresh editor.
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

  const inSel = selected !== null;
  // Hardware back leaves selection mode before leaving the tab.
  useEffect(() => {
    if (inSel) return pushBackLayer(() => setSelected(null));
  }, [inSel]);

  const setViewMode = v => {
    setView(v);
    try { localStorage.setItem("if_notes_view", v); } catch { /* ignore */ }
  };
  const chooseSort = v => {
    setSortBy(v);
    setShowSort(false);
    try { localStorage.setItem("if_notes_sortby", v); } catch { /* ignore */ }
  };

  const notesAll = ideas.filter(i => i.status === "note");
  const archCount = notesAll.filter(n => n.archived).length;
  let pool = notesAll.filter(n => !!n.archived === showArch);
  if (color !== null) pool = pool.filter(i => i.colorIdx === color);
  const modified = n => n.updatedAt || n.createdAt || 0;
  const alpha = n => (n.title || n.text || "").trim();
  pool = [...pool].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;   // pinned notes first
    if (sortBy === "created") return (b.createdAt || 0) - (a.createdAt || 0);
    if (sortBy === "alpha") return alpha(a).localeCompare(alpha(b), "he");
    if (sortBy === "color") return ((a.colorIdx ?? 9) - (b.colorIdx ?? 9)) || (modified(b) - modified(a));
    if (sortBy === "reminder") {
      const ra = a.remindAt || Infinity, rb = b.remindAt || Infinity;
      return ra - rb || (modified(b) - modified(a));
    }
    return modified(b) - modified(a); // "modified"
  });

  const nameOf = i => (colorNames[i] || "").trim() || NOTE_COLOR_FALLBACK[i];
  const used = i => notesAll.some(n => !n.archived === !showArch && n.colorIdx === i);
  const sortLabel = SORTS.find(s => s[0] === sortBy)?.[1] || "";

  // ── selection ──────────────────────────────────────────────────────────────
  const startSel = id => { setSelMenu(false); setSelected(new Set([id])); };
  const toggleSel = id => setSelected(prev => {
    const s = new Set(prev);
    if (s.has(id)) s.delete(id); else s.add(id);
    return s.size ? s : null;
  });
  const selNotes = inSel ? pool.filter(n => selected.has(n.id)) : [];

  const bulkColor = i => {
    selNotes.forEach(n => actions.update?.(n.id, { colorIdx: i }, n));
    setPickColor(false);
    setSelected(null);
  };
  const bulkArchive = () => {
    selNotes.forEach(n => actions.update?.(n.id, { archived: !showArch }, n));
    setSelected(null);
  };
  const bulkPin = () => {
    const pin = !selNotes.every(n => n.pinned);   // pin all, unless already all pinned
    selNotes.forEach(n => actions.update?.(n.id, { pinned: pin }, n));
    setSelected(null);
  };
  const doDelete = list => {
    list.forEach(n => actions.remove?.(n));
    setConfirmDel(null);
    setSelected(null);
  };

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) { onCapture({ text: text.trim(), colorIdx: color ?? null }); return; }
    } catch { /* browser blocked clipboard read — fall through to manual paste */ }
    // Reading the clipboard failed or it was empty: open a fresh note with a
    // paste prompt so the user can paste by hand (long-press → הדבק).
    setPasteHint(true);
    setEditing("new");
  };

  const noteProps = n => ({
    note: n, th, sortBy, scale,
    inSel, isSel: inSel && selected.has(n.id),
    onTap: () => inSel ? toggleSel(n.id) : setEditing(n),
    onLong: () => inSel ? toggleSel(n.id) : startSel(n.id),
  });

  return (
    <>
      {/* The whole toolbar (sort · title · colours) stays pinned under the app
          header while the notes scroll. */}
      <div style={{ position: "sticky", top: "var(--if-head-h, 56px)", zIndex: 20,
        background: th.bg, paddingTop: 8 }}>
      {/* Sort bar — top of the screen, ColorNote style */}
      <button onClick={() => setShowSort(true)}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          width: "100%", margin: "0 0 10px", background: th.surface, color: th.secondary,
          border: `1px solid ${th.border}`, borderRadius: 12, padding: "8px 0",
          cursor: "pointer", fontSize: 12.5, fontWeight: 600, fontFamily: FONT, direction: "rtl" }}>
        מיין {sortLabel}
        <Icon name="down" size={12} color={th.muted} />
      </button>


      {inSel ? (
        /* Selection header: count + the bulk actions */
        <div style={{ display: "flex", alignItems: "center", gap: 2, margin: "0 0 12px",
          background: th.surface, border: `1px solid ${th.electric ? "rgba(168,85,247,0.4)" : th.border}`,
          borderRadius: 13, padding: "7px 9px", direction: "rtl" }}>
          <IconBtn name="close" onClick={() => setSelected(null)} color={th.secondary} size={20} pad="9px" title="בטל בחירה" />
          <span style={{ fontSize: 14, fontWeight: 700, color: th.text, margin: "0 4px" }}>
            {selNotes.length} נבחרו
          </span>
          <span style={{ marginRight: "auto", display: "flex", gap: 2, alignItems: "center" }}>
            {selNotes.length === 1 && (
              <>
                <IconBtn name="copy" onClick={() => {
                  const n = selNotes[0];
                  onCapture({ text: n.text, html: n.html || "", colorIdx: n.colorIdx ?? null,
                    title: n.title ? `${n.title} (עותק)` : "", tags: n.tags || [] });
                  setSelected(null);
                }} color={th.secondary} size={22} pad="9px" title="שכפל" />
                <IconBtn name="share" onClick={() => { actions.share?.(selNotes[0]); setSelected(null); }}
                  color={th.secondary} size={22} pad="9px" title="שתף" />
              </>
            )}
            <IconBtn name="pin" onClick={bulkPin} color={th.accentText} size={22} pad="9px"
              filled={selNotes.every(n => n.pinned)}
              title={selNotes.every(n => n.pinned) ? "בטל הצמדה" : "הצמד"} />
            <IconBtn name="delete" onClick={() => setConfirmDel(selNotes)} color={th.red} size={22} pad="9px" title="מחק" />
            {/* The rest (colour · move · archive) live behind a compact menu so the
                bar never overflows. */}
            <div style={{ position: "relative" }}>
              <IconBtn name="more" onClick={() => setSelMenu(o => !o)} color={th.secondary} size={22} pad="9px" title="עוד" />
              {selMenu && (
                <>
                  <div onClick={() => setSelMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 30 }} />
                  <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 31,
                    minWidth: 190, background: th.surface, borderRadius: 12,
                    border: `1px solid ${th.border}`, boxShadow: "0 12px 34px rgba(0,0,0,0.3)",
                    overflow: "hidden", direction: "rtl" }}>
                    {[
                      { k: "color", label: "צבע לכולם", icon: "tag", on: () => { setSelMenu(false); setPickColor(true); } },
                      ...(projects.length > 0 ? [{ k: "move", label: "העבר לפרויקט", icon: "folder",
                        on: () => { setSelMenu(false); onMoveToProject?.(selNotes); setSelected(null); } }] : []),
                      { k: "arch", label: showArch ? "שחזר מהארכיון" : "לארכיון", icon: "download",
                        on: () => { setSelMenu(false); bulkArchive(); } },
                    ].map((m, i) => (
                      <button key={m.k} onClick={m.on}
                        style={{ display: "flex", alignItems: "center", gap: 12, width: "100%",
                          background: "transparent", border: "none", cursor: "pointer", fontFamily: FONT,
                          padding: "12px 15px", fontSize: 14.5, fontWeight: 500, color: th.text,
                          borderTop: i ? `1px solid ${th.border}` : "none" }}>
                        <span style={{ flex: 1, textAlign: "right" }}>{m.label}</span>
                        <Icon name={m.icon} size={18} color={th.secondary} />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </span>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 2px 12px", direction: "rtl" }}>
          <Icon name={showArch ? "download" : "notes"} size={19} color={th.accent} />
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: th.text }}>
            {showArch ? "ארכיון" : "פתקים"}
          </h2>
          <span style={{ fontSize: 12.5, color: th.muted }}>{showArch ? archCount : notesAll.length - archCount}</span>
          <span style={{ marginRight: "auto", display: "flex", gap: 4, alignItems: "center" }}>
            <IconBtn name="folder" onClick={() => { setShowArch(a => !a); setColor(null); }}
              color={showArch ? th.accent : th.muted} size={17} pad="6px"
              title={showArch ? "חזרה לפתקים" : `ארכיון (${archCount})`} />
            <IconBtn name="tag" onClick={() => setEditNames(true)} color={th.muted} size={17} pad="6px"
              title="שמות הצבעים" />
            <IconBtn name={view === "rows" ? "copy" : "notes"}
              onClick={() => setViewMode(view === "rows" ? "grid" : "rows")}
              color={th.muted} size={17} pad="6px"
              title={view === "rows" ? "תצוגת רשת" : "תצוגת שורות"} />
            {!showArch && (
              <IconBtn name="clip" onClick={paste} color={th.accentText} size={17} pad="6px"
                title="הדבק מהלוח כפתק חדש" />
            )}
          </span>
        </div>
      )}

      {/* Colour filter */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "0 0 10px", direction: "rtl" }}>
        <button onClick={() => setColor(null)}
          style={{ fontSize: 12, fontWeight: 600, fontFamily: FONT, padding: "6px 13px",
            borderRadius: 18, cursor: "pointer", border: "none",
            background: color === null ? th.accent : th.surface,
            color: color === null ? "#fff" : th.secondary }}>
          הכל
        </button>
        {PALETTE.map((c, i) => (
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
      </div>{/* /sticky toolbar */}


      {pool.length === 0 ? (
        <div style={{ textAlign: "center", padding: "30px 0", color: th.muted, direction: "rtl" }}>
          <Icon name={showArch ? "download" : "notes"} size={38} color={th.border} />
          <p style={{ fontSize: 14, marginTop: 8 }}>
            {showArch ? "הארכיון ריק"
              : color === null ? "עוד אין פתקים — לחץ + וכתוב את הראשון" : `אין פתקים בצבע "${nameOf(color)}"`}
          </p>
        </div>
      ) : view === "rows" ? (
        <div data-nokbd>
          {pool.map(n => <NoteRow key={n.id} {...noteProps(n)} />)}
        </div>
      ) : (
        <div data-nokbd style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, direction: "rtl" }}>
          {pool.map(n => <NoteCard key={n.id} {...noteProps(n)} actions={actions} />)}
        </div>
      )}

      {showSort && (
        <Modal onClose={() => setShowSort(false)} maxWidth={330} th={th}>
          <ModalHeader title="מיין לפי" icon="down" onClose={() => setShowSort(false)} th={th} />
          {SORTS.map(([v, label, icon]) => (
            <button key={v} onClick={() => chooseSort(v)}
              style={{ display: "flex", alignItems: "center", gap: 11, width: "100%",
                background: sortBy === v ? th.accentSoft : th.surface2,
                color: sortBy === v ? th.accentText : th.text,
                border: `1px solid ${sortBy === v ? th.accent : th.border}`,
                borderRadius: 12, padding: "12px 14px", marginBottom: 7, cursor: "pointer",
                fontFamily: FONT, fontSize: 14, fontWeight: 500, direction: "rtl", textAlign: "right" }}>
              <Icon name={icon} size={17} color={sortBy === v ? th.accentText : th.secondary} />
              {label}
              {sortBy === v && <span style={{ marginRight: "auto", display: "inline-flex" }}>
                <Icon name="check" size={15} color={th.accentText} /></span>}
            </button>
          ))}
        </Modal>
      )}

      {pickColor && (
        <Modal onClose={() => setPickColor(false)} maxWidth={330} th={th}>
          <ModalHeader title={`צבע ל-${selNotes.length} פתקים`} icon="tag" onClose={() => setPickColor(false)} th={th} />
          <div style={{ display: "flex", gap: 10, justifyContent: "center", padding: "4px 0 6px", direction: "rtl" }}>
            {PALETTE.map((c, i) => (
              <button key={i} onClick={() => bulkColor(i)} title={nameOf(i)}
                style={{ width: 36, height: 36, borderRadius: "50%", background: c, cursor: "pointer",
                  border: "2px solid rgba(127,127,127,0.3)" }} />
            ))}
          </div>
        </Modal>
      )}

      {confirmDel && (
        <Confirm title="העברה לפח האשפה" icon="delete"
          message={confirmDel.length === 1
            ? `"${(confirmDel[0].title || confirmDel[0].text || "הפתק").slice(0, 40)}" יעבור לפח — אפשר לשחזר משם תוך 30 יום.`
            : `${confirmDel.length} פתקים יעברו לפח — אפשר לשחזר משם תוך 30 יום.`}
          confirmLabel="העבר לפח"
          onConfirm={() => doDelete(confirmDel)}
          onCancel={() => setConfirmDel(null)} th={th} />
      )}

      {editing && (
        <NoteEditor th={th} colorNames={colorNames} scale={scale}
          initial={editing === "new" ? null : editing}
          pastePrompt={editing === "new" && pasteHint}
          defaultColor={color ?? 0}
          onCreate={onCreateNote}
          onUpdate={(id, patch) => actions.update?.(id, patch, editing === "new" ? null : editing)}
          onAction={(kind, note) => {
            if (kind === "share") actions.share?.(note);
            else if (kind === "remind") actions.remind?.(note);
            else if (kind === "move") onMoveToProject?.([note]);
            else if (kind === "archive") actions.update?.(note.id, { archived: !note.archived }, note);
            else if (kind === "pin") actions.update?.(note.id, { pinned: !note.pinned }, note);
            else if (kind === "delete") setConfirmDel([note]);   // always warn first
          }}
          onClose={() => { setEditing(null); setPasteHint(false); }} />
      )}

      {editNames && (
        <ColorNamesModal th={th} names={colorNames}
          onSave={names => { onSaveNames?.(names); setEditNames(false); }}
          onClose={() => setEditNames(false)} />
      )}
    </>
  );
}

// Today → time, otherwise a short date (ColorNote style).
function fmtStamp(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("he-IL", { day: "numeric", month: "short" });
}

// One full-width row per note. Tap opens (or toggles selection); long press
// starts selection. A selection circle appears while selecting.
function NoteRow({ note, th, sortBy, scale = 1, inSel, isSel, onTap, onLong }) {
  const c = NOTE_COLORS[note.colorIdx ?? 0];
  const bg = (note.colorIdx != null && th.pastels[note.colorIdx]) || th.surface;
  const press = usePress(onTap, onLong);

  const items = hasChecklist(note.text) ? parseChecklist(note.text) : null;
  const firstLabel = items && items[0] ? (items[0].label || "").trim() : "";
  const titleIsEcho = note.title &&
    (note.text || "").trim().replace(/^\s*(?:[-*]\s+|\[[ xX]\]\s*)/, "")
      .startsWith(note.title.replace(/…$/, ""));
  const showTitle = note.title && !titleIsEcho;
  const body = showTitle ? note.text : (note.text || "(מדיה בלבד)");
  const stamp = fmtStamp(sortBy === "modified" ? (note.updatedAt || note.createdAt) : note.createdAt);

  return (
    <div {...press}
      style={{ display: "flex", alignItems: "stretch", background: bg,
        border: isSel ? `2px solid ${th.accent}` : `1px solid ${th.border}`,
        borderRight: isSel ? `4px solid ${th.accent}` : `4px solid ${c}`,
        boxShadow: th.electric ? `0 0 10px ${isSel ? th.accent : c}1e` : "none",
        borderRadius: 13, marginBottom: 8, cursor: "pointer", direction: "rtl",
        userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none",
        overflow: "hidden" }}>
      {inSel && (
        <div style={{ display: "flex", alignItems: "center", paddingRight: 11 }}>
          <span style={{ width: 20, height: 20, borderRadius: "50%",
            border: isSel ? "none" : `2px solid ${th.borderStrong}`,
            background: isSel ? th.accent : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            {isSel && <Icon name="check" size={12} color="#fff" />}
          </span>
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0, padding: "12px 13px" }}>
        {items ? (
          <>
            {(showTitle ? note.title : firstLabel) && (
              <p style={{ margin: "0 0 3px", fontSize: Math.round(14.5 * scale), fontWeight: 700, color: th.text,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {showTitle ? note.title : firstLabel}
              </p>
            )}
            <p style={{ margin: 0, fontSize: Math.round(12.5 * scale), color: th.secondary }}>
              ☑ {items.filter(i => i.done).length}/{items.length} סומנו
            </p>
          </>
        ) : (
          <>
            {showTitle && (
              <p style={{ margin: "0 0 2px", fontSize: Math.round(14.5 * scale), fontWeight: 700, color: th.text,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {note.title}
              </p>
            )}
            <p style={{ margin: 0, fontSize: Math.round((showTitle ? 12.5 : 14) * scale), color: showTitle ? th.secondary : th.text,
              lineHeight: 1.5, overflow: "hidden", display: "-webkit-box",
              WebkitLineClamp: 2, WebkitBoxOrient: "vertical", wordBreak: "break-word" }}>
              {body}
            </p>
          </>
        )}
      </div>
      <div style={{ flexShrink: 0, padding: "12px 10px 12px 13px", display: "flex",
        flexDirection: "column", alignItems: "flex-end", justifyContent: "space-between", gap: 6 }}>
        <span style={{ fontSize: 11, color: th.muted, whiteSpace: "nowrap" }}>{stamp}</span>
        <span style={{ display: "flex", gap: 5 }}>
          {note.pinned && <Icon name="pin" size={12} color={th.accentText} filled />}
          {note.remindAt > Date.now() && <Icon name="bell" size={12} color={th.accentText} />}
          {note.images?.length > 0 && <Icon name="photo" size={12} color={th.muted} />}
          {note.files?.length > 0 && <Icon name="clip" size={12} color={th.muted} />}
        </span>
      </div>
    </div>
  );
}

// Compact colour card for the grid view. Checklist items stay tappable in
// place (outside selection mode) so a shopping list works without opening.
function NoteCard({ note, th, actions, sortBy, scale = 1, inSel, isSel, onTap, onLong }) {
  const c = NOTE_COLORS[note.colorIdx ?? 0];
  const bg = (note.colorIdx != null && th.pastels[note.colorIdx]) || th.surface;
  const press = usePress(onTap, onLong);
  const list = hasChecklist(note.text);
  // On a checklist the Checklist already renders the first item, so hide a title
  // that merely echoes it — but keep a real, distinct custom title.
  const titleIsEcho = note.title &&
    (note.text || "").trim().replace(/^\s*(?:[-*]\s+|\[[ xX]\]\s*)/, "")
      .startsWith(note.title.replace(/…$/, ""));
  const showCardTitle = note.title && !(list && titleIsEcho);

  return (
    <div {...press}
      style={{ position: "relative", background: bg, borderRadius: 13, padding: "11px 12px",
        cursor: "pointer",
        border: isSel ? `2px solid ${th.accent}` : `1px solid ${th.border}`,
        borderRight: isSel ? `4px solid ${th.accent}` : `4px solid ${c}`,
        boxShadow: th.electric ? `0 0 12px ${isSel ? th.accent : c}22` : "none",
        direction: "rtl", overflow: "hidden",
        userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }}>
      {inSel && (
        <span style={{ position: "absolute", top: 8, left: 8, width: 19, height: 19,
          borderRadius: "50%",
          border: isSel ? "none" : `2px solid ${th.borderStrong}`,
          background: isSel ? th.accent : "rgba(127,127,127,0.15)",
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          {isSel && <Icon name="check" size={11} color="#fff" />}
        </span>
      )}
      {note.pinned && !inSel && (
        <span style={{ position: "absolute", top: 8, left: 8 }}>
          <Icon name="pin" size={13} color={th.accentText} filled />
        </span>
      )}
      {showCardTitle && (
        <p style={{ margin: "0 0 5px", fontSize: Math.round(13 * scale), fontWeight: 700, color: th.text,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {note.title}
        </p>
      )}
      {list ? (
        <Checklist text={note.text} th={th} compact scale={scale}
          onToggle={i => { if (!inSel) actions.update?.(note.id, { text: toggleLine(note.text, i), html: "" }, note); }} />
      ) : (
        <p style={{ margin: 0, fontSize: Math.round(12 * scale), color: th.secondary, lineHeight: 1.55,
          overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical",
          wordBreak: "break-word" }}>
          {note.text || "(מדיה בלבד)"}
        </p>
      )}
    </div>
  );
}

function ColorNamesModal({ names, onSave, onClose, th }) {
  const [vals, setVals] = useState(() => PALETTE.map((_, i) => names[i] || ""));

  return (
    <Modal onClose={onClose} maxWidth={360} th={th}>
      <ModalHeader title="שמות הצבעים" icon="tag" onClose={onClose} th={th} />
      <p style={{ margin: "0 0 12px", fontSize: 12.5, color: th.muted, direction: "rtl", lineHeight: 1.6 }}>
        תן לכל צבע שם משלך — "קניות", "טיולים", "עבודה" — והוא יהפוך לקטגוריה אמיתית בסינון.
      </p>
      {PALETTE.map((c, i) => (
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
