// Small task modals: share an idea, move an idea to a project, quick reminder.
import { useState } from "react";
import { Modal, ModalHeader } from "./base";
import { Icon } from "./Icons";
import { FONT, fmtDatetimeLocal, REPEAT_OPTIONS } from "../theme";

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
// `repeat` is picked first and rides along with whichever time gets saved.
export function ReminderSheet({ idea, onSave, onClose, th }) {
  // For a repeating reminder show its anchor (the original recurring time),
  // not a snoozed next-fire — snooze must not appear to reschedule the series.
  const [custom, setCustom] = useState(idea.repeatAnchor || idea.remindAt || null);
  const [repeat, setRepeat] = useState(idea.repeat || "");
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
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <Icon name="bell" size={15} color={th.muted} />
        <select value={repeat} onChange={e => setRepeat(e.target.value)}
          style={{ flex: 1, border: `1px solid ${th.border}`, borderRadius: 10,
            padding: "9px 10px", fontSize: 13.5, background: th.inputBg,
            color: th.text, fontFamily: FONT, direction: "rtl" }}>
          {REPEAT_OPTIONS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
      </div>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 12 }}>
        {presets.map(([label, ts]) => (
          <button key={label} onClick={() => onSave(ts, repeat || null)}
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
        <button onClick={() => custom && custom > now && onSave(custom, repeat || null)}
          style={{ background: th.accent, color: "#fff", border: "none", borderRadius: 10,
            padding: "0 18px", cursor: "pointer", fontSize: 13.5, fontWeight: 600, fontFamily: FONT,
            opacity: custom && custom > now ? 1 : 0.45 }}>
          קבע
        </button>
      </div>
      {idea.remindAt && (
        <button onClick={() => onSave(null, null)}
          style={{ width: "100%", marginTop: 10, background: "transparent", color: th.red,
            border: `1px solid ${th.border}`, borderRadius: 11, padding: "10px 0",
            cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: FONT }}>
          הסר תזכורת קיימת
        </button>
      )}
    </Modal>
  );
}

// Snooze ("לך לישון") — postpone a fired reminder: quick presets, a custom
// amount+unit row, or an absolute date/time.
export function SnoozeSheet({ idea, onSave, onClose, th }) {
  const [amount, setAmount] = useState(3);
  const [unit, setUnit] = useState(3600e3); // ms per unit — default hours
  const [custom, setCustom] = useState(null);
  const now = Date.now();

  const quick = [
    ["5 דקות", 5 * 60e3], ["15 דקות", 15 * 60e3], ["30 דקות", 30 * 60e3],
    ["שעה", 3600e3], ["יום", 86400e3], ["שבוע", 7 * 86400e3],
  ];
  const units = [[60e3, "דקות"], [3600e3, "שעות"], [86400e3, "ימים"], [7 * 86400e3, "שבועות"]];
  const btn = { background: th.accentSoft, color: th.accentText, border: "none",
    borderRadius: 11, padding: "13px 8px", cursor: "pointer",
    fontSize: 13.5, fontWeight: 600, fontFamily: FONT, whiteSpace: "nowrap" };

  return (
    <Modal onClose={onClose} maxWidth={380} th={th}>
      <ModalHeader title="😴 לך לישון — דחיית תזכורת" icon="bell" onClose={onClose} th={th} />
      <p style={{ margin: "0 0 12px", fontSize: 13, color: th.secondary, lineHeight: 1.5,
        overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
        {(idea.title || idea.text || "").slice(0, 90)}
      </p>

      <p style={{ margin: "0 0 7px", fontSize: 12, color: th.muted, fontWeight: 600 }}>מוגדר מראש</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginBottom: 14 }}>
        {quick.map(([label, ms]) => (
          <button key={label} onClick={() => onSave(now + ms)} style={btn}>{label}</button>
        ))}
      </div>

      <p style={{ margin: "0 0 7px", fontSize: 12, color: th.muted, fontWeight: 600 }}>מותאם אישית</p>
      <input type="datetime-local"
        value={fmtDatetimeLocal(custom)}
        min={fmtDatetimeLocal(now)}
        onChange={e => {
          const ts = e.target.value ? new Date(e.target.value).getTime() : null;
          setCustom(ts);
          if (ts && ts > now) onSave(ts);
        }}
        style={{ width: "100%", border: `1px solid ${th.border}`, borderRadius: 10,
          padding: "11px 12px", fontSize: 14, background: th.inputBg,
          color: th.text, fontFamily: FONT, marginBottom: 10 }} />
      <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
        <input type="number" min={1} max={999} value={amount}
          onChange={e => setAmount(Math.max(1, parseInt(e.target.value) || 1))}
          style={{ width: 64, border: `1px solid ${th.border}`, borderRadius: 10,
            padding: "10px 8px", fontSize: 15, textAlign: "center", background: th.inputBg,
            color: th.text, fontFamily: FONT }} />
        <select value={unit} onChange={e => setUnit(Number(e.target.value))}
          style={{ flex: 1, border: `1px solid ${th.border}`, borderRadius: 10,
            padding: "10px 10px", fontSize: 14, background: th.inputBg,
            color: th.text, fontFamily: FONT, direction: "rtl" }}>
          {units.map(([ms, label]) => <option key={ms} value={ms}>{label}</option>)}
        </select>
        <button onClick={() => onSave(now + amount * unit)}
          style={{ background: th.accent, color: "#fff", border: "none", borderRadius: 10,
            padding: "10px 20px", cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: FONT }}>
          בצע
        </button>
      </div>

      <button onClick={onClose}
        style={{ width: "100%", marginTop: 12, background: "transparent", color: th.secondary,
          border: `1px solid ${th.border}`, borderRadius: 11, padding: "10px 0",
          cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: FONT }}>
        בטל
      </button>
    </Modal>
  );
}

// Owner manages who a project is shared with (Google account emails).
export function ProjectShareModal({ project, share, onSave, onClose, th }) {
  const [emails, setEmails] = useState(share?.sharedWith || []);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const add = () => {
    const e = input.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return;
    if (!emails.includes(e)) setEmails(p => [...p, e]);
    setInput("");
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(emails);
      setSaving(false);
      onClose();
    } catch (e) {
      setSaving(false);
      setError(e?.code === "permission-denied"
        ? "אין הרשאה לשמור שיתוף — צריך לפרסם את כללי האבטחה החדשים בקונסול של Firebase"
        : `השמירה נכשלה (${e?.code || e?.message || "שגיאה"}) — נסה שוב`);
    }
  };

  return (
    <Modal onClose={onClose} maxWidth={400} th={th}>
      <ModalHeader title={`שיתוף · ${project.name}`} icon="share" onClose={onClose} th={th} />
      <p style={{ margin: "0 0 12px", fontSize: 12.5, color: th.secondary, lineHeight: 1.6 }}>
        מי שברשימה ייכנס לאפליקציה עם חשבון Google של הכתובת — יראה את רעיונות הפרויקט,
        יגיב עליהם ויוכל להוסיף רעיונות. הוא לא יוכל לערוך או למחוק את שלך.
      </p>

      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && add()}
          placeholder="name@gmail.com" type="email" dir="ltr"
          style={{ flex: 1, border: `1px solid ${th.border}`, borderRadius: 10,
            padding: "10px 12px", fontSize: 14, background: th.inputBg,
            color: th.text, fontFamily: FONT }} />
        <button onClick={add}
          style={{ background: th.accent, color: "#fff", border: "none", borderRadius: 10,
            padding: "0 14px", cursor: "pointer", display: "flex", alignItems: "center" }}>
          <Icon name="add" size={17} color="#fff" />
        </button>
      </div>

      {emails.map(e => (
        <div key={e} style={{ display: "flex", alignItems: "center", gap: 8,
          background: th.surface2, borderRadius: 10, padding: "8px 12px", marginBottom: 6 }}>
          <span style={{ flex: 1, fontSize: 13.5, color: th.text, direction: "ltr", textAlign: "left" }}>{e}</span>
          <button onClick={() => setEmails(p => p.filter(x => x !== e))}
            style={{ background: "transparent", border: "none", cursor: "pointer", padding: 3,
              display: "flex", alignItems: "center" }}>
            <Icon name="close" size={12} color={th.muted} />
          </button>
        </div>
      ))}
      {emails.length === 0 && (
        <p style={{ margin: "4px 0 8px", fontSize: 12, color: th.muted, textAlign: "center" }}>
          {share ? "שמירה בלי כתובות תבטל את השיתוף" : "הוסף כתובת ראשונה כדי לשתף"}
        </p>
      )}

      {error && (
        <p style={{ margin: "8px 0 0", fontSize: 12.5, color: th.red, textAlign: "center",
          lineHeight: 1.5, background: th.dark ? "#3A1A1E" : "#FDECEC",
          borderRadius: 10, padding: "9px 12px" }}>
          {error}
        </p>
      )}

      <button onClick={save} disabled={saving}
        style={{ width: "100%", marginTop: 10, background: th.accent, color: "#fff",
          border: "none", borderRadius: 12, padding: "13px 0", cursor: "pointer",
          fontSize: 15, fontWeight: 700, fontFamily: FONT, opacity: saving ? 0.6 : 1 }}>
        {emails.length === 0 && share ? "בטל שיתוף" : "שמור שיתוף"}
      </button>
    </Modal>
  );
}

