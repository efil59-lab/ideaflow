// Connect a Galaxy Watch to this account: the watch shows a 6-digit code, the
// user types it here. Also lists the account's watches and disconnects one.
import { useEffect, useState } from "react";
import { Modal, ModalHeader, Confirm } from "./base";
import { Icon } from "./Icons";
import { FONT } from "../theme";

const call = async (op, getToken, extra = {}) => {
  const idToken = await getToken();
  if (!idToken) throw new Error("auth");
  const r = await fetch(`/api/watch?op=${op}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken, ...extra }),
  });
  return r.json();
};

const when = ms => (ms ? new Date(ms).toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "2-digit" }) : "—");

export default function WatchLink({ getToken, onClose, th }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);           // { ok, text }
  const [watches, setWatches] = useState(null);   // null = loading
  const [confirmId, setConfirmId] = useState(null);

  const load = () => call("list", getToken)
    .then(d => setWatches(d.ok ? d.watches : []))
    .catch(() => setWatches([]));
  useEffect(() => { load(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  const link = async () => {
    const c = code.replace(/\D/g, "");
    if (c.length !== 6) { setMsg({ ok: false, text: "הקוד בשעון הוא 6 ספרות" }); return; }
    setBusy(true); setMsg(null);
    try {
      const d = await call("claim", getToken, { code: c });
      if (d.ok) {
        setMsg({ ok: true, text: "השעון מתחבר — תוך כמה שניות הוא יציג את הרעיונות שלך" });
        setCode("");
        setTimeout(load, 5000);
      } else {
        setMsg({ ok: false, text: d.error === "no-code"
          ? "הקוד לא נמצא או שפג תוקפו. בקש בשעון קוד חדש ונסה שוב"
          : "השעון כבר חובר לחשבון אחר" });
      }
    } catch {
      setMsg({ ok: false, text: "אין חיבור כרגע. נסה שוב בעוד רגע" });
    }
    setBusy(false);
  };

  const unlink = async id => {
    setConfirmId(null);
    await call("unlink", getToken, { id }).catch(() => {});
    load();
  };

  return (
    <Modal onClose={onClose} maxWidth={380} th={th}>
      <ModalHeader title="שעון Galaxy" icon="watch" onClose={onClose} th={th} />
      <p style={{ margin: "0 0 12px", fontSize: 13.5, lineHeight: 1.6, color: th.secondary, direction: "rtl" }}>
        פתח את IdeaFlow בשעון. יופיע שם קוד של 6 ספרות — הקלד אותו כאן, והשעון יתחבר לחשבון שלך.
      </p>
      <div style={{ display: "flex", gap: 8, direction: "rtl" }}>
        <input value={code} inputMode="numeric" maxLength={7} placeholder="123456"
          onChange={e => setCode(e.target.value.replace(/[^\d ]/g, ""))}
          onKeyDown={e => { if (e.key === "Enter") link(); }}
          style={{ flex: 1, minWidth: 0, height: 46, borderRadius: 12, border: `1px solid ${th.border}`,
            background: th.inputBg || th.surface2, color: th.text, fontFamily: FONT, fontSize: 22,
            fontWeight: 700, letterSpacing: 4, textAlign: "center", direction: "ltr" }} />
        <button onClick={link} disabled={busy}
          style={{ width: 92, height: 46, borderRadius: 12, border: "none", cursor: busy ? "default" : "pointer",
            background: th.accent, color: "#fff", fontFamily: FONT, fontSize: 15, fontWeight: 700,
            opacity: busy ? 0.6 : 1 }}>
          {busy ? "…" : "חבר"}
        </button>
      </div>
      {msg && (
        <p style={{ margin: "10px 2px 0", fontSize: 13, fontWeight: 600, lineHeight: 1.5, direction: "rtl",
          color: msg.ok ? th.green : th.red }}>{msg.text}</p>
      )}

      <p style={{ margin: "20px 0 8px", fontSize: 12, fontWeight: 700, color: th.muted, direction: "rtl" }}>שעונים מחוברים</p>
      {watches === null ? (
        <p style={{ fontSize: 13, color: th.muted, direction: "rtl", margin: 0 }}>טוען…</p>
      ) : watches.length === 0 ? (
        <p style={{ fontSize: 13, color: th.muted, direction: "rtl", margin: 0 }}>עוד אין שעון מחובר.</p>
      ) : watches.map((w, i) => (
        <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 10, direction: "rtl",
          padding: "10px 12px", marginBottom: 6, borderRadius: 12, background: th.surface2, border: `1px solid ${th.border}` }}>
          <Icon name="watch" size={18} color={th.accentText} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: th.text }}>שעון {watches.length > 1 ? i + 1 : ""}</div>
            <div style={{ fontSize: 11.5, color: th.muted }}>חובר {when(w.createdAt)} · פעיל לאחרונה {when(w.lastSeen)}</div>
          </div>
          <button onClick={() => setConfirmId(w.id)}
            style={{ height: 32, padding: "0 12px", borderRadius: 9, cursor: "pointer", fontFamily: FONT,
              fontSize: 12.5, fontWeight: 700, color: th.red, background: "transparent", border: `1px solid ${th.border}` }}>
            נתק
          </button>
        </div>
      ))}

      {confirmId && (
        <Confirm title="לנתק את השעון?" icon="watch" confirmLabel="נתק"
          message="השעון יפסיק להציג את הרעיונות שלך ולא יוכל לשמור חדשים. אפשר לחבר אותו שוב בכל רגע עם קוד חדש."
          onConfirm={() => unlink(confirmId)} onCancel={() => setConfirmId(null)} th={th} />
      )}
    </Modal>
  );
}
