import { NextResponse } from "next/server";

/**
 * Same-origin image proxy for the question-paper PDF export.
 *
 * Admin-uploaded question/option images are hosted on ImgBB (cross-origin
 * `i.ibb.co`). Browsers refuse to read cross-origin image bytes unless the host
 * emits `Access-Control-Allow-Origin`, which we cannot control. This route
 * fetches the image server-side (no browser CORS restriction) and re-serves it
 * with open CORS headers so `fetch` + `doc.addImage` works client-side.
 *
 * Security: only http/https image URLs are fetched, private/local addresses are
 * blocked (SSRF protection), and responses are size- and time-limited.
 */

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const TIMEOUT_MS = 20000;
const IMAGE_EXTS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "bmp",
  "avif",
  "svg",
  "svgz",
]);

function corsHeaders(): Record<string, string> {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "Content-Type",
  };
}

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "0.0.0.0") return true;
  if (h.endsWith(".localhost")) return true;
  if (h.startsWith("169.254.")) return true; // link-local
  if (h.startsWith("10.") || h.startsWith("192.168.")) return true; // private IPv4
  if (h.startsWith("172.")) {
    const parts = h.split(".");
    if (parts.length >= 2) {
      const second = Number(parts[1]);
      if (!Number.isNaN(second) && second >= 16 && second <= 31) return true;
    }
  }
  return false;
}

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "missing `url` query parameter" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "invalid `url`" }, { status: 400 });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "only http/https URLs are supported" }, { status: 400 });
  }

  if (isBlockedHost(parsed.hostname)) {
    return NextResponse.json(
      { error: "refusing to fetch private or local address" },
      { status: 403 }
    );
  }

  let res: Response;
  try {
    res = await fetch(parsed.toString(), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "follow",
      headers: { "User-Agent": "examsite-image-proxy/1.0" },
    });
  } catch {
    return NextResponse.json({ error: "failed to fetch image" }, { status: 502 });
  }

  if (!res.ok) {
    return NextResponse.json({ error: `upstream responded ${res.status}` }, { status: 502 });
  }

  const contentType = res.headers.get("content-type") || "";
  const isImageByType = contentType.startsWith("image/");
  const ext = parsed.pathname.split(".").pop()?.toLowerCase() ?? "";
  const isImageByExt = IMAGE_EXTS.has(ext);
  if (!isImageByType && !isImageByExt) {
    return NextResponse.json({ error: "upstream did not serve an image" }, { status: 400 });
  }

  const ab = await res.arrayBuffer();
  if (ab.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "image too large" }, { status: 413 });
  }

  return new NextResponse(ab, {
    status: 200,
    headers: {
      "content-type": isImageByType ? contentType : `image/${ext === "jpg" ? "jpeg" : ext}`,
      ...corsHeaders(),
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}

export async function OPTIONS(): Promise<Response> {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  });
}
