/* Hallmark · genre: playful · theme: Hum · design-system: design.md · designed-as-app
 * Client-side image upload to Firebase Storage.
 * Returns a token-bearing download URL suitable for <img src> and Firestore. */
import {
  ref,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  type UploadTask,
} from "firebase/storage";
import { getStorageInstance } from "./firebase/client";

export type ImageFolder = "questions" | "notices";

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Upload an image file and return its public download URL.
 * Path: `<folder>/<yyyy>/<mm>/<uuid>.<ext>` — grouped by month for manageability.
 */
export async function uploadImage(file: File, folder: ImageFolder): Promise<string> {
  const storage = getStorageInstance();
  const ext = (file.name.split(".").pop() || "img")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 8) || "img";
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const path = `${folder}/${yyyy}/${mm}/${randomId()}.${ext}`;
  const snapshot = await uploadBytes(ref(storage, path), file, {
    contentType: file.type || "application/octet-stream",
  });
  return getDownloadURL(snapshot.ref);
}

/**
 * Upload a PDF to Storage with resumable progress reporting.
 * Path: `formula-sheets/<timestamp>_<safe-name>.pdf`
 */
export function uploadPdf(file: File): { task: UploadTask; done: Promise<string> } {
  const storage = getStorageInstance();
  const safeName = (file.name || "sheet.pdf").replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `formula-sheets/${Date.now()}_${safeName}`;
  const task = uploadBytesResumable(ref(storage, path), file, {
    contentType: "application/pdf",
  });
  const done = new Promise<string>((resolve, reject) => {
    task.on(
      "state_changed",
      undefined,
      (err) => reject(err),
      async () => {
        try {
          resolve(await getDownloadURL(task.snapshot.ref));
        } catch (err) {
          reject(err);
        }
      }
    );
  });
  return { task, done };
}

/**
 * Delete a Storage object by its download URL (works for images and PDFs).
 * Parses the object path out of the download URL — supports the
 * `firebasestorage.googleapis.com/v0/b/<bucket>/o/<path>?...&token=...` shape.
 *
 * Returns "deleted" | "skipped" — skipped for blob:/data:/non-Storage URLs
 * (e.g. legacy ImgBB links, which we cannot delete from outside imgbb).
 * Throws on genuine Storage failures so callers can log and continue.
 */
export async function deleteByUrl(
  url: string | undefined | null
): Promise<"deleted" | "skipped"> {
  if (!url) return "skipped";
  if (!url.startsWith("https://firebasestorage.googleapis.com/")) return "skipped";
  const match = url.match(/\/o\/([^?]+)/);
  if (!match) return "skipped";
  let path: string;
  try {
    path = decodeURIComponent(match[1]);
  } catch {
    return "skipped";
  }
  const storage = getStorageInstance();
  await deleteObject(ref(storage, path));
  return "deleted";
}
