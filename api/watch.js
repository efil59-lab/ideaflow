// Galaxy Watch endpoint — the watch app only fetches and draws; everything is
// decided here.
//
//   GET  /api/watch?u=<uid>&k=<key>          → { ok, reminders:[…], recent:[…] }
//   POST /api/watch?u=<uid>&k=<key>  {text}  → saves a new note → { ok, id }
//
// Auth is one long random key kept on the user's doc (users/{uid}.watchKey) and
// baked into the watch build. Compared in constant time.
import admin from "firebase-admin";
import crypto from "node:crypto";

function init() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    });
  }
  return admin.firestore();
}

const sameKey = (a, b) => {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
};

// Same rules as the app: autoTitle (src/data/store.js) and the hidden project
// tag on checklist lines, which every view strips.
const TAG = /\s*⟦p:[^⟧]*⟧\s*$/;
const ITEM = /^\s*(?:[-*]\s+|\[[ xX]\]\s*)/;
export function autoTitle(text) {
  const first = (text || "").trim().split(/\r?\n/)[0].replace(ITEM, "").replace(TAG, "").trim();
  if (!first) return "";
  if (first.length <= 40) return first;
  const cut = first.slice(0, 40);
  const sp = cut.lastIndexOf(" ");
  return (sp > 20 ? cut.slice(0, sp) : cut) + "…";
}
const label = d => (d.title || autoTitle(d.text) || "").trim() || "ללא כותרת";

// Gone from the app's own lists: trash, done, archived/deleted notes.
const live = d => d.status !== "trash" && d.status !== "done" && !d.archived && !d.deletedAt;

// Israel wall-clock pieces for a timestamp — the watch shows them as-is.
const IL = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
function ilParts(ms) {
  const p = Object.fromEntries(IL.formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

export async function buildSummary(db, uid, now = Date.now()) {
  const col = db.collection("users").doc(uid).collection("ideas");

  // Reminders: anything due from an hour ago until the end of tomorrow.
  const today = ilParts(now).day;
  const tomorrow = ilParts(now + 864e5).day;
  const remSnap = await col
    .where("remindAt", ">=", now - 3600e3)
    .where("remindAt", "<=", now + 2 * 864e5)
    .orderBy("remindAt").limit(30).get();
  const reminders = remSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(d => live(d))
    .map(d => {
      const p = ilParts(d.remindAt);
      return { t: label(d), time: p.time, day: p.day === today ? "today" : p.day === tomorrow ? "tomorrow" : null, at: d.remindAt };
    })
    .filter(r => r.day)
    .slice(0, 6);

  // Recent: the newest things written, notes and ideas alike.
  const recSnap = await col.orderBy("createdAt", "desc").limit(15).get();
  const recent = recSnap.docs
    .map(d => d.data())
    .filter(live)
    .slice(0, 5)
    .map(d => ({ t: label(d), at: d.createdAt || 0 }));

  return { ok: true, now, reminders, recent };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const uid = String(req.query?.u || "");
  const key = String(req.query?.k || "");
  if (!uid || !key) return res.status(400).json({ ok: false, error: "missing" });

  try {
    const db = init();
    const user = await db.collection("users").doc(uid).get();
    if (!user.exists || !sameKey(key, user.get("watchKey"))) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const text = String(body.text || "").trim().slice(0, 4000);
      if (!text) return res.status(400).json({ ok: false, error: "empty" });
      // A plain note on the main notes screen — exactly what the phone's
      // "פתק חדש" creates (addNote in src/data/store.js).
      const now = Date.now();
      const ref = db.collection("users").doc(uid).collection("ideas").doc(crypto.randomUUID());
      await ref.set({
        text, html: "", title: autoTitle(text), tags: [],
        status: "note", projectId: null, aiProject: null,
        pinned: false, colorIdx: 0, order: null, noCheck: true,
        images: [], audios: [], files: [], links: [], folderId: null,
        remindAt: null, repeat: null, repeatAnchor: null, comments: [],
        source: "watch", createdAt: now, updatedAt: now,
      });
      return res.status(200).json({ ok: true, id: ref.id });
    }

    return res.status(200).json(await buildSummary(db, uid));
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e).slice(0, 200) });
  }
}
