import { NextRequest, NextResponse } from "next/server";
import {
  collection,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase/client";
import crypto from "crypto";

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";
const PURCHASES_COLLECTION = "course-purchases";

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
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Content-Type, Authorization",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors() });
}

export async function POST(req: NextRequest): Promise<Response> {
  const uid = await verifyIdToken(bearerToken(req) ?? "");
  if (!uid) {
    return NextResponse.json(
      { error: "unauthenticated" },
      { status: 401, headers: cors() }
    );
  }

  try {
    const body = await req.json();
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
    } = body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return NextResponse.json(
        { error: "razorpay_payment_id, razorpay_order_id and razorpay_signature are required" },
        { status: 400, headers: cors() }
      );
    }

    if (!RAZORPAY_KEY_SECRET) {
      return NextResponse.json(
        { error: "Razorpay not configured" },
        { status: 500, headers: cors() }
      );
    }

    // Verify Razorpay signature: HMAC SHA256 of (order_id + "|" + payment_id) with key_secret
    const bodyStr = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", RAZORPAY_KEY_SECRET)
      .update(bodyStr)
      .digest("hex");

    const db = getFirestoreDb();

    if (expectedSignature !== razorpay_signature) {
      // Mark the pending purchase as failed
      const q = query(
        collection(db, PURCHASES_COLLECTION),
        where("razorpayOrderId", "==", razorpay_order_id),
        where("userId", "==", uid)
      );
      const snap = await getDocs(q);
      for (const doc of snap.docs) {
        await updateDoc(doc.ref, {
          status: "failed",
          razorpayPaymentId: razorpay_payment_id,
          updatedAt: new Date(),
        });
      }

      return NextResponse.json(
        { error: "Invalid payment signature" },
        { status: 400, headers: cors() }
      );
    }

    // Signature valid — update the pending purchase to paid
    const q = query(
      collection(db, PURCHASES_COLLECTION),
      where("razorpayOrderId", "==", razorpay_order_id),
      where("userId", "==", uid),
      where("status", "==", "pending")
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      return NextResponse.json(
        { error: "No pending purchase found for this order" },
        { status: 404, headers: cors() }
      );
    }

    const updates: Promise<void>[] = [];
    for (const doc of snap.docs) {
      updates.push(
        updateDoc(doc.ref, {
          status: "paid",
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          paidAt: new Date(),
          updatedAt: new Date(),
        })
      );
    }
    await Promise.all(updates);

    return NextResponse.json(
      { ok: true, orderId: razorpay_order_id, paymentId: razorpay_payment_id },
      { status: 200, headers: cors() }
    );
  } catch (err: unknown) {
    console.error("[POST /api/course/payment/verify]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500, headers: cors() }
    );
  }
}
