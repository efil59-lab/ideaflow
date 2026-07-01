// One-time, non-destructive migration: Realtime DB (v4) → Firestore (v5).
// The old RTDB data is read-only here — nothing is deleted, so v4 keeps
// working as a fallback until you're confident.
import { app, db } from "../firebase";
import { getDatabase, ref as rtdbRef, get } from "firebase/database";
import { doc, getDoc, setDoc, collection } from "firebase/firestore";
import { uploadDataUrl } from "./media";

export async function migrateIfNeeded(uid, onProgress = () => {}) {
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists() && userSnap.data().migratedAt) return false;

  onProgress("קורא נתונים קיימים...");
  let data = null;
  try {
    const snap = await get(rtdbRef(getDatabase(app), `users/${uid}`));
    data = snap.val();
  } catch (e) {
    console.warn("RTDB read failed (new user or rules):", e);
  }

  if (data) {
    const projects = data.projects || [];
    const ideas = data.ideas || [];

    // Projects keep their numeric ids as strings so idea.pid mapping is trivial.
    const pidMap = {};
    for (const p of projects) {
      if (!p) continue;
      const id = String(p.id);
      pidMap[p.id] = id;
      await setDoc(doc(collection(db, "users", uid, "projects"), id), {
        name: p.name || "פרויקט",
        notes: p.notes || "",
        color: p.color || "#2E5BE6",
        pinned: !!p.pinned,
        createdAt: Date.now(),
      });
    }

    let n = 0;
    for (const i of ideas) {
      if (!i) continue;
      n++;
      onProgress(`מעביר רעיון ${n} מתוך ${ideas.length}...`);

      // base64 media → Storage files (Firestore docs are capped at 1MB)
      const images = [];
      for (const src of i.images || []) {
        if (!src) continue;
        if (String(src).startsWith("data:")) {
          try { images.push((await uploadDataUrl(uid, src, "img")).url); }
          catch (e) { console.warn("image migration failed, skipping one image", e); }
        } else images.push(src);
      }
      const audios = [];
      for (const a of i.audios || []) {
        if (!a || !a.src) continue;
        if (String(a.src).startsWith("data:")) {
          try {
            const up = await uploadDataUrl(uid, a.src, a.name || "audio");
            audios.push({ url: up.url, name: a.name || "הקלטה" });
          } catch (e) { console.warn("audio migration failed, skipping one clip", e); }
        } else audios.push({ url: a.src, name: a.name || "הקלטה" });
      }

      await setDoc(doc(collection(db, "users", uid, "ideas"), String(i.id)), {
        text: i.text || "",
        html: i.html || "",
        title: "",
        tags: [],
        status: i.done ? "done" : "active",
        projectId: pidMap[i.pid] || null,
        aiProject: null,
        pinned: !!i.pinned,
        images, audios,
        remindAt: i.remindAt || null,
        createdAt: i.at || Date.now(),
        updatedAt: Date.now(),
      });

      if (i.remindAt && i.remindAt > Date.now() && !i.done) {
        await setDoc(doc(db, "reminders", `${uid}_${i.id}`), {
          uid, ideaId: String(i.id), at: i.remindAt, text: (i.text || "").slice(0, 180),
        });
      }
    }
  }

  await setDoc(userRef, { migratedAt: Date.now() }, { merge: true });
  return !!data;
}
