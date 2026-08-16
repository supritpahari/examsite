import { getFirestoreDb } from "./firebase/client";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

export type ExamStatus = "completed" | "scheduled" | "draft";

export interface Exam {
  id: string;
  title: string;
  subject: string;
  code: string;
  takenOn: string;
  status: ExamStatus;
  attempts: number;
  avgScore: number;
  duration: string;
  createdAt?: unknown;
}

const COLLECTION = "exams";

const EXAM_STATUSES: ExamStatus[] = ["completed", "scheduled", "draft"];

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : value == null ? fallback : String(value);
}

function fromDoc(d: QueryDocumentSnapshot): Exam {
  const data = d.data();
  return {
    id: d.id,
    title: asString(data.title, "Untitled Exam"),
    subject: asString(data.subject, "Mixed"),
    code: asString(data.code, ""),
    takenOn: asString(data.takenOn, "—"),
    status: EXAM_STATUSES.includes(data.status as ExamStatus)
      ? (data.status as ExamStatus)
      : "draft",
    attempts: Number(data.attempts) || 0,
    avgScore: Number(data.avgScore) || 0,
    duration: asString(data.duration, "—"),
    createdAt: data.createdAt,
  };
}

export async function fetchExamByCode(code: string): Promise<Exam | null> {
  if (!code) return null;
  const normalized = code.trim().toLowerCase();
  const exams = await fetchExams();
  return exams.find((e) => e.code.toLowerCase() === normalized) ?? null;
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
    code: exam.code,
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

export async function updateExam(
  id: string,
  patch: Partial<Omit<Exam, "id" | "createdAt">>
): Promise<Exam> {
  const db = getFirestoreDb();
  const ref = doc(db, COLLECTION, id);
  await updateDoc(ref, patch);
  return { ...(patch as Exam), id };
}

export interface ExamQuestion {
  id: string;
  examId: string;
  questionId: string;
  order: number;
  createdAt?: unknown;
}

export async function fetchExamQuestionIds(examId: string): Promise<string[]> {
  const db = getFirestoreDb();
  const snap = await getDocs(
    query(collection(db, "examQuestions"), where("examId", "==", examId))
  );
  return snap.docs
    .map((d) => ({ qid: d.data().questionId as string, order: d.data().order ?? 0 }))
    .sort((a, b) => a.order - b.order)
    .map((x) => x.qid);
}

export interface ExamQuestionLink {
  examId: string;
  questionId: string;
}

export async function fetchAllExamQuestionLinks(): Promise<ExamQuestionLink[]> {
  const db = getFirestoreDb();
  const snap = await getDocs(collection(db, "examQuestions"));
  return snap.docs.map((d) => ({
    examId: d.data().examId as string,
    questionId: d.data().questionId as string,
  }));
}

export async function deleteExamQuestions(examId: string): Promise<void> {
  const db = getFirestoreDb();
  const snap = await getDocs(
    query(collection(db, "examQuestions"), where("examId", "==", examId))
  );
  for (const d of snap.docs) {
    await deleteDoc(doc(db, "examQuestions", d.id));
  }
}

export async function deleteExamQuestionsByQuestion(
  questionId: string
): Promise<void> {
  const db = getFirestoreDb();
  const snap = await getDocs(
    query(collection(db, "examQuestions"), where("questionId", "==", questionId))
  );
  for (const d of snap.docs) {
    await deleteDoc(doc(db, "examQuestions", d.id));
  }
}

export async function setExamQuestions(
  examId: string,
  questionIds: string[]
): Promise<void> {
  const db = getFirestoreDb();
  const existing = await getDocs(
    query(collection(db, "examQuestions"), where("examId", "==", examId))
  );
  const existingIds = new Set(existing.docs.map((d) => d.data().questionId as string));
  for (const d of existing.docs) {
    if (!questionIds.includes(d.data().questionId as string)) {
      await deleteDoc(doc(db, "examQuestions", d.id));
    }
  }
  for (let i = 0; i < questionIds.length; i++) {
    const qid = questionIds[i];
    if (existingIds.has(qid)) continue;
    await addDoc(collection(db, "examQuestions"), {
      examId,
      questionId: qid,
      order: i,
      createdAt: serverTimestamp(),
    });
  }
}
