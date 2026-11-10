/* Visitor tracking — unique visitors + online users.
 *
 * Unique visitors: a random visitorId is stored in localStorage and sent to
 * the server on first visit. The server creates one document per visitorId in
 * Firestore; total unique visitors = count of documents.
 * Online users: each page sends a heartbeat every 30s. A user is "online" if
 * their last heartbeat was within ONLINE_WINDOW_MS (5 minutes).
 */

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getFirestoreDb } from "./firebase/client";

const VISITOR_ID_KEY = "examsite_visitor_id";
const COLLECTION = "site-visitors";
const HEARTBEAT_INTERVAL_MS = 30_000;
const ONLINE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function generateVisitorId(): string {
  return (
    "v_" +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 12)
  );
}

export function getOrCreateVisitorId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(VISITOR_ID_KEY);
  if (!id) {
    id = generateVisitorId();
    try {
      window.localStorage.setItem(VISITOR_ID_KEY, id);
    } catch {
      /* localStorage may be blocked — fall back to session-only id */
    }
  }
  return id;
}

/** Called once per page visit to register the visitor. */
export async function registerVisitor(visitorId: string): Promise<void> {
  if (!visitorId) return;
  try {
    const db = getFirestoreDb();
    const ref = doc(collection(db, COLLECTION), visitorId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        visitorId,
        firstSeen: serverTimestamp(),
        lastSeen: serverTimestamp(),
      });
    } else {
      await setDoc(
        ref,
        { lastSeen: serverTimestamp() },
        { merge: true }
      );
    }
  } catch {
    /* stats must never break the page */
  }
}

/** Heartbeat — mark the visitor as currently online. */
export async function heartbeatVisitor(visitorId: string): Promise<void> {
  if (!visitorId) return;
  try {
    const db = getFirestoreDb();
    const ref = doc(collection(db, COLLECTION), visitorId);
    await setDoc(
      ref,
      { lastSeen: serverTimestamp() },
      { merge: true }
    );
  } catch {
    /* best effort */
  }
}

export interface SiteStats {
  totalVisitors: number;
  onlineUsers: number;
}

export async function fetchSiteStats(): Promise<SiteStats> {
  try {
    const db = getFirestoreDb();
    const snap = await getDocs(collection(db, COLLECTION));
    const now = Date.now();
    let online = 0;
    snap.docs.forEach((d) => {
      const data = d.data() as DocumentData;
      const lastSeen = data.lastSeen;
      let lastSeenMs = 0;
      if (lastSeen && typeof (lastSeen as { toDate?: () => Date }).toDate === "function") {
        lastSeenMs = (lastSeen as { toDate: () => Date }).toDate().getTime();
      } else if (typeof lastSeen === "number") {
        lastSeenMs = lastSeen;
      }
      if (now - lastSeenMs < ONLINE_WINDOW_MS) online += 1;
    });
    return { totalVisitors: snap.size, onlineUsers: online };
  } catch {
    return { totalVisitors: 0, onlineUsers: 0 };
  }
}

/** Client-side heartbeat hook. Returns a cleanup function. */
export function startHeartbeat(visitorId: string): () => void {
  if (typeof window === "undefined") return () => {};
  let timer: ReturnType<typeof setInterval> | null = null;

  async function beat() {
    await heartbeatVisitor(visitorId);
  }

  beat(); // immediate first beat
  timer = setInterval(beat, HEARTBEAT_INTERVAL_MS);

  return () => {
    if (timer) clearInterval(timer);
  };
}