// Comment thread on a single idea — both owner and guests use this.
export function CommentsSheet({ idea, liveComments, onAdd, onClose, th }) {
  const [text, setText] = useState("");
  const [local, setLocal] = useState([]); // optimistic additions
  const comments = [...(liveComments ?? idea.comments ?? []), ...local]
    .sort((a, b) => (a.at || 0) - (b.at || 0));

  const send = () => {
    const t = text.trim();
    if (!t) return;
    onAdd(t);
    setLocal(p => [...p, { id: `local-${p.length}`, text: t, authorName: "אני", at: Date.now() }]);
    setText("");
  };

  return (
    <Modal onClose={onClose} maxWidth={420} th={th}>
      <ModalHeader title="תגובות" icon="chat" onClose={onClose} th={th} />
      <p style={{ margin: "0 0 12px", fontSize: 12.5, color: th.secondary, lineHeight: 1.5,
        overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
        {(idea.title || idea.text || "").slice(0, 100)}
      </p>

      <div style={{ maxHeight: 300, overflowY: "auto", marginBottom: 10 }}>
        {comments.length === 0 && (
          <p style={{ textAlign: "center", fontSize: 13, color: th.muted, padding: "16px 0" }}>
            אין תגובות עדיין — היה הראשון
          </p>
        )}
        {comments.map(c => (
          <div key={c.id} style={{ background: th.surface2, borderRadius: 11,
            padding: "8px 12px", marginBottom: 7 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: th.accentText }}>
                {c.authorName || c.authorEmail || "אורח"}
              </span>
              <span style={{ fontSize: 10, color: th.muted }}>{fmtShort(c.at)}</span>
            </div>
            <p style={{ margin: "3px 0 0", fontSize: 13.5, color: th.text, lineHeight: 1.55,
              whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{c.text}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <input value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="כתוב תגובה..."
          style={{ flex: 1, border: `1px solid ${th.border}`, borderRadius: 11,
            padding: "10px 12px", fontSize: 14, background: th.inputBg,
            color: th.text, fontFamily: FONT, direction: "rtl" }} />
        <button onClick={send}
          style={{ background: th.accent, color: "#fff", border: "none", borderRadius: 11,
            padding: "0 14px", cursor: "pointer", display: "flex", alignItems: "center" }}>
          <Icon name="send" size={16} color="#fff" />
        </button>
      </div>
    </Modal>
  );
}

function fmtShort(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
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
