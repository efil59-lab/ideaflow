// Projects: list view + project detail (capture in context, notes, done toggle) + trash.
import { useState } from "react";
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import CaptureBar from "../ui/CaptureBar";
import IdeaList, { SortToggle } from "../ui/IdeaList";
import { Icon, IconBtn } from "../ui/Icons";
import { Modal, ModalHeader, Confirm } from "../ui/base";
import { ProjectShareModal } from "../ui/sheets";
import { useSharedIdeas } from "../data/store";

import { FONT, fmt } from "../theme";

const projSort = (a, b) =>
  (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)
  || (a.order ?? Infinity) - (b.order ?? Infinity)
  || (a.createdAt || 0) - (b.createdAt || 0);

export default function Projects({ uid, ideas, projects, th, actions, projActions, onCapture,
  openProjectId, setOpenProjectId, commentSeen = {},
  myShares = {}, sharedWithMe = [], shareActions, onSharedCapture }) {
  const open = projects.find(p => p.id === openProjectId);
  if (openProjectId === "__trash__") {
    return <TrashView ideas={ideas} th={th} actions={actions} onBack={() => setOpenProjectId(null)} />;
  }
  if (typeof openProjectId === "string" && openProjectId.startsWith("share:")) {
    const share = sharedWithMe.find(s => s.id === openProjectId.slice(6));
    if (share) {
      return <SharedProjectView uid={uid} share={share} th={th} actions={actions}
        onCapture={onSharedCapture} onBack={() => setOpenProjectId(null)} />;
    }
    setOpenProjectId(null);
    return null;
  }
  return open
    ? <ProjectDetail uid={uid} project={open} ideas={ideas} projects={projects} th={th}
        actions={actions} projActions={projActions} onCapture={onCapture}
        share={myShares[open.id]} shareActions={shareActions}
        onBack={() => setOpenProjectId(null)} />
    : <ProjectsIndex uid={uid} projects={projects} ideas={ideas} th={th} projActions={projActions}
        myShares={myShares} sharedWithMe={sharedWithMe} commentSeen={commentSeen}
        onOpen={setOpenProjectId} />;
}

// Guest view of a project shared with me: live ideas, comment, add — no editing.
// Defaults to open ideas; the eye toggle reveals the done archive, like the owner has.
function SharedProjectView({ uid, share, th, actions, onCapture, onBack }) {
  const [showDone, setShowDone] = useState(false);
  const ideas = useSharedIdeas(share.ownerUid, share.projectId);
  const list = (ideas || []).filter(i =>
    i.status !== "trash" && (showDone ? i.status === "done" : i.status !== "done"));

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <button onClick={onBack}
          style={{ display: "inline-flex", alignItems: "center", gap: 5,
            background: th.surface, color: th.secondary, border: `1px solid ${th.border}`,
            borderRadius: 18, padding: "6px 12px", cursor: "pointer",
            fontSize: 13, fontWeight: 600, fontFamily: FONT }}>
          <span style={{ display: "inline-flex", transform: "rotate(180deg)" }}>
            <Icon name="back" size={14} color={th.secondary} />
          </span>
          חזרה
        </button>
        <span style={{ width: 12, height: 12, borderRadius: "50%", background: share.projectColor }} />
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: th.text, flex: 1 }}>{share.projectName}</h2>
        <IconBtn name={showDone ? "eyeoff" : "eye"} onClick={() => setShowDone(p => !p)}
          color={showDone ? th.accent : th.muted} size={17} pad="7px" title="הצג בוצעו" />
      </div>
      <p style={{ margin: "0 0 12px", fontSize: 12, color: th.muted,
        display: "flex", alignItems: "center", gap: 5 }}>
        <Icon name="share" size={12} color={th.muted} />
        משותף על ידי {share.ownerName || share.ownerEmail}
      </p>

      <CaptureBar uid={uid} th={th} placeholder={`רעיון חדש ב"${share.projectName}"...`}
        draftKey={`if_draft_s_${share.id}`}
        onCapture={data => onCapture(share, data)} />

      <div style={{ height: 14 }} />
      {ideas === null
        ? <p style={{ textAlign: "center", color: th.muted, fontSize: 13, padding: "20px 0" }}>טוען...</p>
        : <IdeaList ideas={list} projects={[]} th={th} shared
            actions={{ comments: idea => actions.shareComments(share, idea), tag: null, openProject: null }}
            emptyText={showDone ? "אין רעיונות שבוצעו" : "אין רעיונות בפרויקט עדיין — הוסף את הראשון"} />}
    </>
  );
}

