// Desktop site — the wide-screen shell (≥1100px) that replaces the phone
// layout with a top header + folders sidebar + centred content, same as the
// pattern used in club45. Same brain: it renders the very same screens through
// ctx.renderTab; only the wrapper differs. The phone/tablet layouts are
// untouched (this mounts only when useIsDesktop() is true).
import { useState } from "react";
import { Icon } from "./ui/Icons";
import { FONT } from "./theme";

const NAV = [
  { id: "notes", label: "פתקים" },
  { id: "projects", label: "פרויקטים" },
  { id: "search", label: "חיפוש" },
];

export default function DesktopSite({ ctx }) {
  const { th, dark, setDark, user, onProfile, onAI, tab, goTab, inMotion,
    folders = [], deskFolder, setDeskFolder, onCreateFolder, ideas = [],
    renderTab, fabNote, version,
    projects = [], projActions, openProjectId, setOpenProjectId } = ctx;
  const [showAllProj, setShowAllProj] = useState(false);

  const headBg = th.grad || th.accent;
  const notesAll = ideas.filter(i => i.status === "note");
  const unfiled = notesAll.filter(n => !n.archived && !(n.folderId || null)).length;
  const folderCount = id => notesAll.filter(n => !n.archived && (n.folderId || null) === id).length;

  const openFolder = id => { setDeskFolder(id); if (tab !== "notes") goTab("notes"); };
  const addFolder = () => {
    const name = window.prompt("שם התיקייה החדשה");
    if (name && name.trim()) onCreateFolder?.(name.trim());
  };

  // Projects for the sidebar: pinned first, then favourites, then by activity.
  // Only the top 10 show; the rest open via a "show more" toggle.
  const projActive = p => ideas.filter(i => i.projectId === p.id && i.status !== "done" && i.status !== "trash").length;
  const projRank = p => (p.pinned ? 2 : 0) + (p.fav ? 1 : 0);
  const rankedAll = [...projects].sort((a, b) => (projRank(b) - projRank(a)) || (projActive(b) - projActive(a)));
  const rankedProjects = showAllProj ? rankedAll : rankedAll.slice(0, 10);
  const extraProj = rankedAll.length - 10;
  const openProject = id => { setOpenProjectId?.(id); if (tab !== "projects") goTab("projects"); };
  const addProject = () => {
    const name = window.prompt("שם הפרויקט החדש");
    if (name && name.trim()) { projActions?.add(name.trim()); }
  };
  const hasSidebar = tab === "notes" || tab === "projects";

  const groupLabel = txt => (
    <div style={{ fontSize: 11, fontWeight: 700, color: th.muted, letterSpacing: 0.4, margin: "8px 6px 6px", direction: "rtl" }}>{txt}</div>
  );
  const projRow = p => {
    const active = openProjectId === p.id;
    return (
      <div key={p.id} onClick={() => openProject(p.id)}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 11,
          cursor: "pointer", fontFamily: FONT, fontSize: 14.5, fontWeight: 600,
          color: active ? th.accentText : th.secondary,
          background: active ? th.accentSoft : "transparent",
          border: `1px solid ${active ? th.accent : "transparent"}` }}>
        <Icon name={p.pinned ? "pin" : "folder"} size={16} color={active ? th.accentText : th.muted} filled={!!p.pinned} />
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
        <button onClick={e => { e.stopPropagation(); projActions?.update(p.id, { fav: !p.fav }); }}
          title={p.fav ? "הסר ממועדפים" : "מועדף"}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", lineHeight: 0 }}>
          <Icon name="star" size={14} color={p.fav ? th.amber : th.muted} filled={!!p.fav} />
        </button>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: active ? th.accentText : th.muted, minWidth: 14, textAlign: "left" }}>{projActive(p)}</span>
      </div>
    );
  };

  const hbtn = {
    width: 38, height: 38, borderRadius: 11, background: "rgba(255,255,255,0.14)",
    border: "1px solid rgba(255,255,255,0.22)", display: "flex", alignItems: "center",
    justifyContent: "center", cursor: "pointer", color: "#fff",
  };

  const foldItem = (active, onClick, icon, label, count, dashed) => (
    <button onClick={onClick} key={label}
      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%",
        padding: "10px 12px", borderRadius: 11, cursor: "pointer", fontFamily: FONT,
        fontSize: 14.5, fontWeight: 600, textAlign: "right",
        color: active ? th.accentText : th.secondary,
        background: active ? th.accentSoft : "transparent",
        border: dashed ? `1px dashed ${th.borderStrong || th.border}` : `1px solid ${active ? th.accent : "transparent"}` }}>
      <Icon name={icon} size={16} color={active ? th.accentText : th.muted} />
      <span style={{ flex: 1 }}>{label}</span>
      {count > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: active ? th.accentText : th.muted }}>{count}</span>}
    </button>
  );

  return (
    <div className="ifd-root" style={{ background: th.bg, color: th.text, fontFamily: FONT, direction: "rtl",
      height: "100dvh", overflowY: "auto", display: "flex", flexDirection: "column" }}>
      {/* ── header ─────────────────────────────────────────── */}
      <header style={{ background: headBg, boxShadow: "0 6px 22px rgba(124,58,237,0.24)",
        display: "flex", alignItems: "center", gap: 18, padding: "0 24px", height: 64, flexShrink: 0 }}>
        <button onClick={() => goTab("notes")}
          style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none",
            cursor: "pointer", fontFamily: FONT }}>
          <span style={{ width: 36, height: 36, borderRadius: 11, background: "rgba(255,255,255,0.16)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: th.electric ? "0 0 14px rgba(255,255,255,0.3)" : "none" }}>
            <Icon name="bulb" size={20} color="#fff" />
          </span>
          <span style={{ textAlign: "right", lineHeight: 1.1 }}>
            <span style={{ display: "block", fontSize: 19, fontWeight: 900, color: "#fff" }}>IdeaFlow</span>
            {inMotion > 0 && <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.82)" }}>{inMotion} רעיונות בתנועה</span>}
          </span>
        </button>

        <nav style={{ display: "flex", gap: 3, marginInlineStart: 10 }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => goTab(n.id)}
              style={{ padding: "8px 16px", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: FONT,
                fontSize: 14.5, fontWeight: 700,
                background: tab === n.id ? "rgba(255,255,255,0.2)" : "transparent",
                color: tab === n.id ? "#fff" : "rgba(255,255,255,0.82)" }}>
              {n.label}
            </button>
          ))}
        </nav>

        <div style={{ marginInlineStart: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => goTab("search")} title="חיפוש"
            style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.22)", borderRadius: 11, padding: "8px 13px",
              color: "rgba(255,255,255,0.9)", fontSize: 13, cursor: "pointer", fontFamily: FONT }}>
            <Icon name="search" size={15} color="#fff" /> חיפוש מהיר…
          </button>
          <button onClick={onAI} title="AI" style={hbtn}><Icon name="sparkle" size={16} color="#fff" /></button>
          <button onClick={() => setDark(d => !d)} title="מצב תצוגה" style={hbtn}><Icon name={dark ? "sun" : "moon"} size={16} color="#fff" /></button>
          <button onClick={onProfile} title="פרופיל"
            style={{ width: 38, height: 38, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.35)",
              background: "rgba(0,0,0,0.25)", overflow: "hidden", cursor: "pointer", padding: 0 }}>
            {user?.photoURL ? <img src={user.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <Icon name="logout" size={15} color="#fff" />}
          </button>
          <button onClick={fabNote}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", color: th.accent,
              borderRadius: 11, padding: "9px 16px", border: "none", cursor: "pointer", fontFamily: FONT,
              fontSize: 14, fontWeight: 800, boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
            <Icon name="add" size={16} color={th.accent} /> פתק חדש
          </button>
        </div>
      </header>

      {/* ── body ───────────────────────────────────────────── */}
      <div style={{ flex: "1 0 auto", width: "100%", maxWidth: 1240, margin: "0 auto",
        display: "grid", gridTemplateColumns: hasSidebar ? "224px 1fr" : "1fr",
        alignItems: "start", gap: 22, padding: "22px 24px 8px" }}>
        {tab === "notes" && (
          <aside style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: th.muted, letterSpacing: 0.4, margin: "2px 6px 7px" }}>תיקיות</div>
            {foldItem(!deskFolder, () => openFolder(null), "notes", "פתקים", unfiled)}
            {folders.map(f => foldItem(deskFolder === f.id, () => openFolder(f.id), "folder", f.name, folderCount(f.id)))}
            {foldItem(false, addFolder, "add", "תיקייה חדשה", 0, true)}
          </aside>
        )}
        {tab === "projects" && (
          <aside style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {(() => {
              const favs = rankedProjects.filter(p => p.fav);
              const rest = rankedProjects.filter(p => !p.fav);
              return (
                <>
                  {favs.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700,
                      color: th.amber, letterSpacing: 0.4, margin: "2px 6px 6px", direction: "rtl" }}>
                      <Icon name="star" size={12} color={th.amber} filled /> מועדפים
                    </div>
                  )}
                  {favs.map(projRow)}
                  {favs.length > 0 ? groupLabel("כל הפרויקטים") : groupLabel("פרויקטים")}
                  {rest.map(projRow)}
                </>
              );
            })()}
            {extraProj > 0 && (
              <button onClick={() => setShowAllProj(v => !v)}
                style={{ background: "none", border: "none", cursor: "pointer", fontFamily: FONT,
                  fontSize: 13, fontWeight: 700, color: th.accentText, textAlign: "right", padding: "8px 12px" }}>
                {showAllProj ? "הצג פחות" : `עוד ${extraProj} פרויקטים…`}
              </button>
            )}
            {foldItem(false, addProject, "add", "פרויקט חדש", 0, true)}
            {foldItem(openProjectId === "__trash__", () => openProject("__trash__"), "delete", "פח אשפה", 0)}
          </aside>
        )}
        <main style={{ minWidth: 0 }}>
          {tab === "notes" && (
            <button onClick={fabNote}
              style={{ display: "flex", alignItems: "center", gap: 11, width: "100%",
                background: th.surface, border: `1px solid ${th.border}`, borderRadius: 14,
                padding: "13px 16px", marginBottom: 18, cursor: "pointer", fontFamily: FONT,
                textAlign: "right", boxShadow: th.electric ? "none" : "0 1px 8px rgba(0,0,0,0.05)" }}>
              <span style={{ width: 32, height: 32, borderRadius: 10, background: th.cta || th.accent,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name="add" size={18} color="#fff" />
              </span>
              <span style={{ flex: 1, color: th.muted, fontSize: 14.5 }}>רשום פתק, רעיון או הדבק קישור…</span>
            </button>
          )}
          <div className="ifd-screen">{renderTab(tab, deskFolder, setDeskFolder)}</div>
        </main>
      </div>

      {/* ── footer ─────────────────────────────────────────── */}
      <footer style={{ borderTop: `1px solid ${th.border}`, maxWidth: 1240, width: "100%", margin: "0 auto",
        padding: "16px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
        color: th.muted, fontSize: 12 }}>
        <span>© 2026 IdeaFlow</span>
        <div style={{ display: "flex", gap: 16, marginInlineStart: "auto" }}>
          <a href="https://efi-lab.vercel.app" target="_blank" rel="noopener" style={{ color: th.secondary, textDecoration: "none" }}>המעבדה של אפי</a>
          <a href="mailto:efil59@gmail.com" style={{ color: th.secondary, textDecoration: "none" }}>צור קשר</a>
        </div>
        <span>v{version}</span>
      </footer>
    </div>
  );
}
