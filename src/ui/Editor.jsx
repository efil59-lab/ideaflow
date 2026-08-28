// Full idea editor — rich text, media, project, reminder.
import { useState, useRef, useEffect } from "react";
import { Modal, ModalHeader } from "./base";
import { Icon } from "./Icons";
import RichEditor, { htmlToText, isHtml } from "./RichEditor";
import { uploadFile, fmtSize, MAX_FILE_BYTES } from "../data/media";
import { ideaAction, IDEA_ACTION_LIST } from "../data/ai";
import { FONT, fmtDatetimeLocal, REPEAT_OPTIONS } from "../theme";

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
  const [files, setFiles] = useState(initial?.files || []);
  const [remindAt, setRemindAt] = useState(initial?.remindAt || null);
  const [repeat, setRepeat] = useState(initial?.repeat || "");
  const [projectId, setProjectId] = useState(initial?.projectId ?? null);
  const [showRemind, setShowRemind] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mediaErr, setMediaErr] = useState("");
  const [autoSaved, setAutoSaved] = useState(false);
  // AI actions: the result is offered, never forced — replace or append, or drop it.
  const [aiBusy, setAiBusy] = useState("");
  const [aiOut, setAiOut] = useState(null);
  const [aiErr, setAiErr] = useState("");

  const runAi = async kind => {
    const plain = htmlToText(html).trim();
    if (!plain) { setAiErr("כתוב משהו קודם"); return; }
    setAiBusy(kind); setAiErr(""); setAiOut(null);
    try { setAiOut(await ideaAction(kind, plain)); }
    catch { setAiErr("ה-AI לא זמין כרגע — נסה שוב"); }
    setAiBusy("");
  };
  const asHtml = t => t.split(/\r?\n/).map(l =>
    l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")).join("<br>");
  const fileRef = useRef();
  const audioRef = useRef();
  const audioCapRef = useRef();
  const docRef = useRef();

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
    if (file.size > MAX_FILE_BYTES) {
      setMediaErr(`הקובץ גדול מדי (${fmtSize(file.size)}) — עד ${fmtSize(MAX_FILE_BYTES)}`);
      return;
    }
    setMediaErr("");
    setBusy(true);
    try {
      const up = await uploadFile(uid, file);
      if (kind === "image") setImages(p => [...p, up.url]);
      else if (kind === "audio") setAudios(p => [...p, { url: up.url, name: up.name }]);
      else setFiles(p => [...p, { url: up.url, name: file.name || up.name, size: up.size }]);
    } catch (e) { console.warn("upload failed", e); setMediaErr("ההעלאה נכשלה — בדוק את החיבור ונסה שוב"); }
    setBusy(false);
  };

  const handleSave = () => {
    const plain = htmlToText(html);
    if (!plain && !images.length && !audios.length && !files.length) return;
    onSave({
      text: plain, html, images, audios, files,
      remindAt: remindAt || null,
      repeat: remindAt ? (repeat || null) : null,
      repeatAnchor: remindAt && repeat ? remindAt : null,
      projectId,
      status: initial?.status === "done" ? "done" : (projectId ? "active" : (initial?.status || "inbox")),
    });
  };

  const mediaBtn = { flex: 1, minWidth: 0, background: th.surface2, border: `1px solid ${th.border}`,
    borderRadius: 11, padding: "11px 0", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center" };

  return (
    <Modal onClose={onClose} th={th}>
      <ModalHeader title={title} icon="edit" onClose={onClose} th={th} />
      <RichEditor html={html} onChange={setHtml} th={th} placeholder="מה עולה לך בראש?" />

      {/* Turn the idea into something: AI actions on the text itself */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 9, direction: "rtl" }}>
        {IDEA_ACTION_LIST.map(a => (
          <button key={a.id} onClick={() => runAi(a.id)} disabled={!!aiBusy}
            style={{ display: "inline-flex", alignItems: "center", gap: 5,
              background: th.accentSoft, color: th.accentText, border: "none",
              borderRadius: 18, padding: "7px 13px", cursor: aiBusy ? "default" : "pointer",
              fontSize: 12.5, fontWeight: 600, fontFamily: FONT,
              opacity: aiBusy && aiBusy !== a.id ? 0.45 : 1 }}>
            <Icon name="sparkle" size={13} color={th.accentText} />
            {aiBusy === a.id ? "חושב…" : a.label}
          </button>
        ))}
      </div>
      {aiErr && <p style={{ margin: "7px 2px 0", fontSize: 12, color: th.red }}>{aiErr}</p>}
      {aiOut && (
        <div style={{ marginTop: 9, borderRadius: 13, padding: "11px 12px", direction: "rtl",
          background: th.electric ? "rgba(168,85,247,0.10)" : th.surface2,
          border: `1px solid ${th.electric ? "rgba(168,85,247,0.35)" : th.border}` }}>
          <p style={{ margin: "0 0 9px", fontSize: 13.5, color: th.text, lineHeight: 1.65,
            whiteSpace: "pre-wrap", maxHeight: 220, overflowY: "auto" }}>{aiOut}</p>
          <div style={{ display: "flex", gap: 7 }}>
            <button onClick={() => { setHtml(asHtml(aiOut)); setAiOut(null); }}
              style={{ flex: 1, background: th.accent, color: "#fff", border: "none", borderRadius: 10,
                padding: "9px 0", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: FONT }}>
              החלף
            </button>
            <button onClick={() => { setHtml(h => h + "<br><br>" + asHtml(aiOut)); setAiOut(null); }}
              style={{ flex: 1, background: th.surface, color: th.text, border: `1px solid ${th.border}`,
                borderRadius: 10, padding: "9px 0", cursor: "pointer",
                fontSize: 13, fontWeight: 600, fontFamily: FONT }}>
              הוסף למטה
            </button>
            <button onClick={() => setAiOut(null)}
              style={{ background: "transparent", color: th.muted, border: `1px solid ${th.border}`,
                borderRadius: 10, padding: "9px 14px", cursor: "pointer",
                fontSize: 13, fontWeight: 600, fontFamily: FONT }}>
              בטל
            </button>
          </div>
        </div>
      )}
      {autoSaved && (
        <p style={{ margin: "6px 2px 0", fontSize: 11.5, color: th.green,
          display: "flex", alignItems: "center", gap: 4 }}>
          <Icon name="check" size={12} color={th.green} /> נשמר אוטומטית
        </p>
      )}

      {/* Destination + reminder — one compact row */}
      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "stretch", direction: "rtl" }}>
        <select value={projectId ?? ""} onChange={e => setProjectId(e.target.value || null)}
          style={{ flex: 1, minWidth: 0, border: `1px solid ${th.border}`, borderRadius: 10,
            padding: "9px 10px", fontSize: 13.5, background: th.inputBg, color: th.text,
            fontFamily: FONT, direction: "rtl" }}>
          <option value="">Inbox — ללא פרויקט</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button onClick={() => setShowRemind(p => !p)} title="תזכורת"
          style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6,
            background: remindAt ? th.accentSoft : th.surface2,
            border: `1px solid ${remindAt ? th.accentText : th.border}`, borderRadius: 10,
            padding: "0 12px", cursor: "pointer", fontFamily: FONT, fontSize: 13, fontWeight: 500,
            color: remindAt ? th.accentText : th.secondary }}>
          <Icon name={remindAt ? "bell" : "belloff"} size={15} color={remindAt ? th.accentText : th.muted} />
          {remindAt
            ? new Date(remindAt).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) + (repeat ? " ↻" : "")
            : "תזכורת"}
        </button>
      </div>

      {/* Reminder detail — opens under the row: date + repeat side by side */}
      {showRemind && (
        <div style={{ marginTop: 8, padding: "10px 12px", background: th.surface2,
          border: `1px solid ${th.border}`, borderRadius: 11 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 4, direction: "rtl" }}>
            <span style={{ flex: 1.4, fontSize: 11, color: th.muted, fontFamily: FONT }}>תאריך ושעה</span>
            <span style={{ flex: 1, fontSize: 11, color: th.muted, fontFamily: FONT }}>חזרה</span>
          </div>
          <div style={{ display: "flex", gap: 8, direction: "rtl" }}>
            <input type="datetime-local"
              value={fmtDatetimeLocal(remindAt)}
              min={fmtDatetimeLocal(Date.now())}
              onChange={e => setRemindAt(e.target.value ? new Date(e.target.value).getTime() : null)}
              style={{ flex: 1.4, minWidth: 0, border: `1px solid ${th.border}`, borderRadius: 9,
                padding: "9px 10px", fontSize: 13.5, background: th.inputBg, color: th.text, fontFamily: FONT }} />
            <select value={repeat} onChange={e => setRepeat(e.target.value)}
              style={{ flex: 1, minWidth: 0, border: `1px solid ${th.border}`, borderRadius: 9,
                padding: "9px 8px", fontSize: 13, background: th.inputBg, color: th.text,
                fontFamily: FONT, direction: "rtl" }}>
              {REPEAT_OPTIONS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </div>
          {remindAt && (
            <span onClick={() => { setRemindAt(null); setRepeat(""); }}
              style={{ display: "inline-block", marginTop: 8, fontSize: 12, color: th.red,
                cursor: "pointer", fontFamily: FONT }}>הסר תזכורת</span>
          )}
        </div>
      )}

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
      {files.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {files.map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8,
              background: th.surface2, borderRadius: 10, padding: "8px 10px", border: `1px solid ${th.border}` }}>
              <Icon name="file" size={15} color={th.secondary} />
              <a href={f.url} target="_blank" rel="noopener noreferrer" download={f.name}
                style={{ flex: 1, minWidth: 0, fontSize: 13, color: th.text, textDecoration: "none",
                  fontFamily: FONT, direction: "rtl", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {f.name}
                {f.size ? <span style={{ color: th.muted, fontSize: 11.5 }}>{"  "}· {fmtSize(f.size)}</span> : null}
              </a>
              <button onClick={() => setFiles(p => p.filter((_, j) => j !== i))}
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
      <input ref={docRef} type="file" style={{ display: "none" }}
        onChange={e => { addMedia(e.target.files[0], "file"); e.target.value = ""; }} />

      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <button style={mediaBtn} title="גלריה" onClick={() => { fileRef.current.removeAttribute("capture"); fileRef.current.click(); }}>
          <Icon name="photo" size={19} color={th.secondary} />
        </button>
        <button style={mediaBtn} title="צלם" onClick={() => { fileRef.current.setAttribute("capture", "environment"); fileRef.current.click(); }}>
          <Icon name="camera" size={19} color={th.secondary} />
        </button>
        <button style={mediaBtn} title="הקלט" onClick={() => audioCapRef.current.click()}>
          <Icon name="mic" size={19} color={th.secondary} />
        </button>
        <button style={mediaBtn} title="אודיו" onClick={() => audioRef.current.click()}>
          <Icon name="music" size={19} color={th.secondary} />
        </button>
        <button style={mediaBtn} title="קובץ" onClick={() => docRef.current.click()}>
          <Icon name="clip" size={19} color={th.secondary} />
        </button>
      </div>
      {mediaErr && (
        <p style={{ margin: "8px 2px 0", fontSize: 12, color: th.red,
          display: "flex", alignItems: "center", gap: 5, textAlign: "right" }}>
          <Icon name="close" size={12} color={th.red} /> {mediaErr}
        </p>
      )}

      <button onClick={handleSave} disabled={busy}
        style={{ width: "100%", marginTop: 10, background: th.cta || th.accent, color: "#fff",
          border: "none", borderRadius: 12, padding: "12px 0", cursor: "pointer",
          fontSize: 15, fontWeight: 700, fontFamily: FONT, opacity: busy ? 0.6 : 1,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <Icon name="save" size={17} color="#fff" /> {busy ? "מעלה..." : "שמור"}
      </button>
    </Modal>
  );
}

