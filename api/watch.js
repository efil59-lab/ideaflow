// Galaxy Watch endpoint — the watch app only fetches and draws; everything is
// decided here. One watch app for everyone: each watch is linked to the
// IdeaFlow account of whoever signed in on the phone.
//
// Linking (the watch shows a code, the phone types it):
//   POST ?op=start                       → watch gets { code, secret }
//   POST ?op=claim   {idToken, code}     → phone (signed in) claims the code
//   POST ?op=poll    {code, secret}      → watch gets { linked, u, k } once claimed
//   POST ?op=list    {idToken}           → phone: the account's linked watches
//   POST ?op=unlink  {idToken, id}       → phone: disconnect one
//
// Using it (u + k from the link):
//   GET  ?u=<uid>&k=<key>                → { ok, reminders:[…], recent:[…] }
//   POST ?u=<uid>&k=<key>  {text}        → saves a new note → { ok, id }
//   GET  ?u=…&k=…&lists=1                → { ok, lists:[{id,t,items:[{i,l,d}]}] }
//   POST ?u=…&k=…&act=check {id,i,done}  → sets one checklist line → { ok }
//   POST ?u=…&k=…&act=delete {id}        → note to the notes archive (30 days), like the phone
//   GET  ?u=…&k=…&notes=1                → { ok, notes:[{id,t,b,pinned,list,f,c}], folders:[{id,name}] }
//   GET  ?u=…&k=…&lists=1&id=<noteId>    → also includes that list even if it isn't in the top 12
//
// Keys and pairing secrets are stored only as SHA-256 hashes. watch_pairs and
// watch_links have no client rule, so Firestore denies them to the app — only
// this function (admin SDK) touches them.
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

const sha = s => crypto.createHash("sha256").update(String(s)).digest("hex");
const sameHash = (a, b) => {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
};
const PAIR_TTL = 10 * 60e3;

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

// Checklist lines — the exact rules of src/ui/Checklist.jsx: "- ", "* ", "[ ] ",
// "[x] " are items; a project tag rides hidden at the end of the line.
const LINE = /^(\s*)(?:[-*]\s+|\[([ xX])\]\s*)(.*)$/;
const LINE_TAG = / ?⟦p:([^⟧\s]+)⟧[ \t]*$/;
export function checklist(text) {
  const out = [];
  String(text || "").split(/\r?\n/).forEach((line, i) => {
    const m = line.match(LINE);
    if (m) out.push({ i, l: m[3].replace(LINE_TAG, ""), d: (m[2] || "").toLowerCase() === "x" });
  });
  return out;
}
// Sets (not flips) one line, so a double tap on the watch can't undo itself.
export function setLine(text, index, done) {
  const lines = String(text || "").split(/\r?\n/);
  const m = (lines[index] || "").match(LINE);
  if (!m) return null;
  lines[index] = `${m[1]}[${done ? "x" : " "}] ${m[3]}`;
  return lines.join("\n");
}

// The checklists worth having on the wrist: pinned first, then the most recently
// touched. Same "live" rule as the rest of the watch.
// Every live note, newest-touched first with pinned on top — read with a field
// mask, because notes can carry big html and image fields.
async function liveNotes(db, uid) {
  const snap = await db.collection("users").doc(uid).collection("ideas")
    .where("status", "==", "note")
    .select("title", "text", "pinned", "archived", "deletedAt", "status", "updatedAt", "createdAt", "folderId", "colorIdx")
    .get();
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(d => live(d))
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)
      || (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
}

export async function buildLists(db, uid, wantId = null) {
  const lists = (await liveNotes(db, uid))
    .map(d => ({ d, items: checklist(d.text) }))
    .filter(x => x.items.length > 0);
  const top = lists.slice(0, 12);
  // a list opened from the notes screen may sit below the top 12
  const extra = wantId && !top.some(x => x.d.id === wantId) && lists.find(x => x.d.id === wantId);
  if (extra) top.push(extra);
  return top.map(({ d, items }) => ({ id: d.id, t: label(d), pinned: !!d.pinned, items: items.slice(0, 60) }));
}

