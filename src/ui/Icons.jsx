// Compact outline icon set (24px viewBox, stroke-based).
const S = { fill: "none", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };

const ICONS = {
  inbox:  (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S}><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>,
  folder: (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
  search: (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  sparkle:(c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/></svg>,
  delete: (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  edit:   (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  pin:    (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" fill={c} stroke={c} strokeWidth="0.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>,
  more:   (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" fill={c}><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>,
  share:  (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
  copy:   (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  check:  (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
  sun:    (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S}><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  moon:   (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  eye:    (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  eyeoff: (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  bulb:   (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" fill={c}><path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z"/></svg>,
  close:  (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S} strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  add:    (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S} strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  save:   (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  up:     (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S} strokeWidth="2.5"><polyline points="18 15 12 9 6 15"/></svg>,
  down:   (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S} strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>,
  back:   (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S} strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>,
  send:   (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  chat:   (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  photo:  (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  camera: (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  mic:    (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S}><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  music:  (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>,
  refresh:(c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  email:  (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  time:   (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  bell:   (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  belloff:(c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S}><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  tag:    (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.83z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  logout: (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  notes:  (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  help:   (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  export: (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  clip:   (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S}><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>,
  download:(c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  file:   (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  undo:   (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S}><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>,
  redo:   (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S}><polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/></svg>,
  paste:  (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" stroke={c} {...S}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>,
};

export function Icon({ name, size = 20, color = "#6E7787" }) {
  const fn = ICONS[name];
  if (!fn) return null;
  return <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, lineHeight: 0 }}>{fn(color, size)}</span>;
}

export function IconBtn({ name, onClick, color = "#6E7787", bg = "transparent", size = 20, pad = "6px", disabled = false, title, style = {} }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      style={{ background: bg, border: "none", cursor: disabled ? "default" : "pointer",
        borderRadius: 9, padding: pad, display: "flex", alignItems: "center",
        justifyContent: "center", opacity: disabled ? 0.35 : 1, flexShrink: 0, ...style }}>
      <Icon name={name} size={size} color={color} />
    </button>
  );
}
