// The hero of the app: type → save. Three seconds from thought to stored idea.
import { useState, useRef, useEffect } from "react";
import { Icon } from "./Icons";
import { uploadFile } from "../data/media";
import { FONT } from "../theme";

export default function CaptureBar({ uid, onCapture, th, placeholder = "מה עולה לך בראש?", draftKey = "if_draft" }) {
  // Draft survives closing/refreshing the app — nothing typed is ever lost.
  const [text, setText] = useState(() => {
    try { return localStorage.getItem(draftKey) || ""; } catch { return ""; }
  });
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (text.trim()) localStorage.setItem(draftKey, text);
        else localStorage.removeItem(draftKey);
      } catch { /* storage full/blocked */ }
    }, 350);
    return () => clearTimeout(t);
  }, [text, draftKey]);
  const [pending, setPending] = useState([]); // [{kind:'image'|'audio'|'file', url, name, size}]
  const [busy, setBusy] = useState(false);
  const taRef = useRef();
  const imgRef = useRef();
  const micRef = useRef();
  const docRef = useRef();

  // App shortcut / share intent asked to jump straight into typing.
  // Android only raises the soft keyboard for a focus() call that happens while
  // the launch tap's user-activation is still live (~5s), and only once the box
  // is actually painted — so we retry focus over the first second.
  const [autoFocus, setAutoFocus] = useState(false);
  useEffect(() => {
    let requested = false;
    try { requested = localStorage.getItem("if_focus_capture") === "1"; } catch { /* ignore */ }
    if (!requested) return;
    setAutoFocus(true);

    // Consume the flag only once we've done our job (or the window lapses) — not
    // on mount — so a dev StrictMode double-mount or a quick tab bounce still
    // re-focuses instead of silently dropping the request.
    const done = () => {
      try { localStorage.removeItem("if_focus_capture"); } catch { /* ignore */ }
      document.removeEventListener("pointerdown", onFirstTap, true);
      timers.forEach(clearTimeout);
      clearTimeout(stop);
    };
    const focusEnd = () => {
      const el = taRef.current;
      if (!el) return;
      el.focus();
      try { const n = el.value.length; el.setSelectionRange(n, n); } catch { /* ignore */ }
      if (document.activeElement === el) done(); // keyboard up — stop retrying
    };
    // Android won't raise the soft keyboard for a scripted focus once the launch
    // activation lapses. The user's first tap on any neutral area (not a button
    // or field) is a real gesture, so focusing inside it does raise it. One-shot,
    // and it never hijacks a deliberate control tap.
    const onFirstTap = e => {
      if (taRef.current && document.activeElement === taRef.current) { done(); return; }
      if (e.target.closest("button, input, textarea, select, a")) return;
      focusEnd();
      done();
    };
    const timers = [0, 120, 300, 600, 1000].map(ms => setTimeout(focusEnd, ms));
    document.addEventListener("pointerdown", onFirstTap, true);
    const stop = setTimeout(done, 8000);

    // Keep the flag on transient unmount; only detach our own listeners/timers.
    return () => {
      document.removeEventListener("pointerdown", onFirstTap, true);
      timers.forEach(clearTimeout);
      clearTimeout(stop);
    };
  }, []);

  const addMedia = async (file, kind) => {
    if (!file) return;
    setBusy(true);
    try {
      const up = await uploadFile(uid, file);
      setPending(p => [...p, { kind, url: up.url, name: kind === "file" ? (file.name || up.name) : up.name, size: up.size }]);
    } catch (e) { console.warn("upload failed", e); }
    setBusy(false);
  };

  // Auto-capture: 9s after the last keystroke (or media add), the idea saves
  // itself — no button needed. Any change resets the countdown.
  const saveRef = useRef(() => {});
  useEffect(() => {
    if (busy) return;
    if (!text.trim() && !pending.length) return;
    const t = setTimeout(() => saveRef.current(), 9000);
    return () => clearTimeout(t);
  }, [text, pending, busy]);

  const save = () => {
    const t = text.trim();
    if (!t && !pending.length) return;
    onCapture({
      text: t,
      images: pending.filter(m => m.kind === "image").map(m => m.url),
      audios: pending.filter(m => m.kind === "audio").map(m => ({ url: m.url, name: m.name })),
      files: pending.filter(m => m.kind === "file").map(m => ({ url: m.url, name: m.name, size: m.size })),
    });
    setText("");
    setPending([]);
    try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
    taRef.current?.focus();
  };
  useEffect(() => { saveRef.current = save; });

  return (
    <div style={{ background: th.surface, border: `1px solid ${th.border}`, borderRadius: 16, padding: "12px 13px" }}>
      <textarea ref={taRef} value={text} onChange={e => setText(e.target.value)}
        autoFocus={autoFocus}
        onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) save(); }}
        placeholder={placeholder} rows={text.length > 80 ? 3 : 2}
        style={{ width: "100%", border: "none", resize: "none", background: "transparent",
          fontSize: 15.5, fontFamily: FONT, direction: "rtl", color: th.text, lineHeight: 1.6 }} />

      {pending.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "4px 0 8px" }}>
          {pending.map((m, i) => (
            <span key={i} style={{ position: "relative" }}>
              {m.kind === "image"
                ? <img src={m.url} alt="" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8 }} />
                : <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12,
                    maxWidth: 160, background: th.surface2, border: `1px solid ${th.border}`, borderRadius: 8,
                    padding: "5px 9px", color: th.secondary }}>
                    <Icon name={m.kind === "audio" ? "music" : "clip"} size={13} color={th.secondary} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.kind === "audio" ? "הקלטה" : m.name}
                    </span>
                  </span>}
              <button onClick={() => setPending(p => p.filter((_, j) => j !== i))}
                style={{ position: "absolute", top: -6, left: -6, width: 17, height: 17,
                  background: th.red, border: "none", borderRadius: "50%", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="close" size={9} color="#fff" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
        <button onClick={() => micRef.current.click()} title="הקלטה קולית"
          style={{ background: "transparent", border: "none", cursor: "pointer", padding: 7, borderRadius: 9 }}>
          <Icon name="mic" size={18} color={th.accent} />
        </button>
        <button onClick={() => imgRef.current.click()} title="תמונה"
          style={{ background: "transparent", border: "none", cursor: "pointer", padding: 7, borderRadius: 9 }}>
          <Icon name="camera" size={18} color={th.accent} />
        </button>
        <button onClick={() => docRef.current.click()} title="צירוף קובץ"
          style={{ background: "transparent", border: "none", cursor: "pointer", padding: 7, borderRadius: 9 }}>
          <Icon name="clip" size={18} color={th.accent} />
        </button>
        {busy && <span style={{ fontSize: 11.5, color: th.muted }}>מעלה...</span>}
        {!busy && (text.trim() || pending.length > 0) && (
          <span style={{ fontSize: 11, color: th.muted }}>יישמר לבד בעוד רגע</span>
        )}
        <button onClick={save} disabled={busy || (!text.trim() && !pending.length)}
          style={{ marginRight: "auto", background: th.accent, color: "#fff", border: "none",
            borderRadius: 10, padding: "8px 22px", cursor: "pointer",
            fontSize: 14, fontWeight: 600, fontFamily: FONT,
            opacity: (!text.trim() && !pending.length) || busy ? 0.45 : 1 }}>
          שמור
        </button>
      </div>

      <input ref={imgRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={e => { addMedia(e.target.files[0], "image"); e.target.value = ""; }} />
      <input ref={micRef} type="file" accept="audio/*" capture="microphone" style={{ display: "none" }}
        onChange={e => { addMedia(e.target.files[0], "audio"); e.target.value = ""; }} />
      <input ref={docRef} type="file" style={{ display: "none" }}
        onChange={e => { addMedia(e.target.files[0], "file"); e.target.value = ""; }} />
    </div>
  );
}
