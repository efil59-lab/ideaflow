// Home: capture first, inbox below.
import { useState } from "react";
import CaptureBar from "../ui/CaptureBar";
import IdeaList, { SortToggle } from "../ui/IdeaList";
import { Icon, IconBtn } from "../ui/Icons";
import { FONT } from "../theme";

// Time-of-day greeting — small thing, makes the app feel awake.
function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "לילה טוב";
  if (h < 12) return "בוקר טוב";
  if (h < 17) return "צהריים טובים";
  if (h < 21) return "ערב טוב";
  return "לילה טוב";
}

export default function Inbox({ uid, ideas, projects, th, actions, onCapture, myShares = {}, userName = "" }) {
  const [showDone, setShowDone] = useState(false);
  const [sortMode, setSortMode] = useState(false);

  const inbox = ideas.filter(i => !i.projectId && (showDone ? i.status === "done" : i.status === "inbox"));
  const recentActive = ideas
    .filter(i => i.projectId && i.status === "active")
    .slice(0, 3);

  return (
    <>
      <div style={{ direction: "rtl", margin: "2px 2px 12px" }}>
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: th.text }}>
          {greeting()}{userName ? `, ${userName}` : ""}! 👋
        </h2>
        <p style={{ margin: "3px 0 0", fontSize: 13, color: th.muted }}>
          בוא נמשיך להפוך רעיונות למציאות
        </p>
      </div>

      <CaptureBar uid={uid} th={th} onCapture={onCapture} />

      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 2px 8px" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: th.muted, letterSpacing: 0.6 }}>
          {showDone ? "בוצעו" : "INBOX"} · {inbox.length}
        </span>
        {!showDone && inbox.length > 1 && (
          <SortToggle sortMode={sortMode} setSortMode={setSortMode} th={th} />
        )}
        <span style={{ marginRight: "auto", display: "flex", gap: 2 }}>
          {!showDone && inbox.length > 0 && (
            <IconBtn name="export" onClick={() => actions.exportList("Inbox", inbox)}
              color={th.muted} size={16} pad="4px" title="ייצוא לקלוד" />
          )}
          <IconBtn name={showDone ? "eyeoff" : "eye"} onClick={() => { setShowDone(p => !p); setSortMode(false); }}
            color={showDone ? th.accent : th.muted} size={16} pad="4px" title="הצג בוצעו" />
        </span>
      </div>

      {inbox.length === 0 && !showDone ? (
        /* An invitation, not an apology — the empty inbox is a prompt to capture. */
        <div style={{ textAlign: "center", padding: "26px 6px 30px", direction: "rtl" }}>
          <span style={{ display: "inline-flex", width: 88, height: 88, borderRadius: "50%",
            alignItems: "center", justifyContent: "center", marginBottom: 14,
            background: th.electric ? "rgba(168,85,247,0.14)" : th.accentSoft,
            boxShadow: th.electric ? "0 0 34px rgba(168,85,247,0.45)" : "none" }}>
            <Icon name="bulb" size={40} color={th.electric ? "#C9A2FF" : th.accent} />
          </span>
          <h3 style={{ margin: "0 0 5px", fontSize: 19, fontWeight: 800, color: th.text }}>
            אין רעיונות?
          </h3>
          <p style={{ margin: "0 0 18px", fontSize: 13.5, color: th.muted }}>
            תפוס אחד לפני שהוא בורח…
          </p>
          <button onClick={() => window.dispatchEvent(new CustomEvent("if-capture", { detail: { kind: "text" } }))}
            style={{ background: th.cta || th.accent, color: "#fff", border: "none",
              borderRadius: 14, padding: "13px 30px", cursor: "pointer",
              fontSize: 15.5, fontWeight: 700, fontFamily: FONT,
              display: "inline-flex", alignItems: "center", gap: 8,
              boxShadow: th.electric ? "0 0 22px rgba(168,85,247,0.5)" : "none" }}>
            <Icon name="add" size={18} color="#fff" /> רעיון חדש
          </button>
        </div>
      ) : (
        <IdeaList ideas={inbox} projects={projects} th={th} actions={actions}
          sortMode={sortMode && !showDone} onReorder={actions.reorder}
          emptyText={showDone ? "אין רעיונות שבוצעו" : "ה-Inbox ריק"} />
      )}

      {!showDone && !sortMode && recentActive.length > 0 && (
        <>
          <p style={{ fontSize: 12, fontWeight: 600, color: th.muted, letterSpacing: 0.6, margin: "18px 2px 8px" }}>
            פעילים לאחרונה
          </p>
          <IdeaList ideas={recentActive} projects={projects} showProject th={th} actions={actions} myShares={myShares} />
        </>
      )}
    </>
  );
}
