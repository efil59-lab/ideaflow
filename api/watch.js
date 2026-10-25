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
