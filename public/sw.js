// IdeaFlow Service Worker - Background Reminders
const CACHE_NAME = "ideaflow-v1";

self.addEventListener("install", e => {
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(self.clients.claim());
});

// Active timer registry: { ideaId: timeoutId }
const timers = new Map();

self.addEventListener("message", event => {
  const { type, idea } = event.data || {};

  if (type === "SCHEDULE_REMINDER" && idea) {
    // Cancel existing timer for this idea
    if (timers.has(idea.id)) {
      clearTimeout(timers.get(idea.id));
      timers.delete(idea.id);
    }

    const delay = idea.remindAt - Date.now();
    if (delay <= 0) return;

    // Max setTimeout = ~24 days
    const safeDelay = Math.min(delay, 2147483647);

    const tid = setTimeout(() => {
      self.registration.showNotification("💡 תזכורת — IdeaFlow", {
        body: idea.text,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        dir: "rtl",
        lang: "he",
        tag: `idea-${idea.id}`,
        requireInteraction: true,
        data: { ideaId: idea.id, url: "/" }
      });
      timers.delete(idea.id);
    }, safeDelay);

    timers.set(idea.id, tid);
  }

  if (type === "CANCEL_REMINDER" && idea) {
    if (timers.has(idea.id)) {
      clearTimeout(timers.get(idea.id));
      timers.delete(idea.id);
    }
  }

  if (type === "CANCEL_ALL") {
    timers.forEach(tid => clearTimeout(tid));
    timers.clear();
  }
});

// Click on notification opens the app
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then(clients => {
      for (const c of clients) {
        if ("focus" in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("/");
    })
  );
});
