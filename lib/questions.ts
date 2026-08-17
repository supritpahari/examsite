import { getFirestoreDb } from "./firebase/client";
import {
  collection,
  addDoc,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  type DocumentSnapshot,
} from "firebase/firestore";

export type QuestionType = "mcq" | "single";

export interface QuestionOption {
  id: string;
  text: string;
  correct: boolean;
  imageUrl?: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  options: QuestionOption[];
  marks: number;
  negative: number;
  chapter?: string;
  imageUrl?: string;
  createdAt?: unknown;
}

const COLLECTION = "questions";

function toStoreOptions(options: QuestionOption[]): Record<string, unknown>[] {
  return options.map((o) => ({
    id: o.id,
    text: o.text,
    correct: o.correct,
    ...(o.imageUrl ? { imageUrl: o.imageUrl } : {}),
  }));
}

function toOption(raw: unknown, index: number): QuestionOption {
  const fallbackId = String.fromCharCode(97 + index); // a, b, c, d…
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    return {
      id: typeof o.id === "string" && o.id ? o.id : fallbackId,
      text: typeof o.text === "string" ? o.text : String(o.text ?? ""),
      correct: Boolean(o.correct),
      imageUrl: typeof o.imageUrl === "string" ? o.imageUrl : undefined,
    };
  }
  // Legacy docs may store options as plain strings.
  return { id: fallbackId, text: raw == null ? "" : String(raw), correct: false };
}

function fromDoc(doc: DocumentSnapshot): Question {
  const data = doc.data() ?? {};
  return {
    id: doc.id,
    type: data.type === "mcq" ? "mcq" : "single",
    prompt: typeof data.prompt === "string" ? data.prompt : String(data.prompt ?? ""),
    options: Array.isArray(data.options)
      ? data.options.map((o: unknown, i: number) => toOption(o, i))
      : [],
    marks: Number(data.marks) || 0,
    negative: Number(data.negative) || 0,
    chapter:
      typeof data.chapter === "string"
        ? data.chapter
        : data.chapter == null
        ? undefined
        : String(data.chapter),
    imageUrl: typeof data.imageUrl === "string" ? data.imageUrl : undefined,
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
    options: toStoreOptions(q.options),
    marks: q.marks,
    negative: q.negative,
    createdAt: serverTimestamp(),
  };
  if (q.chapter) data.chapter = q.chapter;
  if (q.imageUrl) data.imageUrl = q.imageUrl;
  const ref = await addDoc(collection(db, COLLECTION), data);
  return { ...q, id: ref.id };
}

export async function fetchQuestion(id: string): Promise<Question | null> {
  const db = getFirestoreDb();
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return fromDoc(snap);
}

export async function updateQuestion(
  id: string,
  q: Omit<Question, "id" | "createdAt">
): Promise<Question> {
  const db = getFirestoreDb();
  const data: Record<string, unknown> = {
    type: q.type,
    prompt: q.prompt,
    options: toStoreOptions(q.options),
    marks: q.marks,
    negative: q.negative,
    chapter: q.chapter || deleteField(),
    imageUrl: q.imageUrl || deleteField(),
  };
  await setDoc(doc(db, COLLECTION, id), data, { merge: true });
  return { ...q, id };
}

export async function deleteQuestion(id: string): Promise<void> {
  const db = getFirestoreDb();
  await deleteDoc(doc(db, COLLECTION, id));
}
