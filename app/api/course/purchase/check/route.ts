import { NextRequest, NextResponse } from "next/server";
import { getDoc, getDocs, query, where, collection, doc } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase/client";

const FIREBASE_API_KEY =
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCmpBbUxyPr0S5Nx6NnPbJI3vmRRuAiz74";
const PURCHASES_COLLECTION = "course-purchases";

async function verifyIdToken(idToken: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(
        FIREBASE_API_KEY
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { users?: { localId?: string }[] };
    return data.users?.[0]?.localId ?? null;
  } catch {
    return null;
  }
}

function bearerToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

function cors() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "Content-Type, Authorization",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors() });
}

export async function GET(req: NextRequest): Promise<Response> {
  const uid = verifyIdToken(bearerToken(req) ?? "");
  if (!uid) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401, headers: cors() });
  }

  const { searchParams } = new URL(req.url);
  const topicId = searchParams.get("topicId") || "";
  if (!topicId) {
    return NextResponse.json({ error: "topicId is required" }, { status: 400, headers: cors() });
  }

  const db = getFirestoreDb();
  const q = query(
    collection(db, PURCHASES_COLLECTION),
    where("topicId", "==", topicId),
    where("status", "==", "paid")
  );
  const snap = await getDocs(q);
  return NextResponse.json({ purchased: snap.docs.length > 0 }, { headers: cors() });
}
