import { getFirestoreDb } from "./firebase/client";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

export type ExamStatus = "completed" | "scheduled" | "draft";

export interface Exam {
  id: string;
  title: string;
  subject: string;
  takenOn: string;
  status: ExamStatus;
  attempts: number;
  avgScore: number;
  duration: string;
  createdAt?: unknown;
}

const COLLECTION = "exams";

function fromDoc(d: QueryDocumentSnapshot): Exam {
  const data = d.data();
  return {
    id: d.id,
    title: data.title ?? "Untitled Exam",
    subject: data.subject ?? "Mixed",
    takenOn: data.takenOn ?? "—",
    status: (data.status as ExamStatus) ?? "draft",
    attempts: data.attempts ?? 0,
    avgScore: data.avgScore ?? 0,
    duration: data.duration ?? "—",
    createdAt: data.createdAt,
  };
}

export async function fetchExams(): Promise<Exam[]> {
  const db = getFirestoreDb();
  const snap = await getDocs(collection(db, COLLECTION));
  const items = snap.docs.map(fromDoc);
  items.sort((a, b) => {
    const ta = (a.createdAt as { seconds?: number } | undefined)?.seconds ?? 0;
    const tb = (b.createdAt as { seconds?: number } | undefined)?.seconds ?? 0;
    return tb - ta;
  });
  return items;
}

export async function addExam(
  exam: Omit<Exam, "id" | "createdAt">
): Promise<Exam> {
  const db = getFirestoreDb();
  const data: Record<string, unknown> = {
    title: exam.title,
    subject: exam.subject,
    takenOn: exam.takenOn,
    status: exam.status,
    attempts: exam.attempts,
    avgScore: exam.avgScore,
    duration: exam.duration,
    createdAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, COLLECTION), data);
  return { ...exam, id: ref.id };
}

export async function deleteExam(id: string): Promise<void> {
  const db = getFirestoreDb();
  await deleteDoc(doc(db, COLLECTION, id));
}
