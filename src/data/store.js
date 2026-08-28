// Firestore data layer. Ideas and projects live in per-user subcollections;
// reminders and push subscriptions live in flat top-level collections so the
// server cron can query them across users.
import { useEffect, useState } from "react";
import { db, storage } from "../firebase";
import {
  collection, doc, getDoc, onSnapshot, setDoc, updateDoc, deleteDoc, query, orderBy, where, writeBatch, arrayUnion,
} from "firebase/firestore";
import { ref as storageRef, deleteObject } from "firebase/storage";
import { APP_VERSION } from "../changelog";

export const newId = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

const ideasCol = uid => collection(db, "users", uid, "ideas");
const projectsCol = uid => collection(db, "users", uid, "projects");

// ── Dev-only demo data (/?uipreview) ──────────────────────────────────────────
// Lazy factory so production tree-shaking fully removes it (module-level arrays
// with Date.now() are treated as side-effectful and survive DCE).
function demoData() {
  const now = Date.now();
  const base = { status: "inbox", projectId: null, aiProject: null, pinned: false,
    colorIdx: null, order: null, images: [], audios: [], files: [], remindAt: null, updatedAt: 0 };
  return {
    projects: [
      { id: "p1", name: "טלוויזיה", color: "#2E5BE6", notes: "", pinned: false, createdAt: 1 },
      { id: "p2", name: "בית", color: "#0E9488", notes: "", pinned: false, fav: true, createdAt: 2 },
    ],
    ideas: [
      { ...base, id: "d1", text: "מדור 'איפה הם היום' — לעקוב אחרי שחקני הסדרות הקלאסיות", title: "מדור איפה הם היום", tags: ["תוכן"], aiProject: "p1", createdAt: now - 3600e3 },
      { ...base, id: "d2", text: "לקנות נורות חכמות לסלון ולבדוק תאימות ל-Google Home", title: "נורות חכמות לסלון", tags: ["קניות"], pinned: true, colorIdx: 0, remindAt: now + 86400e3, createdAt: now - 7200e3 },
      { ...base, id: "d3", text: "רעיון לפתיח: מחרוזת פתיחים של שנות השמונים ברצף אחד", title: "מחרוזת פתיחים", tags: [], colorIdx: 2, createdAt: now - 10800e3 },
      { ...base, id: "d4", text: "מדור 'מאחורי הקלעים' עם סיפורים מההפקות", title: "מאחורי הקלעים", tags: ["תוכן"], status: "active", projectId: "p1", createdAt: now - 14400e3,
        comments: [{ id: "c1", text: "רעיון מעולה! אפשר להתחיל מ'זהו זה'", authorUid: "guest", authorName: "דנה", at: now - 600e3 }] },
      { ...base, id: "d5", text: "רעיון ישן שכבר לא רלוונטי", title: "רעיון ישן", status: "trash", deletedAt: now - 172800e3, createdAt: now - 200000e3 },
      { ...base, id: "d6", text: "סיסמת הפאנל של האתר: admin / 1234 — הערת רקע", title: "פרטי גישה", status: "active", projectId: "p1", noCheck: true, createdAt: now - 1800e3 },
      { ...base, id: "d7", text: "לתקן את הברז במטבח", title: "ברז מטבח", status: "active", projectId: "p2", createdAt: now - 900e3 },
      { ...base, id: "d8", text: "לצבוע את הסלון", title: "צביעת הסלון", status: "active", projectId: "p2", createdAt: now - 1200e3 },
      { ...base, id: "d9", text: "לסגור חוזה עם הסטודיו", title: "חוזה סטודיו", status: "done", projectId: "p1", createdAt: now - 250000e3 },
    ],
  };
}

