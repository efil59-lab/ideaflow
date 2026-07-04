// Web Push (VAPID) subscription helper — Firestore edition.
// Stores this device's subscription in /pushSubs/{uid}_{key} so the server
// cron (api/send-reminders.js) can deliver reminders to it.
import { db, auth } from "./firebase";
import { doc, setDoc } from "firebase/firestore";

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

const subKey = endpoint => endpoint.replace(/[^A-Za-z0-9_-]/g, "_").slice(-140);

export async function enablePush(uid) {
  try {
    if (!uid || !VAPID_PUBLIC) return false;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return false;

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

    const json = sub.toJSON();
    await setDoc(doc(db, "pushSubs", `${uid}_${subKey(json.endpoint)}`), {
      uid,
      email: (auth.currentUser?.email || "").toLowerCase(),
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
