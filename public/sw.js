// IdeaFlow Service Worker — Web Push reminders
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

// A push arrives from the server (api/send-reminders.js) when a reminder is due.
// This fires even when the app is closed.
self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}
  const title = data.title || "💡 תזכורת — IdeaFlow";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      dir: "rtl",
      lang: "he",
      tag: data.ideaId ? `idea-${data.ideaId}` : undefined,
      requireInteraction: true,
      data: { url: data.url || "/" }
    })
  );
});

// Click on notification opens / focuses the app AND navigates to the idea:
// - app already open  → focus + postMessage (the app opens the idea's editor)
// - app closed        → openWindow with /?idea=<id> (the app reads it on boot)
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
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
