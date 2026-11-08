import { getFirestoreDb } from "./firebase/client";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  type DocumentSnapshot,
} from "firebase/firestore";

export interface CourseTopic {
  id: string;
  name: string;
  price: number; // in INR (whole rupees — as stored by the admin panel)
  pdfUrl: string; // public PDF URL (Firebase Storage / direct link)
  pdfName: string;
}

export interface CourseGrade {
  id: string;
  name: string; // e.g. "Class 11", "JEE Main", "NEET"
  topics: CourseTopic[];
}

export interface Purchase {
  id: string;
  courseId: string;
  topicId: string;
  gradeId: string;
  amount: number;
  status: "paid" | "pending" | "failed";
  paidAt: unknown;
  userId?: string; // Firebase UID if available
}

const GRADES_COLLECTION = "course-grades";
const PURCHASES_COLLECTION = "course-purchases";
const FORMULA_SHEETS_API = "/api/formula-sheets";

/* ------------------------------------------------------------------ *
 * Slug helper                                                        *
 * ------------------------------------------------------------------ */

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

/* ------------------------------------------------------------------ *
 * Fetch uploaded formula sheets from the API and organize by grade   *
 * ------------------------------------------------------------------ */

interface FormulaSheetItem {
  id: string;
  chapter: string;
  grade: string;
  price: number;
  title: string;
  pdfUrl: string;
  pdfName: string;
  fileSize: number;
  uploadedBy: string;
  createdAt: unknown;
  updatedAt: unknown;
}

/** Fetch all uploaded formula sheets from the public API, organized by grade.
 * Falls back to the static catalog if the API is unreachable. */