// Notes to read on the wrist: title + plain body (project tags stripped,
// trimmed to what a watch can sensibly scroll). Checklists are flagged so the
// watch opens them as tickable lists.
export async function buildNotes(db, uid) {
  return (await liveNotes(db, uid)).slice(0, 200).map(d => {
    const body = String(d.text || "").split(/\r?\n/).map(l => l.replace(LINE_TAG, "")).join("\n").trim();
    return {
      id: d.id, t: label(d), pinned: !!d.pinned, list: checklist(d.text).length > 0,
      f: d.folderId || null, c: Number.isInteger(d.colorIdx) ? d.colorIdx : 0,
      b: body.length > 1200 ? body.slice(0, 1200) + "…" : body,
    };
  });
}

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

  // Pinned notes, for the "מוצמדים" tile — an equality query, no index needed.
  const pinSnap = await col.where("pinned", "==", true).limit(20).get();
  const pinned = pinSnap.docs
    .map(d => d.data())
    .filter(d => d.status === "note" && live(d))
    .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
    .slice(0, 6)
    .map(d => ({ t: label(d) }));

  return { ok: true, now, reminders, recent, pinned };
}

// A new idea with the same defaults as addIdea in src/data/store.js.
const ideaDoc = (data, now) => ({
  text: "", html: "", title: "", tags: [],
  status: "inbox", projectId: null, aiProject: null,
  pinned: false, colorIdx: null, order: null, noCheck: false,
  images: [], audios: [], files: [], links: [], folderId: null, remindAt: null,
  repeat: null, repeatAnchor: null, comments: [],
  createdAt: now, updatedAt: now,
  ...data,
});

/**
 * Deleting a note from the watch does exactly what the phone does:
 *  1. ticked tasks tagged to a project are copied into that project, so the
 *     work survives the note (snapshotNoteTasks in src/App.jsx);
 *  2. the note goes to the notes archive with a 30-day countdown, unpinned and
 *     without its reminder (doDelete in src/screens/Notes.jsx);
 *  3. the reminder mirror the cron reads is removed (syncReminder in store.js).
 * Returns how many tasks were kept in projects.
 */
export async function deleteNote(db, uid, id, now = Date.now()) {
  const user = db.collection("users").doc(uid);
  const ref = user.collection("ideas").doc(String(id || "x"));
  const snap = await ref.get();
  if (!snap.exists || snap.get("status") !== "note") return { ok: false, error: "gone" };
  const note = { id: snap.id, ...snap.data() };
  if (note.deletedAt) return { ok: true, kept: 0 };   // already on its way out

  const projects = new Set((await user.collection("projects").select().get()).docs.map(d => d.id));
  const ideas = user.collection("ideas");
  const color = Number.isInteger(note.colorIdx) ? note.colorIdx : null;
  let kept = 0;
  if (note.tagProject && note.tagDone && projects.has(note.tagProject)) {
    const body = String(note.text || "").split(/\r?\n/).map(l => l.replace(LINE_TAG, "")).join("\n");
    await ideas.doc(crypto.randomUUID()).set(ideaDoc({ text: body, title: note.title || "", status: "done",
      projectId: note.tagProject, srcNote: note.id, colorIdx: color }, now));
    kept++;
  }
  const seen = new Set();
  for (const line of String(note.text || "").split(/\r?\n/)) {
    const m = line.match(LINE);
    if (!m || (m[2] || "").toLowerCase() !== "x") continue;
    const pid = (m[3].match(LINE_TAG) || [])[1];
    const text = m[3].replace(LINE_TAG, "").trim();
    if (!pid || !text || !projects.has(pid) || seen.has(pid + "\u0000" + text)) continue;
    seen.add(pid + "\u0000" + text);
    await ideas.doc(crypto.randomUUID()).set(ideaDoc({ text, status: "done", projectId: pid,
      srcNote: note.id, colorIdx: color }, now));
    kept++;
  }

  await ref.update({ archived: true, deletedAt: now, pinned: false, remindAt: null, updatedAt: now });
  await db.collection("reminders").doc(`${uid}_${note.id}`).delete().catch(() => {});
  return { ok: true, kept };
}

// The watch's own credentials → its link doc, or null.
async function findLink(db, uid, key) {
  if (!uid || !key) return null;
  const want = sha(key);
  const snap = await db.collection("watch_links").where("uid", "==", uid).get();
  return snap.docs.find(d => sameHash(d.get("keyHash"), want)) || null;
}

async function phoneUid(body) {
  if (!body.idToken) return null;
  try { return (await admin.auth().verifyIdToken(body.idToken)).uid; } catch { return null; }
}