// ── Live hooks ────────────────────────────────────────────────────────────────
export function useIdeas(uid) {
  const [ideas, setIdeas] = useState(null);
  useEffect(() => {
    if (!uid) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- dev-only demo seed
    if (import.meta.env.DEV && uid === "demo") { setIdeas(demoData().ideas); return; }
    const q = query(ideasCol(uid), orderBy("createdAt", "desc"));
    return onSnapshot(q, snap => {
      setIdeas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => { console.warn("ideas snapshot:", err); setIdeas([]); });
  }, [uid]);
  return ideas;
}

export function useProjects(uid) {
  const [projects, setProjects] = useState(null);
  useEffect(() => {
    if (!uid) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- dev-only demo seed
    if (import.meta.env.DEV && uid === "demo") { setProjects(demoData().projects); return; }
    const q = query(projectsCol(uid), orderBy("createdAt", "asc"));
    return onSnapshot(q, snap => {
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => { console.warn("projects snapshot:", err); setProjects([]); });
  }, [uid]);
  return projects;
}

// First-open check for the welcome guide — stored on the user's Firestore doc,
// so it's per-user (survives reinstall, works across devices), not per-browser.
// Returns true exactly once per user and marks it seen.
export async function guideNotSeenYet(uid) {
  if (import.meta.env.DEV && uid === "demo") {
    if (localStorage.getItem("if_guide_demo")) return false;
    localStorage.setItem("if_guide_demo", "1");
    return true;
  }
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  if (snap.exists() && snap.data().guideSeenAt) return false;
  await setDoc(userRef, { guideSeenAt: Date.now() }, { merge: true });
  return true;
}

// What's-new dialog: shown once per user per APP_VERSION bump. New users who
// just got the guide have the version stamped silently (markVersionSeen).
export async function markVersionSeen(uid) {
  if (import.meta.env.DEV && uid === "demo") {
    localStorage.setItem("if_whatsnew_demo", APP_VERSION);
    return;
  }
  await setDoc(doc(db, "users", uid), { seenVersion: APP_VERSION }, { merge: true });
}

export async function whatsNewNotSeenYet(uid) {
  if (import.meta.env.DEV && uid === "demo") {
    if (localStorage.getItem("if_whatsnew_demo") === APP_VERSION) return false;
    localStorage.setItem("if_whatsnew_demo", APP_VERSION);
    return true;
  }
  const snap = await getDoc(doc(db, "users", uid));
  if (snap.exists() && snap.data().seenVersion === APP_VERSION) return false;
  await markVersionSeen(uid);
  return true;
}

// ── Ideas ─────────────────────────────────────────────────────────────────────
export async function addIdea(uid, data) {
  if (import.meta.env.DEV && uid === "demo") return { id: "demo", ...data };
  const id = newId();
  const idea = {
    text: "", html: "", title: "", tags: [],
    status: "inbox", projectId: null, aiProject: null,
    pinned: false, colorIdx: null, order: null, noCheck: false,
    images: [], audios: [], files: [], remindAt: null, repeat: null, repeatAnchor: null, comments: [],
    createdAt: Date.now(), updatedAt: Date.now(),
    ...data,
  };
  await setDoc(doc(ideasCol(uid), id), idea);
  await syncReminder(uid, id, idea);
  return { id, ...idea };
}

// `base` is the current idea object — required for correct reminder sync when
// the patch touches remindAt/status (the mirror needs the merged state, not
// just the delta; syncing from a bare patch used to wipe reminders).
export async function updateIdea(uid, id, patch, base = null) {
  if (import.meta.env.DEV && uid === "demo") return;
  await updateDoc(doc(ideasCol(uid), id), { ...patch, updatedAt: Date.now() });
  if ("remindAt" in patch || "status" in patch || "repeat" in patch || "repeatAnchor" in patch) {
    syncReminder(uid, id, base ? { ...base, ...patch } : patch);
  }
}

// Persist a manual ordering: each id gets order = its index in the list.
export async function reorderIdeas(uid, ids) {
  if (import.meta.env.DEV && uid === "demo") return;
  const b = writeBatch(db);
  ids.forEach((id, i) => b.update(doc(ideasCol(uid), id), { order: i, updatedAt: Date.now() }));
  await b.commit();
}

// Accepts the full idea object (preferred — enables media cleanup) or a bare id.
export async function deleteIdea(uid, idea) {
  if (import.meta.env.DEV && uid === "demo") return;
  const id = typeof idea === "string" ? idea : idea.id;

  // Best-effort Storage cleanup — orphaned files cost money, docs don't wait for this.
  if (typeof idea === "object") {
    const urls = [
      ...(idea.images || []),
      ...(idea.audios || []).map(a => a && (a.url || a.src)),
      ...(idea.files || []).map(f => f && f.url),
    ].filter(u => typeof u === "string" && u.includes("firebasestorage"));
    for (const u of urls) {
      try { deleteObject(storageRef(storage, u)).catch(() => {}); } catch { /* bad url — skip */ }
    }
  }

  await deleteDoc(doc(ideasCol(uid), id));
  deleteDoc(doc(db, "reminders", `${uid}_${id}`)).catch(() => {});
}

// Mirror an idea's reminder into /reminders/{uid}_{ideaId} for the server cron.
async function syncReminder(uid, id, idea) {
  const rref = doc(db, "reminders", `${uid}_${id}`);
  try {
    if (idea.remindAt && idea.remindAt > Date.now() && idea.status !== "done") {
      // `anchor` is the immutable recurrence origin; snoozing moves `at` (the
      // next fire) but never the anchor, so the repeating rhythm can't drift.
      await setDoc(rref, { uid, ideaId: id, at: idea.remindAt, repeat: idea.repeat || null,
        anchor: idea.repeatAnchor || idea.remindAt, text: (idea.text || "").slice(0, 180) });
    } else {
      await deleteDoc(rref);
    }
  } catch { /* offline or already gone — fine */ }
}

// ── Projects ──────────────────────────────────────────────────────────────────
export const PROJ_COLORS = ["#2E5BE6", "#0E9488", "#7C3AED", "#16A34A", "#D97706", "#DB2777"];

export async function addProject(uid, name, existingCount = 0) {
  const id = newId();
  await setDoc(doc(projectsCol(uid), id), {
    name, notes: "", pinned: false, order: existingCount,
    color: PROJ_COLORS[existingCount % PROJ_COLORS.length],
    createdAt: Date.now(),
  });
  return id;
}

export const updateProject = (uid, id, patch) => updateDoc(doc(projectsCol(uid), id), patch);

// Persist a manual project ordering: each id gets order = its index.
export async function reorderProjects(uid, ids) {
  if (import.meta.env.DEV && uid === "demo") return;
  const b = writeBatch(db);
  ids.forEach((id, i) => b.update(doc(projectsCol(uid), id), { order: i }));
  await b.commit();
}

export async function deleteProject(uid, id, ideas) {
  // Ideas in the project go back to the inbox — deleting a folder shouldn't delete its contents.
  for (const i of (ideas || []).filter(x => x.projectId === id)) {
    await updateIdea(uid, i.id, {
      projectId: null,
      status: i.status === "done" ? "done" : i.status === "trash" ? "trash" : "inbox",
    }, i);
  }
  await deleteDoc(doc(projectsCol(uid), id));
  removeShare(uid, id).catch(() => {});
}

// ── Sharing ───────────────────────────────────────────────────────────────────
// A "share certificate" at shares/{ownerUid}_{projectId} lists invited emails.
// Security rules use it to grant guests scoped access to that project's ideas.
export const shareIdOf = (uid, pid) => `${uid}_${pid}`;

export async function saveShare(uid, project, emails, owner) {
  if (import.meta.env.DEV && uid === "demo") return;
  await setDoc(doc(db, "shares", shareIdOf(uid, project.id)), {
    ownerUid: uid,
    projectId: project.id,
    projectName: project.name,
    projectColor: project.color || "#2E5BE6",
    ownerName: owner.name || owner.email || "",
    ownerEmail: (owner.email || "").toLowerCase(),
    sharedWith: [...new Set(emails.map(e => String(e).trim().toLowerCase()).filter(Boolean))],
    updatedAt: Date.now(),
  });
}

export async function removeShare(uid, pid) {
  if (import.meta.env.DEV && uid === "demo") return;
  await deleteDoc(doc(db, "shares", shareIdOf(uid, pid)));
}

// Dev-only fake shares for /?uipreview — stripped from production builds.
function demoShares() {
  const now = Date.now();
  return {
    mine: {
      p1: { id: "demo_p1", ownerUid: "demo", projectId: "p1", projectName: "טלוויזיה",
        projectColor: "#2E5BE6", ownerName: "תצוגה", sharedWith: ["friend@gmail.com"] },
    },
    withMe: [
      { id: "demoowner_px", ownerUid: "demo-owner", projectId: "px", projectName: "רעיונות לטיול",
        projectColor: "#0E9488", ownerName: "דנה", ownerEmail: "dana@gmail.com", sharedWith: ["demo@local"] },
    ],
    ideas: [
      { id: "s1", text: "לבדוק צימרים בגליל לסופ\"ש הארוך", title: "צימרים בגליל", tags: ["טיול"],
        status: "active", projectId: "px", pinned: false, colorIdx: null, order: null,
        images: [], audios: [], remindAt: null, createdAt: now - 3600e3, updatedAt: 0,
        comments: [{ id: "c1", text: "יש מקום מהמם ליד צפת!", authorName: "דנה", at: now - 1800e3 }] },
      { id: "s2", text: "מסלול נחל עמוד — לצאת מוקדם", title: "נחל עמוד", tags: [],
        status: "active", projectId: "px", pinned: false, colorIdx: 2, order: null,
        images: [], audios: [], remindAt: null, createdAt: now - 7200e3, updatedAt: 0,
        createdBy: { uid: "demo", name: "תצוגה" }, comments: [] },
      { id: "s3", text: "להזמין שולחן למסעדה בראש פינה", title: "מסעדה בראש פינה", tags: [],
        status: "done", projectId: "px", pinned: false, colorIdx: null, order: null,
        images: [], audios: [], remindAt: null, createdAt: now - 9600e3, updatedAt: 0, comments: [] },
    ],
  };
}

// Owner side: my shares, keyed by projectId (drives badges + the share modal)
export function useMyShares(uid) {
  const [shares, setShares] = useState({});
  useEffect(() => {
    if (!uid) return;
    if (import.meta.env.DEV && uid === "demo") { setShares(demoShares().mine); return; }
    const q = query(collection(db, "shares"), where("ownerUid", "==", uid));
    return onSnapshot(q, snap => {
      const m = {};
      snap.docs.forEach(d => { m[d.data().projectId] = { id: d.id, ...d.data() }; });
      setShares(m);
    }, () => setShares({}));
  }, [uid]);
  return shares;
}

// Guest side: projects shared with my email
export function useSharedWithMe(email) {
  const [list, setList] = useState([]);
  useEffect(() => {
    if (!email) return;
    if (import.meta.env.DEV && email === "demo@local") { setList(demoShares().withMe); return; }
    const q = query(collection(db, "shares"), where("sharedWith", "array-contains", email.toLowerCase()));
    return onSnapshot(q, snap => setList(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => setList([]));
  }, [email]);
  return list;
}

// Guest side: live ideas of one shared project (owner's collection, scoped query)
export function useSharedIdeas(ownerUid, projectId) {
  const [ideas, setIdeas] = useState(null);
  useEffect(() => {
    if (!ownerUid || !projectId) return;
    if (import.meta.env.DEV && ownerUid === "demo-owner") { setIdeas(demoShares().ideas); return; }
    const q = query(ideasCol(ownerUid), where("projectId", "==", projectId));
    return onSnapshot(q, snap => setIdeas(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => { console.warn("shared ideas:", err); setIdeas([]); });
  }, [ownerUid, projectId]);
  return ideas;
}

// Append a comment to an idea (owner or guest — rules restrict guests to this)
export async function addComment(ownerUid, ideaId, comment) {
  if (import.meta.env.DEV && ownerUid === "demo") return;
  await updateDoc(doc(collection(db, "users", ownerUid, "ideas"), ideaId), {
    comments: arrayUnion({ ...comment, id: newId(), at: Date.now() }),
    updatedAt: Date.now(),
  });
}

// Guest adds a new idea into the owner's shared project
export async function addSharedIdea(ownerUid, data, createdBy) {
  const id = newId();
  const idea = {
    text: "", html: "", title: "", tags: [],
    status: "active", projectId: null, aiProject: null,
    pinned: false, colorIdx: null, order: null, noCheck: false,
    images: [], audios: [], files: [], remindAt: null, comments: [],
    createdBy,
    createdAt: Date.now(), updatedAt: Date.now(),
    ...data,
  };
  await setDoc(doc(collection(db, "users", ownerUid, "ideas"), id), idea);
  return { id, ...idea };
}

// Stamp who this is and when they were last here, so the owner's admin panel
// has something to show. Own-doc write — covered by the existing rules.
export async function recordPresence(uid, user) {
  if (import.meta.env.DEV && uid === "demo") return;
  try {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    const patch = {
      name: user.displayName || "",
      email: (user.email || "").toLowerCase(),
      photo: user.photoURL || "",
      lastSeen: Date.now(),
    };
    if (!snap.exists() || !snap.data().firstSeen) patch.firstSeen = Date.now();
    await setDoc(ref, patch, { merge: true });
  } catch { /* offline — the next launch stamps it */ }
}

// Live view of the user's own doc (holds commentSeen map, seenVersion, etc.).
export function useUserDoc(uid) {
  const [data, setData] = useState({});
  useEffect(() => {
    if (!uid || (import.meta.env.DEV && uid === "demo")) return;
    return onSnapshot(doc(db, "users", uid), s => setData(s.data() || {}), () => {});
  }, [uid]);
  return data;
}

// Mark every comment in a project as read for this user (nested-map merge).
export async function markCommentsSeen(uid, projectId, at = Date.now()) {
  if (import.meta.env.DEV && uid === "demo") return;
  if (!projectId) return;
  try {
    await setDoc(doc(db, "users", uid), { commentSeen: { [projectId]: at } }, { merge: true });
  } catch { /* offline — retries on next open */ }
}

// Queue a push notification (consumed by the server cron within a minute).
// target: { toUid } or { toEmail }.
export function queueNotification(fromUid, target, payload) {
  if (import.meta.env.DEV && fromUid === "demo") return Promise.resolve();
  return setDoc(doc(collection(db, "notifications"), newId()), {
    fromUid, ...target, ...payload, createdAt: Date.now(),
  }).catch(() => {});
}
