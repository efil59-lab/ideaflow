// Firebase Storage helpers — media lives as files, not base64 in the DB.
import { storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { newId } from "./store";

// Mirror of the cap in storage.rules — a bigger file is rejected server-side,
// so catch it here first with a friendly message instead of a silent failure.
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function uploadDataUrl(uid, dataUrl, name = "file") {
  const blob = await (await fetch(dataUrl)).blob();
  return uploadBlob(uid, blob, name);
}

export async function uploadFile(uid, file) {
  return uploadBlob(uid, file, file.name || "file");
}

async function uploadBlob(uid, blob, name) {
  const safe = String(name).replace(/[^\w.-]/g, "_").slice(-60);
  const path = `users/${uid}/media/${newId()}_${safe}`;
  const r = ref(storage, path);
  await uploadBytes(r, blob);
  const url = await getDownloadURL(r);
  return { url, path, name: safe, size: blob.size || 0, type: blob.type || "" };
}

// Human-readable file size — "340 KB", "2.1 MB".
export function fmtSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
