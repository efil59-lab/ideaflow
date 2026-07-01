// Web Push (VAPID) subscription helper.
// Subscribes the current device and stores the subscription under
// /pushSubs/<uid>/<key>. The server (api/send-reminders.js) reads these
// subscriptions and delivers reminder notifications.
import { db } from "./firebase";
import { ref, set } from "firebase/database";

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

// Firebase keys may not contain . # $ [ ] / — sanitize the endpoint into a key.
function subKey(endpoint) {
  return endpoint.replace(/[^A-Za-z0-9_-]/g, "_").slice(-200);
}

export async function enablePush(uid) {
  try {
    if (!uid || !VAPID_PUBLIC) return false;
    if (!("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)) return false;

    const perm = await Notification.requestPermission();
    if (perm !== "granted") return false;

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      });
    }

    const json = sub.toJSON(); // { endpoint, keys: { p256dh, auth } }
    await set(ref(db, `pushSubs/${uid}/${subKey(json.endpoint)}`), {
      endpoint: json.endpoint,
      keys: json.keys,
      ua: navigator.userAgent.slice(0, 120),
      updatedAt: Date.now(),
    });
    return true;
  } catch (e) {
    console.warn("enablePush failed:", e);
    return false;
  }
}
