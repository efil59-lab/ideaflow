// Notes: the reference lane, ColorNote style. Sort bar on top, one row per
// note, + opens a full-screen autosaving editor. Long-press starts multi-select
// (colour / archive / delete the whole selection); nothing here touches the
// Inbox funnel or the active counts.
import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { Icon, IconBtn } from "../ui/Icons";
import { Modal, ModalHeader, Confirm } from "../ui/base";
import Checklist, { hasChecklist, parseChecklist, toggleLine } from "../ui/Checklist";
import NoteEditor from "../ui/NoteEditor";
import ImageStrip from "../ui/ImageStrip";
import { LinkCard } from "../ui/LinkStrip";
import { safeHtml, hasRich } from "../ui/richtext";
import { pushBackLayer } from "../ui/backstack";
import { FONT, NOTE_COLORS, NOTE_COLOR_FALLBACK } from "../theme";

// All six colours are offered again now that the filter chips live in a
// collapsible panel (the palette button in the header) instead of a fixed row.
const PALETTE = NOTE_COLORS;

// A note is "new" for its first week — a tiny badge marks it.
const isNewNote = n => n.createdAt && (Date.now() - n.createdAt) < 7 * 864e5;
// Days until a deleted (archived-with-timestamp) note is purged for good.
const daysToPurge = n => (n.deletedAt ? Math.max(0, Math.ceil((n.deletedAt + 30 * 864e5 - Date.now()) / 864e5)) : null);

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

// The notes "motto" — mirrors the projects hero, with notes data. Big count +
// checklist progress + a colour-distribution bar, then a few glance tiles. Same
// gradient/electric treatment so the two screens feel like one product.
function NotesStats({ notesAll, archCount, th, nameOf, folderCount = 0, onActive, onFolders, onArchive }) {
  const active = notesAll.filter(n => !n.archived);
  if (!active.length) return null;

  let done = 0, total = 0;
  active.forEach(n => parseChecklist(n.text).forEach(it => { total++; if (it.done) done++; }));
  const pct = total ? Math.round((done / total) * 100) : 0;
  const byColor = NOTE_COLORS.map((c, i) => ({ c, i, n: active.filter(x => (x.colorIdx ?? 0) === i).length }))
    .filter(g => g.n).sort((a, b) => b.n - a.n);
  const newWk = active.filter(isNewNote).length;
  const lists = active.filter(n => hasChecklist(n.text)).length;

  const heroInk = (th.electric || th.vivid) ? "#fff" : th.text;
  const heroSub = (th.electric || th.vivid) ? "rgba(255,255,255,0.72)" : th.muted;

  return (
    <>
      <div style={{ position: "relative", overflow: "hidden",
        background: th.electric
          ? "linear-gradient(135deg,#1A1040 0%,#101634 55%,#0C1026 100%)"
          : th.vivid ? th.grad : th.surface,
        border: th.electric ? "1px solid rgba(168,85,247,0.3)"
          : th.vivid ? "none" : `1px solid ${th.border}`,
        boxShadow: th.electric ? "0 0 34px rgba(124,58,237,0.28)" : "none",
        borderRadius: 18, padding: "16px 16px 14px", marginBottom: 10, direction: "rtl" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <span style={{ width: 44, height: 44, borderRadius: 14, flexShrink: 0,
            background: th.electric ? "rgba(168,85,247,0.18)"
              : th.vivid ? "rgba(255,255,255,0.2)" : th.accentSoft,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: th.electric ? "0 0 16px rgba(168,85,247,0.4)" : "none" }}>
            <Icon name="notes" size={22} color={heroInk} />
          </span>
          <span style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
            <span style={{ fontSize: 38, fontWeight: 800, color: heroInk, letterSpacing: -0.5 }}>{active.length}</span>
            <span style={{ fontSize: 12.5, fontWeight: 500, color: heroSub, marginTop: 4 }}>פתקים</span>
          </span>
          {total > 0 && (
            <span style={{ marginRight: "auto", textAlign: "left", display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: heroInk }}>{pct}%</span>
              <span style={{ fontSize: 11, color: heroSub }}>סומנו</span>
            </span>
          )}
        </div>

        <div style={{ display: "flex", height: 9, borderRadius: 99, overflow: "hidden",
          background: th.electric || th.vivid ? "rgba(255,255,255,0.13)" : th.surface2,
          border: th.electric || th.vivid ? "none" : `1px solid ${th.border}` }}>
          {byColor.map(g => (
            <div key={g.i} title={`${nameOf(g.i)}: ${g.n}`}
              style={{ width: `${(g.n / active.length) * 100}%`, background: g.c,
                boxShadow: th.electric ? `0 0 10px ${g.c}` : "none" }} />
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 9, fontSize: 12, color: heroSub }}>
          <span>{total ? `${done}/${total} סומנו` : `${byColor.length} צבעים בשימוש`}</span>
          {newWk > 0 && <span style={{ marginRight: "auto", color: heroInk, fontWeight: 600 }}>{newWk} חדשים השבוע ›</span>}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, direction: "rtl" }}>
        {[[active.length, "פעילים", onActive], [folderCount, "תיקיות", onFolders], [archCount, "ארכיון", onArchive]].map(([n, label, on]) => (
          <button key={label} onClick={on}
            style={{ flex: 1, background: th.surface, borderRadius: 13,
              border: `1px solid ${th.border}`, padding: "9px 10px", textAlign: "center",
              cursor: "pointer", fontFamily: FONT }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: th.text }}>{n}</div>
            <div style={{ fontSize: 11, color: th.muted, marginTop: 1 }}>{label}</div>
          </button>
        ))}
      </div>
    </>
  );
}

