import { NextRequest, NextResponse } from "next/server";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase/client";

const COLLECTION = "coupons";
const FIREBASE_API_KEY =
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCmpBbUxyPr0S5Nx6NnPbJI3vmRRuAiz74";

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
    "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
    "access-control-allow-headers": "Content-Type, Authorization",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors() });
}

export async function GET(req: NextRequest): Promise<Response> {
  const uid = await verifyIdToken(bearerToken(req) ?? "");
  if (!uid) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401, headers: cors() });
  }

  try {
    const db = getFirestoreDb();
    const snap = await getDocs(collection(db, COLLECTION));
    const coupons = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        code: data.code ?? "",
        discountType: data.discountType ?? "percent",
        discountValue: data.discountValue ?? 0,
        minAmount: data.minAmount ?? null,
        maxDiscount: data.maxDiscount ?? null,
        active: data.active ?? true,
        expiresAt: data.expiresAt ?? null,
        usesLeft: data.usesLeft ?? null,
        createdAt: data.createdAt,
      };
    });
    return NextResponse.json({ coupons }, { headers: cors() });
  } catch (err: unknown) {
    console.error("[GET /api/coupons]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500, headers: cors() }
    );
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const uid = await verifyIdToken(bearerToken(req) ?? "");
  if (!uid) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401, headers: cors() });
  }

  try {
    const body = await req.json();
    const { code, discountType, discountValue, minAmount, maxDiscount, active, expiresAt, usesLeft } = body;

    if (!code || !discountType || discountValue === undefined) {
      return NextResponse.json(
        { error: "code, discountType and discountValue are required" },
        { status: 400, headers: cors() }
      );
    }

    if (!["percent", "fixed"].includes(discountType)) {
      return NextResponse.json(
        { error: "discountType must be 'percent' or 'fixed'" },
        { status: 400, headers: cors() }
      );
    }

    const db = getFirestoreDb();
    const ref = await addDoc(collection(db, COLLECTION), {
      code: String(code).toUpperCase().trim(),
      discountType,
      discountValue: Number(discountValue),
      minAmount: minAmount !== undefined ? Number(minAmount) : null,
      maxDiscount: maxDiscount !== undefined ? Number(maxDiscount) : null,
      active: active !== false,
      expiresAt: expiresAt ?? null,
      usesLeft: usesLeft !== undefined ? Number(usesLeft) : null,
      createdAt: serverTimestamp(),
    });

    return NextResponse.json({ id: ref.id, ok: true }, { status: 201, headers: cors() });
  } catch (err: unknown) {
    console.error("[POST /api/coupons]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500, headers: cors() }
    );
  }
}

export async function PUT(req: NextRequest): Promise<Response> {
  const uid = await verifyIdToken(bearerToken(req) ?? "");
  if (!uid) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401, headers: cors() });
  }

  try {
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400, headers: cors() });
    }

    const db = getFirestoreDb();
    await setDoc(doc(db, COLLECTION, id), data, { merge: true });

    return NextResponse.json({ ok: true }, { headers: cors() });
  } catch (err: unknown) {
    console.error("[PUT /api/coupons]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500, headers: cors() }
    );
  }
}

export async function DELETE(req: NextRequest): Promise<Response> {
  const uid = await verifyIdToken(bearerToken(req) ?? "");
  if (!uid) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401, headers: cors() });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400, headers: cors() });
    }

    const db = getFirestoreDb();
    await deleteDoc(doc(db, COLLECTION, id));

    return NextResponse.json({ ok: true }, { headers: cors() });
  } catch (err: unknown) {
    console.error("[DELETE /api/coupons]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500, headers: cors() }
    );
  }
}
