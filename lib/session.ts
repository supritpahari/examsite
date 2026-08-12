import { getFirestoreDb } from "./firebase/client";
import {
  doc,
  getDoc,
  runTransaction,
  updateDoc,
} from "firebase/firestore";

interface ActiveSession {
  sessionId: string;
  studentName: string;
  expiresAt: number;
}

const DEVICE_KEY = "examsite_device_id";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = window.localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export type ClaimResult =
  | { ok: true; expiresAt: number }
  | { ok: false; reason: "occupied" }
  | { ok: false; reason: "error" };

export async function claimExamSession(
  examId: string,
  sessionId: string,
  studentName: string,
  durationMinutes: number
): Promise<ClaimResult> {
  const db = getFirestoreDb();
  const ref = doc(db, "exams", examId);
  const now = Date.now();
  const expiresAt = now + durationMinutes * 60 * 1000;
  try {
    const result = await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.data() as { activeSession?: ActiveSession } | undefined;
      const existing = data?.activeSession;
      if (
        existing &&
        existing.sessionId !== sessionId &&
        existing.expiresAt > now
      ) {
        return { ok: false as const, reason: "occupied" as const };
      }
      const next: ActiveSession = { sessionId, studentName, expiresAt };
      tx.set(
        ref,
        { activeSession: next },
        { merge: true }
      );
      return { ok: true as const, expiresAt };
    });
    return result;
  } catch {
    return { ok: false, reason: "error" };
  }
}

export async function releaseExamSession(
  examId: string,
  sessionId: string
): Promise<void> {
  const db = getFirestoreDb();
  const ref = doc(db, "exams", examId);
  try {
    const snap = await getDoc(ref);
    const existing = snap.data()?.activeSession as ActiveSession | undefined;
    if (existing && existing.sessionId === sessionId) {
      await updateDoc(ref, { activeSession: null });
    }
  } catch {
    /* best-effort release */
  }
}

export async function getExamOccupant(
  examId: string
): Promise<ActiveSession | null> {
  const db = getFirestoreDb();
  const snap = await getDoc(doc(db, "exams", examId));
  const existing = snap.data()?.activeSession as ActiveSession | undefined;
  if (!existing) return null;
  return existing.expiresAt > Date.now() ? existing : null;
}