export default function Notes({ uid, ideas, th, actions, onCapture, onCreateNote,
  projects = [], onMoveToProject, noteFont = 0, colorNames = [], onSaveNames,
  folders = [], onSaveFolders }) {
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
  const [showColorFilter, setShowColorFilter] = useState(false);   // colour chips, toggled by the palette icon
  const [pasteHint, setPasteHint] = useState(false);     // opened via clip but clipboard was blocked
  // Folders: the active folder filters the list; null = the clean "unfiled"
  // main screen. Entering the app always starts here on the general view — the
  // last-open folder is not remembered across launches (by request).
  const [activeFolder, setActiveFolder] = useState(null);
  const [folderPickFor, setFolderPickFor] = useState(null);   // notes awaiting a folder | null
  const [newFolderOpen, setNewFolderOpen] = useState(false);  // create-folder prompt
  const [manageFolder, setManageFolder] = useState(null);     // folder action sheet (rename/delete)
  const [renameFolderObj, setRenameFolderObj] = useState(null);
  const [delFolder, setDelFolder] = useState(null);           // folder pending delete confirmation
  const [foldersOverview, setFoldersOverview] = useState(false); // stats → folders list

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
  // A persisted folder that was since deleted falls back to the main list.
  const validFolder = folders.some(f => f.id === activeFolder) ? activeFolder : null;
  const folderCount = id => notesAll.filter(n => !n.archived && (n.folderId || null) === id).length;
  const unfiledCount = folderCount(null);
  let pool = notesAll.filter(n => !!n.archived === showArch);
  // The archive shows everything; the live list is scoped to the active folder
  // (null = unfiled), which is what keeps the main screen clean.
  if (!showArch) pool = pool.filter(n => (n.folderId || null) === validFolder);
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
    // Restoring from the archive also clears any pending-delete countdown.
    selNotes.forEach(n => actions.update?.(n.id, showArch ? { archived: false, deletedAt: null } : { archived: true }, n));
    setSelected(null);
  };
  const bulkPin = () => {
    const pin = !selNotes.every(n => n.pinned);   // pin all, unless already all pinned
    selNotes.forEach(n => actions.update?.(n.id, { pinned: pin }, n));
    setSelected(null);
  };
  const selectAll = () => setSelected(new Set(pool.map(n => n.id)));
  const doDelete = list => {
    // Deleting a note sends it to the notes ARCHIVE with a 30-day countdown;
    // deleting from inside the archive removes it for good.
    if (showArch) list.forEach(n => actions.destroy?.(n));
    else list.forEach(n => actions.update?.(n.id, { archived: true, deletedAt: Date.now(), pinned: false, remindAt: null }, n));
    setConfirmDel(null);
    setSelected(null);
  };

  // ── folders ──────────────────────────────────────────────────────────────
  const chooseFolder = id => setActiveFolder(id);
  const createFolder = name => {
    const f = { id: "f_" + Date.now(), name: (name || "").trim() || "תיקייה" };
    onSaveFolders?.([...folders, f]);
    return f;
  };
  const renameFolder = (id, name) =>
    onSaveFolders?.(folders.map(f => (f.id === id ? { ...f, name: (name || "").trim() || f.name } : f)));
  const deleteFolder = id => {
    notesAll.filter(n => n.folderId === id).forEach(n => actions.update?.(n.id, { folderId: null }, n));
    onSaveFolders?.(folders.filter(f => f.id !== id));
    if (validFolder === id) chooseFolder(null);
    setManageFolder(null);
  };
  // File a set of notes into a folder (id, or null to unfile), then leave select.
  const fileInto = (notesList, id) => {
    notesList.forEach(n => actions.update?.(n.id, { folderId: id }, n));
    setFolderPickFor(null);
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
      {/* The shared "motto" hero — same shape as the projects screen, with notes
          data. Scrolls away above the pinned toolbar. */}
      {!showArch && !inSel && !validFolder && (
        <NotesStats notesAll={notesAll} archCount={archCount} th={th} nameOf={nameOf}
          folderCount={folders.length}
          onActive={() => { setShowArch(false); chooseFolder(null); }}
          onFolders={() => (folders.length ? setFoldersOverview(true) : setNewFolderOpen(true))}
          onArchive={() => { setColor(null); setShowArch(true); }} />
      )}

      {/* The whole toolbar (sort · title · colours) stays pinned under the app
          header while the notes scroll. */}
      <div style={{ position: "sticky", top: 0, zIndex: 20,
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
          {selNotes.length < pool.length && (
            <button onClick={selectAll}
              style={{ background: "transparent", border: "none", cursor: "pointer", fontFamily: FONT,
                fontSize: 12.5, fontWeight: 700, color: th.accentText, padding: "4px 6px" }}>
              סמן הכל
            </button>
          )}
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
                      { k: "folder", label: "העבר לתיקייה", icon: "folder",
                        on: () => { setSelMenu(false); setFolderPickFor(selNotes); } },
                      ...(projects.length > 0 ? [{ k: "move", label: "העבר לפרויקט", icon: "inbox",
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
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: th.text,
            maxWidth: "55vw", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {showArch ? "ארכיון" : validFolder ? folders.find(f => f.id === validFolder)?.name : "פתקים"}
          </h2>
          <span style={{ fontSize: 12.5, color: th.muted }}>
            {showArch ? archCount : validFolder ? folderCount(validFolder) : unfiledCount}</span>
          <span style={{ marginRight: "auto", display: "flex", gap: 4, alignItems: "center" }}>
            {/* Palette: opens the colour filter chips */}
            <button onClick={() => setShowColorFilter(o => !o)} title="סינון לפי צבע"
              style={{ background: (showColorFilter || color !== null) ? th.accentSoft : "transparent",
                border: "none", borderRadius: 9, cursor: "pointer", padding: "6px",
                display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, width: 17, height: 17 }}>
                {[0, 1, 3, 4].map(i => (
                  <span key={i} style={{ background: NOTE_COLORS[i], borderRadius: 2,
                    outline: color === i ? `1.5px solid ${th.text}` : "none" }} />
                ))}
              </span>
            </button>
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

      {/* Folder bar — a chip per folder plus the clean unfiled "פתקים" view.
          Tap filters; long-press a folder to rename/delete; + creates one. */}
      {!inSel && !showArch && (
        <div data-noswipe style={{ display: "flex", gap: 7, overflowX: "auto", margin: "0 0 12px",
          paddingBottom: 3, direction: "rtl", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
          <FolderChip label="פתקים" icon="notes" count={unfiledCount}
            active={validFolder === null} onClick={() => chooseFolder(null)} th={th} />
          {folders.map(f => (
            <FolderChip key={f.id} label={f.name} icon="folder" count={folderCount(f.id)}
              active={validFolder === f.id} onClick={() => chooseFolder(f.id)}
              onLong={() => setManageFolder(f)} th={th} />
          ))}
          <button onClick={() => setNewFolderOpen(true)} title="תיקייה חדשה"
            style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4,
              padding: "7px 13px", borderRadius: 18, cursor: "pointer", fontFamily: FONT,
              fontSize: 12.5, fontWeight: 700, background: "transparent", color: th.accentText,
              border: `1px dashed ${th.borderStrong || th.border}`, whiteSpace: "nowrap" }}>
            <Icon name="add" size={14} color={th.accentText} /> תיקייה
          </button>
        </div>
      )}

      {/* Colour filter — revealed by the palette icon */}
      {showColorFilter && (
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
      )}
      </div>{/* /sticky toolbar */}


      {pool.length === 0 ? (
        <div style={{ textAlign: "center", padding: "30px 0", color: th.muted, direction: "rtl" }}>
          <Icon name={showArch ? "download" : "notes"} size={38} color={th.border} />
          <p style={{ fontSize: 14, marginTop: 8 }}>
            {showArch ? "הארכיון ריק"
              : color !== null ? `אין פתקים בצבע "${nameOf(color)}"`
              : validFolder ? "התיקייה ריקה — העבר לכאן פתקים דרך בחירה מרובה או תפריט הפתק"
              : "עוד אין פתקים — לחץ + וכתוב את הראשון"}
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
        <Confirm title={showArch ? "מחיקה לצמיתות" : "מחיקת פתק"} icon="delete"
          message={showArch
            ? (confirmDel.length === 1
                ? `"${(confirmDel[0].title || confirmDel[0].text || "הפתק").slice(0, 40)}" יימחק לצמיתות — לא ניתן לשחזר.`
                : `${confirmDel.length} פתקים יימחקו לצמיתות — לא ניתן לשחזר.`)
            : (confirmDel.length === 1
                ? `"${(confirmDel[0].title || confirmDel[0].text || "הפתק").slice(0, 40)}" יעבור לארכיון ויימחק אוטומטית בעוד 30 יום. אפשר לשחזר עד אז.`
                : `${confirmDel.length} פתקים יעברו לארכיון ויימחקו אוטומטית בעוד 30 יום.`)}
          confirmLabel={showArch ? "מחק לצמיתות" : "העבר לארכיון"}
          onConfirm={() => doDelete(confirmDel)}
          onCancel={() => setConfirmDel(null)} th={th} />
      )}

      {editing && (
        <NoteEditor th={th} colorNames={colorNames} scale={scale} uid={uid}
          initial={editing === "new" ? null : editing}
          pastePrompt={editing === "new" && pasteHint}
          defaultColor={color ?? 0}
          onCreate={onCreateNote}
          onUpdate={(id, patch) => actions.update?.(id, patch, editing === "new" ? null : editing)}
          onAction={(kind, note) => {
            if (kind === "share") actions.share?.(note);
            else if (kind === "remind") actions.remind?.(note);
            else if (kind === "move") onMoveToProject?.([note]);
            else if (kind === "folder") setFolderPickFor([note]);
            else if (kind === "archive") actions.update?.(note.id, note.archived ? { archived: false, deletedAt: null } : { archived: true }, note);
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

      {/* Pick a folder for one or more notes (or create one on the spot). */}
      {folderPickFor && (
        <FolderPicker th={th} folders={folders} count={folderPickFor.length}
          current={folderPickFor.length === 1 ? (folderPickFor[0].folderId || null) : undefined}
          onPick={id => fileInto(folderPickFor, id)}
          onCreate={name => { const f = createFolder(name); fileInto(folderPickFor, f.id); }}
          onClose={() => setFolderPickFor(null)} />
      )}

      {newFolderOpen && (
        <FolderNameModal th={th} title="תיקייה חדשה" confirmLabel="צור"
          onSave={name => { const f = createFolder(name); setNewFolderOpen(false); chooseFolder(f.id); }}
          onClose={() => setNewFolderOpen(false)} />
      )}

      {renameFolderObj && (
        <FolderNameModal th={th} title="שינוי שם" confirmLabel="שמור" initial={renameFolderObj.name}
          onSave={name => { renameFolder(renameFolderObj.id, name); setRenameFolderObj(null); }}
          onClose={() => setRenameFolderObj(null)} />
      )}

      {manageFolder && (
        <Modal onClose={() => setManageFolder(null)} maxWidth={320} th={th}>
          <ModalHeader title={manageFolder.name} icon="folder" onClose={() => setManageFolder(null)} th={th} />
          {[
            { k: "rename", label: "שינוי שם", icon: "edit",
              on: () => { setRenameFolderObj(manageFolder); setManageFolder(null); } },
            { k: "del", label: "מחיקת תיקייה", icon: "delete", danger: true,
              on: () => { setDelFolder(manageFolder); setManageFolder(null); } },
          ].map((m, i) => (
            <button key={m.k} onClick={m.on}
              style={{ display: "flex", alignItems: "center", gap: 11, width: "100%",
                background: th.surface2, color: m.danger ? th.red : th.text,
                border: `1px solid ${th.border}`, borderRadius: 12, padding: "12px 14px",
                marginBottom: 7, cursor: "pointer", fontFamily: FONT, fontSize: 14, fontWeight: 500,
                direction: "rtl", textAlign: "right" }}>
              <Icon name={m.icon} size={17} color={m.danger ? th.red : th.secondary} />
              {m.label}
            </button>
          ))}
        </Modal>
      )}

      {delFolder && (
        <Confirm title="מחיקת תיקייה" icon="delete"
          message={`התיקייה "${delFolder.name}" תימחק. הפתקים שבתוכה לא יימחקו — הם יחזרו למסך הפתקים הראשי.`}
          confirmLabel="מחק תיקייה"
          onConfirm={() => { deleteFolder(delFolder.id); setDelFolder(null); }}
          onCancel={() => setDelFolder(null)} th={th} />
      )}

      {foldersOverview && (
        <Modal onClose={() => setFoldersOverview(false)} maxWidth={340} th={th}>
          <ModalHeader title="התיקיות שלי" icon="folder" onClose={() => setFoldersOverview(false)} th={th} />
          <div style={{ display: "flex", flexDirection: "column", gap: 7, direction: "rtl" }}>
            <button onClick={() => { chooseFolder(null); setShowArch(false); setFoldersOverview(false); }}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: th.surface2,
                color: th.text, border: `1px solid ${th.border}`, borderRadius: 12, padding: "12px 14px",
                cursor: "pointer", fontFamily: FONT, fontSize: 14, fontWeight: 600, textAlign: "right" }}>
              <Icon name="notes" size={17} color={th.secondary} />
              <span style={{ flex: 1 }}>פתקים (ללא תיקייה)</span>
              <span style={{ fontSize: 12.5, color: th.muted, fontWeight: 700 }}>{unfiledCount}</span>
            </button>
            {folders.map(f => (
              <button key={f.id} onClick={() => { chooseFolder(f.id); setShowArch(false); setFoldersOverview(false); }}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: th.surface2,
                  color: th.text, border: `1px solid ${th.border}`, borderRadius: 12, padding: "12px 14px",
                  cursor: "pointer", fontFamily: FONT, fontSize: 14, fontWeight: 500, textAlign: "right" }}>
                <Icon name="folder" size={17} color={th.secondary} />
                <span style={{ flex: 1 }}>{f.name}</span>
                <span style={{ fontSize: 12.5, color: th.muted, fontWeight: 700 }}>{folderCount(f.id)}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}

// A pill in the folder bar. Tap filters to the folder AND slides the strip so
// the tapped chip centres — revealing the next folder that was off-screen.
// Long-press (folders only) opens the rename/delete sheet.
function FolderChip({ label, icon, count, active, onClick, onLong, th }) {
  const ref = useRef(null);
  const activate = () => {
    onClick?.();
    try { ref.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }); }
    catch { /* older engines */ }
  };
  const press = usePress(activate, onLong || (() => {}));
  return (
    <button ref={ref} {...(onLong ? press : { onClick: activate })}
      style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6,
        padding: "7px 13px", borderRadius: 18, cursor: "pointer", fontFamily: FONT,
        fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap", userSelect: "none",
        WebkitUserSelect: "none", WebkitTouchCallout: "none",
        background: active ? th.accent : th.surface,
        color: active ? "#fff" : th.secondary,
        border: `1px solid ${active ? th.accent : th.border}` }}>
      <Icon name={icon} size={13} color={active ? "#fff" : th.muted} />
      {label}
      {count > 0 && (
        <span style={{ fontSize: 11, fontWeight: 700, opacity: active ? 0.9 : 0.6 }}>{count}</span>
      )}
    </button>
  );
}

// Assigns note(s) to a folder: pick an existing one, remove from any folder, or
// type a new folder name.
function FolderPicker({ folders, count, current, onPick, onCreate, onClose, th }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  return (
    <Modal onClose={onClose} maxWidth={340} th={th}>
      <ModalHeader title={count > 1 ? `העברת ${count} פתקים לתיקייה` : "העברה לתיקייה"}
        icon="folder" onClose={onClose} th={th} />
      <div style={{ display: "flex", flexDirection: "column", gap: 7, direction: "rtl" }}>
        {folders.map(f => (
          <button key={f.id} onClick={() => onPick(f.id)}
            style={{ display: "flex", alignItems: "center", gap: 10, width: "100%",
              background: current === f.id ? th.accentSoft : th.surface2,
              color: current === f.id ? th.accentText : th.text,
              border: `1px solid ${current === f.id ? th.accent : th.border}`,
              borderRadius: 12, padding: "12px 14px", cursor: "pointer",
              fontFamily: FONT, fontSize: 14, fontWeight: 500, textAlign: "right" }}>
            <Icon name="folder" size={17} color={current === f.id ? th.accentText : th.secondary} />
            <span style={{ flex: 1 }}>{f.name}</span>
            {current === f.id && <Icon name="check" size={15} color={th.accentText} />}
          </button>
        ))}
        {current != null && current !== undefined && (
          <button onClick={() => onPick(null)}
            style={{ display: "flex", alignItems: "center", gap: 10, width: "100%",
              background: th.surface2, color: th.secondary, border: `1px solid ${th.border}`,
              borderRadius: 12, padding: "12px 14px", cursor: "pointer",
              fontFamily: FONT, fontSize: 14, fontWeight: 500, textAlign: "right" }}>
            <Icon name="close" size={16} color={th.secondary} />
            <span style={{ flex: 1 }}>הסר מהתיקייה</span>
          </button>
        )}
        {adding ? (
          <form onSubmit={e => { e.preventDefault(); if (name.trim()) onCreate(name.trim()); }}
            style={{ display: "flex", gap: 7, marginTop: 2 }}>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="שם התיקייה"
              style={{ flex: 1, minWidth: 0, border: `1px solid ${th.border}`, borderRadius: 10,
                padding: "10px 12px", fontFamily: FONT, fontSize: 14, direction: "rtl",
                background: th.inputBg, color: th.text, outline: "none" }} />
            <button type="submit"
              style={{ border: "none", borderRadius: 10, padding: "0 16px", cursor: "pointer",
                background: th.cta || th.accent, color: "#fff", fontFamily: FONT, fontWeight: 700 }}>צור</button>
          </form>
        ) : (
          <button onClick={() => setAdding(true)}
            style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", marginTop: 2,
              background: "transparent", color: th.accentText, border: `1px dashed ${th.borderStrong || th.border}`,
              borderRadius: 12, padding: "12px 14px", cursor: "pointer",
              fontFamily: FONT, fontSize: 14, fontWeight: 700, textAlign: "right" }}>
            <Icon name="add" size={16} color={th.accentText} />
            <span style={{ flex: 1 }}>תיקייה חדשה</span>
          </button>
        )}
      </div>
    </Modal>
  );
}

// A single-field name prompt for creating or renaming a folder.
function FolderNameModal({ title, confirmLabel = "שמור", initial = "", onSave, onClose, th }) {
  const [name, setName] = useState(initial);
  return (
    <Modal onClose={onClose} maxWidth={330} th={th}>
      <ModalHeader title={title} icon="folder" onClose={onClose} th={th} />
      <form onSubmit={e => { e.preventDefault(); if (name.trim()) onSave(name.trim()); }}
        style={{ display: "flex", flexDirection: "column", gap: 10, direction: "rtl" }}>
        <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="שם התיקייה"
          style={{ border: `1px solid ${th.border}`, borderRadius: 11, padding: "12px 14px",
            fontFamily: FONT, fontSize: 15, direction: "rtl", background: th.inputBg,
            color: th.text, outline: "none" }} />
        <button type="submit" disabled={!name.trim()}
          style={{ border: "none", borderRadius: 12, padding: "12px", cursor: name.trim() ? "pointer" : "default",
            background: name.trim() ? (th.cta || th.accent) : th.border, color: "#fff",
            fontFamily: FONT, fontSize: 15, fontWeight: 700, opacity: name.trim() ? 1 : 0.6 }}>
          {confirmLabel}
        </button>
      </form>
    </Modal>
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
  // A shared link puts the same caption in the title and the body, which would
  // trip the echo test and drop the bold title — but here the bold header is
  // exactly what we want, so keep it for any note carrying a link.
  const showTitle = note.title && (!titleIsEcho || note.links?.length > 0);
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
            <p className={hasRich(note.html) ? "if-rich-view" : undefined}
              style={{ margin: 0, fontSize: Math.round((showTitle ? 12.5 : 14) * scale), color: showTitle ? th.secondary : th.text,
                lineHeight: 1.5, overflow: "hidden", display: "-webkit-box",
                WebkitLineClamp: 2, WebkitBoxOrient: "vertical", wordBreak: "break-word" }}
              {...(hasRich(note.html) ? { dangerouslySetInnerHTML: { __html: safeHtml(note.html) } } : {})}>
              {hasRich(note.html) ? undefined : body}
            </p>
          </>
        )}
      </div>
      <div style={{ flexShrink: 0, padding: "12px 10px 12px 13px", display: "flex",
        flexDirection: "column", alignItems: "flex-end", justifyContent: "space-between", gap: 6 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
          {note.deletedAt ? (
            <span style={{ fontSize: 9, fontWeight: 800, color: "#fff", background: th.red,
              borderRadius: 6, padding: "1px 6px", letterSpacing: 0.2, whiteSpace: "nowrap" }}>
              יימחק בעוד {daysToPurge(note)} י׳
            </span>
          ) : isNewNote(note) && (
            <span style={{ fontSize: 9, fontWeight: 800, color: "#fff", background: th.accent,
              borderRadius: 6, padding: "1px 6px", letterSpacing: 0.3 }}>חדש</span>
          )}
          <span style={{ fontSize: 11, color: th.muted, whiteSpace: "nowrap" }}>{stamp}</span>
        </div>
        <span style={{ display: "flex", gap: 5 }}>
          {note.pinned && <Icon name="pin" size={12} color={th.accentText} filled />}
          {note.remindAt > Date.now() && <Icon name="bell" size={12} color={th.accentText} />}
          {note.audios?.length > 0 && <Icon name="mic" size={12} color={th.muted} />}
          {note.images?.length > 0 && <Icon name="photo" size={12} color={th.muted} />}
          {note.files?.length > 0 && <Icon name="clip" size={12} color={th.muted} />}
          {note.links?.length > 0 && <Icon name="link" size={12} color={th.muted} />}
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
  const items = list ? parseChecklist(note.text) : null;

  // Every grid card is the same square; content that overflows is faded out with
  // a "המשך…" hint, and tapping the card opens the note.
  const bodyRef = useRef(null);
  const [truncated, setTruncated] = useState(false);
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (el) setTruncated(el.scrollHeight > el.clientHeight + 2);
  }, [note.text, note.title, scale, note.colorIdx, showCardTitle]);

  return (
    <div {...press}
      style={{ position: "relative", background: bg, borderRadius: 13, padding: "11px 12px",
        cursor: "pointer", aspectRatio: "1 / 1", display: "flex", flexDirection: "column",
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
      {isNewNote(note) && !inSel && (
        <span style={{ position: "absolute", top: 8, left: note.pinned ? 30 : 8,
          fontSize: 9, fontWeight: 800, color: "#fff", background: th.accent,
          borderRadius: 6, padding: "1px 6px", letterSpacing: 0.3 }}>חדש</span>
      )}
      {showCardTitle && (
        <p style={{ margin: "0 0 5px", fontSize: Math.round(13 * scale), fontWeight: 700, color: th.text,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }}>
          {note.title}
        </p>
      )}
      <div ref={bodyRef} style={{ flex: 1, minHeight: 0, overflow: "hidden", position: "relative" }}>
        {items ? (
          <div>
            {items.map(it => (
              <div key={it.i} style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 3 }}>
                <span style={{ flexShrink: 0, width: 13, height: 13, borderRadius: 4, marginTop: 2,
                  border: it.done ? "none" : `1.5px solid ${th.dark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)"}`,
                  background: it.done ? th.green : (th.dark ? "rgba(255,255,255,0.14)" : "#fff"),
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {it.done && <Icon name="check" size={9} color="#fff" />}
                </span>
                <span style={{ fontSize: Math.round(11.5 * scale), lineHeight: 1.4, wordBreak: "break-word",
                  color: it.done ? th.muted : th.secondary, textDecoration: it.done ? "line-through" : "none" }}>
                  {it.label}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className={hasRich(note.html) ? "if-rich-view" : undefined}
            style={{ margin: 0, fontSize: Math.round(12 * scale), color: th.secondary, lineHeight: 1.55,
              whiteSpace: "pre-wrap", wordBreak: "break-word" }}
            {...(hasRich(note.html) ? { dangerouslySetInnerHTML: { __html: safeHtml(note.html) } } : {})}>
            {hasRich(note.html) ? undefined : (note.text || "(מדיה בלבד)")}
          </p>
        )}
        {truncated && (
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 30,
            background: `linear-gradient(transparent, ${bg} 70%)`, pointerEvents: "none",
            display: "flex", alignItems: "flex-end" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: th.accentText }}>המשך…</span>
          </div>
        )}
      </div>
      {note.images?.length > 0 && (
        <div style={{ flexShrink: 0, marginTop: 8 }}>
          <ImageStrip images={note.images} th={th} size={42} />
        </div>
      )}
      {note.links?.length > 0 && (
        <div style={{ flexShrink: 0, marginTop: 8 }}>
          <LinkCard link={note.links[0]} th={th} compact />
        </div>
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
