// Global search across all projects, statuses, and tags.
import { useState } from "react";
import IdeaList from "../ui/IdeaList";
import { Icon } from "../ui/Icons";
import { FONT } from "../theme";

export default function Search({ ideas, projects, th, actions }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all"); // all | active | done

  const query = q.trim().toLowerCase();
  const results = query
    ? ideas.filter(i =>
        (filter === "all" || (filter === "done" ? i.status === "done" : i.status !== "done")) &&
        ((i.text || "").toLowerCase().includes(query) ||
         (i.title || "").toLowerCase().includes(query) ||
         (i.tags || []).some(t => t.toLowerCase().includes(query))))
    : [];

  return (
    <>
      <div style={{ position: "relative", marginBottom: 10 }}>
        <input value={q} onChange={e => setQ(e.target.value)} autoFocus
          placeholder="חפש בכל הרעיונות..."
          style={{ width: "100%", border: `1px solid ${th.border}`, borderRadius: 12,
            padding: "12px 38px 12px 34px", fontSize: 15, background: th.inputBg,
            fontFamily: FONT, direction: "rtl", color: th.text }} />
        <span style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
          <Icon name="search" size={17} color={th.muted} />
        </span>
        {q && (
          <button onClick={() => setQ("")}
            style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
              border: "none", background: th.surface2, borderRadius: "50%", width: 22, height: 22,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="close" size={11} color={th.secondary} />
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[["all", "הכל"], ["active", "פעילים"], ["done", "בוצעו"]].map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)}
            style={{ fontSize: 12.5, fontWeight: 600, fontFamily: FONT, padding: "6px 14px",
              borderRadius: 18, cursor: "pointer",
              background: filter === id ? th.accentSoft : th.surface,
              color: filter === id ? th.accentText : th.secondary,
              border: `1px solid ${filter === id ? th.accent : th.border}` }}>
            {label}
          </button>
        ))}
      </div>

      {query
        ? <>
            <p style={{ fontSize: 12, color: th.muted, margin: "0 2px 8px" }}>{results.length} תוצאות</p>
            <IdeaList ideas={results} projects={projects} showProject th={th} actions={actions}
              emptyText="לא נמצאו רעיונות" />
          </>
        : <div style={{ textAlign: "center", padding: "44px 0", color: th.muted }}>
            <Icon name="search" size={40} color={th.border} />
            <p style={{ fontSize: 14, marginTop: 8 }}>חיפוש בטקסט, בכותרות ובתגיות — בכל הפרויקטים</p>
          </div>}
    </>
  );
}
