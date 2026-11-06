import { getFirestoreDb } from "./firebase/client";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  type DocumentSnapshot,
} from "firebase/firestore";

export interface CourseTopic {
  id: string;
  name: string;
  price: number; // in INR (minor units / paise)
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

/* ------------------------------------------------------------------ *
 * Static catalog (single source of truth for grades/topics/prices)   *
 * ------------------------------------------------------------------ */

export const COURSE_GRADES: CourseGrade[] = [
  {
    id: "class-11",
    name: "Class 11 (Physics)",
    topics: [
      {
        id: "mechanics",
        name: "Mechanics — Kinematics & Laws of Motion",
        price: 4900,
        pdfUrl: "/pdfs/class-11-mechanics.pdf",
        pdfName: "Class 11 - Mechanics Formula Sheet.pdf",
      },
      {
        id: "thermodynamics",
        name: "Thermodynamics & Kinetic Theory",
        price: 4900,
        pdfUrl: "/pdfs/class-11-thermodynamics.pdf",
        pdfName: "Class 11 - Thermodynamics Formula Sheet.pdf",
      },
      {
        id: "waves",
        name: "Waves & Oscillations",
        price: 3900,
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
        price: 5900,
        pdfUrl: "/pdfs/class-12-electrostatics.pdf",
        pdfName: "Class 12 - Electrostatics Formula Sheet.pdf",
      },
      {
        id: "magnetism",
        name: "Magnetism & Electromagnetic Induction",
        price: 5900,
        pdfUrl: "/pdfs/class-12-magnetism.pdf",
        pdfName: "Class 12 - Magnetism Formula Sheet.pdf",
      },
      {
        id: "optics",
        name: "Ray & Wave Optics",
        price: 4900,
        pdfUrl: "/pdfs/class-12-optics.pdf",
        pdfName: "Class 12 - Optics Formula Sheet.pdf",
      },
      {
        id: "modern-physics",
        name: "Modern Physics & Semiconductors",
        price: 5900,
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
        price: 9900,
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
        price: 7900,
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