function TrashView({ ideas, th, actions, onBack }) {
  const [confirmIdea, setConfirmIdea] = useState(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const list = ideas.filter(i => i.status === "trash")
    .sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <button onClick={onBack}
          style={{ display: "inline-flex", alignItems: "center", gap: 5,
            background: th.surface, color: th.secondary, border: `1px solid ${th.border}`,
            borderRadius: 18, padding: "6px 12px", cursor: "pointer",
            fontSize: 13, fontWeight: 600, fontFamily: FONT }}>
          <span style={{ display: "inline-flex", transform: "rotate(180deg)" }}>
            <Icon name="back" size={14} color={th.secondary} />
          </span>
          חזרה
        </button>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: th.text, flex: 1 }}>פח אשפה</h2>
        {list.length > 0 && (
          <button onClick={() => setConfirmAll(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "transparent",
              color: th.red, border: `1px solid ${th.border}`, borderRadius: 18, padding: "6px 13px",
              cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: FONT }}>
            <Icon name="delete" size={14} color={th.red} /> רוקן הכל
          </button>
        )}
      </div>
      <p style={{ margin: "0 0 12px", fontSize: 12, color: th.muted }}>
        רעיונות נמחקים לצמיתות אחרי 30 יום בפח
      </p>

      {list.length === 0 && (
        <div style={{ textAlign: "center", padding: "36px 0", color: th.muted }}>
          <Icon name="delete" size={40} color={th.border} />
          <p style={{ fontSize: 14, marginTop: 8 }}>הפח ריק</p>
        </div>
      )}

      {list.map(i => (
        <div key={i.id} style={{ background: th.surface, border: `1px solid ${th.border}`,
          borderRadius: 13, padding: "11px 13px", marginBottom: 9, direction: "rtl" }}>
          <p style={{ margin: 0, fontSize: 13.5, color: th.secondary, lineHeight: 1.5,
            overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {i.title || i.text || "(מדיה בלבד)"}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9 }}>
            <button onClick={() => actions.restore(i)}
              style={{ background: th.accentSoft, color: th.accentText, border: "none",
                borderRadius: 9, padding: "6px 16px", cursor: "pointer",
                fontSize: 12.5, fontWeight: 600, fontFamily: FONT }}>שחזר</button>
            <button onClick={() => setConfirmIdea(i)}
              style={{ background: "transparent", color: th.red, border: `1px solid ${th.border}`,
                borderRadius: 9, padding: "6px 12px", cursor: "pointer",
                fontSize: 12.5, fontWeight: 600, fontFamily: FONT }}>מחק לצמיתות</button>
            <span style={{ marginRight: "auto", fontSize: 10.5, color: th.muted }}>{fmt(i.deletedAt)}</span>
          </div>
        </div>
      ))}

      {confirmIdea && (
        <Confirm title="מחיקה לצמיתות" message="אי אפשר לשחזר אחרי זה."
          onConfirm={() => { actions.destroy(confirmIdea); setConfirmIdea(null); }}
          onCancel={() => setConfirmIdea(null)} th={th} />
      )}
      {confirmAll && (
        <Confirm title="לרוקן את כל הפח?"
          message={`${list.length} רעיונות יימחקו לצמיתות. אי אפשר לשחזר אחרי זה.`}
          confirmLabel="רוקן הכל"
          onConfirm={() => { actions.emptyTrash(list); setConfirmAll(false); onBack(); }}
          onCancel={() => setConfirmAll(false)} th={th} />
      )}
    </>
  );
}

