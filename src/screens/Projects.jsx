// Projects: list view + project detail (capture in context, notes, done toggle) + trash.
import { useState } from "react";
import CaptureBar from "../ui/CaptureBar";
import IdeaList, { SortToggle } from "../ui/IdeaList";
import { Icon, IconBtn } from "../ui/Icons";
import { Modal, ModalHeader, Confirm } from "../ui/base";

import { FONT, fmt } from "../theme";

export default function Projects({ uid, ideas, projects, th, actions, projActions, onCapture,
  openProjectId, setOpenProjectId }) {
  const open = projects.find(p => p.id === openProjectId);
  if (openProjectId === "__trash__") {
    return <TrashView ideas={ideas} th={th} actions={actions} onBack={() => setOpenProjectId(null)} />;
  }
  return open
    ? <ProjectDetail uid={uid} project={open} ideas={ideas} projects={projects} th={th}
        actions={actions} projActions={projActions} onCapture={onCapture}
        onBack={() => setOpenProjectId(null)} />
    : <ProjectsIndex projects={projects} ideas={ideas} th={th} projActions={projActions}
        onOpen={setOpenProjectId} />;
}

function TrashView({ ideas, th, actions, onBack }) {
  const [confirmIdea, setConfirmIdea] = useState(null);
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
    </>
  );
}

function ProjectsIndex({ projects, ideas, th, projActions, onOpen }) {
  const [name, setName] = useState("");
  const sorted = [...projects].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  const trashCount = ideas.filter(i => i.status === "trash").length;

  return (
    <>
      <div style={{ display: "flex", gap: 7, marginBottom: 14 }}>
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

      {sorted.length === 0 && (
        <div style={{ textAlign: "center", padding: "36px 0", color: th.muted }}>
          <Icon name="folder" size={40} color={th.border} />
          <p style={{ fontSize: 14, marginTop: 8 }}>צור פרויקט ראשון כדי לארגן רעיונות</p>
        </div>
      )}

      {sorted.map(p => {
        const active = ideas.filter(i => i.projectId === p.id && i.status !== "done" && i.status !== "trash").length;
        const done = ideas.filter(i => i.projectId === p.id && i.status === "done").length;
        return (
          <div key={p.id} onClick={() => onOpen(p.id)}
            style={{ display: "flex", alignItems: "center", gap: 11, background: th.surface,
              border: `1px solid ${th.border}`, borderRadius: 14, padding: "14px 15px",
              marginBottom: 9, cursor: "pointer", direction: "rtl" }}>
            <span style={{ width: 13, height: 13, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: th.text,
                display: "flex", alignItems: "center", gap: 5 }}>
                {p.pinned && <Icon name="pin" size={12} color={th.accent} />}
                {p.name}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: th.muted }}>
                {active} פעילים{done ? ` · ${done} בוצעו` : ""}
              </p>
            </div>
            <Icon name="back" size={16} color={th.muted} />
          </div>
        );
      })}

      {/* Trash entry */}
      <div onClick={() => onOpen("__trash__")}
        style={{ display: "flex", alignItems: "center", gap: 11, marginTop: 16,
          borderRadius: 14, padding: "12px 15px", cursor: "pointer", direction: "rtl",
          border: `1px dashed ${th.borderStrong}`, opacity: 0.85 }}>
        <Icon name="delete" size={16} color={th.muted} />
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: th.secondary }}>פח אשפה</span>
        {ideas.filter(i => i.status === "trash").length > 0 && (
          <span style={{ fontSize: 11.5, color: th.muted }}>
            {ideas.filter(i => i.status === "trash").length}
          </span>
        )}
      </div>
    </>
  );
}

function ProjectDetail({ uid, project, ideas, projects, th, actions, projActions, onCapture, onBack }) {
  const [showDone, setShowDone] = useState(false);
  const [sortMode, setSortMode] = useState(false);
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(project.name);
  const [notes, setNotes] = useState(false);
  const [notesTxt, setNotesTxt] = useState(project.notes || "");
  const [confirmDel, setConfirmDel] = useState(false);

  const list = ideas.filter(i => i.projectId === project.id &&
    (showDone ? i.status === "done" : (i.status !== "done" && i.status !== "trash")));

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
        <span style={{ width: 12, height: 12, borderRadius: "50%", background: project.color }} />
        {renaming ? (
          <input value={newName} autoFocus onChange={e => setNewName(e.target.value)}
            onBlur={() => { if (newName.trim()) projActions.update(project.id, { name: newName.trim() }); setRenaming(false); }}
            onKeyDown={e => e.key === "Enter" && e.target.blur()}
            style={{ flex: 1, fontSize: 17, fontWeight: 700, fontFamily: FONT, color: th.text,
              background: "transparent", border: "none", borderBottom: `1.5px solid ${th.accent}`, direction: "rtl" }} />
        ) : (
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: th.text, flex: 1 }}>{project.name}</h2>
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
          <MenuBtn th={th} icon="share" label="שתף" onClick={() => {
            setMenu(false);
            const txt = list.map((i, n) => `${n + 1}. ${i.text}`).join("\n");
            window.open("https://wa.me/?text=" + encodeURIComponent(project.name + ":\n" + txt), "_blank");
          }} />
          <MenuBtn th={th} icon="export" label="ייצוא לקלוד" onClick={() => {
            setMenu(false);
            const open = ideas.filter(i => i.projectId === project.id && i.status !== "done" && i.status !== "trash");
            actions.exportList(project.name, open);
          }} />
          <MenuBtn th={th} icon="delete" label="מחק" danger onClick={() => { setMenu(false); setConfirmDel(true); }} />
        </div>
      )}

      <CaptureBar uid={uid} th={th} placeholder={`רעיון חדש ב"${project.name}"...`}
        draftKey={`if_draft_p_${project.id}`}
        onCapture={data => onCapture({ ...data, projectId: project.id, status: "active" })} />

      <div style={{ height: 14 }} />
      <IdeaList ideas={list} projects={projects} th={th} actions={actions}
        sortMode={sortMode && !showDone} onReorder={actions.reorder}
        emptyText={showDone ? "אין רעיונות שבוצעו" : "אין רעיונות בפרויקט — הוסף אחד למעלה"} />

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
