import { NextRequest, NextResponse } from "next/server";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
} from "firebase/storage";
import { getFirebaseApp, getFirestoreDb } from "@/lib/firebase/client";

const FIREBASE_API_KEY =
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCmpBbUxyPr0S5Nx6NnPbJI3vmRRuAiz74";

const COLLECTION = "formula-sheets";
const STORAGE_ROOT = "formula-sheets";

/** Verify a Firebase ID token via the Identity Toolkit lookup endpoint. */
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
    if (!data.users?.[0]?.localId) return null;
    return data.users[0].localId;
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
    "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "access-control-allow-headers": "Content-Type, Authorization",
  };
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: cors() });
}

function objectPathFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/o\/(.+)/);
    if (!m) return null;
    return decodeURIComponent(m[1]);
  } catch {
    return null;
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors() });
}

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const uid = await verifyIdToken(bearerToken(req) ?? "");
    if (!uid) {
      return jsonError("unauthenticated", 401);
    }

    const db = getFirestoreDb();
    const snap = await getDocs(collection(db, COLLECTION));
    const items = snap.docs.map((d) => {
      const x = d.data() ?? {};
      return {
        id: d.id,
        chapter: x.chapter ?? "",
        grade: x.grade ?? "",
        price: Number(x.price) || 0,
        title: x.title ?? "",
        pdfUrl: x.pdfUrl ?? "",
        pdfName: x.pdfName ?? "",
        fileSize: Number(x.fileSize) || 0,
        uploadedBy: x.uploadedBy ?? "",
        createdAt: x.createdAt,
        updatedAt: x.updatedAt,
      };
    });
    items.sort((a, b) => {
      const ta = (a.createdAt as { seconds?: number } | undefined)?.seconds ?? 0;
      const tb = (b.createdAt as { seconds?: number } | undefined)?.seconds ?? 0;
      return tb - ta;
    });
    return NextResponse.json({ items }, { headers: cors() });
  } catch (err: unknown) {
    console.error("[GET /api/formula-sheets]", err);
    return jsonError(
      err instanceof Error ? err.message : "Internal server error",
      500
    );
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const uid = await verifyIdToken(bearerToken(req) ?? "");
    if (!uid) {
      return jsonError("unauthenticated", 401);
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const chapter = (form.get("chapter") as string) || "";
    const grade = (form.get("grade") as string) || "";
    const priceRaw = form.get("price") as string;
    const title = (form.get("title") as string) || "";

    if (!file) {
      return jsonError("file is required", 400);
    }
    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      return jsonError("only PDF files are allowed", 400);
    }
    if (!chapter || !grade) {
      return jsonError("chapter and grade are required", 400);
    }

    const storage = getStorage(getFirebaseApp());
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileRef = ref(storage, `${STORAGE_ROOT}/${Date.now()}_${safeName}`);
    const snap = await uploadBytes(fileRef, file);
    const pdfUrl = await getDownloadURL(snap.ref);

    const db = getFirestoreDb();
    const refDoc = await addDoc(collection(db, COLLECTION), {
      chapter,
      grade,
      price: Number(priceRaw) || 0,
      title: title || file.name.replace(/\.pdf$/i, ""),
      pdfUrl,
      pdfName: file.name,
      fileSize: file.size,
      uploadedBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return NextResponse.json(
      { id: refDoc.id, pdfUrl, pdfName: file.name },
      { status: 201, headers: cors() }
    );
  } catch (err: unknown) {
    console.error("[POST /api/formula-sheets]", err);
    return jsonError(
      err instanceof Error ? err.message : "Internal server error",
      500
    );
  }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  try {
    const uid = await verifyIdToken(bearerToken(req) ?? "");
    if (!uid) {
      return jsonError("unauthenticated", 401);
    }

    const form = await req.formData();
    const id = (form.get("id") as string) || "";
    if (!id) {
      return jsonError("id is required", 400);
    }

    const db = getFirestoreDb();
    const existingSnap = await getDoc(doc(db, COLLECTION, id));
    if (!existingSnap.exists()) {
      return jsonError("not found", 404);
    }

    const stored: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
      uploadedBy: uid,
    };

    const chapter = form.get("chapter") as string | null;
    const grade = form.get("grade") as string | null;
    const priceRaw = form.get("price") as string | null;
    const title = form.get("title") as string | null;
    if (chapter !== null) stored.chapter = chapter;
    if (grade !== null) stored.grade = grade;
    if (priceRaw !== null) stored.price = Number(priceRaw) || 0;
    if (title !== null) stored.title = title;

    const file = form.get("file") as File | null;
    let pdfUrl = existingSnap.data()?.pdfUrl as string | undefined;
    let pdfName = existingSnap.data()?.pdfName as string | undefined;
    let fileSize = existingSnap.data()?.fileSize as number | undefined;

    if (file) {
      const oldUrl = existingSnap.data()?.pdfUrl as string | undefined;
      if (oldUrl) {
        const path = objectPathFromUrl(oldUrl);
        if (path) {
          try {
            await deleteObject(
              ref(getStorage(getFirebaseApp()), path)
            );
          } catch {
            /* ignore */
          }
        }
      }
      const storage = getStorage(getFirebaseApp());
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileRef = ref(storage, `${STORAGE_ROOT}/${Date.now()}_${safeName}`);
      const snap = await uploadBytes(fileRef, file);
      pdfUrl = await getDownloadURL(snap.ref);
      pdfName = file.name;
      fileSize = file.size;
    }
    if (pdfUrl !== undefined) stored.pdfUrl = pdfUrl;
    if (pdfName !== undefined) stored.pdfName = pdfName;
    if (fileSize !== undefined) stored.fileSize = fileSize;

    await setDoc(doc(db, COLLECTION, id), stored, { merge: true });
    return NextResponse.json({ ok: true }, { headers: cors() });
  } catch (err: unknown) {
    console.error("[PATCH /api/formula-sheets]", err);
    return jsonError(
      err instanceof Error ? err.message : "Internal server error",
      500
    );
  }
}

export async function DELETE(req: NextRequest): Promise<Response> {
  try {
    const uid = await verifyIdToken(bearerToken(req) ?? "");
    if (!uid) {
      return jsonError("unauthenticated", 401);
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id") || "";
    if (!id) {
      return jsonError("id is required", 400);
    }

    const db = getFirestoreDb();
    const existingSnap = await getDoc(doc(db, COLLECTION, id));
    if (existingSnap.exists()) {
      const oldUrl = existingSnap.data()?.pdfUrl as string | undefined;
      if (oldUrl) {
        const path = objectPathFromUrl(oldUrl);
        if (path) {
          try {
            await deleteObject(ref(getStorage(getFirebaseApp()), path));
          } catch {
            /* ignore */
          }
        }
      }
    }

    await deleteDoc(doc(db, COLLECTION, id));
    return NextResponse.json({ ok: true }, { headers: cors() });
  } catch (err: unknown) {
    console.error("[DELETE /api/formula-sheets]", err);
    return jsonError(
      err instanceof Error ? err.message : "Internal server error",
      500
    );
  }
}