// Overall progress across every project. The coloured part of the bar is what's
// still open — one segment per project, in the project's colour — and the muted
// tail is what's already done. Tapping it lists exactly which ideas are left.
function ProjectsStats({ projects, ideas, th, onOpen }) {
  const [open, setOpen] = useState(false);

  const activeOf = pid => ideas.filter(i =>
    i.projectId === pid && !i.noCheck && i.status !== "done" && i.status !== "trash");
  // Busiest project first — both in the bar and in the drill-down list.
  const groups = projects.map(p => ({ p, list: activeOf(p.id) }))
    .filter(g => g.list.length)
    .sort((a, b) => b.list.length - a.list.length);
  const activeTotal = groups.reduce((n, g) => n + g.list.length, 0);
  const doneTotal = ideas.filter(i => i.projectId && i.status === "done").length;
  const total = activeTotal + doneTotal;
  if (!total) return null;
  const pct = Math.round((activeTotal / total) * 100);
  const allIdeas = ideas.filter(i => i.status !== "trash").length;
  // On the dark/gradient heroes the text sits on colour, not on the surface.
  const heroInk = (th.electric || th.vivid) ? "#fff" : th.text;
  const heroSub = (th.electric || th.vivid) ? "rgba(255,255,255,0.72)" : th.muted;

  return (
    <>
      {/* Hero: the app's pulse — how much is still in motion, and where. */}
      <div onClick={() => activeTotal && setOpen(true)}
        style={{ position: "relative", overflow: "hidden",
          background: th.electric
            ? "linear-gradient(135deg,#1A1040 0%,#101634 55%,#0C1026 100%)"
            : th.vivid ? th.grad : th.surface,
          border: th.electric ? "1px solid rgba(168,85,247,0.3)"
            : th.vivid ? "none" : `1px solid ${th.border}`,
          boxShadow: th.electric ? "0 0 34px rgba(124,58,237,0.28)" : "none",
          borderRadius: 18, padding: "16px 16px 14px", marginBottom: 10, direction: "rtl",
          cursor: activeTotal ? "pointer" : "default" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <span style={{ width: 44, height: 44, borderRadius: 14, flexShrink: 0,
            background: th.electric ? "rgba(168,85,247,0.18)"
              : th.vivid ? "rgba(255,255,255,0.2)" : th.accentSoft,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: th.electric ? "0 0 16px rgba(168,85,247,0.4)" : "none" }}>
            <Icon name="bulb" size={22} color={heroInk} />
          </span>
          <span style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
            <span style={{ fontSize: 38, fontWeight: 800, color: heroInk, letterSpacing: -0.5 }}>
              {activeTotal}
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 500, color: heroSub, marginTop: 4 }}>
              רעיונות פעילים
            </span>
          </span>
          <span style={{ marginRight: "auto", textAlign: "left", display: "flex",
            flexDirection: "column", lineHeight: 1.1 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: heroInk }}>{pct}%</span>
            <span style={{ fontSize: 11, color: heroSub }}>נותרו</span>
          </span>
        </div>

        <div style={{ display: "flex", height: 9, borderRadius: 99, overflow: "hidden",
          background: th.electric || th.vivid ? "rgba(255,255,255,0.13)" : th.surface2,
          border: th.electric || th.vivid ? "none" : `1px solid ${th.border}` }}>
          {groups.map(g => (
            <div key={g.p.id} title={`${g.p.name}: ${g.list.length}`}
              style={{ width: `${(g.list.length / total) * 100}%`, background: g.p.color,
                boxShadow: th.electric ? `0 0 10px ${g.p.color}` : "none" }} />
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 9,
          fontSize: 12, color: heroSub }}>
          <span>{doneTotal} פעולות שבוצעו</span>
          {activeTotal > 0 && (
            <span style={{ marginRight: "auto", color: heroInk, fontWeight: 600 }}>הצג רשימה ›</span>
          )}
        </div>
      </div>

      {/* Your activity at a glance */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, direction: "rtl" }}>
        {[[allIdeas, "רעיונות"], [doneTotal, "בוצעו"], [projects.length, "פרויקטים"]].map(([n, label]) => (
          <div key={label} style={{ flex: 1, background: th.surface, borderRadius: 13,
            border: `1px solid ${th.border}`, padding: "9px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: th.text }}>{n}</div>
            <div style={{ fontSize: 11, color: th.muted, marginTop: 1 }}>{label}</div>
          </div>
        ))}
      </div>

      {open && (
        <Modal onClose={() => setOpen(false)} maxWidth={420} th={th}>
          <ModalHeader title={`${activeTotal} רעיונות פעילים`} icon="folder"
            onClose={() => setOpen(false)} th={th} />
          {groups.map(g => (
            <div key={g.p.id} style={{ marginBottom: 14, direction: "rtl" }}>
              <div onClick={() => { setOpen(false); onOpen(g.p.id); }}
                style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer",
                  marginBottom: 6, paddingBottom: 5, borderBottom: `1px solid ${th.border}` }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: g.p.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: th.text }}>{g.p.name}</span>
                <span style={{ fontSize: 12, color: th.muted }}>({g.list.length})</span>
                <span style={{ marginRight: "auto", display: "inline-flex" }}>
                  <Icon name="back" size={13} color={th.muted} />
                </span>
              </div>
              {g.list.map(i => (
                <p key={i.id} style={{ margin: "0 0 5px", paddingRight: 16, fontSize: 13,
                  color: th.secondary, lineHeight: 1.5, overflow: "hidden",
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                  • {i.title || i.text || "(מדיה בלבד)"}
                </p>
              ))}
            </div>
          ))}
        </Modal>
      )}
    </>
  );
}

function ProjectsIndex({ uid, projects, ideas, th, projActions, onOpen, myShares = {}, sharedWithMe = [], commentSeen = {} }) {
  const [name, setName] = useState("");
  const [sortMode, setSortMode] = useState(false);
  // "manual" | "active" — persisted so the choice survives future visits.
  const [sortBy, setSortBy] = useState(() => {
    try { return localStorage.getItem("if_projsort") || "manual"; } catch { return "manual"; }
  });
  const chooseSort = v => {
    setSortBy(v);
    try { localStorage.setItem("if_projsort", v); } catch { /* ignore */ }
    if (v === "active") setSortMode(false);
  };
  const trashCount = ideas.filter(i => i.status === "trash").length;

  // "Note" ideas (noCheck) are background info, not active work — excluded from the count.
  const counts = p => ({
    active: ideas.filter(i => i.projectId === p.id && !i.noCheck && i.status !== "done" && i.status !== "trash").length,
    done: ideas.filter(i => i.projectId === p.id && i.status === "done").length,
  });

  const sorted = sortBy === "active"
    ? [...projects].sort((a, b) => counts(b).active - counts(a).active || projSort(a, b))
    : [...projects].sort(projSort);

  // Unread = a comment from someone else, newer than this project's last-read mark.
  const hasUnread = p => ideas.some(i =>
    i.projectId === p.id &&
    (i.comments || []).some(c => c.authorUid !== uid && (c.at || 0) > (commentSeen[p.id] || 0)));

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  return (
    <>
      <div style={{ display: "flex", gap: 7, marginBottom: 12 }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="פרויקט חדש..."
          onKeyDown={e => { if (e.key === "Enter" && name.trim()) { projActions.add(name.trim()); setName(""); } }}
          style={{ flex: 1, border: `1px solid ${th.border}`, borderRadius: 12, padding: "11px 14px",
            fontSize: 14, fontFamily: FONT, direction: "rtl", background: th.inputBg, color: th.text }} />
        <button onClick={() => { if (name.trim()) { projActions.add(name.trim()); setName(""); } }}
          style={{ background: th.accent, color: "#fff", border: "none", borderRadius: 12,
            padding: "0 16px", cursor: "pointer", display: "flex", alignItems: "center" }}>
          <Icon name="add" size={20} color="#fff" />
        </button>
        <button onClick={() => onOpen("__trash__")} title="פח אשפה"
          style={{ background: th.surface, border: `1px solid ${th.border}`, borderRadius: 12,
            padding: "0 13px", cursor: "pointer", display: "flex", alignItems: "center",
            gap: 5, position: "relative" }}>
          <Icon name="delete" size={17} color={th.secondary} />
          {trashCount > 0 && (
            <span style={{ fontSize: 11, fontWeight: 600, color: th.secondary, fontFamily: FONT }}>
              {trashCount}
            </span>
          )}
        </button>
      </div>

      <ProjectsStats projects={projects} ideas={ideas} th={th} onOpen={onOpen} />

      {projects.length > 1 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, direction: "rtl" }}>
          <span style={{ fontSize: 12, color: th.muted, fontWeight: 600 }}>מיון:</span>
          {[["manual", "ידני"], ["active", "הכי פעילים"]].map(([v, label]) => (
            <button key={v} onClick={() => chooseSort(v)}
              style={{ background: sortBy === v ? th.accentSoft : th.surface,
                color: sortBy === v ? th.accentText : th.secondary,
                border: `1px solid ${sortBy === v ? th.accent : th.border}`,
                borderRadius: 18, padding: "4px 12px", cursor: "pointer",
                fontSize: 12, fontWeight: 600, fontFamily: FONT }}>
              {label}
            </button>
          ))}
          {sortBy === "manual" && (
            <span style={{ marginRight: "auto" }}>
              <SortToggle sortMode={sortMode} setSortMode={setSortMode} th={th} />
            </span>
          )}
        </div>
      )}

      {sorted.length === 0 && (
        <div style={{ textAlign: "center", padding: "36px 0", color: th.muted }}>
          <Icon name="folder" size={40} color={th.border} />
          <p style={{ fontSize: 14, marginTop: 8 }}>צור פרויקט ראשון כדי לארגן רעיונות</p>
        </div>
      )}

      {sortMode ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter}
          onDragEnd={e => {
            const { active, over } = e;
            if (!over || active.id === over.id) return;
            const oldI = sorted.findIndex(p => p.id === active.id);
            const newI = sorted.findIndex(p => p.id === over.id);
            projActions.reorder(arrayMove(sorted, oldI, newI).map(p => p.id));
          }}>
          <SortableContext items={sorted.map(p => p.id)} strategy={verticalListSortingStrategy}>
            {sorted.map(p => (
              <SortableProjectRow key={p.id} p={p} th={th} counts={counts(p)} />
            ))}
          </SortableContext>
        </DndContext>
      ) : (
        sorted.map(p => (
          <ProjectRow key={p.id} p={p} th={th} counts={counts(p)}
            isShared={!!myShares[p.id]} unread={hasUnread(p)}
            onOpen={() => onOpen(p.id)}
            onPin={() => projActions.update(p.id, { pinned: !p.pinned })} />
        ))
      )}

      {/* Projects shared with me by others */}
      {sharedWithMe.length > 0 && !sortMode && (
        <>
          <p style={{ fontSize: 12, fontWeight: 600, color: th.muted, letterSpacing: 0.6,
            margin: "18px 2px 8px" }}>
            משותפים איתי
          </p>
          {sharedWithMe.map(s => (
            <div key={s.id} onClick={() => onOpen("share:" + s.id)}
              style={{ display: "flex", alignItems: "center", gap: 11, background: th.surface,
                border: `1px dashed ${th.borderStrong}`, borderRadius: 14, padding: "14px 15px",
                marginBottom: 9, cursor: "pointer", direction: "rtl" }}>
              <span style={{ width: 13, height: 13, borderRadius: "50%", background: s.projectColor, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: th.text }}>{s.projectName}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: th.muted,
                  display: "flex", alignItems: "center", gap: 4 }}>
                  <Icon name="share" size={11} color={th.muted} />
                  {s.ownerName || s.ownerEmail}
                </p>
              </div>
              <Icon name="back" size={15} color={th.muted} />
            </div>
          ))}
        </>
      )}
    </>
  );
}

