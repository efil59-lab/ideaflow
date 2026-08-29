import { useRef, useState } from "react";

// Voice recording via getUserMedia + MediaRecorder — works in installed PWAs
// where the Web Speech API doesn't. `onClip` gets the recorded Blob on stop.
export function useRecorder(onClip) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const mrRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  const toggle = async () => {
    if (recording) { try { mrRef.current?.stop(); } catch { /* ignore */ } return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("ההקלטה לא נתמכת בדפדפן הזה"); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = e => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        streamRef.current?.getTracks().forEach(t => t.stop());
        setRecording(false);
        if (blob.size) onClip(blob);
      };
      mrRef.current = mr;
      mr.start();
      setRecording(true);
      setError("");
    } catch (e) {
      setError(e?.name === "NotAllowedError" ? "לא ניתנה הרשאת מיקרופון" : "לא ניתן להקליט");
      setRecording(false);
    }
  };

  return { recording, error, toggle };
}
