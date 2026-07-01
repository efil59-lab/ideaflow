// Home: capture first, inbox below.
import { useState } from "react";
import CaptureBar from "../ui/CaptureBar";
import IdeaList from "../ui/IdeaList";
import { IconBtn } from "../ui/Icons";

export default function Inbox({ uid, ideas, projects, th, actions, onCapture }) {
  const [showDone, setShowDone] = useState(false);

  const inbox = ideas.filter(i => !i.projectId && (showDone ? i.status === "done" : i.status === "inbox"));
  const recentActive = ideas
    .filter(i => i.projectId && i.status === "active")
    .slice(0, 3);

  return (
    <>
      <CaptureBar uid={uid} th={th} onCapture={onCapture} />

      <div style={{ display: "flex", alignItems: "center", margin: "16px 2px 8px" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: th.muted, letterSpacing: 0.6 }}>
          {showDone ? "בוצעו" : "INBOX"} · {inbox.length}
        </span>
        <IconBtn name={showDone ? "eyeoff" : "eye"} onClick={() => setShowDone(p => !p)}
          color={showDone ? th.accent : th.muted} size={16} pad="4px" style={{ marginRight: "auto" }}
          title="הצג בוצעו" />
      </div>

      <IdeaList ideas={inbox} projects={projects} th={th} actions={actions}
        emptyText={showDone ? "אין רעיונות שבוצעו" : "ה-Inbox ריק — תפוס רעיון חדש למעלה"} />

      {!showDone && recentActive.length > 0 && (
        <>
          <p style={{ fontSize: 12, fontWeight: 600, color: th.muted, letterSpacing: 0.6, margin: "18px 2px 8px" }}>
            פעילים לאחרונה
          </p>
          <IdeaList ideas={recentActive} projects={projects} showProject th={th} actions={actions} />
        </>
      )}
    </>
  );
}
