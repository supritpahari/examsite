import { getFirestoreDb } from "./firebase/client";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

export interface AttemptAnswer {
  questionId: string;
  chosen: number | null;
  chosenOptionId: string | null;
  correctOptionId: string;
  correct: boolean;
  marks: number;
}

export interface Attempt {
  id: string;
  examId: string;
  examCode: string;
  studentName: string;
  sessionId: string;
  score: number;
  total: number;
  correct: number;
  wrong: number;
  unattempted: number;
  answers: AttemptAnswer[];
  startedAt?: number;
  submittedAt: number;
  createdAt?: unknown;
}

const COLLECTION = "attempts";

function fromDoc(d: QueryDocumentSnapshot): Attempt {
  const data = d.data();
  return {
    id: d.id,
    examId: data.examId ?? "",
    examCode: data.examCode ?? "",
    studentName: data.studentName ?? "Anonymous",
    sessionId: data.sessionId ?? "",
    score: data.score ?? 0,
    total: data.total ?? 0,
    correct: data.correct ?? 0,
    wrong: data.wrong ?? 0,
    unattempted: data.unattempted ?? 0,
    answers: Array.isArray(data.answers) ? (data.answers as AttemptAnswer[]) : [],
    startedAt: data.startedAt,
    submittedAt: data.submittedAt ?? 0,
    createdAt: data.createdAt,
  };
}

export async function saveAttempt(
  attempt: Omit<Attempt, "id" | "createdAt">
): Promise<Attempt> {
  const db = getFirestoreDb();
  const data: Record<string, unknown> = {
    examId: attempt.examId,
    examCode: attempt.examCode,
    studentName: attempt.studentName,
    sessionId: attempt.sessionId,
    score: attempt.score,
    total: attempt.total,
    correct: attempt.correct,
    wrong: attempt.wrong,
    unattempted: attempt.unattempted,
    answers: attempt.answers,
    startedAt: attempt.startedAt ?? null,
    submittedAt: attempt.submittedAt,
    createdAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, COLLECTION), data);
  return { ...attempt, id: ref.id };
}

export async function fetchAttemptsByExam(examId: string): Promise<Attempt[]> {
  const db = getFirestoreDb();
  const snap = await getDocs(
    query(collection(db, COLLECTION), where("examId", "==", examId))
  );
  const items = snap.docs.map(fromDoc);
  items.sort((a, b) => b.submittedAt - a.submittedAt);
  return items;
}

export async function deleteAttemptsByExam(examId: string): Promise<void> {
  const db = getFirestoreDb();
  const snap = await getDocs(
    query(collection(db, COLLECTION), where("examId", "==", examId))
  );
  for (const d of snap.docs) {
    await deleteDoc(doc(db, COLLECTION, d.id));
  }
}

export interface ExamAttemptSummary {
  examId: string;
  attempts: Attempt[];
  count: number;
  avgScore: number;
}

export async function fetchAllAttemptSummaries(): Promise<
  Record<string, ExamAttemptSummary>
> {
  const db = getFirestoreDb();
  const snap = await getDocs(collection(db, COLLECTION));
  const byExam = new Map<string, Attempt[]>();
  for (const d of snap.docs) {
    const a = fromDoc(d);
    if (!a.examId) continue;
    if (!byExam.has(a.examId)) byExam.set(a.examId, []);
    byExam.get(a.examId)!.push(a);
  }
  const result: Record<string, ExamAttemptSummary> = {};
  for (const [examId, attempts] of byExam.entries()) {
    attempts.sort((x, y) => y.submittedAt - x.submittedAt);
    const avgScore =
      attempts.length > 0
        ? Math.round(
            (attempts.reduce(
              (sum, a) => sum + (a.total > 0 ? (a.score / a.total) * 100 : 0),
              0
            ) /
              attempts.length) *
              10
          ) / 10
        : 0;
    result[examId] = { examId, attempts, count: attempts.length, avgScore };
  }
  return result;
}

export async function fetchAttempt(id: string): Promise<Attempt | null> {
  const db = getFirestoreDb();
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return fromDoc(snap as QueryDocumentSnapshot);
}

export async function hasAttemptBySession(
  examId: string,
  sessionId: string
): Promise<boolean> {
  if (!sessionId) return false;
  const existing = await fetchAttemptsByExam(examId);
  return existing.some((a) => a.sessionId === sessionId);
}

export async function hasAttemptByName(
  examId: string,
  studentName: string
): Promise<boolean> {
  const trimmed = studentName.trim().toLowerCase();
  if (!trimmed) return false;
  const existing = await fetchAttemptsByExam(examId);
  return existing.some(
    (a) => a.studentName.trim().toLowerCase() === trimmed
  );
}
