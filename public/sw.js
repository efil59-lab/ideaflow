// IdeaFlow Service Worker — Web Push reminders
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

// A push arrives from the server (api/send-reminders.js) when a reminder is due.
// This fires even when the app is closed.
self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}
  const title = data.title || "💡 תזכורת — IdeaFlow";
  // Real reminders (not digests / share events) get a snooze action button.
  const snoozable = data.ideaId && data.ideaId !== "digest" && data.ideaId !== "share";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      dir: "rtl",
      lang: "he",
      tag: data.ideaId ? `idea-${data.ideaId}` : undefined,
      requireInteraction: true,
      actions: snoozable ? [{ action: "snooze", title: "😴 לך לישון" }] : [],
      data: { url: data.url || "/", ideaId: data.ideaId || null }
    })
  );
});

// Click on notification opens / focuses the app AND navigates to the idea:
// - app already open  → focus + postMessage (the app opens the idea's editor)
// - app closed        → openWindow with /?idea=<id> (the app reads it on boot)
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const d = event.notification.data || {};
  // "לך לישון" action → open the app on the snooze dialog instead of the editor.
  const url = event.action === "snooze" && d.ideaId
    ? `/?snooze=${encodeURIComponent(d.ideaId)}`
    : d.url || "/";
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