function ProjectRow({ p, th, counts, onOpen, onPin, isShared = false, unread = false }) {
  return (
    <div onClick={onOpen}
      style={{ display: "flex", alignItems: "center", gap: 11, background: th.surface,
        border: `1px solid ${p.pinned ? th.accent : th.border}`,
        // Each project wears its own colour as a leading bar
        borderRight: `4px solid ${p.color}`,
        boxShadow: th.electric ? `0 0 14px ${p.color}22` : "none",
        borderRadius: 14, padding: "14px 15px 14px 12px",
        marginBottom: 9, cursor: "pointer", direction: "rtl" }}>
      <span style={{ width: 34, height: 34, borderRadius: 11, flexShrink: 0,
        background: th.electric ? `${p.color}22` : th.surface2,
        display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon name="folder" size={17} color={p.color} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: th.text,
          display: "flex", alignItems: "center", gap: 6 }}>
          {p.name}
          {unread && (
            <span title="תגובה חדשה שלא נקראה"
              style={{ width: 9, height: 9, borderRadius: "50%", background: th.red,
                flexShrink: 0, animation: "blink 1.1s ease-in-out infinite",
                boxShadow: `0 0 0 3px ${th.red}22` }} />
          )}
          {isShared && <Icon name="share" size={12} color={th.accent} />}
        </p>
        <p style={{ margin: "3px 0 0", fontSize: 12, color: th.muted,
          display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: p.color }} />
          <span style={{ color: th.secondary, fontWeight: 600 }}>{counts.active}</span> רעיונות
          {counts.done ? <><span>·</span><span>{counts.done} בוצעו</span></> : null}
        </p>
      </div>
      <IconBtn name="pin" onClick={e => { e.stopPropagation(); onPin(); }}
        color={p.pinned ? th.accent : th.muted} size={16} pad="6px"
        title={p.pinned ? "בטל נעיצה" : "נעץ לראש"} />
      <Icon name="back" size={15} color={th.muted} />
    </div>
  );
}

