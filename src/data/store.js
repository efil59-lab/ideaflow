// Firestore data layer. Ideas and projects live in per-user subcollections;
// reminders and push subscriptions live in flat top-level collections so the
// server cron can query them across users.
import { useEffect, useState } from "react";
import { db, storage } from "../firebase";
import {
  collection, doc, getDoc, onSnapshot, setDoc, updateDoc, deleteDoc, query, orderBy, writeBatch,
} from "firebase/firestore";
import { ref as storageRef, deleteObject } from "firebase/storage";

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
    colorIdx: null, order: null, images: [], audios: [], remindAt: null, updatedAt: 0 };
  return {
    projects: [
      { id: "p1", name: "טלוויזיה", color: "#2E5BE6", notes: "", pinned: false, createdAt: 1 },
      { id: "p2", name: "בית", color: "#0E9488", notes: "", pinned: false, createdAt: 2 },
    ],
    ideas: [
      { ...base, id: "d1", text: "מדור 'איפה הם היום' — לעקוב אחרי שחקני הסדרות הקלאסיות", title: "מדור איפה הם היום", tags: ["תוכן"], aiProject: "p1", createdAt: now - 3600e3 },
      { ...base, id: "d2", text: "לקנות נורות חכמות לסלון ולבדוק תאימות ל-Google Home", title: "נורות חכמות לסלון", tags: ["קניות"], pinned: true, colorIdx: 0, remindAt: now + 86400e3, createdAt: now - 7200e3 },
      { ...base, id: "d3", text: "רעיון לפתיח: מחרוזת פתיחים של שנות השמונים ברצף אחד", title: "מחרוזת פתיחים", tags: [], colorIdx: 2, createdAt: now - 10800e3 },
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

// ── Ideas ─────────────────────────────────────────────────────────────────────
export async function addIdea(uid, data) {
  if (import.meta.env.DEV && uid === "demo") return { id: "demo", ...data };
  const id = newId();
  const idea = {
    text: "", html: "", title: "", tags: [],
    status: "inbox", projectId: null, aiProject: null,
    pinned: false, colorIdx: null, order: null,
    images: [], audios: [], remindAt: null,
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
  if ("remindAt" in patch || "status" in patch) {
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
      await setDoc(rref, { uid, ideaId: id, at: idea.remindAt, text: (idea.text || "").slice(0, 180) });
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
    name, notes: "", pinned: false,
    color: PROJ_COLORS[existingCount % PROJ_COLORS.length],
    createdAt: Date.now(),
  });
  return id;
}

export const updateProject = (uid, id, patch) => updateDoc(doc(projectsCol(uid), id), patch);

export async function deleteProject(uid, id, ideas) {
  // Ideas in the project go back to the inbox — deleting a folder shouldn't delete its contents.
  for (const i of (ideas || []).filter(x => x.projectId === id)) {
    await updateIdea(uid, i.id, {
      projectId: null,
      status: i.status === "done" ? "done" : i.status === "trash" ? "trash" : "inbox",
    }, i);
  }
  await deleteDoc(doc(projectsCol(uid), id));
}
