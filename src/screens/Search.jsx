// Global search across all projects, statuses, and tags.
import { useState } from "react";
import IdeaList from "../ui/IdeaList";
import { Icon } from "../ui/Icons";
import { FONT } from "../theme";

export default function Search({ ideas, projects, th, actions, q, setQ }) {
  const [filter, setFilter] = useState("active"); // all | active | done
  // Recent searches live on the device — a fast way back to a previous hunt.
  const [recent, setRecent] = useState(() => {
    try { return JSON.parse(localStorage.getItem("if_recent_q") || "[]"); } catch { return []; }
  });
  const remember = term => {
    const t = term.trim();
    if (t.length < 2) return;
    setRecent(prev => {
      const next = [t, ...prev.filter(x => x !== t)].slice(0, 8);
      try { localStorage.setItem("if_recent_q", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };
  // The tags actually in use, most-used first — one tap to browse by theme.
  const topTags = Object.entries(
    ideas.reduce((m, i) => {
      if (i.status === "trash") return m;
      (i.tags || []).forEach(t => { m[t] = (m[t] || 0) + 1; });
      return m;
    }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t);

  const query = q.trim().toLowerCase();
  const results = query
    ? ideas.filter(i =>
        i.status !== "trash" &&
        // "פעילים" excludes archived notes too — only "הכל" reaches the archive.
        (filter === "all" || (filter === "done" ? i.status === "done" : (i.status !== "done" && !i.archived))) &&
        ((i.text || "").toLowerCase().includes(query) ||
         (i.title || "").toLowerCase().includes(query) ||
         (i.tags || []).some(t => t.toLowerCase().includes(query))))
    : [];

  return (
    <>
      <h2 style={{ margin: "4px 2px 12px", fontSize: 22, fontWeight: 800, direction: "rtl",
        color: th.text,
        ...(th.electric || th.vivid ? {
          background: th.grad, WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent", backgroundClip: "text",
        } : {}) }}>
        מה אתה מחפש?
      </h2>

      <div style={{ position: "relative", marginBottom: 12 }}>
        <input value={q} onChange={e => setQ(e.target.value)} autoFocus
          onBlur={() => remember(q)}
          onKeyDown={e => { if (e.key === "Enter") remember(q); }}
          placeholder="חפש בכל הרעיונות, פרויקטים, תגיות…"
          style={{ width: "100%", boxSizing: "border-box", borderRadius: 14,
            border: `1px solid ${th.electric ? "rgba(168,85,247,0.5)" : th.border}`,
            boxShadow: th.electric ? "0 0 20px rgba(168,85,247,0.28)" : "none",
            padding: "14px 40px 14px 36px", fontSize: 15.5, background: th.inputBg,
            fontFamily: FONT, direction: "rtl", color: th.text, outline: "none" }} />
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
        : <div style={{ direction: "rtl" }}>
            {recent.length > 0 && (
              <>
                <p style={{ fontSize: 12, fontWeight: 600, color: th.muted, margin: "4px 2px 7px" }}>
                  חיפושים אחרונים
                </p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                  {recent.map(t => (
                    <button key={t} onClick={() => setQ(t)}
                      style={{ fontSize: 12.5, fontWeight: 500, fontFamily: FONT, padding: "6px 13px",
                        borderRadius: 18, cursor: "pointer", background: th.surface,
                        color: th.secondary, border: `1px solid ${th.border}` }}>
                      {t}
                    </button>
                  ))}
                </div>
              </>
            )}

            {topTags.length > 0 && (
              <>
                <p style={{ fontSize: 12, fontWeight: 600, color: th.muted, margin: "4px 2px 7px" }}>
                  תגיות פופולריות
                </p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                  {topTags.map(t => (
                    <button key={t} onClick={() => setQ(t)}
                      style={{ fontSize: 12.5, fontWeight: 600, fontFamily: FONT, padding: "6px 13px",
                        borderRadius: 18, cursor: "pointer", background: th.accentSoft,
                        color: th.accentText, border: "none" }}>
                      #{t}
                    </button>
                  ))}
                </div>
              </>
            )}

            {actions.ai && (
              <button onClick={() => actions.ai()}
                style={{ display: "flex", alignItems: "center", gap: 11, width: "100%",
                  borderRadius: 15, padding: "13px 14px", cursor: "pointer", direction: "rtl",
                  textAlign: "right", fontFamily: FONT,
                  background: th.electric ? "rgba(168,85,247,0.12)" : th.surface,
                  border: `1px solid ${th.electric ? "rgba(168,85,247,0.4)" : th.border}`,
                  boxShadow: th.electric ? "0 0 18px rgba(168,85,247,0.2)" : "none" }}>
                <span style={{ width: 34, height: 34, borderRadius: 11, flexShrink: 0,
                  background: th.accentSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="sparkle" size={17} color={th.accentText} />
                </span>
                <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.35 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: th.text }}>חיפוש חכם עם AI</span>
                  <span style={{ fontSize: 12, color: th.muted }}>שאל שאלה על הרעיונות שלך</span>
                </span>
                <span style={{ marginRight: "auto", display: "inline-flex" }}>
                  <Icon name="back" size={14} color={th.muted} />
                </span>
              </button>
            )}
          </div>}
    </>
  );
}
