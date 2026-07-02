// Firebase Storage helpers — media lives as files, not base64 in the DB.
import { storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { newId } from "./store";

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
  return { url, path, name: safe };
}
