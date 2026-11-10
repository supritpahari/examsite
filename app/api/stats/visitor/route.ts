/* Visitor stats API.
 *
 * POST /api/stats/visitor — register or heartbeat a visitor.
 *   Body: { visitorId: string }
 * GET  /api/stats/visitor — return { totalVisitors, onlineUsers }.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase/client";

const COLLECTION = "site-visitors";
const ONLINE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function cors() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Content-Type",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors() });
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const { visitorId } = await req.json();
    if (!visitorId) {
      return NextResponse.json(
        { error: "visitorId is required" },
        { status: 400, headers: cors() }
      );
    }

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

    return NextResponse.json({ ok: true }, { headers: cors() });
  } catch (err: unknown) {
    console.error("[POST /api/stats/visitor]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500, headers: cors() }
    );
  }
}

export async function GET(): Promise<Response> {
  try {
    const db = getFirestoreDb();
    const snap = await getDocs(collection(db, COLLECTION));
    const now = Date.now();
    let online = 0;
    snap.docs.forEach((d) => {
      const data = d.data();
      const lastSeen = data.lastSeen;
      let lastSeenMs = 0;
      if (lastSeen && typeof (lastSeen as { toDate?: () => Date }).toDate === "function") {
        lastSeenMs = (lastSeen as { toDate: () => Date }).toDate().getTime();
      } else if (typeof lastSeen === "number") {
        lastSeenMs = lastSeen;
      }
      if (now - lastSeenMs < ONLINE_WINDOW_MS) online += 1;
    });
    return NextResponse.json(
      { totalVisitors: snap.size, onlineUsers: online },
      { headers: cors() }
    );
  } catch (err: unknown) {
    console.error("[GET /api/stats/visitor]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500, headers: cors() }
    );
  }
}
