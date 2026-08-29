import { useState } from "react";
import { Icon } from "./Icons";
import { Confirm } from "./base";

// A list of voice clips with native playback controls. Editing surfaces pass
// onRemove; read-only surfaces don't.
export default function AudioStrip({ audios = [], onRemove, th }) {
  const [confirm, setConfirm] = useState(null);
  if (!audios.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, direction: "rtl" }}>
      {audios.map((a, i) => {
        const url = typeof a === "string" ? a : a.url;
        return (
          <div key={url || i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <audio controls src={url} style={{ flex: 1, height: 38, minWidth: 0 }} />
            {onRemove && (
              <button onClick={e => { e.stopPropagation(); setConfirm(i); }} title="הסר"
                style={{ flexShrink: 0, width: 26, height: 26, borderRadius: "50%", background: th.red,
                  border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="close" size={12} color="#fff" />
              </button>
            )}
          </div>
        );
      })}
      {confirm !== null && (
        <Confirm title="מחיקת הקלטה" icon="mic"
          message="ההקלטה תוסר מהפתק. לא ניתן לשחזר."
          confirmLabel="מחק הקלטה"
          onConfirm={() => { onRemove(confirm); setConfirm(null); }}
          onCancel={() => setConfirm(null)} th={th} />
      )}
    </div>
  );
}
