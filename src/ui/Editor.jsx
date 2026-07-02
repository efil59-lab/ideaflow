// Full idea editor — rich text, media, project, reminder.
import { useState, useRef, useEffect } from "react";
import { Modal, ModalHeader } from "./base";
import { Icon } from "./Icons";
import RichEditor, { htmlToText, isHtml } from "./RichEditor";
import { uploadFile } from "../data/media";
import { FONT, fmtDatetimeLocal } from "../theme";

export default function Editor({ uid, initial, projects, onSave, onAutosave, onClose, title, th }) {
  const initialHtml = initial?.html
    ? initial.html
    : (initial?.text
        ? (isHtml(initial.text) ? initial.text
           : initial.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>"))
        : "");
  const [html, setHtml] = useState(initialHtml);
  const [images, setImages] = useState(initial?.images || []);
  const [audios, setAudios] = useState(initial?.audios || []);
  const [remindAt, setRemindAt] = useState(initial?.remindAt || null);
  const [projectId, setProjectId] = useState(initial?.projectId ?? null);
  const [showRemind, setShowRemind] = useState(false);
  const [busy, setBusy] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);
  const fileRef = useRef();
  const audioRef = useRef();
  const audioCapRef = useRef();

  // Autosave text 1.5s after the last keystroke (existing ideas only).
  // Media/project/reminder still commit via the save button.
  const lastSavedRef = useRef(initialHtml);
  const flushRef = useRef(() => {});
  useEffect(() => {
    flushRef.current = () => {
      if (!onAutosave || html === lastSavedRef.current) return false;
      const plain = htmlToText(html);
      if (!plain) return false;
      lastSavedRef.current = html;
      onAutosave({ text: plain, html });
      return true;
    };
  });
  useEffect(() => {
    if (!onAutosave || html === lastSavedRef.current) return;
    setAutoSaved(false);
    const t = setTimeout(() => { if (flushRef.current()) setAutoSaved(true); }, 1500);
    return () => clearTimeout(t);
  }, [html, onAutosave]);
  // Closing the editor in any way (X, backdrop, hardware back) must not lose
  // a pending edit — flush it on unmount.
  useEffect(() => () => { flushRef.current(); }, []);

  const addMedia = async (file, kind) => {
    if (!file) return;
    setBusy(true);
    try {
      const up = await uploadFile(uid, file);
      if (kind === "image") setImages(p => [...p, up.url]);
      else setAudios(p => [...p, { url: up.url, name: up.name }]);
    } catch (e) { console.warn("upload failed", e); }
    setBusy(false);
  };

  const handleSave = () => {
    const plain = htmlToText(html);
    if (!plain && !images.length && !audios.length) return;
    onSave({
      text: plain, html, images, audios,
      remindAt: remindAt || null,
      projectId,
      status: initial?.status === "done" ? "done" : (projectId ? "active" : (initial?.status || "inbox")),
    });
  };

  const mediaBtn = { flex: 1, background: th.surface2, color: th.secondary, border: `1px solid ${th.border}`,
    borderRadius: 11, padding: "10px 0", cursor: "pointer", fontSize: 12.5, fontWeight: 600,
    fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minWidth: 66 };

  return (
    <Modal onClose={onClose} th={th}>
      <ModalHeader title={title} icon="edit" onClose={onClose} th={th} />
      <RichEditor html={html} onChange={setHtml} th={th} placeholder="מה עולה לך בראש?" />
      {autoSaved && (
        <p style={{ margin: "6px 2px 0", fontSize: 11.5, color: th.green,
          display: "flex", alignItems: "center", gap: 4 }}>
          <Icon name="check" size={12} color={th.green} /> נשמר אוטומטית
        </p>
      )}

      {/* Project select */}
      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: th.muted, fontWeight: 500 }}>שמור אל:</span>
        <ProjPill active={projectId === null} label="Inbox" color={th.muted} th={th}
          onClick={() => setProjectId(null)} />
        {projects.map(p => (
          <ProjPill key={p.id} active={projectId === p.id} label={p.name} color={p.color} th={th}
            onClick={() => setProjectId(p.id)} />
        ))}
      </div>

      {/* Reminder */}
      <div style={{ marginTop: 10, borderRadius: 11, border: `1px solid ${th.border}`, overflow: "hidden" }}>
        <button onClick={() => setShowRemind(p => !p)}
          style={{ width: "100%", background: remindAt ? th.accentSoft : th.surface2,
            border: "none", cursor: "pointer", padding: "10px 13px",
            display: "flex", alignItems: "center", gap: 8, direction: "rtl" }}>
          <Icon name={remindAt ? "bell" : "belloff"} size={16} color={remindAt ? th.accentText : th.muted} />
          <span style={{ flex: 1, fontSize: 13, fontWeight: 500, textAlign: "right",
            color: remindAt ? th.accentText : th.secondary, fontFamily: FONT }}>
            {remindAt
              ? `תזכורת: ${new Date(remindAt).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`
              : "הגדר תזכורת"}
          </span>
          {remindAt && (
            <span onClick={e => { e.stopPropagation(); setRemindAt(null); setShowRemind(false); }}
              style={{ fontSize: 11, color: th.accentText, background: th.surface,
                borderRadius: 20, padding: "2px 9px", fontWeight: 600, fontFamily: FONT }}>הסר</span>
          )}
        </button>
        {showRemind && (
          <div style={{ padding: "10px 13px", background: th.surface2, borderTop: `1px solid ${th.border}` }}>
            <input type="datetime-local"
              value={fmtDatetimeLocal(remindAt)}
              min={fmtDatetimeLocal(Date.now())}
              onChange={e => setRemindAt(e.target.value ? new Date(e.target.value).getTime() : null)}
              style={{ width: "100%", border: `1px solid ${th.border}`, borderRadius: 9,
                padding: "9px 12px", fontSize: 14, background: th.inputBg,
                color: th.text, fontFamily: FONT }} />
          </div>
        )}
      </div>

      {/* Media previews */}
      {audios.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {audios.map((a, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8,
              background: th.surface2, borderRadius: 10, padding: "7px 10px", border: `1px solid ${th.border}` }}>
              <Icon name="music" size={15} color={th.secondary} />
              <audio src={a.url || a.src} controls style={{ flex: 1, height: 32 }} />
              <button onClick={() => setAudios(p => p.filter((_, j) => j !== i))}
                style={{ background: th.red, border: "none", borderRadius: "50%", width: 20, height: 20,
                  cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="close" size={11} color="#fff" />
              </button>
            </div>
          ))}
        </div>
      )}
      {images.length > 0 && (
        <div style={{ display: "flex", gap: 7, marginTop: 10, flexWrap: "wrap" }}>
          {images.map((src, i) => (
            <div key={i} style={{ position: "relative" }}>
              <img src={src} alt="" style={{ width: 62, height: 62, objectFit: "cover", borderRadius: 10 }} />
              <button onClick={() => setImages(p => p.filter((_, j) => j !== i))}
                style={{ position: "absolute", top: -5, left: -5, width: 20, height: 20,
                  background: th.red, border: "none", borderRadius: "50%",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="close" size={11} color="#fff" />
              </button>
            </div>
          ))}
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={e => { addMedia(e.target.files[0], "image"); e.target.value = ""; }} />
      <input ref={audioRef} type="file" accept="audio/*" style={{ display: "none" }}
        onChange={e => { addMedia(e.target.files[0], "audio"); e.target.value = ""; }} />
      <input ref={audioCapRef} type="file" accept="audio/*" capture="microphone" style={{ display: "none" }}
        onChange={e => { addMedia(e.target.files[0], "audio"); e.target.value = ""; }} />

      <div style={{ display: "flex", gap: 7, marginTop: 12, flexWrap: "wrap" }}>
        <button style={mediaBtn} onClick={() => { fileRef.current.removeAttribute("capture"); fileRef.current.click(); }}>
          <Icon name="photo" size={15} color={th.secondary} /> גלריה
        </button>
        <button style={mediaBtn} onClick={() => { fileRef.current.setAttribute("capture", "environment"); fileRef.current.click(); }}>
          <Icon name="camera" size={15} color={th.secondary} /> צלם
        </button>
        <button style={mediaBtn} onClick={() => audioCapRef.current.click()}>
          <Icon name="mic" size={15} color={th.secondary} /> הקלט
        </button>
        <button style={mediaBtn} onClick={() => audioRef.current.click()}>
          <Icon name="music" size={15} color={th.secondary} /> אודיו
        </button>
      </div>

      <button onClick={handleSave} disabled={busy}
        style={{ width: "100%", marginTop: 12, background: th.accent, color: "#fff",
          border: "none", borderRadius: 12, padding: "13px 0", cursor: "pointer",
          fontSize: 15, fontWeight: 700, fontFamily: FONT, opacity: busy ? 0.6 : 1,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <Icon name="save" size={17} color="#fff" /> {busy ? "מעלה..." : "שמור"}
      </button>
    </Modal>
  );
}

function ProjPill({ active, label, color, onClick, th }) {
  return (
    <button onClick={onClick}
      style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600,
        fontFamily: FONT, padding: "5px 11px", borderRadius: 18, cursor: "pointer",
        background: active ? th.accentSoft : th.surface2,
        color: active ? th.accentText : th.secondary,
        border: `1px solid ${active ? th.accent : th.border}` }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
      {label}
    </button>
  );
}
