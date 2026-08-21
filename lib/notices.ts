import { getFirestoreDb } from "./firebase/client";
import { doc, getDoc, setDoc, serverTimestamp, deleteField } from "firebase/firestore";

// ---- Block types ----
export type NoticeBlockType = "heading" | "text" | "image" | "button" | "divider" | "spacer";

export type TextAlign = "left" | "center" | "right";

export interface NoticeBlockStyle {
  // Text / heading
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: TextAlign;
  color?: string;        // any CSS color — hex, rgb(), var(), etc. Empty = inherit.
  bgColor?: string;      // background tint for the whole block
  fontSize?: "sm" | "base" | "lg" | "xl" | "2xl" | "3xl";
  // Button specific
  btnBg?: string;
  btnColor?: string;
  btnAlign?: TextAlign;
  // Image
  imgMaxH?: number;      // px
  imgAlign?: TextAlign;
  // Spacer
  spacerH?: number;      // px
}

export type NoticeButtonAction =
  | { kind: "link"; url: string; newTab?: boolean }
  | { kind: "tab"; tab: NoticeTabTarget };

// Tab targets correspond to keys in the admin NAV array.
export type NoticeTabTarget =
  | "notices"
  | "questions"
  | "exams"
  | "students"
  | "information"
  | "settings";

export const NOTICE_TAB_TARGETS: { value: NoticeTabTarget; label: string }[] = [
  { value: "notices", label: "Notices" },
  { value: "questions", label: "Questions" },
  { value: "exams", label: "Exams" },
  { value: "students", label: "Students" },
  { value: "information", label: "Information" },
  { value: "settings", label: "Settings" },
];

export interface NoticeBlock {
  id: string;
  type: NoticeBlockType;
  // Shared content
  content?: string;        // text/heading HTML-ish content (we store a tiny custom rich-text format)
  // Image
  imageUrl?: string;
  imageAlt?: string;
  // Button
  btnLabel?: string;
  action?: NoticeButtonAction;
  // Styling
  style?: NoticeBlockStyle;
}

export interface Notice {
  title: string;
  blocks: NoticeBlock[];
  publishedAt?: unknown;
  publishedBy?: string;
}

const COLLECTION = "settings";
const DOC = "notice";

const EMPTY_NOTICE: Notice = { title: "", blocks: [] };

export async function loadNotice(): Promise<Notice> {
  try {
    const db = getFirestoreDb();
    const snap = await getDoc(doc(db, COLLECTION, DOC));
    if (snap.exists()) {
      const data = snap.data() as Partial<Notice> & { blocks?: unknown };
      const blocks = Array.isArray(data.blocks)
        ? (data.blocks as NoticeBlock[]).filter((b) => b && typeof b === "object" && b.type)
        : [];
      return {
        title: typeof data.title === "string" ? data.title : "",
        blocks,
        publishedAt: data.publishedAt,
        publishedBy: typeof data.publishedBy === "string" ? data.publishedBy : undefined,
      };
    }
  } catch {
    /* fall through */
  }
  return { ...EMPTY_NOTICE };
}

export async function saveNotice(
  notice: Omit<Notice, "publishedAt"> & { publishedBy?: string }
): Promise<void> {
  const db = getFirestoreDb();
  // Strip undefined fields and any blocks with no meaningful content so
  // Firestore doesn't store nulls that confuse fromDoc later.
  const cleanBlocks = notice.blocks
    .map((b) => {
      const out: Record<string, unknown> = { id: b.id, type: b.type };
      if (b.content !== undefined) out.content = b.content;
      if (b.imageUrl !== undefined) out.imageUrl = b.imageUrl;
      if (b.imageAlt !== undefined) out.imageAlt = b.imageAlt;
      if (b.btnLabel !== undefined) out.btnLabel = b.btnLabel;
      if (b.action !== undefined) out.action = b.action;
      if (b.style && Object.keys(b.style).length) out.style = b.style;
      return out as unknown as NoticeBlock;
    })
    .filter(
      (b) =>
        b.type === "divider" ||
        b.type === "spacer" ||
        (b.type === "image" && b.imageUrl) ||
        (b.type === "button" && b.btnLabel) ||
        ((b.type === "text" || b.type === "heading") && (b.content || "").trim().length > 0)
    );

  await setDoc(
    doc(db, COLLECTION, DOC),
    {
      title: notice.title.trim() || "",
      blocks: cleanBlocks,
      publishedBy: notice.publishedBy || deleteField(),
      publishedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function clearNotice(): Promise<void> {
  const db = getFirestoreDb();
  // Replace doc with an empty notice — safe, keeps the doc alive.
  await setDoc(doc(db, COLLECTION, DOC), {
    title: "",
    blocks: [],
    publishedBy: deleteField(),
    publishedAt: deleteField(),
  });
}

export function hasContent(n: Notice | null | undefined): boolean {
  if (!n) return false;
  return n.blocks.some((b) => {
    if (b.type === "divider" || b.type === "spacer") return false;
    if (b.type === "image") return Boolean(b.imageUrl);
    if (b.type === "button") return Boolean(b.btnLabel);
    return (b.content || "").trim().length > 0;
  });
}

export function makeBlockId(): string {
  return "blk_" + Math.random().toString(36).slice(2, 10);
}

export function newBlock(type: NoticeBlockType): NoticeBlock {
  const base: NoticeBlock = { id: makeBlockId(), type };
  switch (type) {
    case "heading":
      return {
        ...base,
        content: "",
        style: { fontSize: "2xl", bold: true, align: "left" },
      };
    case "text":
      return { ...base, content: "", style: { fontSize: "base", align: "left" } };
    case "image":
      return {
        ...base,
        imageUrl: "",
        imageAlt: "",
        style: { imgAlign: "center", imgMaxH: 240 },
      };
    case "button":
      return {
        ...base,
        btnLabel: "Click me",
        action: { kind: "link", url: "#", newTab: true },
        style: { btnAlign: "left" },
      };
    case "divider":
      return base;
    case "spacer":
      return { ...base, style: { spacerH: 24 } };
  }
}
