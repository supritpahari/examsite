import { NextRequest, NextResponse } from "next/server";
import { addDoc, collection } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase/client";

const RAZORPAY_KEY_ID =
  process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "";
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
    const { topicId, amount, courseId, gradeId, topicName, gradeName } = body;

    if (!topicId || !amount || !courseId || !gradeId) {
      return NextResponse.json(
        { error: "topicId, amount, courseId and gradeId are required" },
        { status: 400, headers: cors() }
      );
    }

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return NextResponse.json(
        { error: "Razorpay not configured" },
        { status: 500, headers: cors() }
      );
    }

    // Razorpay amount is in paise (smallest currency unit)
    const amountPaise = Math.round(Number(amount) * 100);

    const receipt = `rcpt_${uid}_${topicId}_${Date.now()}`;

    const authHeader = Buffer.from(
      `${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`
    ).toString("base64");

    const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt,
        notes: {
          uid,
          topicId,
          courseId,
          gradeId,
          topicName: topicName || "",
          gradeName: gradeName || "",
        },
      }),
    });

    if (!orderRes.ok) {
      const errorText = await orderRes.text();
      console.error("[Razorpay order creation failed]", {
        status: orderRes.status,
        statusText: orderRes.statusText,
        body: errorText,
        hasKeyId: !!RAZORPAY_KEY_ID,
        hasKeySecret: !!RAZORPAY_KEY_SECRET,
        keyIdPrefix: RAZORPAY_KEY_ID ? RAZORPAY_KEY_ID.slice(0, 8) + "..." : "none",
      });
      return NextResponse.json(
        { error: "Failed to create payment order", details: errorText.slice(0, 200) },
        { status: 500, headers: cors() }
      );
    }

    const order = await orderRes.json();

    // Store a pending purchase record so we can link the payment later
    const db = getFirestoreDb();
    await addDoc(collection(db, PURCHASES_COLLECTION), {
      courseId,
      topicId,
      gradeId,
      amount: Number(amount),
      status: "pending",
      userId: uid,
      razorpayOrderId: order.id,
      receipt,
      createdAt: new Date(),
    });

    return NextResponse.json(
      {
        orderId: order.id,
        amount: amountPaise,
        currency: "INR",
        key: RAZORPAY_KEY_ID,
      },
      { status: 200, headers: cors() }
    );
  } catch (err: unknown) {
    console.error("[POST /api/course/payment/create-order]", {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      hasKeyId: !!RAZORPAY_KEY_ID,
      hasKeySecret: !!RAZORPAY_KEY_SECRET,
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500, headers: cors() }
    );
  }
}
