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

export type ExamStatus = "completed" | "scheduled" | "draft" | "stopped";

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


/** Pad two digits. */
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Format a local Date as the value a <input type="datetime-local"> expects. */
export function toLocalInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Current local date/time in datetime-local format. */
export function todayIsoLocal(): string {
  return toLocalInputValue(new Date());
}

/**
 * Best-effort conversion of a stored takenOn value (ISO local string,
 * legacy "Nov 08, 2026", etc.) into datetime-local input format.
 */
export function toIsoLocal(value: string): string {
  if (!value || value === "—") return "";
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`;
  const t = Date.parse(value);
  if (Number.isNaN(t)) return "";
  return toLocalInputValue(new Date(t));
}

/**
 * Parse a stored takenOn value (ISO local "2026-11-08T18:30", or legacy
 * free text like "Nov 08, 2026") into a Date. Returns null when missing/unparseable.
 */
export function parseTakenOn(value: string): Date | null {
  if (!value || value === "—") return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const d = new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4]),
      Number(m[5]),
      Number(m[6] ?? 0)
    );
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : new Date(t);
}

/** Display format for a stored takenOn value — ISO input becomes "8 Nov 2026, 6:30 pm". */
export function formatTakenOn(value: string): string {
  if (!value || value === "—") return "—";
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return value; // legacy free-text — show as stored
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const COLLECTION = "exams";

const EXAM_STATUSES: ExamStatus[] = ["completed", "scheduled", "draft", "stopped"];

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
  questionIds: string[],
  marksMap: Record<string, number> = {},
  negativeMap: Record<string, number> = {}
): Promise<void> {
  const db = getFirestoreDb();
  const existing = await getDocs(
    query(collection(db, "examQuestions"), where("examId", "==", examId))
  );
  const byQid = new Map(existing.docs.map((d) => [d.data().questionId as string, d]));
  for (const d of existing.docs) {
    if (!questionIds.includes(d.data().questionId as string)) {
      await deleteDoc(doc(db, "examQuestions", d.id));
    }
  }
  for (let i = 0; i < questionIds.length; i++) {
    const qid = questionIds[i];
    const marks = Number(marksMap[qid]) || 0;
    const negative = Number(negativeMap[qid]) || 0;
    const existingDoc = byQid.get(qid);
    if (existingDoc) {
      await updateDoc(doc(db, "examQuestions", existingDoc.id), {
        order: i,
        marks,
        negative,
      });
      continue;
    }
    await addDoc(collection(db, "examQuestions"), {
      examId,
      questionId: qid,
      order: i,
      marks,
      negative,
      createdAt: serverTimestamp(),
    });
  }
}

export interface ExamQuestionMarks {
  marks: number;
  negative: number;
}

export async function fetchExamQuestionMarks(
  examId: string
): Promise<Record<string, ExamQuestionMarks>> {
  const db = getFirestoreDb();
  const snap = await getDocs(
    query(collection(db, "examQuestions"), where("examId", "==", examId))
  );
  const config: Record<string, ExamQuestionMarks> = {};
  for (const d of snap.docs) {
    const qid = d.data().questionId as string;
    config[qid] = {
      marks: Number(d.data().marks) || 0,
      negative: Number(d.data().negative) || 0,
    };
  }
  return config;
}
