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
          url: `/?idea=${encodeURIComponent(r.ideaId)}`,
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

    // ── Nightly digest at 20:00 Israel time ──────────────────────────────────
    // "You have N unassigned ideas in your inbox" — once per day per user,
    // deduped via /digests/{uid} so overlapping cron calls can't double-send.
    let digests = 0;
    const ilTime = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(new Date());
    if (ilTime === "20:00") {
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
      const subsAll = await db.collection("pushSubs").get();
      const subsByUid = {};
      subsAll.forEach(d => {
        const s = d.data();
        if (s?.uid) (subsByUid[s.uid] = subsByUid[s.uid] || []).push(d);
      });

      for (const [uid, subs] of Object.entries(subsByUid)) {
        const marker = db.collection("digests").doc(uid);
        const m = await marker.get();
        if (m.exists && m.data().date === today) continue;
        await marker.set({ date: today });

        const inbox = await db.collection("users").doc(uid)
          .collection("ideas").where("status", "==", "inbox").get();
        const n = inbox.size;
        if (n === 0) continue;

        const payload = JSON.stringify({
          title: "💡 IdeaFlow",
          body: n === 1
            ? "יש לך רעיון אחד באינבוקס שמחכה לשיוך"
            : `יש לך ${n} רעיונות באינבוקס שמחכים לשיוך`,
          ideaId: "digest",
          url: "/",
        });
        await Promise.all(subs.map(async sd => {
          const sub = sd.data();
          if (!sub?.endpoint || !sub?.keys) return;
          try {
            await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
          } catch (e) {
            if (e.statusCode === 404 || e.statusCode === 410) await sd.ref.delete();
          }
        }));
        digests++;
      }
    }

    // ── Share notifications (comments / new shared ideas) ────────────────────
    // Queued by clients in /notifications, delivered here and deleted.
    let notified = 0;
    const nSnap = await db.collection("notifications").limit(100).get();
    for (const nd of nSnap.docs) {
      const n = nd.data() || {};
      let subs = [];
      if (n.toUid) {
        subs = (await db.collection("pushSubs").where("uid", "==", n.toUid).get()).docs;
      } else if (n.toEmail) {
        subs = (await db.collection("pushSubs").where("email", "==", n.toEmail).get()).docs;
      }
      const payload = JSON.stringify({
        title: n.title || "IdeaFlow",
        body: (n.body || "").slice(0, 180),
        ideaId: n.ideaId || "share",
        url: n.url || "/",
      });
      await Promise.all(subs.map(async sd => {
        const sub = sd.data();
        if (!sub?.endpoint || !sub?.keys) return;
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
          notified++;
        } catch (e) {
          if (e.statusCode === 404 || e.statusCode === 410) await sd.ref.delete();
        }
      }));
      await nd.ref.delete();
    }

    return res.status(200).json({ ok: true, now, fired, sent, pruned, digests, notified });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
