import { useState, useRef, useEffect } from "react";
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { auth, googleProvider, db } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { ref, onValue, set } from "firebase/database";

const PROJ_COLORS = ["#2563EB","#0891B2","#7C3AED","#059669","#D97706"];
const SK = "ideas_v22";

const PASTEL = ["#FFFFFF","#FEF9E7","#E8F8F5","#EAF2FB","#F4ECF7",
  "#FDF2E9","#FEF5E7","#EAFAF1","#F2F4F4","#FFF5E1"];

const DEF_PROJECTS = [
  { id:1, name:"פרויקט ראשי", notes:"", color:"#2563EB" },
  { id:2, name:"עיצוב UI",    notes:"", color:"#0891B2" },
];
const DEF_IDEAS = [
  { id:1, pid:1, text:"לפתח ממשק קולי לניהול רעיונות", color:"#FFFFFF", pinned:true,  checked:false, done:false, images:[], at:Date.now() },
  { id:2, pid:1, text:"לשלב AI לסיכום שבועי אוטומטי",  color:"#FFFFFF", pinned:false, checked:false, done:false, images:[], at:Date.now()-1000 },
  { id:3, pid:1, text:"לבנות פאנל אדמין למעקב נתונים", color:"#FFFFFF", pinned:false, checked:false, done:true,  images:[], at:Date.now()-2000 },
];

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const ICONS = {
  delete: (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  edit:   (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  pin:    (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" fill={c} stroke={c} strokeWidth="0.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>,
  more:   (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" fill={c}><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>,
  share:  (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
  copy:   (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  check:  (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  sun:    (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  moon:   (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  ai:     (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1" fill={c}/></svg>,
  eye:    (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  eyeoff: (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  bulb:   (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" fill={c}><path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z"/></svg>,
  search: (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  close:  (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  add:    (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  save:   (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  folder: (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
  up:     (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>,
  down:   (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  send:   (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  chart:  (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  chat:   (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  palette:(c,s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="8.5" cy="13.5" r="1.5" fill={c}/><circle cx="15.5" cy="13.5" r="1.5" fill={c}/><circle cx="12" cy="9" r="1.5" fill={c}/></svg>,
  photo:  (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  camera: (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  refresh:(c,s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  email:  (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  time:   (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  bell:   (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  belloff:(c,s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  brain:  (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.14"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.14"/></svg>,
};

function Icon({ name, size=20, color="#6B7280" }) {
  const fn = ICONS[name];
  if (!fn) return null;
  return <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center",
    flexShrink:0, lineHeight:0 }}>{fn(color, size)}</span>;
}

function IconBtn({ name, onClick, color="#6B7280", bg="transparent", size=20,
                   pad="5px", disabled=false, style={} }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ background:bg, border:"none", cursor:disabled?"default":"pointer",
        borderRadius:8, padding:pad, display:"flex", alignItems:"center",
        justifyContent:"center", opacity:disabled?0.3:1, flexShrink:0, ...style }}>
      <Icon name={name} size={size} color={color} />
    </button>
  );
}

// ── Themes ────────────────────────────────────────────────────────────────────
function getTheme(dark) {
  if (dark) return {
    bg:"#0F1623", surface:"#1A2232", surface2:"#222D40",
    border:"#2A3550", accent:"#3B82F6", accentSoft:"#1E3A5F", accentTint:"#172035",
    green:"#10B981", red:"#EF4444", greyBar:"#151F2E",
    text:"#F1F5F9", muted:"#94A3B8", inputBg:"#1A2232", cardBg:"#1A2232",
    pastels:["#1A2232","#2D2A1A","#162520","#1A2130","#261A30",
             "#2D2015","#2D2510","#162618","#22252A","#2A2510"],
  };
  return {
    bg:"#EEF4FB", surface:"#FFFFFF", surface2:"#F4F8FE",
    border:"#DDE8F5", accent:"#2563EB", accentSoft:"#DBEAFE", accentTint:"#EFF6FF",
    green:"#10B981", red:"#DC2626", greyBar:"#F1F5F9",
    text:"#1E293B", muted:"#64748B", inputBg:"#FFFFFF", cardBg:"#FFFFFF",
    pastels:["#FFFFFF","#FEF9E7","#E8F8F5","#EAF2FB","#F4ECF7",
             "#FDF2E9","#FEF5E7","#EAFAF1","#F2F4F4","#FFF5E1"],
  };
}

function load() {
  try { const r = localStorage.getItem(SK); if (r) return JSON.parse(r); } catch {}
  return { projects:DEF_PROJECTS, ideas:DEF_IDEAS, nid:10 };
}
function persist(s) { try { localStorage.setItem(SK, JSON.stringify(s)); } catch {} }
function loadPid(projects) {
  try {
    const saved = localStorage.getItem(SK+"_pid");
    if (saved) {
      const id = parseInt(saved);
      if (projects.find(p=>p.id===id)) return id;
    }
  } catch {}
  return projects[0]?.id||1;
}
function savePid(id) { try { localStorage.setItem(SK+"_pid", String(id)); } catch {} }

function fmt(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"}) + " " +
         d.toLocaleDateString("he-IL",{day:"2-digit",month:"2-digit",year:"2-digit"});
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, th }) {
  return (
    <div style={{ position:"fixed", top:14, left:"50%", transform:"translateX(-50%)",
      background:th.text, color:th.bg, borderRadius:12, padding:"9px 20px",
      fontSize:14, fontWeight:600, zIndex:9999, pointerEvents:"none" }}>
      {msg}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function Modal({ onClose, children, maxWidth=480, th }) {
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)",
      backdropFilter:"blur(6px)", zIndex:800,
      display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div onClick={e=>e.stopPropagation()}
        style={{ background:th.surface, borderRadius:20, width:"100%", maxWidth,
          maxHeight:"85vh", overflowY:"auto", padding:"22px 18px 24px",
          direction:"rtl", boxShadow:"0 16px 48px rgba(0,0,0,0.4)",
          border:`2px solid ${th.border}` }}>
        {children}
      </div>
    </div>
  );
}

// ── Confirm ───────────────────────────────────────────────────────────────────
function Confirm({ title, message, onConfirm, onCancel, th }) {
  return (
    <Modal onClose={onCancel} maxWidth={340} th={th}>
      <div style={{ textAlign:"center", marginBottom:6 }}>
        <Icon name="delete" size={44} color={th.red} />
      </div>
      <h3 style={{ margin:"0 0 6px", fontSize:18, fontWeight:800, color:th.text, textAlign:"center" }}>{title}</h3>
      {message && <p style={{ margin:"0 0 18px", fontSize:14, color:th.muted, textAlign:"center", lineHeight:1.6 }}>{message}</p>}
      <div style={{ display:"flex", gap:8 }}>
        <button onClick={onCancel} style={{ flex:1, background:th.surface2, color:th.text,
          border:`1px solid ${th.border}`, borderRadius:12, padding:"12px 0", cursor:"pointer",
          fontSize:15, fontWeight:700, fontFamily:"'Rubik',sans-serif" }}>ביטול</button>
        <button onClick={onConfirm} style={{ flex:1, background:th.red, color:"#fff",
          border:"none", borderRadius:12, padding:"12px 0", cursor:"pointer",
          fontSize:15, fontWeight:700, fontFamily:"'Rubik',sans-serif" }}>מחק</button>
      </div>
    </Modal>
  );
}

// ── Reminder utils ────────────────────────────────────────────────────────────
function scheduleReminder(idea, remindAt) {
  if (!("Notification" in window)) return;
  const delay = remindAt - Date.now();
  if (delay <= 0) return;
  Notification.requestPermission().then(perm => {
    if (perm !== "granted") return;
    setTimeout(() => {
      new Notification("💡 תזכורת", {
        body: idea.text,
        icon: "/favicon.ico",
      });
    }, delay);
  });
}

function fmtDatetimeLocal(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const pad = n => String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Idea Editor ───────────────────────────────────────────────────────────────
function IdeaEditor({ initial, onSave, onClose, title, th }) {
  const [text, setText]       = useState(initial?.text || "");
  const [images, setImages]   = useState(initial?.images || []);
  const [remindAt, setRemindAt] = useState(initial?.remindAt || null);
  const [showRemind, setShowRemind] = useState(false);
  const fileRef = useRef();

  const addImg = file => {
    if (!file) return;
    const r = new FileReader();
    r.onload = e => setImages(p=>[...p, e.target.result]);
    r.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!text.trim() && !images.length) return;
    const idea = { text: text.trim(), images, remindAt };
    if (remindAt && remindAt > Date.now()) scheduleReminder(idea, remindAt);
    onSave(idea);
  };

  return (
    <Modal onClose={onClose} th={th}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <h3 style={{ margin:0, fontSize:18, fontWeight:800, color:th.text }}>{title}</h3>
        <IconBtn name="close" onClick={onClose} color={th.accent} bg={th.accentSoft} size={18} pad="7px" />
      </div>
      <textarea value={text} onChange={e=>setText(e.target.value)}
        placeholder="כתוב את הרעיון שלך..." rows={5} autoFocus
        style={{ width:"100%", border:`2px solid ${th.border}`, borderRadius:13,
          padding:"13px 15px", fontSize:16, fontFamily:"'Rubik',sans-serif",
          direction:"rtl", resize:"vertical", background:th.inputBg,
          lineHeight:1.65, color:th.text, outline:"none" }} />

      {/* Reminder section */}
      <div style={{ marginTop:12, borderRadius:11, border:`1.5px solid ${th.border}`,
        overflow:"hidden" }}>
        <button onClick={()=>setShowRemind(p=>!p)}
          style={{ width:"100%", background:remindAt?th.accentSoft:th.surface2,
            border:"none", cursor:"pointer", padding:"10px 14px",
            display:"flex", alignItems:"center", gap:8, direction:"rtl" }}>
          <Icon name={remindAt?"bell":"belloff"} size={17}
            color={remindAt?th.accent:th.muted} />
          <span style={{ flex:1, fontSize:13, fontWeight:600, textAlign:"right",
            color:remindAt?th.accent:th.muted, fontFamily:"'Rubik',sans-serif" }}>
            {remindAt
              ? `תזכורת: ${new Date(remindAt).toLocaleString("he-IL",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}`
              : "הגדר תזכורת"}
          </span>
          {remindAt && (
            <span onClick={e=>{ e.stopPropagation(); setRemindAt(null); setShowRemind(false); }}
              style={{ fontSize:11, color:th.accent, background:th.accentSoft,
                borderRadius:20, padding:"2px 8px", fontWeight:700,
                fontFamily:"'Rubik',sans-serif" }}>
              הסר
            </span>
          )}
        </button>
        {showRemind && (
          <div style={{ padding:"10px 14px", background:th.surface2,
            borderTop:`1px solid ${th.border}` }}>
            <input type="datetime-local"
              value={fmtDatetimeLocal(remindAt)}
              min={fmtDatetimeLocal(Date.now())}
              onChange={e=>{ setRemindAt(e.target.value ? new Date(e.target.value).getTime() : null); }}
              style={{ width:"100%", border:`1.5px solid ${th.border}`, borderRadius:9,
                padding:"9px 12px", fontSize:14, background:th.inputBg,
                color:th.text, fontFamily:"'Rubik',sans-serif", outline:"none" }} />
          </div>
        )}
      </div>

      {images.length > 0 && (
        <div style={{ display:"flex", gap:7, marginTop:10, flexWrap:"wrap" }}>
          {images.map((src,i)=>(
            <div key={i} style={{ position:"relative" }}>
              <img src={src} alt="" style={{ width:64, height:64, objectFit:"cover", borderRadius:10 }} />
              <button onClick={()=>setImages(p=>p.filter((_,j)=>j!==i))}
                style={{ position:"absolute", top:-5, left:-5, width:20, height:20,
                  background:th.red, border:"none", borderRadius:"50%",
                  cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Icon name="close" size={12} color="#fff" />
              </button>
            </div>
          ))}
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}}
        onChange={e=>{ addImg(e.target.files[0]); e.target.value=""; }} />
      <div style={{ display:"flex", gap:7, marginTop:12 }}>
        <button onClick={()=>{ fileRef.current.removeAttribute("capture"); fileRef.current.click(); }}
          style={{ flex:1, background:th.accentSoft, color:th.accent, border:"none", borderRadius:11,
            padding:"11px 0", cursor:"pointer", fontSize:14, fontWeight:700,
            fontFamily:"'Rubik',sans-serif", display:"flex", alignItems:"center",
            justifyContent:"center", gap:7 }}>
          <Icon name="photo" size={17} color={th.accent} /> גלריה
        </button>
        <button onClick={()=>{ fileRef.current.setAttribute("capture","environment"); fileRef.current.click(); }}
          style={{ flex:1, background:th.accentSoft, color:th.accent, border:"none", borderRadius:11,
            padding:"11px 0", cursor:"pointer", fontSize:14, fontWeight:700,
            fontFamily:"'Rubik',sans-serif", display:"flex", alignItems:"center",
            justifyContent:"center", gap:7 }}>
          <Icon name="camera" size={17} color={th.accent} /> צלם
        </button>
      </div>
      <button onClick={handleSave}
        style={{ width:"100%", marginTop:12, background:th.accent, color:"#fff",
          border:"none", borderRadius:13, padding:"13px 0", cursor:"pointer",
          fontSize:16, fontWeight:800, fontFamily:"'Rubik',sans-serif",
          display:"flex", alignItems:"center", justifyContent:"center", gap:8,
          boxShadow:`0 4px 14px ${th.accent}55` }}>
        <Icon name="save" size={19} color="#fff" /> שמור רעיון
      </button>
    </Modal>
  );
}

function IdeaCard({ idea, onUpdate, onDelete, onShare, onEdit, onMoveUp, onMoveDown, isFirst, isLast, th, dark, sortMode, dragHandleProps }) {
  const [showMore, setShowMore] = useState(false);
  const [copied, setCopied]     = useState(false);
  const [bigImg, setBigImg]     = useState(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const u = patch => onUpdate({ ...idea, ...patch });

  const onCheck = () => {
    if (sortMode) return;
    if (idea.done) { u({ done:false, checked:false }); return; }
    u({ checked:true });
    setTimeout(() => onUpdate({ ...idea, checked:false, done:true }), 450);
  };

  const onCopy = () => {
    const txt = idea.text;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).catch(() => fallbackCopy(txt));
    } else {
      fallbackCopy(txt);
    }
    setCopied(true); setTimeout(()=>setCopied(false), 1400);
  };

  const fallbackCopy = (txt) => {
    const el = document.createElement("textarea");
    el.value = txt;
    el.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0;";
    document.body.appendChild(el);
    el.focus(); el.select();
    try { document.execCommand("copy"); } catch {}
    document.body.removeChild(el);
  };

  const stroked = idea.checked || idea.done;
  const isLong  = idea.text?.length > 120;
  const cardBg  = dark ? th.cardBg : (idea.color || "#fff");

  return (
    <>
      {confirmDel && (
        <div style={{ position:"fixed", inset:0, zIndex:1000 }}>
          <Confirm title="מחיקת רעיון"
            message={`"${idea.text.slice(0,50)}${idea.text.length>50?"...":""}"`}
            onConfirm={()=>{ setConfirmDel(false); onDelete(idea.id); }}
            onCancel={()=>setConfirmDel(false)} th={th} />
        </div>
      )}
      {bigImg && (
        <div onClick={()=>setBigImg(null)} style={{ position:"fixed", inset:0,
          background:"rgba(0,0,0,0.88)", zIndex:1000,
          display:"flex", alignItems:"center", justifyContent:"center" }}>
          <img src={bigImg} alt="" style={{ maxWidth:"92vw", maxHeight:"85vh", borderRadius:14 }} />
        </div>
      )}

      <div style={{ background:cardBg, borderRadius:16, marginBottom:12,
        border:`1.5px solid ${th.border}`,
        boxShadow:`0 1px 4px rgba(0,0,0,0.06)`,
        opacity:idea.done?0.62:1, direction:"rtl", position:"relative" }}>

        {/* Main row */}
        <div style={{ display:"flex", alignItems:"flex-start", padding:"12px 12px 8px" }}>

          {/* Checkbox (right side) OR drag handle */}
          {sortMode ? (
            <div {...dragHandleProps}
              style={{ flexShrink:0, width:28, height:28, display:"flex",
                alignItems:"center", justifyContent:"center",
                cursor:"grab", color:th.muted, fontSize:18, marginLeft:10, marginTop:1,
                touchAction:"none" }}>
              ⠿
            </div>
          ) : (
            <div onClick={onCheck} style={{
              flexShrink:0, width:22, height:22, borderRadius:6, marginLeft:10, marginTop:3,
              border: stroked?"none":`1.5px solid ${th.muted}`,
              background: idea.done?th.green:idea.checked?"#A78BFA":"transparent",
              display:"flex", alignItems:"center", justifyContent:"center",
              cursor:"pointer", transition:"all .15s" }}>
              {stroked && <Icon name="check" size={14} color="#fff" />}
            </div>
          )}

          {/* Text */}
          <div onClick={()=>isLong && setExpanded(p=>!p)}
            style={{ flex:1, fontSize:15, lineHeight:1.45, color:th.text,
              textDecoration:stroked?"line-through":"none",
              cursor:isLong?"pointer":"default",
              fontFamily:"'Rubik',sans-serif", fontWeight:400,
              whiteSpace:"pre-wrap", wordBreak:"break-word",
              direction:"rtl", textAlign:"right",
              overflow:"hidden", display:"-webkit-box",
              WebkitLineClamp:expanded?"unset":3, WebkitBoxOrient:"vertical" }}>
            {idea.pinned && (
              <span style={{ display:"inline-flex", verticalAlign:"middle", marginLeft:4 }}>
                <Icon name="pin" size={13} color={th.accent} />
              </span>
            )}
            {idea.remindAt && idea.remindAt > Date.now() && (
              <span style={{ display:"inline-flex", verticalAlign:"middle", marginLeft:4 }}>
                <Icon name="bell" size={13} color={th.accent} />
              </span>
            )}
            {idea.text}
          </div>
        </div>

        {/* Show more/less */}
        {isLong && !sortMode && (
          <div onClick={()=>setExpanded(p=>!p)}
            style={{ padding:"0 12px 6px", textAlign:"center", cursor:"pointer" }}>
            <span style={{ fontSize:11, color:th.accent, fontWeight:700,
              background:th.accentSoft, padding:"3px 12px", borderRadius:20,
              display:"inline-flex", alignItems:"center", gap:4 }}>
              <Icon name={expanded?"up":"down"} size={12} color={th.accent} />
              {expanded ? "הצג פחות" : "הצג עוד"}
            </span>
          </div>
        )}

        {/* Images */}
        {idea.images?.length > 0 && (
          <div style={{ display:"flex", gap:6, padding:"0 12px 8px", flexWrap:"wrap" }}>
            {idea.images.map((src,i) => (
              <img key={i} src={src} alt="" onClick={()=>setBigImg(src)}
                style={{ width:64, height:64, objectFit:"cover", borderRadius:10, cursor:"pointer" }} />
            ))}
          </div>
        )}

        {/* Toolbar — hidden in sort mode */}
        {!sortMode && (
          <div style={{ background:th.greyBar, borderTop:`1px solid ${th.border}`,
            borderRadius:"0 0 14px 14px", padding:"4px 10px",
            display:"flex", alignItems:"center", justifyContent:"space-between",
            overflow:"hidden", position:"relative", minHeight:40 }}>

            {/* Page 1: primary actions — copy replaces delete */}
            <div style={{ display:"flex", alignItems:"center", gap:4, width:"100%",
              transform: showMore ? "translateX(110%)" : "translateX(0)",
              transition:"transform 0.25s cubic-bezier(0.4,0,0.2,1)",
              position: showMore ? "absolute" : "relative" }}>
              <IconBtn name={copied?"check":"copy"} onClick={onCopy}
                color={copied?th.green:th.muted} size={21} pad="6px 9px" />
              <IconBtn name="edit" onClick={onEdit} color={th.muted} size={21} pad="6px 9px" />
              <IconBtn name="pin"
                onClick={()=>u({pinned:!idea.pinned})}
                color={idea.pinned?th.accent:th.muted}
                bg={idea.pinned?th.accentSoft:"transparent"}
                size={21} pad="6px 9px" />
              <div style={{ width:1, height:16, background:th.border, margin:"0 4px" }} />
              <IconBtn name="more" onClick={()=>setShowMore(true)}
                color={th.muted} size={21} pad="6px 9px" style={{ opacity:0.6 }} />
            </div>

            {/* Page 2: secondary — delete replaces copy */}
            <div style={{ display:"flex", alignItems:"center", gap:4, width:"100%",
              transform: showMore ? "translateX(0)" : "translateX(-110%)",
              transition:"transform 0.25s cubic-bezier(0.4,0,0.2,1)",
              position: showMore ? "relative" : "absolute" }}>
              <IconBtn name="up" onClick={()=>setShowMore(false)}
                color={th.accent} size={19} pad="6px 9px"
                style={{ transform:"rotate(-90deg)" }} />
              <div style={{ width:1, height:16, background:th.border, margin:"0 4px" }} />
              <IconBtn name="delete" onClick={()=>{ setShowMore(false); setConfirmDel(true); }}
                color={th.red} size={21} pad="6px 9px" />
              <IconBtn name="share" onClick={()=>onShare(idea)}
                color={th.muted} size={21} pad="6px 9px" />
              <div style={{ display:"flex", gap:5, marginRight:4, alignItems:"center" }}>
                {(dark?th.pastels:PASTEL).slice(0,6).map((c,i)=>(
                  <div key={i} onClick={()=>u({color:c})}
                    style={{ width:18, height:18, borderRadius:"50%", background:c,
                      border:idea.color===c?`2px solid ${th.accent}`:`1.5px solid ${th.border}`,
                      cursor:"pointer", flexShrink:0 }} />
                ))}
              </div>
            </div>

            <span style={{ fontSize:9, color:th.muted, fontWeight:600, whiteSpace:"nowrap",
              display:"flex", alignItems:"center", gap:3, flexShrink:0,
              opacity: showMore ? 0 : 1, transition:"opacity 0.2s" }}>
              <Icon name="time" size={10} color={th.muted} />
              {fmt(idea.at)}
            </span>
          </div>
        )}
      </div>
    </>
  );
}

// ── Sortable wrapper ──────────────────────────────────────────────────────────
function SortableIdeaCard({ idea, sortMode, ...props }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: idea.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative",
    zIndex: isDragging ? 10 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <IdeaCard idea={idea} sortMode={sortMode}
        dragHandleProps={sortMode ? { ...attributes, ...listeners } : {}}
        {...props} />
    </div>
  );
}

// ── Share Modal ───────────────────────────────────────────────────────────────
function ShareModal({ idea, onClose, th }) {
  const go = m => {
    const t = encodeURIComponent(`💡 ${idea.text}`);
    if (m==="wa")   window.open(`https://wa.me/?text=${t}`,"_blank");
    if (m==="mail") window.open(`mailto:?subject=רעיון&body=${t}`,"_blank");
    if (m==="copy") navigator.clipboard?.writeText(idea.text);
    onClose();
  };
  return (
    <Modal onClose={onClose} th={th}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <h3 style={{ margin:0, fontSize:17, fontWeight:800, color:th.text,
          display:"flex", alignItems:"center", gap:8 }}>
          <Icon name="share" size={20} color={th.accent} /> שתף רעיון
        </h3>
        <IconBtn name="close" onClick={onClose} color={th.accent} bg={th.accentSoft} size={18} pad="7px" />
      </div>
      <div style={{ background:th.accentTint, borderRadius:12, padding:"11px 13px", marginBottom:14,
        border:`1px solid ${th.border}` }}>
        <p style={{ margin:0, fontSize:14, color:th.text, lineHeight:1.6 }}>{idea.text}</p>
      </div>
      {[{m:"wa",  icon:"chat",  label:"WhatsApp", bg:"#25D366", col:"#fff"},
        {m:"mail",icon:"email", label:"אימייל",   bg:th.accentSoft, col:th.accent},
        {m:"copy",icon:"copy",  label:"העתק",     bg:th.accentTint, col:th.accent}].map(s=>(
        <button key={s.m} onClick={()=>go(s.m)}
          style={{ display:"flex", alignItems:"center", gap:10, width:"100%",
            background:s.bg, color:s.col, border:"none", borderRadius:12,
            padding:"12px 14px", marginBottom:7, cursor:"pointer",
            fontFamily:"'Rubik',sans-serif", fontSize:14, fontWeight:700 }}>
          <Icon name={s.icon} size={19} color={s.col} />{s.label}
        </button>
      ))}
    </Modal>
  );
}

// ── Spin ──────────────────────────────────────────────────────────────────────
function Spin({ th }) {
  return (
    <div style={{ textAlign:"center", padding:"22px 0" }}>
      <div style={{ width:36, height:36, border:`3px solid ${th.border}`,
        borderTop:`3px solid ${th.accent}`, borderRadius:"50%",
        margin:"0 auto 8px", animation:"sp .7s linear infinite" }} />
      <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── AI Panel ──────────────────────────────────────────────────────────────────
function AIPanel({ ideas, onClose, th }) {
  const [tab, setTab]   = useState("analyze");
  const [loading, setL] = useState(false);
  const [result, setR]  = useState(null);
  const [q, setQ]       = useState("");
  const [ans, setAns]   = useState("");

  const analyze = async () => {
    setL(true); setR(null);
    const txt = ideas.filter(i=>!i.done).map(i=>i.text).join("\n");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:900,
          system:"ענה בעברית. החזר JSON בלבד: {summary,insights:[],recommendations:[]}",
          messages:[{role:"user",content:`נתח:\n${txt}`}] })});
      const d = await res.json();
      setR(JSON.parse(d.content.map(b=>b.text||"").join("").replace(/```json|```/g,"").trim()));
    } catch { setR({summary:"שגיאה.",insights:[],recommendations:[]}); }
    setL(false);
  };

  const ask = async () => {
    if (!q.trim()) return; setL(true); setAns("");
    const ctx = ideas.filter(i=>!i.done).map(i=>i.text).join("\n");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:400,
          system:"ענה בעברית, קצר.",
          messages:[{role:"user",content:`רעיונות:\n${ctx}\n\nשאלה: ${q}`}] })});
      const d = await res.json();
      setAns(d.content.map(b=>b.text||"").join(""));
    } catch { setAns("שגיאה."); }
    setL(false);
  };

  return (
    <Modal onClose={onClose} th={th}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <h3 style={{ margin:0, fontSize:17, fontWeight:800, color:th.text,
          display:"flex", alignItems:"center", gap:8 }}>
          <Icon name="ai" size={22} color={th.accent} /> עוזר AI
        </h3>
        <IconBtn name="close" onClick={onClose} color={th.accent} bg={th.accentSoft} size={18} pad="7px" />
      </div>
      <div style={{ display:"flex", gap:4, background:th.surface2, borderRadius:11, padding:3, marginBottom:14 }}>
        {[{id:"analyze",icon:"chart",l:"ניתוח"},{id:"ask",icon:"chat",l:"שאל"}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{ flex:1, padding:"8px 0", border:"none", borderRadius:9, cursor:"pointer",
              fontFamily:"'Rubik',sans-serif", fontWeight:700, fontSize:13,
              background:tab===t.id?th.surface:"transparent", color:tab===t.id?th.accent:th.muted,
              display:"flex", alignItems:"center", justifyContent:"center", gap:6,
              boxShadow:tab===t.id?"0 1px 5px rgba(0,0,0,0.12)":"none" }}>
            <Icon name={t.icon} size={15} color={tab===t.id?th.accent:th.muted} />{t.l}
          </button>
        ))}
      </div>

      {tab==="analyze" && <>
        {!result&&!loading&&(
          <div style={{ textAlign:"center", padding:"20px 0" }}>
            <Icon name="brain" size={52} color={th.accent} />
            <p style={{ color:th.muted, fontSize:14, margin:"12px 0 16px" }}>
              {ideas.filter(i=>!i.done).length} רעיונות פעילים
            </p>
            <button onClick={analyze}
              style={{ background:th.accent, color:"#fff", border:"none",
                borderRadius:12, padding:"11px 28px", fontSize:15, fontWeight:700,
                cursor:"pointer", fontFamily:"'Rubik',sans-serif",
                display:"inline-flex", alignItems:"center", gap:8 }}>
              נתח
            </button>
          </div>
        )}
        {loading && <Spin th={th} />}
        {result && <>
          <div style={{ background:th.accentTint, borderRadius:11, padding:12, marginBottom:10,
            border:`1px solid ${th.border}` }}>
            <p style={{ margin:0, color:th.text, fontSize:13, lineHeight:1.7 }}>{result.summary}</p>
          </div>
          {result.insights?.map((x,i)=>(
            <p key={i} style={{ margin:"0 0 5px", fontSize:12, color:th.text, lineHeight:1.6,
              paddingRight:10, borderRight:`2px solid ${th.accent}` }}>{x}</p>
          ))}
          {result.recommendations?.map((x,i)=>(
            <div key={i} style={{ background:th.accentSoft, borderRadius:9, padding:"7px 11px",
              marginTop:5, fontSize:12, color:th.text }}>{i+1}. {x}</div>
          ))}
          <button onClick={analyze}
            style={{ marginTop:12, width:"100%", background:"transparent",
              color:th.accent, border:`2px solid ${th.accent}`, borderRadius:10, padding:"8px 0",
              cursor:"pointer", fontSize:12, fontWeight:700, fontFamily:"'Rubik',sans-serif",
              display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
            <Icon name="refresh" size={14} color={th.accent} /> מחדש
          </button>
        </>}
      </>}

      {tab==="ask" && <>
        <div style={{ display:"flex", gap:6, marginBottom:12 }}>
          <input value={q} onChange={e=>setQ(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&ask()}
            placeholder="שאל כל דבר..."
            style={{ flex:1, border:`2px solid ${th.border}`, borderRadius:11,
              padding:"10px 12px", fontSize:14, background:th.inputBg,
              fontFamily:"'Rubik',sans-serif", direction:"rtl", outline:"none", color:th.text }} />
          <button onClick={ask} disabled={loading}
            style={{ background:th.accent, color:"#fff", border:"none", borderRadius:11,
              padding:"0 14px", cursor:"pointer", opacity:loading?0.6:1,
              display:"flex", alignItems:"center" }}>
            <Icon name="send" size={18} color="#fff" />
          </button>
        </div>
        {loading && <Spin th={th} />}
        {ans && <div style={{ background:th.accentTint, borderRadius:11, padding:12,
          border:`1px solid ${th.border}` }}>
          <p style={{ margin:0, color:th.text, fontSize:13, lineHeight:1.7 }}>{ans}</p>
        </div>}
        {!ans&&!loading&&["מה הרעיון הדחוף ביותר?","סכם את הפרויקט","מה כדאי לבצע ראשון?"].map(s=>(
          <button key={s} onClick={()=>setQ(s)}
            style={{ display:"flex", alignItems:"center", gap:8, width:"100%",
              background:th.accentTint, border:`1px solid ${th.border}`, borderRadius:9,
              padding:"9px 12px", marginBottom:5, cursor:"pointer", fontSize:13,
              color:th.text, fontFamily:"'Rubik',sans-serif" }}>
            <Icon name="chat" size={14} color={th.muted} />{s}
          </button>
        ))}
      </>}
    </Modal>
  );
}

// ── Project Modal ─────────────────────────────────────────────────────────────
function ProjModal({ projects, ideas, activePid, onClose, onAdd, onDel, onEdit, onSelect, th }) {
  const [name, setName]     = useState("");
  const [editId, setEditId] = useState(null);
  const [editN, setEditN]   = useState("");
  const [confirmId, setConfirmId] = useState(null);

  return (
    <Modal onClose={onClose} th={th}>
      {confirmId && <Confirm title="מחיקת פרויקט" message="כל הרעיונות יימחקו."
        onConfirm={()=>{ onDel(confirmId); setConfirmId(null); }}
        onCancel={()=>setConfirmId(null)} th={th} />}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <h3 style={{ margin:0, fontSize:17, fontWeight:800, color:th.text,
          display:"flex", alignItems:"center", gap:8 }}>
          <Icon name="folder" size={20} color={th.accent} /> פרויקטים
        </h3>
        <IconBtn name="close" onClick={onClose} color={th.accent} bg={th.accentSoft} size={18} pad="7px" />
      </div>

      {projects.map(p=>{
        const cnt = ideas.filter(i=>i.pid===p.id&&!i.done).length;
        return (
          <div key={p.id} onClick={()=>onSelect(p.id)}
            style={{ display:"flex", alignItems:"center", gap:9, marginBottom:8,
              background:p.id===activePid?th.accentSoft:th.accentTint, borderRadius:12,
              padding:"11px 13px", cursor:"pointer",
              border:`2px solid ${p.id===activePid?th.accent:"transparent"}` }}>
            <div style={{ width:12, height:12, borderRadius:"50%", background:p.color, flexShrink:0 }} />
            {editId===p.id
              ? <input value={editN} onChange={e=>setEditN(e.target.value)} autoFocus
                  onClick={e=>e.stopPropagation()}
                  onBlur={()=>{ if(editN.trim()) onEdit(p.id,editN); setEditId(null); }}
                  style={{ flex:1, border:"none", background:"transparent", fontSize:14,
                    fontFamily:"'Rubik',sans-serif", outline:"none", color:th.text }} />
              : <span style={{ flex:1, fontSize:14, color:th.text,
                  fontWeight:p.id===activePid?700:500 }}>{p.name}</span>}
            <span style={{ fontSize:11, color:th.accent, background:th.surface,
              padding:"2px 9px", borderRadius:20, fontWeight:700 }}>{cnt}</span>
            <IconBtn name="edit" size={16} color={th.muted} pad="4px"
              onClick={e=>{ e.stopPropagation(); e.preventDefault(); setEditId(p.id); setEditN(p.name); }} />
            {projects.length>1 &&
              <IconBtn name="delete" size={16} color={th.muted} pad="4px"
                onClick={e=>{ e.stopPropagation(); e.preventDefault(); setConfirmId(p.id); }} />}
          </div>
        );
      })}

      <div style={{ display:"flex", gap:7, marginTop:12 }}>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="פרויקט חדש..."
          onKeyDown={e=>{ if(e.key==="Enter"&&name.trim()){ onAdd(name); setName(""); }}}
          style={{ flex:1, border:`2px solid ${th.border}`, borderRadius:11, padding:"10px 13px",
            fontSize:14, fontFamily:"'Rubik',sans-serif", direction:"rtl", outline:"none",
            background:th.inputBg, color:th.text }} />
        <button onClick={()=>{ if(name.trim()){ onAdd(name); setName(""); }}}
          style={{ background:th.accent, color:"#fff", border:"none", borderRadius:11,
            padding:"0 16px", cursor:"pointer", display:"flex", alignItems:"center" }}>
          <Icon name="add" size={22} color="#fff" />
        </button>
      </div>
    </Modal>
  );
}

// ── Notes Modal ───────────────────────────────────────────────────────────────
function NotesModal({ project, onSave, onClose, th }) {
  const [txt, setTxt] = useState(project.notes||"");
  return (
    <Modal onClose={onClose} th={th}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <h3 style={{ margin:0, fontSize:16, fontWeight:800, color:th.text }}>{project.name}</h3>
        <IconBtn name="close" onClick={onClose} color={th.accent} bg={th.accentSoft} size={18} pad="7px" />
      </div>
      <textarea value={txt} onChange={e=>setTxt(e.target.value)} placeholder="הוסף הערות..."
        rows={7} style={{ width:"100%", border:`2px solid ${th.border}`, borderRadius:13, padding:13,
          fontSize:14, fontFamily:"'Rubik',sans-serif", direction:"rtl", resize:"none",
          outline:"none", lineHeight:1.7, background:th.inputBg, color:th.text }} />
      <button onClick={()=>{ onSave(txt); onClose(); }}
        style={{ marginTop:11, width:"100%", background:th.accent, color:"#fff", border:"none",
          borderRadius:12, padding:"12px 0", cursor:"pointer", fontSize:14, fontWeight:700,
          fontFamily:"'Rubik',sans-serif", display:"flex", alignItems:"center",
          justifyContent:"center", gap:8 }}>
        <Icon name="save" size={17} color="#fff" /> שמור
      </button>
    </Modal>
  );
}

// ── Login Screen ──────────────────────────────────────────────────────────────
function LoginScreen({ th }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const login = async () => {
    setLoading(true); setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch(e) {
      setError("שגיאה בהתחברות. נסה שוב.");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh", background:th.bg, display:"flex",
      alignItems:"center", justifyContent:"center", padding:24,
      fontFamily:"'Rubik',sans-serif", direction:"rtl" }}>
      <div style={{ background:th.surface, borderRadius:24, padding:40,
        maxWidth:360, width:"100%", textAlign:"center",
        border:`1.5px solid ${th.border}`,
        boxShadow:"0 8px 32px rgba(0,0,0,0.08)" }}>
        <div style={{ fontSize:52, marginBottom:16 }}>💡</div>
        <h1 style={{ margin:"0 0 8px", fontSize:28, fontWeight:900, color:th.text }}>
          IdeaFlow
        </h1>
        <p style={{ margin:"0 0 32px", fontSize:15, color:th.muted, lineHeight:1.6 }}>
          שמור וארגן את הרעיונות שלך
        </p>
        <button onClick={login} disabled={loading}
          style={{ width:"100%", padding:"14px 0", borderRadius:12,
            background: loading ? th.surface2 : "#fff",
            border:`1.5px solid ${th.border}`,
            cursor: loading ? "default" : "pointer",
            fontSize:15, fontWeight:700, color:th.text,
            display:"flex", alignItems:"center", justifyContent:"center", gap:12,
            fontFamily:"'Rubik',sans-serif",
            boxShadow:"0 2px 8px rgba(0,0,0,0.08)" }}>
          {loading ? (
            <span style={{ color:th.muted }}>מתחבר...</span>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              התחבר עם Google
            </>
          )}
        </button>
        {error && (
          <p style={{ margin:"16px 0 0", fontSize:13, color:th.red }}>{error}</p>
        )}
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser]         = useState(undefined); // undefined=loading
  const [dark, setDark]         = useState(false);
  const th = getTheme(dark);

  // Auth state listener
  useEffect(()=>{
    const unsub = onAuthStateChanged(auth, u => setUser(u || null));
    return () => unsub();
  }, []);

  if (user === undefined) return (
    <div style={{ minHeight:"100vh", background:th.bg, display:"flex",
      alignItems:"center", justifyContent:"center" }}>
      <div style={{ fontSize:48 }}>💡</div>
    </div>
  );

  if (!user) return <LoginScreen th={th} />;

  return <AppContent user={user} dark={dark} setDark={setDark} th={th} />;
}

function AppContent({ user, dark, setDark, th }) {
  const uid = user.uid;
  const dbPath = `users/${uid}`;

  const [projects, setProjects] = useState(null);
  const [ideas, setIdeas]       = useState(null);
  const [nid, setNid]           = useState(null);
  const [pid, setPid]           = useState(null);
  const [loaded, setLoaded]     = useState(false);

  // Load data from Firebase
  useEffect(()=>{
    const unsub = onValue(ref(db, dbPath), snap => {
      const data = snap.val();
      if (data) {
        setProjects(data.projects || DEF_PROJECTS);
        setIdeas(data.ideas || DEF_IDEAS);
        setNid(data.nid || 10);
        const savedPid = data.lastPid;
        const validPid = (data.projects||DEF_PROJECTS).find(p=>p.id===savedPid);
        setPid(validPid ? savedPid : (data.projects||DEF_PROJECTS)[0]?.id || 1);
      } else {
        // First time user
        const initData = { projects:DEF_PROJECTS, ideas:DEF_IDEAS, nid:10, lastPid:1 };
        set(ref(db, dbPath), initData);
        setProjects(DEF_PROJECTS);
        setIdeas(DEF_IDEAS);
        setNid(10);
        setPid(1);
      }
      setLoaded(true);
    });
    return () => unsub();
  }, [uid]);

  // Save to Firebase (debounced)
  const saveTimer = useRef(null);
  const saveToFirebase = (data) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      set(ref(db, dbPath), data).catch(()=>{});
    }, 800);
  };

  const persistAll = (p, i, n, lastPid) => {
    saveToFirebase({ projects:p, ideas:i, nid:n, lastPid });
  };

  const setPidAndSave = (id) => {
    setPid(id);
    persistAll(projects, ideas, nid, id);
  };
  const [showLogout, setShowLogout] = useState(false);
  const [search, setSearch]       = useState("");
  const [archive, setArchive]     = useState(false);
  const [showAI, setShowAI]     = useState(false);
  const [showProj, setShowProj] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [shareIdea, setShare]   = useState(null);
  const [newOpen, setNewOpen]   = useState(false);
  const [editIdea, setEditIdea] = useState(null);
  const [toast, setToast]       = useState(null);
  const [fabVisible, setFabVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y > lastScrollY.current + 8) setFabVisible(false);
      else if (y < lastScrollY.current - 8) setFabVisible(true);
      lastScrollY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive:true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const [focusedId, setFocusedId] = useState(null);
  const [sortMode, setSortMode]   = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ideas.findIndex(i => i.id === active.id);
    const newIndex = ideas.findIndex(i => i.id === over.id);
    const next = arrayMove(ideas, oldIndex, newIndex);
    setIdeas(next);
    persistAll(projects, next, nid, pid);
  };

  const nidRef = useRef(nid);
  nidRef.current = nid;

  const toast$ = msg => { setToast(msg); setTimeout(()=>setToast(null),1800); };

  if (!loaded || !projects || !ideas) return (
    <div style={{ minHeight:"100vh", background:th.bg, display:"flex",
      alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16,
      fontFamily:"'Rubik',sans-serif" }}>
      <div style={{ fontSize:48 }}>💡</div>
      <div style={{ color:th.muted, fontSize:15 }}>טוען נתונים...</div>
    </div>
  );

  const cur = projects.find(p=>p.id===pid);

  const filtered = ideas
    .filter(i=>i.pid===pid)
    .filter(i=>archive||!i.done)
    .filter(i=>i.text.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0));

  const active = ideas.filter(i=>i.pid===pid&&!i.done).length;
  const done   = ideas.filter(i=>i.pid===pid&&i.done).length;

  const saveNew = ({text,images,remindAt}) => {
    const id = nidRef.current;
    const newIdea = {id,pid,text,color:"#FFFFFF",pinned:false,checked:false,done:false,images,remindAt:remindAt||null,at:Date.now()};
    const newIdeas = [newIdea, ...ideas];
    const newNid = nid + 1;
    setIdeas(newIdeas); setNid(newNid); setNewOpen(false);
    persistAll(projects, newIdeas, newNid, pid);
    toast$("רעיון נוסף");
  };
  const saveEdit = ({text,images,remindAt}) => {
    const newIdeas = ideas.map(i=>i.id===editIdea.id?{...i,text,images,remindAt:remindAt||null}:i);
    setIdeas(newIdeas); setEditIdea(null);
    persistAll(projects, newIdeas, nid, pid);
    toast$("נשמר");
  };
  const updIdea = u => {
    const newIdeas = ideas.map(i=>i.id===u.id?u:i);
    setIdeas(newIdeas);
    persistAll(projects, newIdeas, nid, pid);
  };
  const delIdea = id => {
    const newIdeas = ideas.filter(i=>i.id!==id);
    setIdeas(newIdeas);
    persistAll(projects, newIdeas, nid, pid);
    toast$("נמחק");
  };
  const addProj = name => {
    const id = nidRef.current, color = PROJ_COLORS[projects.length%PROJ_COLORS.length];
    const newProjects = [...projects, {id,name,notes:"",color}];
    const newNid = nid + 1;
    setProjects(newProjects); setNid(newNid); setPid(id);
    persistAll(newProjects, ideas, newNid, id);
  };
  const delProj = id => {
    const newProjects = projects.filter(x=>x.id!==id);
    const newIdeas = ideas.filter(i=>i.pid!==id);
    const newPid = pid===id ? newProjects[0]?.id : pid;
    setProjects(newProjects); setIdeas(newIdeas); setPid(newPid);
    persistAll(newProjects, newIdeas, nid, newPid);
  };
  const editProj = (id,name) => {
    const newProjects = projects.map(x=>x.id===id?{...x,name}:x);
    setProjects(newProjects);
    persistAll(newProjects, ideas, nid, pid);
  };
  const saveNotes = notes => {
    const newProjects = projects.map(x=>x.id===pid?{...x,notes}:x);
    setProjects(newProjects);
    persistAll(newProjects, ideas, nid, pid);
  };
  const moveIdea = (id,dir) => {
    const a=[...ideas], idx=a.findIndex(i=>i.id===id), ti=idx+dir;
    if(ti<0||ti>=a.length) return;
    [a[idx],a[ti]]=[a[ti],a[idx]];
    setIdeas(a);
    persistAll(projects, a, nid, pid);
  };

  return (
    <div style={{ minHeight:"100vh", background:th.bg,
      fontFamily:"'Rubik',sans-serif", direction:"rtl", transition:"background 0.3s" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;}
        input:focus,textarea:focus{outline:none;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-thumb{background:${th.border};border-radius:4px;}
      `}</style>

      <div style={{ padding:"8px 10px 0" }}>
        <div style={{ maxWidth:520, margin:"0 auto" }}>
          <div style={{ background:th.surface, borderRadius:16,
            border:`1.5px solid ${th.border}`,
            boxShadow:`0 3px 12px rgba(0,0,0,0.1)`,
            padding:"12px 13px", marginBottom:8 }}>

            {/* Header */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
              <h1 style={{ margin:0, fontSize:19, fontWeight:900, color:th.text,
                display:"flex", alignItems:"center", gap:7 }}>
                <Icon name="bulb" size={22} color={th.accent} />
                IdeaFlow
              </h1>
              <div style={{ display:"flex", gap:6 }}>
                <IconBtn name={dark?"sun":"moon"}
                  onClick={()=>setDark(d=>!d)}
                  color={th.text} bg={th.surface2} size={19} pad="9px"
                  style={{ border:`1.5px solid ${th.border}`, borderRadius:22 }} />
                <IconBtn name="ai"
                  onClick={()=>setShowAI(p=>!p)}
                  color={showAI?"#fff":th.text}
                  bg={showAI?th.accent:th.surface2} size={19} pad="9px"
                  style={{ border:`1.5px solid ${showAI?th.accent:th.border}`, borderRadius:22 }} />
                <IconBtn name={archive?"eyeoff":"eye"}
                  onClick={()=>setArchive(p=>!p)}
                  color={archive?"#fff":th.text}
                  bg={archive?th.accent:th.surface2} size={19} pad="9px"
                  style={{ border:`1.5px solid ${archive?th.accent:th.border}`, borderRadius:22 }} />
                <button onClick={()=>setShowLogout(true)}
                  title="התנתק"
                  style={{ width:38, height:38, borderRadius:22, border:`1.5px solid ${th.border}`,
                    background:th.surface2, cursor:"pointer", overflow:"hidden", padding:0 }}>
                  {user.photoURL
                    ? <img src={user.photoURL} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                    : <span style={{ fontSize:16 }}>👤</span>}
                </button>
              </div>
            </div>

            {/* Search */}
            <div style={{ position:"relative", marginBottom:9 }}>
              <input value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="חיפוש רעיון..."
                style={{ width:"100%", border:`1.5px solid ${th.border}`,
                  borderRadius:10, padding:"9px 36px 9px 32px",
                  fontSize:14, background:th.inputBg,
                  fontFamily:"'Rubik',sans-serif", direction:"rtl", color:th.text }} />
              <span style={{ position:"absolute", right:10, top:"50%",
                transform:"translateY(-50%)", pointerEvents:"none" }}>
                <Icon name="search" size={17} color={th.muted} />
              </span>
              {search && (
                <button onClick={()=>setSearch("")}
                  style={{ position:"absolute", left:8, top:"50%", transform:"translateY(-50%)",
                    border:"none", background:th.accentSoft, borderRadius:"50%",
                    width:20, height:20, cursor:"pointer",
                    display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Icon name="close" size={12} color={th.accent} />
                </button>
              )}
            </div>

            {/* Project selector */}
            <div style={{ background:th.surface2, borderRadius:11,
              border:`1.5px solid ${th.border}`, padding:"9px 11px", marginBottom:9 }}>
              <div style={{ display:"flex", alignItems:"center",
                justifyContent:"space-between", marginBottom:8 }}>
                <span style={{ fontSize:13, fontWeight:700, color:th.text }}>בחר פרויקט:</span>
                <button onClick={()=>setShowProj(true)}
                  style={{ background:th.surface, color:th.accent,
                    border:`1.5px solid ${th.accent}`, borderRadius:20,
                    padding:"5px 12px", cursor:"pointer", fontSize:12, fontWeight:800,
                    fontFamily:"'Rubik',sans-serif",
                    display:"flex", alignItems:"center", gap:4 }}>
                  <Icon name="add" size={13} color={th.accent} /> פרויקט חדש
                </button>
              </div>
              <div style={{ position:"relative" }}>
                <button onClick={()=>setShowMenu(p=>!p)}
                  style={{ width:"100%", background:th.surface,
                    border:`1.5px solid ${th.border}`, borderRadius:9,
                    padding:"9px 12px", cursor:"pointer",
                    display:"flex", alignItems:"center", gap:8 }}>
                  <Icon name={showMenu?"up":"down"} size={15} color={th.accent} />
                  <div style={{ width:10, height:10, borderRadius:"50%", background:cur?.color }} />
                  <span style={{ flex:1, fontWeight:700, color:th.text, fontSize:14,
                    textAlign:"right" }}>{cur?.name}</span>
                  <span style={{ fontSize:10, color:"#fff", background:th.accent,
                    padding:"2px 8px", borderRadius:20, fontWeight:700 }}>{active}</span>
                </button>
                {showMenu && (
                  <div style={{ position:"absolute", top:"calc(100% + 3px)", right:0, left:0,
                    background:th.surface, borderRadius:10,
                    boxShadow:"0 6px 20px rgba(0,0,0,0.2)", zIndex:200,
                    overflow:"hidden", border:`1.5px solid ${th.border}` }}>
                    {projects.map(p=>(
                      <div key={p.id}
                        style={{ display:"flex", alignItems:"center", gap:4, padding:"9px 10px",
                          background:p.id===pid?th.accentTint:th.surface,
                          borderBottom:`1px solid ${th.border}` }}>
                        <div onClick={e=>{ e.stopPropagation(); setPidAndSave(p.id); setShowMenu(false); }}
                          style={{ display:"flex", alignItems:"center", gap:7, flex:1, cursor:"pointer" }}>
                          <div style={{ width:9, height:9, borderRadius:"50%",
                            background:p.color, flexShrink:0 }} />
                          <span style={{ fontSize:13, color:th.text,
                            fontWeight:p.id===pid?700:500 }}>{p.name}</span>
                          <span style={{ fontSize:10, color:th.accent, fontWeight:700,
                            background:th.accentSoft, padding:"1px 7px", borderRadius:20 }}>
                            {ideas.filter(i=>i.pid===p.id&&!i.done).length}
                          </span>
                        </div>
                        <button onClick={e=>{ e.stopPropagation();
                          const txt=ideas.filter(i=>i.pid===p.id&&!i.done).map((i,n)=>(n+1)+". "+i.text).join("\n");
                          window.open("https://wa.me/?text="+encodeURIComponent(p.name+":\n"+txt),"_blank");
                        }} style={{ background:"transparent", border:"none", cursor:"pointer",
                          padding:"3px 6px", display:"flex", alignItems:"center" }}>
                          <Icon name="share" size={15} color={th.muted} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display:"flex", gap:7, marginBottom:8 }}>
            {[{l:"פעילים",v:active,c:th.accent},
              {l:"בוצעו", v:done,  c:th.green},
              {l:'סה"כ',  v:active+done, c:th.accent}].map(s=>(
              <div key={s.l} style={{ flex:1, background:th.surface, borderRadius:12,
                padding:"7px 6px", textAlign:"center",
                border:`1.5px solid ${s.c}44`, boxShadow:`0 2px 6px ${s.c}18` }}>
                <div style={{ fontSize:18, fontWeight:900, color:s.c, lineHeight:1 }}>{s.v}</div>
                <div style={{ fontSize:10, color:s.c, fontWeight:700, marginTop:2 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth:520, margin:"0 auto", padding:"4px 12px 100px" }}>

        {/* Sort button row */}
        {filtered.length > 1 && (
          <div style={{ display:"flex", justifyContent:"flex-start", marginBottom:8 }}>
            <button onClick={()=>setSortMode(s=>!s)}
              style={{ display:"flex", alignItems:"center", gap:6,
                background: sortMode ? th.accent : th.surface,
                color: sortMode ? "#fff" : th.muted,
                border:`1.5px solid ${sortMode?th.accent:th.border}`,
                borderRadius:20, padding:"5px 14px", cursor:"pointer",
                fontSize:12, fontWeight:600, fontFamily:"'Rubik',sans-serif",
                transition:"all 0.2s" }}>
              {sortMode ? "✓ סיים" : "↕ סדר"}
            </button>
          </div>
        )}

        {filtered.length===0
          ? <div style={{ textAlign:"center", padding:"50px 0", color:th.muted }}>
              <Icon name="bulb" size={52} color={th.border} />
              <p style={{ fontSize:15, marginTop:10 }}>
                {search?"לא נמצאו רעיונות":"לחץ על הכפתור הצף להוספת רעיון"}
              </p>
            </div>
          : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={filtered.map(i=>i.id)} strategy={verticalListSortingStrategy}>
                {filtered.map((idea,idx)=>(
                  <SortableIdeaCard key={idea.id} idea={idea} th={th} dark={dark}
                    sortMode={sortMode}
                    onUpdate={updIdea} onDelete={delIdea}
                    onShare={setShare} onEdit={()=>setEditIdea(idea)}
                    onMoveUp={()=>moveIdea(idea.id,-1)}
                    onMoveDown={()=>moveIdea(idea.id,1)}
                    isFirst={idx===0} isLast={idx===filtered.length-1} />
                ))}
              </SortableContext>
            </DndContext>
          )
        }
      </div>

      {/* FAB - scroll-aware */}
      <button onClick={()=>setNewOpen(true)}
        style={{ position:"fixed", bottom:24, left:"50%",
          transform: fabVisible
            ? "translateX(-50%) translateY(0) scale(1)"
            : "translateX(-50%) translateY(80px) scale(0.8)",
          opacity: fabVisible ? 1 : 0,
          pointerEvents: fabVisible ? "auto" : "none",
          transition:"transform 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.3s",
          height:42, borderRadius:21, background:th.accent,
          border:"none", cursor:"pointer", padding:"0 20px",
          display:"flex", alignItems:"center", justifyContent:"center", gap:8,
          boxShadow:`0 4px 16px ${th.accent}55, 0 1px 4px rgba(0,0,0,0.15)`,
          zIndex:100 }}>
        <Icon name="bulb" size={18} color="#fff" />
        <span style={{ fontSize:14, fontWeight:700, color:"#fff",
          fontFamily:"'Rubik',sans-serif", whiteSpace:"nowrap" }}>רעיון חדש</span>
      </button>

      {/* Modals */}
      {toast     && <Toast msg={toast} th={th} />}
      {showLogout && (
        <Modal onClose={()=>setShowLogout(false)} maxWidth={300} th={th}>
          <div style={{ textAlign:"center" }}>
            <div style={{ marginBottom:12 }}>
              {user.photoURL
                ? <img src={user.photoURL} style={{ width:56, height:56, borderRadius:"50%" }} />
                : <div style={{ fontSize:44 }}>👤</div>}
            </div>
            <div style={{ fontSize:15, fontWeight:700, color:th.text, marginBottom:4 }}>
              {user.displayName}
            </div>
            <div style={{ fontSize:13, color:th.muted, marginBottom:20 }}>
              {user.email}
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={()=>setShowLogout(false)}
                style={{ flex:1, height:44, background:th.surface2, color:th.text,
                  border:`1px solid ${th.border}`, borderRadius:12, cursor:"pointer",
                  fontSize:14, fontWeight:600, fontFamily:"'Rubik',sans-serif" }}>
                ביטול
              </button>
              <button onClick={()=>{ signOut(auth); setShowLogout(false); }}
                style={{ flex:1, height:44, background:th.red, color:"#fff",
                  border:"none", borderRadius:12, cursor:"pointer",
                  fontSize:14, fontWeight:700, fontFamily:"'Rubik',sans-serif" }}>
                התנתק
              </button>
            </div>
          </div>
        </Modal>
      )}
      {newOpen   && <IdeaEditor title="רעיון חדש" onSave={saveNew} onClose={()=>setNewOpen(false)} th={th} />}
      {editIdea  && <IdeaEditor title="עריכה" initial={editIdea} onSave={saveEdit} onClose={()=>setEditIdea(null)} th={th} />}
      {showAI    && <AIPanel ideas={ideas.filter(i=>i.pid===pid)} onClose={()=>setShowAI(false)} th={th} />}
      {shareIdea && <ShareModal idea={shareIdea} onClose={()=>setShare(null)} th={th} />}
      {showProj  && <ProjModal projects={projects} ideas={ideas} activePid={pid}
        onClose={()=>setShowProj(false)} onAdd={addProj} onDel={delProj}
        onEdit={editProj} onSelect={id=>{ setPidAndSave(id); setShowProj(false); }} th={th} />}
      {showNotes && cur && <NotesModal project={cur} onSave={saveNotes}
        onClose={()=>setShowNotes(false)} th={th} />}
    </div>
  );
}
