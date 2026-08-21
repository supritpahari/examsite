"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Question, QuestionOption as Option, QuestionType } from "@/lib/questions";
import { MathPreview } from "../shared";

const PLACEHOLDER = "Type using LaTeX-style syntax: $x^2$, $\\frac{a}{b}$, $\\vec{v}$, $\\sqrt{x}$";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB — ImgBB free tier allows up to 32 MB but 5 MB is plenty for question images
const IMBB_ENDPOINT = "https://api.imgbb.com/1/upload?key=4125525efeb9a21fe49db324919cdeaf";

interface ToolItem {
  label: string;
  title: string;
  snippet: string;
  wrap?: boolean;
}

const TOOLBAR: ToolItem[] = [
  { label: "x²", title: "Exponent", snippet: "^{}", wrap: true },
  { label: "x₂", title: "Subscript", snippet: "_{}", wrap: true },
  { label: "√", title: "Square root", snippet: "\\sqrt{}", wrap: true },
  { label: "a/b", title: "Fraction", snippet: "\\frac{}{}", wrap: true },
  { label: "v⃗", title: "Vector", snippet: "\\vec{}", wrap: true },
  { label: "î", title: "Unit vector (cap)", snippet: "\\hat{}", wrap: true },
  { label: "∫", title: "Integral", snippet: "\\int_{}^{} " },
  { label: "∑", title: "Summation", snippet: "\\sum_{}^{} " },
  { label: "lim", title: "Limit", snippet: "\\lim_{x \\to } " },
  { label: "α", title: "Alpha", snippet: "\\alpha " },
  { label: "β", title: "Beta", snippet: "\\beta " },
  { label: "θ", title: "Theta", snippet: "\\theta " },
  { label: "π", title: "Pi", snippet: "\\pi " },
  { label: "Δ", title: "Delta", snippet: "\\Delta " },
  { label: "∞", title: "Infinity", snippet: "\\infty " },
  { label: "$…$", title: "Math mode", snippet: "$ $", wrap: true },
];

type UploadStatus = "idle" | "uploading" | "error";

function insertAtCursor(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string,
  setValue: (v: string) => void,
  snippet: string,
  wrap: boolean
) {
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  const selected = value.slice(start, end);
  let insert = snippet;
  let caret = start + snippet.length;
  if (wrap) {
    const innerOpen = snippet.indexOf("{") + 1;
    insert = snippet.replace("{}", `{${selected}}`);
    caret = start + innerOpen + selected.length;
  }
  const next = value.slice(0, start) + insert + value.slice(end);
  setValue(next);
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(caret, caret);
  });
}

