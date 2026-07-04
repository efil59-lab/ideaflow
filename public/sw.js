// IdeaFlow Service Worker — Web Push reminders
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

// A push arrives from the server (api/send-reminders.js) when a reminder is due.
// This fires even when the app is closed.
self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}
  const title = data.title || "💡 תזכורת — IdeaFlow";
  // Only real reminders (kind:"reminder", with a uid to snooze against) get the
  // background snooze buttons — not digests, comments, or share events.
  const snoozable = data.kind === "reminder" && data.ideaId && data.uid;
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      dir: "rtl",
      lang: "he",
      tag: data.ideaId ? `idea-${data.ideaId}` : undefined,
      requireInteraction: true,
      actions: snoozable
        ? [{ action: "snooze15", title: "15 דק׳" },
           { action: "snoozeMore", title: "אחר" }]
        : [],
      data: { url: data.url || "/", ideaId: data.ideaId || null, uid: data.uid || null }
    })
  );
});

// A snooze button → reschedule in the background via the server; the app never
// opens. We swap the reminder for a brief confirmation on the same tag.
const SNOOZE_MIN = { snooze15: 15, snooze60: 60 };

function snoozeInBackground(d, min) {
  return fetch(`/api/snooze?uid=${encodeURIComponent(d.uid)}&ideaId=${encodeURIComponent(d.ideaId)}&min=${min}`,
    { method: "POST" })
    .then(r => r.ok)
    .catch(() => false)
    .then(ok => self.registration.showNotification(
      ok ? "😴 התזכורת נדחתה" : "לא הצלחתי לדחות",
      {
        body: ok
          ? (min === 60 ? "תופיע שוב בעוד שעה" : `תופיע שוב בעוד ${min} דקות`)
          : "פתח את האפליקציה ונסה שוב",
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-96.png",
        dir: "rtl", lang: "he",
        tag: `idea-${d.ideaId}`,
        data: { url: `/?idea=${encodeURIComponent(d.ideaId)}`, ideaId: d.ideaId }
      }));
}

// Click behaviour:
// - "15 דק׳" button   → background reschedule, no window opens
// - "אחר" button      → open the app on the full snooze dialog (?snooze=)
// - notification body → open / focus the app on the idea itself
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const d = event.notification.data || {};

  const min = SNOOZE_MIN[event.action];
  if (min && d.uid && d.ideaId) {
    event.waitUntil(snoozeInBackground(d, min));
    return; // deliberately no openWindow — the app stays closed
  }

  const url = (event.action === "snoozeMore" && d.ideaId)
    ? `/?snooze=${encodeURIComponent(d.ideaId)}`
    : (d.url || "/");
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async clients => {
      for (const c of clients) {
        if ("focus" in c) {
          await c.focus();
          c.postMessage({ type: "OPEN_URL", url });
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