export async function fetchCourseGradesFromApi(): Promise<CourseGrade[]> {
  try {
    const res = await fetch(FORMULA_SHEETS_API, { cache: "no-store" });
    if (!res.ok) throw new Error(`API responded ${res.status}`);
    const data = (await res.json()) as { items: FormulaSheetItem[] };
    const items = data.items ?? [];

    const byGrade = new Map<string, CourseGrade>();
    for (const item of items) {
      const gradeName = item.grade || "Uncategorized";
      const gradeId = slugify(gradeName);
      let grade = byGrade.get(gradeId);
      if (!grade) {
        grade = { id: gradeId, name: gradeName, topics: [] };
        byGrade.set(gradeId, grade);
      }
      grade.topics.push({
        id: slugify(item.chapter || item.title || item.id),
        name: item.title || item.chapter || "Untitled",
        price: item.price,
        pdfUrl: item.pdfUrl,
        pdfName: item.pdfName || `${item.chapter || item.title}.pdf`,
      });
    }
    return Array.from(byGrade.values()).sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ *
 * Static catalog (fallback when API is unreachable)                  *
 * ------------------------------------------------------------------ */

export const COURSE_GRADES: CourseGrade[] = [
  {
    id: "class-11",
    name: "Class 11 (Physics)",
    topics: [
      {
        id: "mechanics",
        name: "Mechanics — Kinematics & Laws of Motion",
        price: 49,
        pdfUrl: "/pdfs/class-11-mechanics.pdf",
        pdfName: "Class 11 - Mechanics Formula Sheet.pdf",
      },
      {
        id: "thermodynamics",
        name: "Thermodynamics & Kinetic Theory",
        price: 49,
        pdfUrl: "/pdfs/class-11-thermodynamics.pdf",
        pdfName: "Class 11 - Thermodynamics Formula Sheet.pdf",
      },
      {
        id: "waves",
        name: "Waves & Oscillations",
        price: 39,
        pdfUrl: "/pdfs/class-11-waves.pdf",
        pdfName: "Class 11 - Waves Formula Sheet.pdf",
      },
    ],
  },
  {
    id: "class-12",
    name: "Class 12 (Physics)",
    topics: [
      {
        id: "electrostatics",
        name: "Electrostatics & Current Electricity",
        price: 59,
        pdfUrl: "/pdfs/class-12-electrostatics.pdf",
        pdfName: "Class 12 - Electrostatics Formula Sheet.pdf",
      },
      {
        id: "magnetism",
        name: "Magnetism & Electromagnetic Induction",
        price: 59,
        pdfUrl: "/pdfs/class-12-magnetism.pdf",
        pdfName: "Class 12 - Magnetism Formula Sheet.pdf",
      },
      {
        id: "optics",
        name: "Ray & Wave Optics",
        price: 49,
        pdfUrl: "/pdfs/class-12-optics.pdf",
        pdfName: "Class 12 - Optics Formula Sheet.pdf",
      },
      {
        id: "modern-physics",
        name: "Modern Physics & Semiconductors",
        price: 59,
        pdfUrl: "/pdfs/class-12-modern-physics.pdf",
        pdfName: "Class 12 - Modern Physics Formula Sheet.pdf",
      },
    ],
  },
  {
    id: "jee",
    name: "JEE Main & Advanced",
    topics: [
      {
        id: "jee-full",
        name: "JEE Complete Physics Formula Pack",
        price: 99,
        pdfUrl: "/pdfs/jee-full-physics.pdf",
        pdfName: "JEE Complete Physics Formula Pack.pdf",
      },
    ],
  },
  {
    id: "neet",
    name: "NEET UG",
    topics: [
      {
        id: "neet-full",
        name: "NEET Physics Formula Pack",
        price: 79,
        pdfUrl: "/pdfs/neet-full-physics.pdf",
        pdfName: "NEET Physics Formula Pack.pdf",
      },
    ],
  },
];

export function getGrade(id: string): CourseGrade | undefined {
  return COURSE_GRADES.find((g) => g.id === id);
}

export function getTopic(gradeId: string, topicId: string): CourseTopic | undefined {
  const grade = getGrade(gradeId);
  if (!grade) return undefined;
  return grade.topics.find((t) => t.id === topicId);
}

/** Look up a topic in the dynamic (API-fetched) catalog. */
export async function getTopicFromApi(
  gradeId: string,
  topicId: string
): Promise<CourseTopic | undefined> {
  const grades = await fetchCourseGradesFromApi();
  const grade = grades.find((g) => g.id === gradeId);
  if (!grade) return undefined;
  return grade.topics.find((t) => t.id === topicId);
}

/* ------------------------------------------------------------------ *
 * Purchases (Firestore)                                              *
 * ------------------------------------------------------------------ */

function fromDocPurchase(snap: DocumentSnapshot): Purchase {
  const d = snap.data() ?? {};
  return {
    id: snap.id,
    courseId: typeof d.courseId === "string" ? d.courseId : "",
    topicId: typeof d.topicId === "string" ? d.topicId : "",
    gradeId: typeof d.gradeId === "string" ? d.gradeId : "",
    amount: Number(d.amount) || 0,
    status: d.status === "paid" ? "paid" : d.status === "pending" ? "pending" : "failed",
    paidAt: d.paidAt,
    userId: typeof d.userId === "string" ? d.userId : undefined,
  };
}

/** Fetch only this user's paid purchases (scoped query — never the whole collection). */
export async function fetchPurchasesByUid(uid: string): Promise<Purchase[]> {
  const db = getFirestoreDb();
  const snap = await getDocs(
    query(
      collection(db, PURCHASES_COLLECTION),
      where("userId", "==", uid),
      where("status", "==", "paid")
    )
  );
  return snap.docs.map(fromDocPurchase);
}

export async function fetchPurchases(): Promise<Purchase[]> {
  const db = getFirestoreDb();
  const snap = await getDocs(collection(db, PURCHASES_COLLECTION));
  return snap.docs.map(fromDocPurchase);
}

export async function recordPurchase(
  data: Omit<Purchase, "id" | "paidAt"> & { userId?: string }
): Promise<Purchase> {
  const db = getFirestoreDb();
  const ref = await addDoc(collection(db, PURCHASES_COLLECTION), {
    courseId: data.courseId,
    topicId: data.topicId,
    gradeId: data.gradeId,
    amount: data.amount,
    status: "paid",
    paidAt: serverTimestamp(),
    userId: data.userId ?? null,
  });
  return { ...data, id: ref.id, status: "paid", paidAt: null } as Purchase;
}

export async function hasPurchased(topicId: string): Promise<boolean> {
  // Best-effort check: any paid purchase for this topic. In a real app you'd
  // scope this by the logged-in user (Firebase UID).
  try {
    const purchases = await fetchPurchases();
    return purchases.some((p) => p.topicId === topicId && p.status === "paid");
  } catch {
    return false;
  }
}
