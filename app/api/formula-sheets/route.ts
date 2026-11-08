import { NextResponse } from "next/server";
import { collection, getDocs } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase/client";

const COLLECTION = "formula-sheets";

function cors() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "Content-Type",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors() });
}

/** Public catalog feed — used by /course to build the grade list. Read-only. */
export async function GET() {
  try {
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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500, headers: cors() }
    );
  }
}
