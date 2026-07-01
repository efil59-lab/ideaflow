// Runs once per minute (external cron, e.g. cron-job.org).
// Finds due reminders in Firestore and delivers Web Push notifications.
//
// Required Vercel env vars:
//   CRON_SECRET              - shared secret; cron sends ?key=<secret> or x-cron-key header
//   FIREBASE_SERVICE_ACCOUNT - Firebase service-account JSON (single-line string)
//   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT
import admin from "firebase-admin";
import webpush from "web-push";

function init() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    });
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@ideaflow.app",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export default async function handler(req, res) {
  const key = req.query?.key || req.headers["x-cron-key"];
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    init();
    const db = admin.firestore();
    const now = Date.now();
    let fired = 0, sent = 0, pruned = 0;

    const due = await db.collection("reminders").where("at", "<=", now).limit(200).get();

    // Group by uid so each user's subscriptions are fetched once.
    const byUid = {};
    due.forEach(d => {
      const r = d.data();
      if (!r?.uid) return;
      (byUid[r.uid] = byUid[r.uid] || []).push({ ref: d.ref, ...r });
    });

    for (const [uid, reminders] of Object.entries(byUid)) {
      const subsSnap = await db.collection("pushSubs").where("uid", "==", uid).get();
      const subs = subsSnap.docs;

      for (const r of reminders) {
        const payload = JSON.stringify({
          title: "💡 תזכורת — IdeaFlow",
          body: (r.text || "").slice(0, 180) || "תזכורת",
          ideaId: r.ideaId,
          url: "/",
        });

        await Promise.all(subs.map(async sd => {
          const sub = sd.data();
          if (!sub?.endpoint || !sub?.keys) return;
          try {
            await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
            sent++;
          } catch (e) {
            if (e.statusCode === 404 || e.statusCode === 410) {
              await sd.ref.delete();
              pruned++;
            }
          }
        }));

        await r.ref.delete();
        fired++;
      }
    }

    return res.status(200).json({ ok: true, now, fired, sent, pruned });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
