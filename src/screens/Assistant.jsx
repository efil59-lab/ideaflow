// AI assistant — grounded on all ideas, plus a one-tap weekly overview.
import { useState } from "react";
import { Modal, ModalHeader, Spin } from "../ui/base";
import { Icon } from "../ui/Icons";
import { askAI, weeklyOverview } from "../data/ai";
import { FONT } from "../theme";

export default function Assistant({ ideas, projects, onClose, th }) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState("");

  const run = async (fn) => {
    setLoading(true); setAnswer("");
    try { setAnswer(await fn()); }
    catch { setAnswer("משהו השתבש — נסה שוב."); }
    setLoading(false);
  };

  const ask = () => { if (q.trim()) run(() => askAI(q, ideas, projects)); };

  const quick = [
    ["תמונת מצב שבועית", () => run(() => weeklyOverview(ideas, projects))],
    ["מה הכי דחוף?", () => { setQ("מה הרעיון הכי דחוף או שווה לקדם עכשיו?"); run(() => askAI("מה הרעיון הכי דחוף או שווה לקדם עכשיו?", ideas, projects)); }],
    ["אילו רעיונות דומים?", () => { setQ("אילו רעיונות דומים ששווה לאחד?"); run(() => askAI("אילו רעיונות דומים ששווה לאחד?", ideas, projects)); }],
  ];

  return (
    <Modal onClose={onClose} th={th}>
      <ModalHeader title="עוזר AI" icon="sparkle" onClose={onClose} th={th} />

      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <input value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === "Enter" && ask()}
          placeholder="שאל על הרעיונות שלך..."
          style={{ flex: 1, border: `1px solid ${th.border}`, borderRadius: 11,
            padding: "10px 12px", fontSize: 14, background: th.inputBg,
            fontFamily: FONT, direction: "rtl", color: th.text }} />
        <button onClick={ask} disabled={loading}
          style={{ background: th.accent, color: "#fff", border: "none", borderRadius: 11,
            padding: "0 14px", cursor: "pointer", opacity: loading ? 0.6 : 1,
            display: "flex", alignItems: "center" }}>
          <Icon name="send" size={17} color="#fff" />
        </button>
      </div>

      {loading && <Spin th={th} />}

      {answer && (
        <div style={{ background: th.surface2, borderRadius: 12, padding: "12px 14px",
          border: `1px solid ${th.border}`, marginBottom: 10 }}>
          <p style={{ margin: 0, color: th.text, fontSize: 13.5, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{answer}</p>
        </div>
      )}

      {!answer && !loading && quick.map(([label, fn]) => (
        <button key={label} onClick={fn}
          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%",
            background: th.surface2, border: `1px solid ${th.border}`, borderRadius: 11,
            padding: "11px 13px", marginBottom: 6, cursor: "pointer", fontSize: 13.5,
            color: th.text, fontFamily: FONT, fontWeight: 500 }}>
          <Icon name="sparkle" size={14} color={th.accent} />{label}
        </button>
      ))}
    </Modal>
  );
}
