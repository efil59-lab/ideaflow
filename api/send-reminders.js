// Runs once per minute (triggered by an external cron, e.g. cron-job.org).
// Finds due reminders across all users and delivers a Web Push notification.
//
// Required Vercel env vars:
//   CRON_SECRET            - shared secret; the cron must send ?key=<secret> or x-cron-key header
//   FIREBASE_SERVICE_ACCOUNT - the Firebase service-account JSON (as a single-line string)
//   FIREBASE_DATABASE_URL  - e.g. https://<project>-default-rtdb.firebaseio.com
//   VAPID_PUBLIC_KEY       - VAPID public key (same one the client uses)
//   VAPID_PRIVATE_KEY      - VAPID private key
//   VAPID_SUBJECT          - mailto:you@example.com  (optional, defaults below)
import admin from "firebase-admin";
import webpush from "web-push";

function init() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
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
    const db = admin.database();
    const now = Date.now();

    const remSnap = await db.ref("reminders").once("value");
    const all = remSnap.val() || {};
    let sent = 0, pruned = 0, fired = 0;

    for (const uid of Object.keys(all)) {
      const entries = all[uid] || {};
      const due = Object.entries(entries).filter(([, r]) => r && typeof r.at === "number" && r.at <= now);
      if (!due.length) continue;

      const subSnap = await db.ref(`pushSubs/${uid}`).once("value");
      const subs = subSnap.val() || {};

      for (const [ideaId, r] of due) {
        const payload = JSON.stringify({
          title: "💡 תזכורת — IdeaFlow",
          body: (r.text || "").slice(0, 180) || "תזכורת",
          ideaId,
          url: "/",
        });

        await Promise.all(Object.entries(subs).map(async ([subId, sub]) => {
          if (!sub || !sub.endpoint || !sub.keys) return;
          try {
            await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
            sent++;
          } catch (e) {
            // 404/410 = subscription expired; remove it
            if (e.statusCode === 404 || e.statusCode === 410) {
              await db.ref(`pushSubs/${uid}/${subId}`).remove();
              pruned++;
            }
          }
        }));

        // Remove the reminder so it won't fire again
        await db.ref(`reminders/${uid}/${ideaId}`).remove();
        fired++;
      }
    }

    return res.status(200).json({ ok: true, now, fired, sent, pruned });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