async function pairing(db, op, body, res) {
  const pairs = db.collection("watch_pairs");
  const now = Date.now();

  if (op === "start") {
    // A fresh 6-digit code nobody else is holding right now.
    for (let i = 0; i < 8; i++) {
      const code = String(crypto.randomInt(0, 1e6)).padStart(6, "0");
      const ref = pairs.doc(code);
      const cur = await ref.get();
      if (cur.exists && cur.get("expiresAt") > now) continue;
      const secret = crypto.randomBytes(24).toString("hex");
      await ref.set({ secretHash: sha(secret), createdAt: now, expiresAt: now + PAIR_TTL, uid: null });
      return res.status(200).json({ ok: true, code, secret, ttl: PAIR_TTL });
    }
    return res.status(503).json({ ok: false, error: "busy" });
  }

  if (op === "poll") {
    const ref = pairs.doc(String(body.code || ""));
    const p = await ref.get();
    if (!p.exists || !sameHash(p.get("secretHash"), sha(body.secret || ""))) {
      return res.status(404).json({ ok: false, error: "unknown" });
    }
    if (!p.get("uid")) {
      if (p.get("expiresAt") < now) { await ref.delete(); return res.status(410).json({ ok: false, error: "expired" }); }
      return res.status(200).json({ ok: true, linked: false });
    }
    // Claimed: mint this watch's key now, hand it over once, forget the pairing.
    const uid = p.get("uid");
    const key = crypto.randomBytes(32).toString("hex");
    const link = db.collection("watch_links").doc();
    await link.set({ uid, keyHash: sha(key), createdAt: now, lastSeen: now });
    await ref.delete();
    return res.status(200).json({ ok: true, linked: true, u: uid, k: key });
  }

  const uid = await phoneUid(body);
  if (!uid) return res.status(401).json({ ok: false, error: "auth" });

  if (op === "claim") {
    const code = String(body.code || "").replace(/\D/g, "");
    const ref = pairs.doc(code);
    const p = code.length === 6 ? await ref.get() : null;
    if (!p?.exists || p.get("expiresAt") < now) return res.status(404).json({ ok: false, error: "no-code" });
    if (p.get("uid") && p.get("uid") !== uid) return res.status(409).json({ ok: false, error: "taken" });
    await ref.update({ uid, claimedAt: now });
    return res.status(200).json({ ok: true });
  }

  if (op === "list") {
    const snap = await db.collection("watch_links").where("uid", "==", uid).get();
    const watches = snap.docs
      .map(d => ({ id: d.id, createdAt: d.get("createdAt") || 0, lastSeen: d.get("lastSeen") || 0 }))
      .sort((a, b) => b.createdAt - a.createdAt);
    return res.status(200).json({ ok: true, watches });
  }

  if (op === "unlink") {
    const ref = db.collection("watch_links").doc(String(body.id || "x"));
    const d = await ref.get();
    if (d.exists && d.get("uid") === uid) await ref.delete();
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ ok: false, error: "op" });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  let body = req.body || {};
  if (typeof body === "string") { try { body = JSON.parse(body || "{}"); } catch { body = {}; } }

  try {
    const db = init();
    const op = String(req.query?.op || "");
    if (op) {
      if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });
      return await pairing(db, op, body, res);
    }

    const uid = String(req.query?.u || "");
    const link = await findLink(db, uid, req.query?.k);
    // 403 tells the watch it was disconnected, so it goes back to pairing.
    if (!link) return res.status(403).json({ ok: false, error: "forbidden" });
    const now = Date.now();
    if (now - (link.get("lastSeen") || 0) > 3600e3) link.ref.update({ lastSeen: now }).catch(() => {});

    if (req.method === "POST" && req.query?.act === "check") {
      const ref = db.collection("users").doc(uid).collection("ideas").doc(String(body.id || "x"));
      const n = await ref.get();
      if (!n.exists || n.get("status") !== "note") return res.status(404).json({ ok: false, error: "gone" });
      const text = setLine(n.get("text"), Number(body.i), !!body.done);
      if (text === null) return res.status(409).json({ ok: false, error: "changed" });
      await ref.update({ text, updatedAt: now });
      return res.status(200).json({ ok: true, items: checklist(text) });
    }

    if (req.method === "POST" && req.query?.act === "delete") {
      const r = await deleteNote(db, uid, body.id, now);
      return res.status(r.ok ? 200 : 404).json(r);
    }

    if (req.method === "GET" && req.query?.lists) {
      return res.status(200).json({ ok: true, lists: await buildLists(db, uid, req.query.id || null) });
    }

    if (req.method === "GET" && req.query?.notes) {
      // The phone's folders, in the user's own order — the watch groups by them.
      const folders = ((await db.collection("users").doc(uid).get()).get("folders") || [])
        .filter(f => f && f.id && f.name).map(f => ({ id: String(f.id), name: String(f.name) }));
      return res.status(200).json({ ok: true, notes: await buildNotes(db, uid), folders });
    }

    if (req.method === "POST") {
      const text = String(body.text || "").trim().slice(0, 4000);
      if (!text) return res.status(400).json({ ok: false, error: "empty" });
      // A plain note on the main notes screen — exactly what the phone's
      // "פתק חדש" creates (addNote in src/data/store.js).
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
