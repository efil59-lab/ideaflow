// Firestore data layer. Ideas and projects live in per-user subcollections;
// reminders and push subscriptions live in flat top-level collections so the
// server cron can query them across users.
import { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, query, orderBy,
} from "firebase/firestore";

export const newId = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

const ideasCol = uid => collection(db, "users", uid, "ideas");
const projectsCol = uid => collection(db, "users", uid, "projects");

// ── Live hooks ────────────────────────────────────────────────────────────────
export function useIdeas(uid) {
  const [ideas, setIdeas] = useState(null);
  useEffect(() => {
    if (!uid) return;
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
    const q = query(projectsCol(uid), orderBy("createdAt", "asc"));
    return onSnapshot(q, snap => {
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => { console.warn("projects snapshot:", err); setProjects([]); });
  }, [uid]);
  return projects;
}

// ── Ideas ─────────────────────────────────────────────────────────────────────
export async function addIdea(uid, data) {
  const id = newId();
  const idea = {
    text: "", html: "", title: "", tags: [],
    status: "inbox", projectId: null, aiProject: null,
    pinned: false, images: [], audios: [], remindAt: null,
    createdAt: Date.now(), updatedAt: Date.now(),
    ...data,
  };
  await setDoc(doc(ideasCol(uid), id), idea);
  await syncReminder(uid, id, idea);
  return { id, ...idea };
}

export async function updateIdea(uid, id, patch) {
  await updateDoc(doc(ideasCol(uid), id), { ...patch, updatedAt: Date.now() });
  if ("remindAt" in patch || "status" in patch || "text" in patch) {
    syncReminder(uid, id, patch);
  }
}

export async function deleteIdea(uid, id) {
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
    await updateIdea(uid, i.id, { projectId: null, status: i.status === "done" ? "done" : "inbox" });
  }
  await deleteDoc(doc(projectsCol(uid), id));
}
