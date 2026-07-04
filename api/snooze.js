// Background snooze for a reminder — called by the service worker when the user
// taps a snooze button ON the notification, so the app never opens.
//
// Moves only the next fire (idea.remindAt + the /reminders mirror's `at`); the
// repeat + immutable anchor are preserved, so a repeating series never drifts.
//
// Auth: identified by uid + ideaId, both unguessable (Firebase uid + UUID idea
// id) and embedded in the trusted push payload we generated. Low-sensitivity —
// the worst an attacker with both ids could do is delay one reminder.
import admin from "firebase-admin";

function init() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    });
  }
}

export default async function handler(req, res) {
  const uid = req.query?.uid || req.body?.uid;
  const ideaId = req.query?.ideaId || req.body?.ideaId;
  const min = parseInt(req.query?.min || req.body?.min, 10);
  if (!uid || !ideaId || !min || min < 1 || min > 100000) {
    return res.status(400).json({ error: "bad request" });
  }

  try {
    init();
    const db = admin.firestore();
    const at = Date.now() + min * 60 * 1000;

    const ideaRef = db.doc(`users/${uid}/ideas/${ideaId}`);
    const snap = await ideaRef.get();
    if (!snap.exists) return res.status(404).json({ error: "idea not found" });
    const idea = snap.data() || {};

    await ideaRef.update({ remindAt: at, updatedAt: Date.now() });
    // Upsert the mirror (a non-repeat reminder was deleted when it fired, so this
    // re-creates it; a repeat reminder just gets its next fire pulled earlier).
    await db.doc(`reminders/${uid}_${ideaId}`).set({
      uid, ideaId, at,
      repeat: idea.repeat || null,
      anchor: idea.repeatAnchor || at,
      text: (idea.text || "").slice(0, 180),
    });

    return res.status(200).json({ ok: true, at });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
