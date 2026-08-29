import { useRef, useState } from "react";

// Voice dictation via the Web Speech API (Chrome / Android). `onText` receives
// each finalised chunk to append. Returns { supported, listening, toggle }.
export function useDictation(onText) {
  const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const supported = !!SR;
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);

  const stop = () => { try { recRef.current?.stop(); } catch { /* ignore */ } setListening(false); };

  const toggle = () => {
    if (!supported) return false;
    if (listening) { stop(); return true; }
    const rec = new SR();
    rec.lang = "he-IL";
    rec.interimResults = false;
    rec.continuous = true;
    rec.onresult = e => {
      let out = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) out += e.results[i][0].transcript;
      }
      if (out.trim()) onText(out.trim());
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { setListening(false); }
    return true;
  };

  return { supported, listening, toggle, stop };
}