function SortableProjectRow({ p, th, counts }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: p.id });
  return (
    <div ref={setNodeRef} style={{
      transform: CSS.Transform.toString(transform), transition,
      opacity: isDragging ? 0.55 : 1, position: "relative", zIndex: isDragging ? 10 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: th.surface,
        border: `1px solid ${th.border}`, borderRadius: 14, padding: "14px 13px",
        marginBottom: 9, direction: "rtl" }}>
        <div {...attributes} {...listeners}
          style={{ flexShrink: 0, width: 26, height: 26, display: "flex", alignItems: "center",
            justifyContent: "center", cursor: "grab", color: th.muted, fontSize: 17,
            touchAction: "none", userSelect: "none" }}>⠿</div>
        <span style={{ width: 12, height: 12, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: th.text,
            display: "flex", alignItems: "center", gap: 5 }}>
            {p.pinned && <Icon name="pin" size={12} color={th.accent} />}
            {p.name}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: th.muted }}>
            {counts.active} פעילים{counts.done ? ` · ${counts.done} בוצעו` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

function ProjectDetail({ uid, project, ideas, projects, th, actions, projActions, onCapture, onBack,
  share = null, shareActions }) {
  const [showDone, setShowDone] = useState(false);
  const [sortMode, setSortMode] = useState(false);
  const [menu, setMenu] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(project.name);
  const [notes, setNotes] = useState(false);
  const [notesTxt, setNotesTxt] = useState(project.notes || "");
  const [confirmDel, setConfirmDel] = useState(false);

  const list = ideas.filter(i => i.projectId === project.id &&
    (showDone ? i.status === "done" : (i.status !== "done" && i.status !== "trash")));

  return (
    <>
      {/* Vivid look: a gradient ribbon in the project's color crowns the view */}
      {th.vivid && (
        <div style={{ height: 5, borderRadius: 99, margin: "0 0 12px",
          background: `linear-gradient(90deg, ${project.color}, #7C3AED, #DB2777)` }} />
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <button onClick={onBack}
          style={{ display: "inline-flex", alignItems: "center", gap: 5,
            background: th.surface, color: th.secondary, border: `1px solid ${th.border}`,
            borderRadius: 18, padding: "6px 12px", cursor: "pointer",
            fontSize: 13, fontWeight: 600, fontFamily: FONT }}>
          <span style={{ display: "inline-flex", transform: "rotate(180deg)" }}>
            <Icon name="back" size={14} color={th.secondary} />
          </span>
          חזרה
        </button>
        <span style={{ width: 12, height: 12, borderRadius: "50%", background: project.color }} />
        {renaming ? (
          <input value={newName} autoFocus onChange={e => setNewName(e.target.value)}
            onBlur={() => { if (newName.trim()) projActions.update(project.id, { name: newName.trim() }); setRenaming(false); }}
            onKeyDown={e => e.key === "Enter" && e.target.blur()}
            style={{ flex: 1, fontSize: 17, fontWeight: 700, fontFamily: FONT, color: th.text,
              background: "transparent", border: "none", borderBottom: `1.5px solid ${th.accent}`, direction: "rtl" }} />
        ) : (
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: th.text, flex: 1,
            display: "flex", alignItems: "center", gap: 7 }}>
            {project.name}
            {share && (
              <span onClick={() => setShowShare(true)}
                style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5,
                  fontWeight: 600, color: th.accentText, background: th.accentSoft,
                  borderRadius: 12, padding: "2px 8px", cursor: "pointer" }}>
                <Icon name="share" size={10} color={th.accentText} />
                משותף
              </span>
            )}
          </h2>
        )}
        {!showDone && list.length > 1 && (
          <SortToggle sortMode={sortMode} setSortMode={setSortMode} th={th} />
        )}
        <IconBtn name={showDone ? "eyeoff" : "eye"} onClick={() => { setShowDone(p => !p); setSortMode(false); }}
          color={showDone ? th.accent : th.muted} size={17} pad="7px" />
        <IconBtn name="more" onClick={() => setMenu(m => !m)} color={th.muted} size={17} pad="7px" />
      </div>

      {menu && (
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          <MenuBtn th={th} icon="edit" label="שנה שם" onClick={() => { setMenu(false); setRenaming(true); }} />
          <MenuBtn th={th} icon="notes" label="הערות" onClick={() => { setMenu(false); setNotesTxt(project.notes || ""); setNotes(true); }} />
          <MenuBtn th={th} icon="pin" label={project.pinned ? "בטל נעיצה" : "נעץ"}
            onClick={() => { setMenu(false); projActions.update(project.id, { pinned: !project.pinned }); }} />
          <MenuBtn th={th} icon="chat" label="שלח בוואטסאפ" onClick={() => {
            setMenu(false);
            const txt = list.map((i, n) => `${n + 1}. ${i.text}`).join("\n");
            window.open("https://wa.me/?text=" + encodeURIComponent(project.name + ":\n" + txt), "_blank");
          }} />
          <MenuBtn th={th} icon="export" label="ייצוא לקלוד" onClick={() => {
            setMenu(false);
            const open = ideas.filter(i => i.projectId === project.id && i.status !== "done" && i.status !== "trash");
            actions.exportList(project.name, open);
          }} />
          <MenuBtn th={th} icon="share" label={share ? `שיתוף (${share.sharedWith.length})` : "שיתוף"}
            onClick={() => { setMenu(false); setShowShare(true); }} />
          <MenuBtn th={th} icon="delete" label="מחק" danger onClick={() => { setMenu(false); setConfirmDel(true); }} />
        </div>
      )}

      <CaptureBar uid={uid} th={th} placeholder={`רעיון חדש ב"${project.name}"...`}
        draftKey={`if_draft_p_${project.id}`}
        onCapture={data => onCapture({ ...data, projectId: project.id, status: "active" })} />

      <div style={{ height: 14 }} />
      <IdeaList ideas={list} projects={projects} th={th} actions={actions}
        sortMode={sortMode && !showDone} onReorder={actions.reorder}
        myShares={share ? { [project.id]: share } : {}}
        emptyText={showDone ? "אין רעיונות שבוצעו" : "אין רעיונות בפרויקט — הוסף אחד למעלה"} />

      {showShare && (
        <ProjectShareModal project={project} share={share} th={th}
          onSave={emails => shareActions.save(project, emails)}
          onClose={() => setShowShare(false)} />
      )}

      {notes && (
        <Modal onClose={() => setNotes(false)} th={th}>
          <ModalHeader title={`הערות · ${project.name}`} icon="notes" onClose={() => setNotes(false)} th={th} />
          <textarea value={notesTxt} onChange={e => setNotesTxt(e.target.value)} rows={7}
            placeholder="הערות לפרויקט..."
            style={{ width: "100%", border: `1px solid ${th.border}`, borderRadius: 12, padding: 13,
              fontSize: 14, fontFamily: FONT, direction: "rtl", resize: "none",
              lineHeight: 1.7, background: th.inputBg, color: th.text }} />
          <button onClick={() => { projActions.update(project.id, { notes: notesTxt }); setNotes(false); }}
            style={{ marginTop: 10, width: "100%", background: th.accent, color: "#fff", border: "none",
              borderRadius: 11, padding: "12px 0", cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: FONT }}>
            שמור
          </button>
        </Modal>
      )}

      {confirmDel && (
        <Confirm title="מחיקת פרויקט"
          message="הרעיונות שבפרויקט לא יימחקו — הם יחזרו ל-Inbox."
          onConfirm={() => { setConfirmDel(false); projActions.remove(project.id); onBack(); }}
          onCancel={() => setConfirmDel(false)} th={th} />
      )}
    </>
  );
}

function MenuBtn({ th, icon, label, onClick, danger }) {
  return (
    <button onClick={onClick}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600,
        fontFamily: FONT, padding: "7px 12px", borderRadius: 10, cursor: "pointer",
        background: th.surface, color: danger ? th.red : th.secondary, border: `1px solid ${th.border}` }}>
      <Icon name={icon} size={14} color={danger ? th.red : th.secondary} />{label}
    </button>
  );
}
