/* Student profile stored at users/{uid} — name prefilled into the exam lobby.
 * Phone auth gives us a stable uid; the display name lives in Firestore. */

import { getFirestoreDb } from "./firebase/client";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

export interface StudentProfile {
  uid: string;
  name: string;
  createdAt: unknown;
}

const COLLECTION = "users";
const MAX_NAME = 80;

export async function fetchProfile(uid: string): Promise<StudentProfile | null> {
  try {
    const db = getFirestoreDb();
    const snap = await getDoc(doc(db, COLLECTION, uid));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      uid,
      name: typeof d.name === "string" ? d.name : "",
      createdAt: d.createdAt,
    };
  } catch {
    return null; // profile is a convenience, never block the UI on it
  }
}

export async function saveProfile(uid: string, name: string): Promise<void> {
  const trimmed = name.trim().slice(0, MAX_NAME);
  if (!trimmed) throw new Error("Enter your name.");
  const db = getFirestoreDb();
  await setDoc(
    doc(db, COLLECTION, uid),
    { name: trimmed, updatedAt: serverTimestamp() },
    { merge: true }
  );
}