function MathField({
  value,
  onChange,
  placeholder,
  multiline,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  id?: string;
}) {
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const apply = (item: ToolItem) => {
    const el = ref.current;
    if (!el) return;
    insertAtCursor(el, value, onChange, item.snippet, item.wrap ?? false);
  };

  return (
    <div className="nq-field">
      <div className="nq-toolbar">
        {TOOLBAR.map((item) => (
          <button
            key={item.label}
            type="button"
            className="nq-tool"
            title={item.title}
            onClick={() => apply(item)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {multiline ? (
        <textarea
          id={id}
          ref={ref as React.RefObject<HTMLTextAreaElement>}
          className="nq-math-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          id={id}
          type="text"
          ref={ref as React.RefObject<HTMLInputElement>}
          className="nq-math-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

export interface QuestionEditorProps {
  initial?: Question | null;
  onSave: (q: Omit<Question, "id" | "createdAt">) => Promise<unknown>;
  title?: string;
  subtitle?: string;
  backHref?: string;
  existingChapters?: string[];
}

export default function QuestionEditor({
  initial = null,
  onSave,
  title = "New Question",
  subtitle = "Build your question on the left — the preview updates live on the right.",
  backHref = "/admin",
  existingChapters = [],
}: QuestionEditorProps) {
  const router = useRouter();

  const [type, setType] = useState<QuestionType>(initial?.type ?? "single");
  const [prompt, setPrompt] = useState(initial?.prompt ?? "");
  const [options, setOptions] = useState<Option[]>(
    initial?.options?.length
      ? initial.options.map((o) => ({ ...o }))
      : [
          { id: "a", text: "", correct: false },
          { id: "b", text: "", correct: false },
          { id: "c", text: "", correct: false },
          { id: "d", text: "", correct: false },
        ]
  );

  // Main image state — stored url may be a blob: preview or the remote ImgBB URL.
  // `removed` flag tracks explicit removal in edit mode so we know to deleteField on save.
  const [imageUrl, setImageUrl] = useState<string | undefined>(initial?.imageUrl);
  const [mainImgRemoved, setMainImgRemoved] = useState(false);
  const [mainUploadStatus, setMainUploadStatus] = useState<UploadStatus>("idle");
  const [mainUploadError, setMainUploadError] = useState("");
  const mainBlobUrlRef = useRef<string | null>(null);

  // Per-option image state
  const [optionImgRemoved, setOptionImgRemoved] = useState<Record<string, boolean>>({});
  const [optionUploadStatus, setOptionUploadStatus] = useState<Record<string, UploadStatus>>({});
  const [optionUploadError, setOptionUploadError] = useState<Record<string, string>>({});
  const optionBlobUrlsRef = useRef<Record<string, string>>({});

  const [chapter, setChapter] = useState(initial?.chapter ?? "");
  const [chapterOpen, setChapterOpen] = useState(false);
  const [chapterQuery, setChapterQuery] = useState("");
  const [chapterHighlight, setChapterHighlight] = useState(0);
  const [typeOpen, setTypeOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ id?: string; msg: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [didStartTyping, setDidStartTyping] = useState(false);

  const typeRef = useRef<HTMLDivElement>(null);
  const chapterRef = useRef<HTMLDivElement>(null);
  const chapterInputRef = useRef<HTMLInputElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const savedSnapshot = useMemo(
    () => ({
      type: initial?.type ?? "single",
      prompt: initial?.prompt ?? "",
      options: initial?.options?.length
        ? initial.options.map((o) => ({ ...o }))
        : [
            { id: "a", text: "", correct: false },
            { id: "b", text: "", correct: false },
            { id: "c", text: "", correct: false },
            { id: "d", text: "", correct: false },
          ],
      imageUrl: initial?.imageUrl,
      chapter: initial?.chapter ?? "",
    }),
    [initial]
  );

  // Track any in-flight uploads (main + any option) for the global Save lock
  const uploadsInFlight =
    (mainUploadStatus === "uploading" ? 1 : 0) +
    Object.values(optionUploadStatus).filter((s) => s === "uploading").length;

  // Close type / chapter dropdowns on outside click
  useEffect(() => {
    if (!typeOpen && !chapterOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (typeOpen && typeRef.current && !typeRef.current.contains(t)) setTypeOpen(false);
      if (chapterOpen && chapterRef.current && !chapterRef.current.contains(t)) setChapterOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [typeOpen, chapterOpen]);

  useEffect(() => {
    if (chapterOpen) {
      setChapterQuery("");
      setChapterHighlight(0);
      requestAnimationFrame(() => chapterInputRef.current?.focus());
    }
  }, [chapterOpen]);

  // Warn before leaving the page with unsaved changes
  useEffect(() => {
    const hasChanges = computeIsDirty();
    if (!hasChanges || saving) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, prompt, options, imageUrl, mainImgRemoved, optionImgRemoved, chapter, saving, didStartTyping]);

  // Revoke any lingering blob URLs on unmount to avoid memory leaks
  useEffect(() => {
    const mainRef = mainBlobUrlRef;
    const optRef = optionBlobUrlsRef;
    return () => {
      if (mainRef.current) URL.revokeObjectURL(mainRef.current);
      for (const url of Object.values(optRef.current)) URL.revokeObjectURL(url);
    };
  }, []);

  // When the admin switches to single-correct, keep only the first currently-correct option
  // (called synchronously from the type-change click handler to avoid an effect-cascade).
  function coerceToSingleCorrect(prev: Option[]): Option[] {
    const firstCorrectIdx = prev.findIndex((o) => o.correct);
    if (firstCorrectIdx <= 0) return prev;
    return prev.map((o, i) => ({ ...o, correct: i === firstCorrectIdx }));
  }

  function switchType(next: QuestionType) {
    markDirty();
    setType(next);
    setTypeOpen(false);
    if (next === "single") {
      setOptions((prev) => coerceToSingleCorrect(prev));
    }
  }

  function markDirty() {
    if (!didStartTyping) setDidStartTyping(true);
  }

  function computeIsDirty(): boolean {
    if (!initial) {
      // On "new question", treat any non-empty content as dirty
      return (
        didStartTyping ||
        prompt.trim().length > 0 ||
        options.some((o) => o.text.trim() || o.imageUrl) ||
        Boolean(imageUrl) ||
        chapter.trim().length > 0
      );
    }
    if (type !== savedSnapshot.type) return true;
    if (prompt !== savedSnapshot.prompt) return true;
    if ((chapter ?? "") !== (savedSnapshot.chapter ?? "")) return true;

    // image
    const savedImg = savedSnapshot.imageUrl;
    if (mainImgRemoved) {
      if (savedImg) return true;
    } else {
      if ((imageUrl ?? "") !== (savedImg ?? "")) {
        // blob: URLs are local previews — still count as dirty because they need to upload on save
        if (imageUrl?.startsWith("blob:")) return true;
        return true;
      }
    }

    // options
    if (options.length !== savedSnapshot.options.length) return true;
    for (let i = 0; i < options.length; i++) {
      const a = options[i];
      const b = savedSnapshot.options[i];
      if (!b) return true;
      if (a.id !== b.id || a.text !== b.text || a.correct !== b.correct) return true;
      const optRemoved = optionImgRemoved[a.id];
      const optSavedImg = b.imageUrl;
      if (optRemoved) {
        if (optSavedImg) return true;
      } else if ((a.imageUrl ?? "") !== (optSavedImg ?? "")) {
        if (a.imageUrl?.startsWith("blob:")) return true;
        return true;
      }
    }
    return false;
  }

  function scrollErrorIntoView() {
    requestAnimationFrame(() => {
      footerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function showErr(msg: string, fieldId?: string) {
    setError({ id: fieldId, msg });
    scrollErrorIntoView();
    if (fieldId) {
      requestAnimationFrame(() => {
        document.getElementById(fieldId)?.focus();
      });
    }
  }

  function validateImageFile(f: File): string | null {
    if (!f.type.startsWith("image/")) return "Only image files are accepted.";
    if (f.size > MAX_IMAGE_BYTES) {
      return `Image is too large (${(f.size / 1024 / 1024).toFixed(1)} MB). Max ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB.`;
    }
    return null;
  }

  async function uploadToImgBB(f: File): Promise<string> {
    const form = new FormData();
    form.append("image", f);
    const res = await fetch(IMBB_ENDPOINT, { method: "POST", body: form });
    if (!res.ok) throw new Error(`ImgBB responded ${res.status}`);
    const data = (await res.json()) as {
      success?: boolean;
      data?: { url?: string; display_url?: string };
    };
    const url = data.data?.display_url || data.data?.url;
    if (!data.success || !url) throw new Error("Upload failed");
    return url;
  }

  const setOptText = (id: string, text: string) => {
    markDirty();
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, text } : o)));
    if (error?.id === `opt-${id}`) setError(null);
  };

  const setOptImage = (id: string, imageUrl: string | undefined) =>
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, imageUrl } : o)));

  const toggleCorrect = (id: string) => {
    markDirty();
    setOptions((prev) =>
      prev.map((o) =>
        o.id === id
          ? { ...o, correct: type === "single" ? true : !o.correct }
          : type === "single"
            ? { ...o, correct: false }
            : o
      )
    );
    if (error?.id === "options") setError(null);
  };

  const onImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const err = validateImageFile(f);
    if (err) {
      setMainUploadStatus("error");
      setMainUploadError(err);
      showErr(err);
      return;
    }
    markDirty();
    setMainUploadStatus("uploading");
    setMainUploadError("");
    setMainImgRemoved(false);
    setError(null);

    // Local preview while uploading
    if (mainBlobUrlRef.current) URL.revokeObjectURL(mainBlobUrlRef.current);
    const previewUrl = URL.createObjectURL(f);
    mainBlobUrlRef.current = previewUrl;
    setImageUrl(previewUrl);

    try {
      const url = await uploadToImgBB(f);
      setImageUrl(url);
      setMainUploadStatus("idle");
      setMainUploadError("");
    } catch (err) {
      setMainUploadStatus("error");
      const msg = err instanceof Error ? err.message : "Upload failed";
      setMainUploadError(`Upload failed: ${msg}. Please try again or remove the image before saving.`);
      setImageUrl(previewUrl); // keep local preview so the user sees what they picked
    }
  };

  const onRemoveMainImage = () => {
    markDirty();
    if (mainBlobUrlRef.current) {
      URL.revokeObjectURL(mainBlobUrlRef.current);
      mainBlobUrlRef.current = null;
    }
    setImageUrl(undefined);
    setMainImgRemoved(true);
    setMainUploadStatus("idle");
    setMainUploadError("");
  };

  const onRetryMainImage = () => {
    // Force the user to re-pick — we can't retry without a File reference
    const input = document.getElementById("nq-main-file") as HTMLInputElement | null;
    input?.click();
  };

  const onOptionImage = async (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const err = validateImageFile(f);
    if (err) {
      setOptionUploadStatus((p) => ({ ...p, [id]: "error" }));
      setOptionUploadError((p) => ({ ...p, [id]: err }));
      showErr(err, `opt-file-${id}`);
      return;
    }
    markDirty();
    setOptionUploadStatus((p) => ({ ...p, [id]: "uploading" }));
    setOptionUploadError((p) => ({ ...p, [id]: "" }));
    setOptionImgRemoved((p) => {
      const n = { ...p };
      delete n[id];
      return n;
    });
    setError(null);

    const oldBlob = optionBlobUrlsRef.current[id];
    if (oldBlob) URL.revokeObjectURL(oldBlob);
    const previewUrl = URL.createObjectURL(f);
    optionBlobUrlsRef.current[id] = previewUrl;
    setOptImage(id, previewUrl);

    try {
      const url = await uploadToImgBB(f);
      setOptImage(id, url);
      setOptionUploadStatus((p) => ({ ...p, [id]: "idle" }));
      setOptionUploadError((p) => ({ ...p, [id]: "" }));
    } catch (err2) {
      setOptionUploadStatus((p) => ({ ...p, [id]: "error" }));
      const msg = err2 instanceof Error ? err2.message : "Upload failed";
      setOptionUploadError((p) => ({ ...p, [id]: `Upload failed: ${msg}. Try again or remove the image.` }));
      setOptImage(id, previewUrl);
    }
  };

  const onRemoveOptionImage = (id: string) => {
    markDirty();
    const blob = optionBlobUrlsRef.current[id];
    if (blob) {
      URL.revokeObjectURL(blob);
      delete optionBlobUrlsRef.current[id];
    }
    setOptImage(id, undefined);
    setOptionImgRemoved((p) => ({ ...p, [id]: true }));
    setOptionUploadStatus((p) => {
      const n = { ...p };
      delete n[id];
      return n;
    });
    setOptionUploadError((p) => {
      const n = { ...p };
      delete n[id];
      return n;
    });
  };

  const save = async () => {
    if (uploadsInFlight > 0) {
      showErr("Please wait for all image uploads to finish before saving.");
      return;
    }
    if (mainUploadStatus === "error") {
      showErr("The question image failed to upload. Please retry or remove it before saving.", "nq-main-file");
      return;
    }
    const failedOpt = Object.entries(optionUploadStatus).find(([, s]) => s === "error");
    if (failedOpt) {
      showErr(
        `An option image failed to upload. Please retry or remove it before saving.`,
        `opt-file-${failedOpt[0]}`
      );
      return;
    }
    // Disallow saving blob: URLs (defensive — these are local-only)
    if (imageUrl?.startsWith("blob:")) {
      showErr("The question image is still a local preview — wait for the upload to finish or remove it.");
      return;
    }
    for (const o of options) {
      if (o.imageUrl?.startsWith("blob:")) {
        showErr(`An option image for ${o.id.toUpperCase()} is still a local preview — wait for the upload to finish or remove it.`);
        return;
      }
    }

    const filled = options.filter((o) => o.text.trim().length > 0 || Boolean(o.imageUrl));
    if (!prompt.trim()) {
      showErr("Please fill in the question text.", "nq-prompt");
      return;
    }
    if (filled.length !== 4) {
      showErr("Please fill all 4 options (each needs text or an image).", "options");
      return;
    }
    if (!filled.some((o) => o.correct)) {
      showErr("Mark at least one option as the correct answer.", "options");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const finalImageUrl = mainImgRemoved ? undefined : imageUrl;
      const finalOptions = filled.map((o) =>
        optionImgRemoved[o.id] ? { ...o, imageUrl: undefined } : o
      );
      await onSave({
        type,
        prompt: prompt.trim(),
        options: finalOptions,
        marks: 0,
        negative: 0,
        chapter: chapter.trim() || undefined,
        imageUrl: finalImageUrl,
      });
      setSaved(true);
      // Give the toast a moment to show before navigating away
      setTimeout(() => {
        router.push(backHref);
      }, 650);
    } catch (err) {
      showErr(err instanceof Error ? err.message : "Failed to save the question. Please try again.");
      setSaving(false);
    }
  };

  const onBack = () => {
    if (saving) return;
    if (uploadsInFlight > 0) {
      const ok = window.confirm(
        "An image is still uploading. Leaving now will cancel the upload and discard this question. Leave anyway?"
      );
      if (!ok) return;
    } else if (computeIsDirty() && !saved) {
      const ok = window.confirm(
        "You have unsaved changes. Leave this page without saving?"
      );
      if (!ok) return;
    }
    router.push(backHref);
  };

  const onChapterChange = (v: string) => {
    markDirty();
    // Normalize internal whitespace but preserve the user's typing; final trim happens on save.
    setChapter(v.replace(/\s+/g, " "));
  };

  const filled = options.filter((o) => o.text.trim().length > 0 || Boolean(o.imageUrl));
  const isDirty = computeIsDirty();

  return (
    <div
      className="nq-root"
      style={
        {
          "--paper": "#f4f0e8",
          "--paper-2": "#ebe6da",
          "--ink": "#14110d",
          "--ink-2": "#3a352c",
          "--dim": "#8a8275",
          "--rule": "#d9d1bf",
          "--accent": "oklch(0.52 0.20 25)",
          "--accent-2": "oklch(0.42 0.22 25)",
          "--ok": "#0f7a3d",
          "--err": "#b3261e",
        } as React.CSSProperties
      }
    >
      <style>{`
        .nq-root {
          min-height: 100vh;
          background: var(--paper);
          color: var(--ink);
          font-family: 'Inter', sans-serif;
        }

        .nq-header {
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
          padding: 22px 34px; border-bottom: 1px solid var(--rule); flex-wrap: wrap;
        }
        .nq-header-title { font-family: 'Instrument Serif', serif; font-size: 28px; margin: 0; color: var(--ink); }
        .nq-header-title em { font-style: italic; color: var(--accent); }
        .nq-header-sub { font-size: 13px; color: var(--dim); margin-top: 4px; font-family: 'JetBrains Mono', monospace; }
        .nq-back {
          background: transparent; border: 1px solid var(--ink); color: var(--ink);
          padding: 10px 16px; cursor: pointer; font-family: 'JetBrains Mono', monospace;
          font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em;
        }
        .nq-back:hover { background: var(--ink); color: var(--paper); }
        .nq-back:disabled { opacity: 0.5; cursor: not-allowed; }

        .nq-main {
          display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 0; max-width: 1280px; margin: 0 auto;
        }
        @media (max-width: 960px) {
          .nq-main { grid-template-columns: 1fr; }
          .nq-pane { border-bottom: 1px solid var(--rule); }
        }

        .nq-pane { padding: 30px 34px; min-width: 0; }
        .nq-pane-label {
          font-family: 'JetBrains Mono', monospace; font-size: 10px; text-transform: uppercase;
          letter-spacing: 0.2em; color: var(--dim); margin: 0 0 18px; display: flex; align-items: center; gap: 10px;
        }
        .nq-pane-label::after { content: ""; flex: 1; height: 1px; background: var(--rule); }
        .nq-form { border-right: 1px solid var(--rule); }

        .nq-field { margin-bottom: 18px; }
        .nq-field label {
          display: block; font-family: 'JetBrains Mono', monospace; font-size: 10px;
          text-transform: uppercase; letter-spacing: 0.16em; color: var(--ink-2); margin-bottom: 8px;
        }
        .nq-field input, .nq-field textarea {
          width: 100%; background: transparent; border: 1px solid var(--ink); border-radius: 0;
          padding: 12px 14px; font-family: 'JetBrains Mono', monospace; font-size: 14px; color: var(--ink); outline: none;
        }
        .nq-field input:focus, .nq-field textarea:focus { background: #fff; }
        .nq-row { display: flex; gap: 14px; margin-bottom: 18px; }
        .nq-row > * { flex: 1; }
        .nq-row .nq-field { margin-bottom: 0; }

        .nq-select { position: relative; }
        .nq-select-trigger {
          width: 100%; background: transparent; border: 1px solid var(--ink); border-radius: 0;
          padding: 12px 14px; font-family: 'JetBrains Mono', monospace; font-size: 14px; color: var(--ink);
          outline: none; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px;
        }
        .nq-select-trigger:focus { background: #fff; }
        .nq-caret { transition: transform 0.18s ease; font-size: 12px; color: var(--dim); }
        .nq-caret.open { transform: rotate(180deg); }
        .nq-select-menu {
          position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 20;
          list-style: none; margin: 0; padding: 4px; background: var(--paper);
          border: 1px solid var(--ink); box-shadow: 6px 6px 0 rgba(20,17,13,0.12);
        }
        .nq-select-opt {
          padding: 10px 12px; font-family: 'JetBrains Mono', monospace; font-size: 13px;
          color: var(--ink-2); cursor: pointer; border: 1px solid transparent;
        }
        .nq-select-opt:hover { background: var(--paper-2); color: var(--ink); }
        .nq-select-opt.sel { color: var(--accent); border-color: var(--rule); background: var(--paper-2); }
        .nq-select-opt.hi { background: var(--paper-2); color: var(--ink); }
        .nq-select-placeholder { color: var(--dim); }
        .nq-chapter-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .nq-chapter-clear {
          width: 22px; height: 22px; display: grid; place-items: center;
          border: 1px solid var(--rule); color: var(--dim); font-size: 16px; line-height: 1;
        }
        .nq-chapter-clear:hover { border-color: var(--accent); color: var(--accent); }
        .nq-chapter-menu {
          position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 24;
          background: var(--paper); border: 1px solid var(--ink);
          box-shadow: 6px 6px 0 rgba(20,17,13,0.12);
        }
        .nq-chapter-search {
          width: 100% !important; border: 0 !important; border-bottom: 1px solid var(--rule) !important;
          background: #fff !important; font-size: 13px !important; padding: 10px 12px !important;
        }
        .nq-chapter-list {
          position: static !important; top: auto !important; box-shadow: none !important;
          border: 0 !important; max-height: 220px; overflow-y: auto;
        }
        .nq-chapter-create { color: var(--accent) !important; }
        .nq-chapter-empty { color: var(--dim); cursor: default; }

        .nq-hint { font-size: 11px; color: var(--dim); margin-top: 6px; font-family: 'JetBrains Mono', monospace; }
        .nq-hint.err { color: var(--err); }
        .nq-hint.ok { color: var(--ok); }

        .nq-toolbar {
          display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 0;
          border: 1px solid var(--rule); border-bottom: 0; padding: 8px; background: var(--paper-2);
        }
        .nq-tool {
          min-width: 34px; height: 32px; padding: 0 8px; background: var(--paper);
          border: 1px solid var(--rule); cursor: pointer; font-family: 'JetBrains Mono', monospace;
          font-size: 13px; color: var(--ink-2); line-height: 1;
        }
        .nq-tool:hover { color: var(--accent); border-color: var(--accent); }
        .nq-tool:active { transform: translateY(1px); }
        .nq-math-input { border-top: 0 !important; }
        .nq-field > .nq-toolbar + textarea { resize: vertical; min-height: 90px; line-height: 1.5; }

        .nq-opt-edit { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 8px; transition: background 0.15s ease; }
        .nq-opt-edit.correct-row { background: rgba(220, 60, 40, 0.08); border: 1px solid var(--accent); padding: 6px; }
        .nq-opt-key {
          flex: 0 0 auto; width: 32px; height: 32px; border: 1px solid var(--rule);
          background: var(--paper); color: var(--ink-2); cursor: pointer;
          font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 600;
          display: grid; place-items: center; transition: all 0.15s ease;
        }
        .nq-opt-key:hover { border-color: var(--accent); color: var(--accent); }
        .nq-opt-key.correct { background: var(--accent); color: #fff; border-color: var(--accent); }
        .nq-opt-body { flex: 1; min-width: 0; }
        .nq-opt-img-row { display: flex; align-items: center; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
        .nq-opt-img-preview { max-height: 48px; max-width: 120px; border: 1px solid var(--rule); object-fit: contain; }
        .nq-file {
          font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--ink-2);
          border: 1px solid var(--rule); padding: 10px 12px; display: inline-block; cursor: pointer;
          background: var(--paper);
        }
        .nq-file input { display: none; }
        .nq-file-sm { display: inline-block; padding: 6px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; }
        .nq-file-sm-remove {
          background: transparent; border: 1px solid var(--rule); color: var(--ink-2);
          font-family: 'JetBrains Mono', monospace; font-size: 10px; text-transform: uppercase;
          letter-spacing: 0.08em; padding: 6px 10px; cursor: pointer;
        }
        .nq-file-sm-remove:hover { color: var(--accent); border-color: var(--accent); }
        .nq-file-retry {
          background: transparent; border: 1px solid var(--err); color: var(--err);
          font-family: 'JetBrains Mono', monospace; font-size: 10px; text-transform: uppercase;
          letter-spacing: 0.08em; padding: 6px 10px; cursor: pointer;
        }
        .nq-file-retry:hover { background: var(--err); color: #fff; }

        .nq-file.nq-uploading {
          color: var(--accent); border-color: var(--accent);
          background: rgba(220, 60, 40, 0.04);
          cursor: progress;
        }
        .nq-file.nq-uploading .nq-spinner {
          display: inline-block; width: 10px; height: 10px; margin-right: 6px;
          border: 2px solid currentColor; border-top-color: transparent; border-radius: 50%;
          vertical-align: -1px;
          animation: nq-spin 0.7s linear infinite;
        }
        .nq-file.nq-error {
          color: var(--err); border-color: var(--err);
          background: rgba(179, 38, 30, 0.04);
        }
        @keyframes nq-spin { to { transform: rotate(360deg); } }

        .nq-img-preview { max-height: 90px; margin-top: 10px; border: 1px solid var(--rule); display: block; }

        .nq-footer { padding: 0 34px 34px; max-width: 1280px; margin: 0 auto; position: relative; }
        .nq-error {
          font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--err);
          margin-bottom: 12px; line-height: 1.5; padding: 10px 12px;
          border: 1px solid var(--err); background: rgba(179,38,30,0.05);
        }
        .nq-toast {
          font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--ok);
          margin-bottom: 12px; line-height: 1.5; padding: 10px 12px;
          border: 1px solid var(--ok); background: rgba(15,122,61,0.07);
        }
        .nq-submit {
          width: 100%; background: var(--accent); color: #fff; border: 1px solid var(--accent);
          padding: 14px; font-family: 'Inter', sans-serif; font-weight: 600; font-size: 14px;
          letter-spacing: 0.04em; cursor: pointer; text-transform: uppercase;
        }
        .nq-submit:hover { background: var(--accent-2); border-color: var(--accent-2); }
        .nq-submit:disabled { opacity: 0.6; cursor: not-allowed; }
        .nq-waiting {
          font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--dim);
          margin-bottom: 10px; letter-spacing: 0.04em;
        }

        /* ---- Live preview pane ---- */
        .nq-preview-card {
          border: 1px solid var(--ink); background: #fffdf8; position: relative; padding: 26px 26px 30px;
        }
        .nq-preview-card::before, .nq-preview-card::after {
          content: ""; position: absolute; width: 12px; height: 12px; background: var(--ink);
        }
        .nq-preview-card::before { top: -1px; left: -1px; }
        .nq-preview-card::after { bottom: -1px; right: -1px; }
        .nq-preview-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
        .nq-badge {
          font-family: 'JetBrains Mono', monospace; font-size: 9px; text-transform: uppercase;
          letter-spacing: 0.12em; padding: 4px 9px; border: 1px solid var(--rule); color: var(--ink-2);
        }
        .nq-badge.accent { border-color: var(--accent); color: var(--accent); }
        .nq-preview-img { max-height: 140px; max-width: 100%; margin-bottom: 14px; border: 1px solid var(--rule); }
        .nq-preview-prompt {
          font-family: 'Georgia', 'Times New Roman', serif; font-size: 18px; color: var(--ink);
          line-height: 1.7; word-break: break-word; margin-bottom: 20px;
        }
        .nq-preview-inline {
          font-family: 'Georgia', 'Times New Roman', serif; font-size: 17px;
          color: var(--ink); line-height: 1.6; word-break: break-word;
        }
        .nq-preview-body {
          font-family: 'Georgia', 'Times New Roman', serif; font-size: 18px;
          color: var(--ink); line-height: 1.7; word-break: break-word;
        }
        .nq-prev-math { padding: 0 1px; }
        .nq-frac { display: inline-flex; flex-direction: column; vertical-align: middle; text-align: center; margin: 0 2px; font-size: 0.78em; }
        .nq-frac-num { border-bottom: 1px solid var(--ink); padding: 0 5px; }
        .nq-frac-den { padding: 0 5px; }
        .nq-vec { position: relative; display: inline-block; }
        .nq-vec-arrow { position: absolute; top: -0.55em; left: 50%; transform: translateX(-50%); font-size: 0.8em; line-height: 1; letter-spacing: -0.05em; pointer-events: none; }
        .nq-vec-body { padding: 0 1px; }
        .nq-hat { position: relative; display: inline-block; }
        .nq-hat-cap { position: absolute; top: -0.55em; left: 50%; transform: translateX(-55%) scaleX(1.1); font-size: 0.85em; line-height: 1; pointer-events: none; }
        .nq-hat-body { padding: 0 1px; }
        .nq-sqrt { border-top: 1px solid var(--ink); padding: 0 2px; }
        .nq-sqrt-body { border-top: 1px solid var(--ink); padding: 0 2px; }

        .nq-options { display: flex; flex-direction: column; gap: 10px; margin-top: 4px; }
        .nq-option {
          display: flex; align-items: flex-start; gap: 12px; border: 1px solid var(--rule);
          padding: 12px 14px; background: var(--paper); transition: all 0.15s ease;
        }
        .nq-option.correct { border-color: var(--accent); background: rgba(220, 60, 40, 0.07); }
        .nq-opt-key-badge {
          flex: 0 0 auto; width: 28px; height: 28px; border: 1px solid var(--rule);
          display: grid; place-items: center; font-family: 'JetBrains Mono', monospace;
          font-size: 12px; font-weight: 600; color: var(--ink-2); background: var(--paper-2);
        }
        .nq-option.correct .nq-opt-key-badge { background: var(--accent); color: #fff; border-color: var(--accent); }
        .nq-opt-text { flex: 1; min-width: 0; }
        .nq-opt-img { max-height: 60px; max-width: 160px; margin-top: 8px; border: 1px solid var(--rule); object-fit: contain; }
        .nq-correct-tag {
          flex: 0 0 auto; font-family: 'JetBrains Mono', monospace; font-size: 9px; text-transform: uppercase;
          letter-spacing: 0.12em; color: var(--accent); border: 1px solid var(--accent); padding: 3px 8px;
        }
        .nq-placeholder { color: var(--dim); font-family: 'Georgia', serif; font-style: italic; }
        .nq-empty-hint { color: var(--dim); font-size: 13px; line-height: 1.6; }
      `}</style>

      <header className="nq-header">
        <div>
          <h1 className="nq-header-title">{title.indexOf(" ") === -1 ? <em>{title}</em> : (
            <>
              {title.split(" ")[0]} <em>{title.split(" ").slice(1).join(" ")}</em>
            </>
          )}</h1>
          <div className="nq-header-sub">{subtitle}</div>
        </div>
        <button
          className="nq-back"
          onClick={onBack}
          disabled={saving}
          aria-label="Back to questions"
          title={saving ? "Please wait while saving…" : isDirty ? "You have unsaved changes" : ""}
        >
          ← Back{isDirty && !saving ? "" : ""}
        </button>
      </header>

      <div className="nq-main">
        <section className="nq-pane nq-form">
          <h2 className="nq-pane-label">Editor</h2>

          <div className="nq-row">
            <div className="nq-field">
              <label>Type</label>
              <div className="nq-select" ref={typeRef}>
                <button
                  type="button"
                  className="nq-select-trigger"
                  onClick={() => setTypeOpen((o) => !o)}
                  aria-haspopup="listbox"
                  aria-expanded={typeOpen}
                >
                  <span>{type === "single" ? "Single Correct" : "MCQ (Multiple)"}</span>
                  <span className={`nq-caret${typeOpen ? " open" : ""}`}>▾</span>
                </button>
                {typeOpen && (
                  <ul className="nq-select-menu" role="listbox">
                    <li
                      role="option"
                      aria-selected={type === "single"}
                      className={`nq-select-opt${type === "single" ? " sel" : ""}`}
                      onClick={() => switchType("single")}
                    >
                      Single Correct
                    </li>
                    <li
                      role="option"
                      aria-selected={type === "mcq"}
                      className={`nq-select-opt${type === "mcq" ? " sel" : ""}`}
                      onClick={() => switchType("mcq")}
                    >
                      MCQ (Multiple)
                    </li>
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="nq-hint" style={{ marginTop: -8, marginBottom: 18 }}>
            Marks and negative marking are not stored on a question — you set both per exam when
            you add it to an exam.
          </div>

          <div className="nq-field">
            <label>Chapter (optional)</label>
            <input
              type="text"
              value={chapter}
              placeholder="e.g. Kinematics, Thermodynamics"
              list="nq-chapter-suggestions"
              autoComplete="off"
              onChange={(e) => onChapterChange(e.target.value)}
            />
            <datalist id="nq-chapter-suggestions">
              {existingChapters.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <div className="nq-hint">Used to group questions when adding them to an exam by chapter.</div>
          </div>

          <div className="nq-field">
            <label>Question {type === "mcq" ? "(select all correct)" : "(select one correct)"}</label>
            <MathField
              id="nq-prompt"
              value={prompt}
              onChange={(v) => { markDirty(); setPrompt(v); if (error?.id === "nq-prompt") setError(null); }}
              placeholder={PLACEHOLDER}
              multiline
            />
            <div className="nq-hint">Use the toolbar to insert formulae, exponents, fractions, vectors and Greek symbols.</div>
          </div>

          <div className="nq-field">
            <label>Image (optional, max 1)</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <label
                htmlFor="nq-main-file"
                className={`nq-file${mainUploadStatus === "uploading" ? " nq-uploading" : ""}${mainUploadStatus === "error" ? " nq-error" : ""}`}
              >
                {mainUploadStatus === "uploading" ? (
                  <><span className="nq-spinner" />Uploading…</>
                ) : mainUploadStatus === "error" ? (
                  <>Upload failed</>
                ) : imageUrl ? (
                  <>Image attached ✓ (change)</>
                ) : (
                  <>Choose image…</>
                )}
                <input
                  id="nq-main-file"
                  type="file"
                  accept="image/*"
                  onChange={onImage}
                  disabled={mainUploadStatus === "uploading"}
                />
              </label>
              {imageUrl && mainUploadStatus !== "uploading" && (
                <button type="button" className="nq-file-sm-remove" onClick={onRemoveMainImage}>
                  Remove image
                </button>
              )}
              {mainUploadStatus === "error" && (
                <button type="button" className="nq-file-retry" onClick={onRetryMainImage}>
                  Retry
                </button>
              )}
            </div>
            {mainUploadStatus === "uploading" && (
              <div className="nq-hint">Uploading — save stays locked until this finishes or fails.</div>
            )}
            {mainUploadStatus === "error" && (
              <div className="nq-hint err">{mainUploadError}</div>
            )}
            {imageUrl && mainUploadStatus !== "uploading" && (
              <img className="nq-img-preview" src={imageUrl} alt="preview" />
            )}
          </div>

          <div className="nq-field" id="options">
            <label>Options (4 required) — optional image per option</label>
            {options.map((o, i) => {
              const optStatus = optionUploadStatus[o.id] ?? "idle";
              const optErr = optionUploadError[o.id] ?? "";
              return (
                <div className={`nq-opt-edit${o.correct ? " correct-row" : ""}`} key={o.id}>
                  <button
                    type="button"
                    className={`nq-opt-key${o.correct ? " correct" : ""}`}
                    onClick={() => toggleCorrect(o.id)}
                    aria-pressed={o.correct}
                    title={type === "single" ? "Select correct answer" : "Toggle correct answer"}
                  >
                    {String.fromCharCode(65 + i)}
                  </button>
                  <div className="nq-opt-body">
                    <MathField
                      id={`opt-${o.id}`}
                      value={o.text}
                      onChange={(v) => setOptText(o.id, v)}
                      placeholder="Option text — e.g. $\\vec{F} = m\\vec{a}$"
                    />
                    <div className="nq-opt-img-row">
                      {o.imageUrl && optStatus !== "uploading" && (
                        <img className="nq-opt-img-preview" src={o.imageUrl} alt={`option ${String.fromCharCode(65 + i)} preview`} />
                      )}
                      <label
                        htmlFor={`opt-file-${o.id}`}
                        className={`nq-file nq-file-sm${optStatus === "uploading" ? " nq-uploading" : ""}${optStatus === "error" ? " nq-error" : ""}`}
                      >
                        {optStatus === "uploading" ? (
                          <><span className="nq-spinner" />Uploading…</>
                        ) : optStatus === "error" ? (
                          <>Upload failed</>
                        ) : o.imageUrl ? (
                          <>Change image</>
                        ) : (
                          <>+ Image</>
                        )}
                        <input
                          id={`opt-file-${o.id}`}
                          type="file"
                          accept="image/*"
                          onChange={(e) => onOptionImage(e, o.id)}
                          disabled={optStatus === "uploading"}
                        />
                      </label>
                      {o.imageUrl && optStatus !== "uploading" && (
                        <button
                          type="button"
                          className="nq-file-sm-remove"
                          onClick={() => onRemoveOptionImage(o.id)}
                        >
                          Remove
                        </button>
                      )}
                      {optStatus === "error" && (
                        <button
                          type="button"
                          className="nq-file-retry"
                          onClick={() => document.getElementById(`opt-file-${o.id}`)?.click()}
                        >
                          Retry
                        </button>
                      )}
                    </div>
                    {optStatus === "uploading" && (
                      <div className="nq-hint">Uploading — save stays locked until this finishes.</div>
                    )}
                    {optStatus === "error" && <div className="nq-hint err">{optErr}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="nq-pane">
          <h2 className="nq-pane-label">Live preview</h2>
          {filled.length === 0 && !prompt.trim() ? (
            <div className="nq-preview-card">
              <p className="nq-empty-hint">
                Start typing your question to see a live preview here. The card shows exactly how the
                question will look to a student, with the correct answer highlighted.
              </p>
            </div>
          ) : (
            <div className="nq-preview-card">
              <div className="nq-preview-meta">
                <span className="nq-badge accent">{type === "mcq" ? "MCQ (Multiple)" : "Single Correct"}</span>
                {chapter.trim() && <span className="nq-badge">{chapter.trim()}</span>}
              </div>

              {imageUrl && <img className="nq-preview-img" src={imageUrl} alt="question" />}

              <div className="nq-preview-prompt">
                {prompt.trim() ? (
                  <MathPreview text={prompt} />
                ) : (
                  <span className="nq-placeholder">Question text will appear here…</span>
                )}
              </div>

              <div className="nq-options">
                {options.map((o, i) => {
                  const hasContent = o.text.trim() || o.imageUrl;
                  return (
                    <div className={`nq-option${o.correct && hasContent ? " correct" : ""}`} key={o.id}>
                      <span className="nq-opt-key-badge">{String.fromCharCode(65 + i)}</span>
                      <div className="nq-opt-text">
                        {hasContent ? (
                          <>
                            {o.text.trim() ? <MathPreview text={o.text} compact /> : null}
                            {o.imageUrl && <img className="nq-opt-img" src={o.imageUrl} alt={`option ${String.fromCharCode(65 + i)}`} />}
                          </>
                        ) : (
                          <span className="nq-placeholder">Option {String.fromCharCode(65 + i)}…</span>
                        )}
                      </div>
                      {o.correct && hasContent && <span className="nq-correct-tag">Correct</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="nq-footer" ref={footerRef}>
        {error && <div className="nq-error">{error.msg}</div>}
        {saved && <div className="nq-toast">Question saved ✓ — returning to list…</div>}
        {!saved && !error && uploadsInFlight > 0 && (
          <div className="nq-waiting">
            Waiting for {uploadsInFlight} image upload{uploadsInFlight === 1 ? "" : "s"} to finish before saving…
          </div>
        )}
        <button
          className="nq-submit"
          onClick={save}
          disabled={saving || uploadsInFlight > 0 || saved}
          title={
            uploadsInFlight > 0
              ? "Cannot save while an image is still uploading"
              : saving
                ? "Saving question…"
                : "Save question"
          }
        >
          {uploadsInFlight > 0
            ? `Waiting for upload${uploadsInFlight === 1 ? "" : "s"}…`
            : saving
              ? "Saving…"
              : saved
                ? "Saved ✓"
                : "Save Question"}
        </button>
        {isDirty && !saving && !saved && !error && (
          <div className="nq-hint" style={{ textAlign: "center", marginTop: 8 }}>
            You have unsaved changes.
          </div>
        )}
      </div>
    </div>
  );
}
rim() && <span className="nq-badge">{chapter.trim()}</span>}
              </div>

              {imageUrl && <img className="nq-preview-img" src={imageUrl} alt="question" />}

              <div className="nq-preview-prompt">
                {prompt.trim() ? (
                  <MathPreview text={prompt} />
                ) : (
                  <span className="nq-placeholder">Question text will appear here…</span>
                )}
              </div>

              <div className="nq-options">
                {options.map((o, i) => {
                  const hasContent = o.text.trim() || o.imageUrl;
                  return (
                    <div className={`nq-option${o.correct && hasContent ? " correct" : ""}`} key={o.id}>
                      <span className="nq-opt-key-badge">{String.fromCharCode(65 + i)}</span>
                      <div className="nq-opt-text">
                        {hasContent ? (
                          <>
                            {o.text.trim() ? <MathPreview text={o.text} compact /> : null}
                            {o.imageUrl && <img className="nq-opt-img" src={o.imageUrl} alt={`option ${String.fromCharCode(65 + i)}`} />}
                          </>
                        ) : (
                          <span className="nq-placeholder">Option {String.fromCharCode(65 + i)}…</span>
                        )}
                      </div>
                      {o.correct && hasContent && <span className="nq-correct-tag">Correct</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="nq-footer" ref={footerRef}>
        {error && <div className="nq-error">{error.msg}</div>}
        {saved && <div className="nq-toast">Question saved ✓ — returning to list…</div>}
        {!saved && !error && uploadsInFlight > 0 && (
          <div className="nq-waiting">
            Waiting for {uploadsInFlight} image upload{uploadsInFlight === 1 ? "" : "s"} to finish before saving…
          </div>
        )}
        <button
          className="nq-submit"
          onClick={save}
          disabled={saving || uploadsInFlight > 0 || saved}
          title={
            uploadsInFlight > 0
              ? "Cannot save while an image is still uploading"
              : saving
                ? "Saving question…"
                : "Save question"
          }
        >
          {uploadsInFlight > 0
            ? `Waiting for upload${uploadsInFlight === 1 ? "" : "s"}…`
            : saving
              ? "Saving…"
              : saved
                ? "Saved ✓"
                : "Save Question"}
        </button>
        {isDirty && !saving && !saved && !error && (
          <div className="nq-hint" style={{ textAlign: "center", marginTop: 8 }}>
            You have unsaved changes.
          </div>
        )}
      </div>
    </div>
  );
}
