// Owner-only: who is using the app.
//
// Verified server-side with the admin SDK, so it needs no Firestore rules
// change — the caller proves who they are with a Firebase ID token, and only
// the owner's email gets an answer.
import admin from "firebase-admin";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "efil59@gmail.com").toLowerCase();

function init() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    });
  }
}

async function countIdeas(db, uid) {
  const col = db.collection("users").doc(uid).collection("ideas");
  try {
    const [all, done] = await Promise.all([
      col.count().get(),
      col.where("status", "==", "done").count().get(),
    ]);
    return { total: all.data().count, done: done.data().count };
  } catch {
    // Older SDK without aggregates — fall back to a ref-only read.
    const snap = await col.select("status").get();
    return {
      total: snap.size,
      done: snap.docs.filter(d => d.get("status") === "done").length,
    };
  }
}

export default async function handler(req, res) {
  const idToken = req.body?.idToken || req.query?.idToken;
  if (!idToken) return res.status(400).json({ error: "missing token" });

  try {
    init();
    const decoded = await admin.auth().verifyIdToken(idToken);
    if ((decoded.email || "").toLowerCase() !== ADMIN_EMAIL) {
      return res.status(403).json({ error: "forbidden" });
    }

    const db = admin.firestore();
    const snap = await db.collection("users").get();
    const users = await Promise.all(snap.docs.map(async d => {
      const u = d.data() || {};
      const counts = await countIdeas(db, d.id).catch(() => ({ total: 0, done: 0 }));
      return {
        uid: d.id,
        name: u.name || "",
        email: u.email || "",
        photo: u.photo || "",
        firstSeen: u.firstSeen || null,
        lastSeen: u.lastSeen || null,
        version: u.seenVersion || "",
        ideas: counts.total,
        done: counts.done,
      };
    }));
    users.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));

    const subs = await db.collection("pushSubs").get();
    const pushUids = new Set(subs.docs.map(d => d.get("uid")).filter(Boolean));
    users.forEach(u => { u.push = pushUids.has(u.uid); });

    return res.status(200).json({ ok: true, count: users.length, users });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
