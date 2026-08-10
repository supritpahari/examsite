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

export type QuestionType = "mcq" | "single";

export interface QuestionOption {
  id: string;
  text: string;
  correct: boolean;
}

export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  options: QuestionOption[];
  marks: number;
  negative: number;
  imageUrl?: string;
  createdAt?: unknown;
}

const COLLECTION = "questions";

function fromDoc(doc: QueryDocumentSnapshot): Question {
  const data = doc.data();
  return {
    id: doc.id,
    type: data.type ?? "single",
    prompt: data.prompt ?? "",
    options: Array.isArray(data.options) ? data.options : [],
    marks: data.marks ?? 0,
    negative: data.negative ?? 0,
    imageUrl: data.imageUrl,
    createdAt: data.createdAt,
  };
}

export async function fetchQuestions(): Promise<Question[]> {
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

export async function addQuestion(
  q: Omit<Question, "id" | "createdAt">
): Promise<Question> {
  const db = getFirestoreDb();
  const data: Record<string, unknown> = {
    type: q.type,
    prompt: q.prompt,
    options: q.options,
    marks: q.marks,
    negative: q.negative,
    createdAt: serverTimestamp(),
  };
  if (q.imageUrl) data.imageUrl = q.imageUrl;
  const ref = await addDoc(collection(db, COLLECTION), data);
  return { ...q, id: ref.id };
}

export async function deleteQuestion(id: string): Promise<void> {
  const db = getFirestoreDb();
  await deleteDoc(doc(db, COLLECTION, id));
}
