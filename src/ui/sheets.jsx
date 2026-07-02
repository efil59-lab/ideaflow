// Small task modals: share an idea, move an idea to a project, quick reminder.
import { useState } from "react";
import { Modal, ModalHeader } from "./base";
import { Icon } from "./Icons";
import { FONT, fmtDatetimeLocal } from "../theme";

export function ShareModal({ idea, onClose, th }) {
  const go = m => {
    const t = encodeURIComponent(`💡 ${idea.text}`);
    if (m === "wa") window.open(`https://wa.me/?text=${t}`, "_blank");
    if (m === "mail") window.open(`mailto:?subject=רעיון&body=${t}`, "_blank");
    if (m === "copy") navigator.clipboard?.writeText(idea.text);
    onClose();
  };
  const rows = [
    { m: "wa", icon: "chat", label: "WhatsApp" },
    { m: "mail", icon: "email", label: "אימייל" },
    { m: "copy", icon: "copy", label: "העתק ללוח" },
  ];
  return (
    <Modal onClose={onClose} maxWidth={380} th={th}>
      <ModalHeader title="שתף רעיון" icon="share" onClose={onClose} th={th} />
      <div style={{ background: th.surface2, borderRadius: 11, padding: "10px 13px", marginBottom: 12 }}>
        <p style={{ margin: 0, fontSize: 13.5, color: th.text, lineHeight: 1.6 }}>
          {(idea.text || "").slice(0, 200)}
        </p>
      </div>
      {rows.map(s => (
        <button key={s.m} onClick={() => go(s.m)}
          style={{ display: "flex", alignItems: "center", gap: 10, width: "100%",
            background: th.surface2, color: th.text, border: `1px solid ${th.border}`,
            borderRadius: 11, padding: "12px 14px", marginBottom: 7, cursor: "pointer",
            fontFamily: FONT, fontSize: 14, fontWeight: 500 }}>
          <Icon name={s.icon} size={17} color={th.accent} />{s.label}
        </button>
      ))}
    </Modal>
  );
}

export function MoveSheet({ idea, projects, onMove, onClose, onNewProject, th }) {
  return (
    <Modal onClose={onClose} maxWidth={380} th={th}>
      <ModalHeader title="העבר לפרויקט" icon="folder" onClose={onClose} th={th} />
      <Row label="Inbox" dot={th.muted} active={!idea.projectId} th={th}
        onClick={() => onMove(null)} />
      {projects.map(p => (
        <Row key={p.id} label={p.name} dot={p.color} active={idea.projectId === p.id} th={th}
          onClick={() => onMove(p.id)} />
      ))}
      <button onClick={onNewProject}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%",
          background: "transparent", color: th.accentText, border: `1px dashed ${th.borderStrong}`,
          borderRadius: 11, padding: "11px 14px", marginTop: 4, cursor: "pointer",
          fontFamily: FONT, fontSize: 13.5, fontWeight: 600 }}>
        <Icon name="add" size={15} color={th.accentText} /> פרויקט חדש
      </button>
    </Modal>
  );
}

// One-tap reminder: presets save immediately; custom time via the picker.
export function ReminderSheet({ idea, onSave, onClose, th }) {
  const [custom, setCustom] = useState(idea.remindAt || null);
  const now = Date.now();

  const tonight = new Date(); tonight.setHours(20, 0, 0, 0);
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(9, 0, 0, 0);
  const presets = [
    ["בעוד שעה", now + 3600e3],
    ...(tonight.getTime() > now ? [["הערב 20:00", tonight.getTime()]] : []),
    ["מחר 9:00", tomorrow.getTime()],
  ];

  return (
    <Modal onClose={onClose} maxWidth={380} th={th}>
      <ModalHeader title="תזכורת" icon="bell" onClose={onClose} th={th} />
      <p style={{ margin: "0 0 12px", fontSize: 13, color: th.secondary, lineHeight: 1.5,
        overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
        {(idea.title || idea.text || "").slice(0, 90)}
      </p>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 12 }}>
        {presets.map(([label, ts]) => (
          <button key={label} onClick={() => onSave(ts)}
            style={{ flex: 1, minWidth: 90, background: th.accentSoft, color: th.accentText,
              border: "none", borderRadius: 11, padding: "11px 8px", cursor: "pointer",
              fontSize: 13, fontWeight: 600, fontFamily: FONT, whiteSpace: "nowrap" }}>
            {label}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 7 }}>
        <input type="datetime-local"
          value={fmtDatetimeLocal(custom)}
          min={fmtDatetimeLocal(now)}
          onChange={e => setCustom(e.target.value ? new Date(e.target.value).getTime() : null)}
          style={{ flex: 1, border: `1px solid ${th.border}`, borderRadius: 10,
            padding: "9px 12px", fontSize: 14, background: th.inputBg,
            color: th.text, fontFamily: FONT }} />
        <button onClick={() => custom && custom > now && onSave(custom)}
          style={{ background: th.accent, color: "#fff", border: "none", borderRadius: 10,
            padding: "0 18px", cursor: "pointer", fontSize: 13.5, fontWeight: 600, fontFamily: FONT,
            opacity: custom && custom > now ? 1 : 0.45 }}>
          קבע
        </button>
      </div>
      {idea.remindAt && (
        <button onClick={() => onSave(null)}
          style={{ width: "100%", marginTop: 10, background: "transparent", color: th.red,
            border: `1px solid ${th.border}`, borderRadius: 11, padding: "10px 0",
            cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: FONT }}>
          הסר תזכורת קיימת
        </button>
      )}
    </Modal>
  );
}

function Row({ label, dot, active, onClick, th }) {
  return (
    <button onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%",
        background: active ? th.accentSoft : th.surface2,
        color: active ? th.accentText : th.text,
        border: `1px solid ${active ? th.accent : th.border}`,
        borderRadius: 11, padding: "12px 14px", marginBottom: 7, cursor: "pointer",
        fontFamily: FONT, fontSize: 14, fontWeight: 500 }}>
      <span style={{ width: 10, height: 10, borderRadius: "50%", background: dot }} />
      {label}
    </button>
  );
}
