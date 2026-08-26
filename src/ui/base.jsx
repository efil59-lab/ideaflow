import { createPortal } from "react-dom";
import { Icon, IconBtn } from "./Icons";
import { FONT } from "../theme";

// Rendered into document.body: an ancestor with a transform/animation (the app
// body's fadeUp) would otherwise become the containing block for position:fixed,
// dropping the dialog to the middle of the scrolled page instead of the viewport.
export function Modal({ onClose, children, maxWidth = 480, th }) {
  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,14,22,0.55)",
      backdropFilter: "blur(4px)", zIndex: 800,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: th.surface, borderRadius: 18, width: "100%", maxWidth,
          maxHeight: "88vh", overflowY: "auto", padding: "20px 18px 22px",
          direction: "rtl", border: `1px solid ${th.border}`,
          animation: "fadeUp .18s ease-out" }}>
        {children}
      </div>
    </div>,
    document.body
  );
}

export function ModalHeader({ title, icon, onClose, th }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: th.text,
        display: "flex", alignItems: "center", gap: 8 }}>
        {icon && <Icon name={icon} size={20} color={th.accent} />}
        {title}
      </h3>
      <IconBtn name="close" onClick={onClose} color={th.secondary} bg={th.surface2} size={16} pad="8px" />
    </div>
  );
}

export function Confirm({ title, message, confirmLabel = "מחק", icon = "delete", tone = "red", onConfirm, onCancel, th }) {
  const accent = tone === "red" ? th.red : th.accent;
  const tint = tone === "red" ? (th.dark ? "#3A1A1E" : "#FDECEC") : th.accentSoft;
  return (
    <Modal onClose={onCancel} maxWidth={330} th={th}>
      <div style={{ width: 46, height: 46, borderRadius: "50%", background: tint,
        display: "flex", alignItems: "center", justifyContent: "center", margin: "2px auto 12px" }}>
        <Icon name={icon} size={22} color={accent} />
      </div>
      <h3 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 700, color: th.text, textAlign: "center" }}>{title}</h3>
      {message && <p style={{ margin: "0 0 18px", fontSize: 13.5, color: th.secondary, textAlign: "center", lineHeight: 1.6 }}>{message}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onCancel} style={{ flex: 1, background: th.surface2, color: th.text,
          border: `1px solid ${th.border}`, borderRadius: 11, padding: "12px 0", cursor: "pointer",
          fontSize: 14, fontWeight: 600, fontFamily: FONT }}>ביטול</button>
        <button onClick={onConfirm} style={{ flex: 1, background: accent, color: "#fff",
          border: "none", borderRadius: 11, padding: "12px 0", cursor: "pointer",
          fontSize: 14, fontWeight: 600, fontFamily: FONT }}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}

export function Toast({ msg, th }) {
  return (
    <div className="if-toast" style={{ position: "fixed", top: 14, left: "50%", transform: "translateX(-50%)",
      background: th.text, color: th.bg, borderRadius: 11, padding: "9px 20px",
      fontSize: 14, fontWeight: 500, zIndex: 9999, pointerEvents: "none", fontFamily: FONT }}>
      {msg}
    </div>
  );
}

export function Spin({ th, size = 30 }) {
  return (
    <div style={{ textAlign: "center", padding: "18px 0" }}>
      <div style={{ width: size, height: size, border: `3px solid ${th.border}`,
        borderTop: `3px solid ${th.accent}`, borderRadius: "50%",
        margin: "0 auto", animation: "sp .7s linear infinite" }} />
    </div>
  );
}

export function Chip({ children, color, bg, border, onClick, th }) {
  return (
    <span onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 11.5, fontWeight: 500, padding: "2px 9px", borderRadius: 7,
      color: color || th.secondary, background: bg || th.surface2,
      border: `1px solid ${border || "transparent"}`,
      cursor: onClick ? "pointer" : "default", fontFamily: FONT, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}
