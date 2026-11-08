/* Hallmark · genre: playful · theme: Hum · design-system: design.md · designed-as-app */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { uploadImage } from "@/lib/storage";
import { useRouter } from "next/navigation";
import type { Question, QuestionOption as Option, QuestionType } from "@/lib/questions";
import { MathPreview } from "../shared";
import ConfirmDialog from "../../_components/ConfirmDialog";

const PLACEHOLDER = "Type using LaTeX-style syntax: $x^2$, $\\frac{a}{b}$, $\\vec{v}$, $\\sqrt{x}$";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB is plenty for question images

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

  // Main image state — stored url may be a blob: preview or the remote Storage URL.
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

  async function uploadQuestionImage(f: File): Promise<string> {
    return uploadImage(f, "questions");
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
      const url = await uploadQuestionImage(f);
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
      const url = await uploadQuestionImage(f);
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
    if (!chapter.trim()) {
      showErr("Chapter is required — pick one from the dropdown or type a new one.", "chapter");
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
        chapter: chapter.trim(),
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

  const [leaveConfirm, setLeaveConfirm] = useState<null | "upload" | "dirty">(null);
  const onBack = () => {
    if (saving) return;
    if (uploadsInFlight > 0) {
      setLeaveConfirm("upload");
      return;
    }
    if (computeIsDirty() && !saved) {
      setLeaveConfirm("dirty");
      return;
    }
    router.push(backHref);
  };

  const onChapterChange = (v: string) => {
    markDirty();
    // Normalize internal whitespace but preserve the user's typing; final trim happens on save.
    setChapter(v.replace(/\s+/g, " "));
  };

  const chapterTerm = chapter.trim().toLowerCase();
  const chapterMatches = existingChapters.filter(
    (c) => !chapterTerm || c.toLowerCase().includes(chapterTerm)
  );
  const chapterExactMatch = existingChapters.some((c) => c.toLowerCase() === chapterTerm);
  const createRowVisible = Boolean(chapterTerm) && !chapterExactMatch;
  const chapterMaxIndex = createRowVisible ? chapterMatches.length : Math.max(0, chapterMatches.length - 1);
  const pickChapter = (c: string) => {
    setChapter(c);
    setChapterOpen(false);
    markDirty();
    chapterInputRef.current?.focus();
  };
  const onChapterKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!chapterOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setChapterOpen(true);
      }
      return;
    }
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setChapterOpen(false);
        break;
      case "ArrowDown":
        e.preventDefault();
        setChapterHighlight((i) => Math.min(chapterMaxIndex, i + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setChapterHighlight((i) => Math.max(0, i - 1));
        break;
      case "Home":
        e.preventDefault();
        setChapterHighlight(0);
        break;
      case "End":
        e.preventDefault();
        setChapterHighlight(chapterMaxIndex);
        break;
      case "Enter":
        e.preventDefault();
        if (chapterHighlight < chapterMatches.length) {
          pickChapter(chapterMatches[chapterHighlight]);
        } else if (createRowVisible && chapterHighlight === chapterMatches.length) {
          setChapterOpen(false); // keep the typed chapter; created on save
        } else {
          setChapterOpen(false);
        }
        break;
      case "Tab":
        setChapterOpen(false);
        break;
    }
  };

  const filled = options.filter((o) => o.text.trim().length > 0 || Boolean(o.imageUrl));
  const isDirty = computeIsDirty();

  return (
    <div className="nq-root">
      <style>{`
        .nq-root {
          min-height: 100vh;
          background: var(--color-paper);
          color: var(--color-ink);
          font-family: var(--font-body);
        }

        .nq-header {
          display: flex; align-items: center; justify-content: space-between; gap: 1rem;
          padding: 0.9rem var(--page-gutter); border-bottom: 1px solid var(--color-rule); flex-wrap: wrap;
          max-width: var(--page-max); margin-inline: auto; width: 100%;
        }
        .nq-header-title { font-family: var(--font-display); font-weight: 600; font-size: 1.5rem; letter-spacing: -0.03em; margin: 0; color: var(--color-ink); }
        .nq-header-sub { font-size: 0.66rem; color: var(--color-muted); margin-top: 0.25rem; font-family: var(--font-mono); font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; }
        .nq-back {
          background: var(--color-paper-2); border: 0; color: var(--color-ink-2);
          padding: 0.55rem 1rem; border-radius: var(--radius-pill); cursor: pointer; font-family: var(--font-body);
          font-size: 0.78rem; font-weight: 600; text-decoration: none;
          transition: background var(--dur-micro), color var(--dur-micro);
        }
        .nq-back:hover { background: var(--color-paper-3); color: var(--color-ink); }
        .nq-back:disabled { opacity: 0.5; cursor: not-allowed; }

        .nq-main {
          display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 0; max-width: var(--page-max); margin: 0 auto; width: 100%;
        }
        @media (max-width: 960px) {
          .nq-main { grid-template-columns: minmax(0, 1fr); }
          .nq-pane { border-bottom: 1px solid var(--color-rule); }
        }

        .nq-pane { padding: 1.5rem 2rem; min-width: 0; }
        .nq-pane-label {
          font-family: var(--font-mono); font-size: 0.6rem; font-weight: 500; text-transform: uppercase;
          letter-spacing: 0.2em; color: var(--color-muted); margin: 0 0 1.1rem; display: flex; align-items: center; gap: 0.65rem;
        }
        .nq-pane-label::after { content: ""; flex: 1; height: 1px; background: var(--color-rule); }
        .nq-form { border-right: 1px solid var(--color-rule); }

        .nq-field { margin-bottom: 1rem; }
        .nq-field label {
          display: block; font-family: var(--font-mono); font-size: 0.58rem; font-weight: 500;
          text-transform: uppercase; letter-spacing: 0.18em; color: var(--color-muted); margin-bottom: 0.4rem;
        }
        .nq-field input, .nq-field textarea {
          width: 100%; background: var(--color-paper-2); border: 1.5px solid transparent; border-radius: var(--radius-input);
          padding: 0.7rem 0.85rem; font-family: var(--font-mono); font-size: 0.9rem; color: var(--color-ink); outline: none;
          transition: border-color var(--dur-micro), background var(--dur-micro);
        }
        .nq-field input:focus, .nq-field textarea:focus { border-color: var(--color-accent-2); background: var(--color-paper); }
        .nq-row { display: flex; gap: 0.9rem; margin-bottom: 1rem; }
        .nq-row > * { flex: 1; min-width: 0; }
        .nq-row .nq-field { margin-bottom: 0; }

        .nq-select { position: relative; }
        .nq-select-trigger {
          width: 100%; background: var(--color-paper-2); border: 1.5px solid transparent; border-radius: var(--radius-input);
          padding: 0.7rem 0.85rem; font-family: var(--font-mono); font-size: 0.88rem; color: var(--color-ink);
          outline: none; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 0.6rem;
          transition: border-color var(--dur-micro), background var(--dur-micro);
        }
        .nq-select-trigger:focus { border-color: var(--color-accent-2); background: var(--color-paper); }
        .nq-caret { transition: transform 0.18s var(--ease-out); font-size: 0.75rem; color: var(--color-muted); }
        .nq-caret.open { transform: rotate(180deg); }
        .nq-select-menu {
          position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: var(--z-dropdown);
          list-style: none; margin: 0; padding: 0.3rem; background: var(--color-paper);
          border: 1px solid var(--color-rule-2); border-radius: var(--radius-input); box-shadow: var(--shadow-lift);
        }
        .nq-select-opt {
          padding: 0.55rem 0.65rem; font-family: var(--font-mono); font-size: 0.82rem;
          color: var(--color-ink-2); cursor: pointer; border: 0; border-radius: var(--radius-sm);
        }
        .nq-select-opt:hover, .nq-select-opt.hi { background: var(--color-paper-2); color: var(--color-ink); }
        .nq-select-opt.sel { background: var(--color-tint-cyan); color: var(--color-ink); font-weight: 600; }
        .nq-select-placeholder { color: var(--color-faint); }
        .nq-caret-btn {
          position: absolute; right: 4px; top: 50%; transform: translateY(-50%);
          width: 30px; height: 30px; display: grid; place-items: center;
          background: transparent; border: 0; border-radius: var(--radius-sm);
          color: var(--color-muted); cursor: pointer; transition: color var(--dur-micro), background var(--dur-micro);
        }
        .nq-caret-btn:hover { color: var(--color-accent-2-deep); background: var(--color-tint-cyan); }
        .nq-chapter-create { color: var(--color-accent-2-deep) !important; font-weight: 600; }
        .nq-chapter-empty { color: var(--color-muted); padding: 0.55rem 0.65rem; font-size: 0.78rem; line-height: 1.5; list-style: none; }
        .nq-req { color: var(--color-danger); margin-left: 0.2em; }
        .nq-select input[aria-expanded="true"] { border-color: var(--color-accent-2); background: var(--color-paper); }

        .nq-hint { font-size: 0.66rem; color: var(--color-muted); margin-top: 0.35rem; font-family: var(--font-mono); }
        .nq-hint.err { color: var(--color-danger); }
        .nq-hint.ok { color: var(--color-mint-deep); }

        .nq-toolbar {
          display: flex; flex-wrap: wrap; gap: 0.3rem; margin-bottom: 0;
          border: 1px solid var(--color-rule); border-bottom: 0; border-radius: var(--radius-input) var(--radius-input) 0 0;
          padding: 0.4rem; background: var(--color-paper-2);
        }
        .nq-tool {
          min-width: 34px; height: 32px; padding: 0 0.5rem; background: var(--color-paper);
          border: 1px solid var(--color-rule); border-radius: 6px; cursor: pointer; font-family: var(--font-mono);
          font-size: 0.78rem; color: var(--color-ink-2); line-height: 1; transition: border-color var(--dur-micro), color var(--dur-micro);
        }
        .nq-tool:hover { color: var(--color-accent-2-deep); border-color: var(--color-accent-2); }
        .nq-tool:active { transform: translateY(1px); }
        .nq-math-input { border-top: 0 !important; border-radius: 0 0 var(--radius-input) var(--radius-input) !important; }
        .nq-field > .nq-toolbar + textarea { resize: vertical; min-height: 90px; line-height: 1.5; }

        .nq-opt-edit { display: flex; align-items: flex-start; gap: 0.6rem; margin-bottom: 0.45rem; transition: background var(--dur-micro); }
        .nq-opt-edit.correct-row { background: var(--color-tint-mint); border-radius: var(--radius-sm); padding: 0.35rem; }
        .nq-opt-key {
          flex: 0 0 auto; width: 32px; height: 32px; border: 1.5px solid var(--color-rule-2); border-radius: var(--radius-sm);
          background: var(--color-paper); color: var(--color-ink-2); cursor: pointer;
          font-family: var(--font-mono); font-size: 0.78rem; font-weight: 600;
          display: grid; place-items: center; transition: all var(--dur-micro);
        }
        .nq-opt-key:hover { border-color: var(--color-accent-2); color: var(--color-accent-2-deep); }
        .nq-opt-key.correct { background: var(--color-mint); border-color: var(--color-mint); color: var(--color-ink); }
        .nq-opt-body { flex: 1; min-width: 0; }
        .nq-opt-img-row { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.4rem; flex-wrap: wrap; }
        .nq-opt-img-preview { max-height: 48px; max-width: 120px; border: 1px solid var(--color-rule); border-radius: var(--radius-sm); object-fit: contain; }
        .nq-file {
          font-family: var(--font-body); font-size: 0.74rem; font-weight: 600; color: var(--color-ink-2);
          background: var(--color-paper-2); border: 0; padding: 0.55rem 0.9rem; display: inline-flex; align-items: center; gap: 0.4rem;
          cursor: pointer; border-radius: var(--radius-pill); transition: background var(--dur-micro), color var(--dur-micro);
        }
        .nq-file input { display: none; }
        .nq-file:hover { background: var(--color-paper-3); color: var(--color-ink); }
        .nq-file-sm { display: inline-block; padding: 0.32rem 0.65rem; font-size: 0.58rem; text-transform: uppercase; letter-spacing: 0.08em; }
        .nq-file-sm-remove {
          background: transparent; border: 1px solid var(--color-rule-2); color: var(--color-muted);
          border-radius: var(--radius-pill); font-family: var(--font-mono); font-size: 0.58rem; text-transform: uppercase;
          letter-spacing: 0.08em; padding: 0.32rem 0.65rem; cursor: pointer; transition: border-color var(--dur-micro), color var(--dur-micro);
        }
        .nq-file-sm-remove:hover { color: var(--color-danger); border-color: var(--color-danger); }
        .nq-file-retry {
          background: transparent; border: 1px solid var(--color-danger); color: var(--color-danger);
          border-radius: var(--radius-pill); font-family: var(--font-mono); font-size: 0.58rem; text-transform: uppercase;
          letter-spacing: 0.08em; padding: 0.32rem 0.65rem; cursor: pointer;
        }
        .nq-file-retry:hover { background: var(--color-danger); color: var(--color-on-panel); }

        .nq-file.nq-uploading {
          color: var(--color-accent-2-deep); background: var(--color-tint-cyan);
          cursor: progress;
        }
        .nq-file.nq-uploading .nq-spinner {
          display: inline-block; width: 10px; height: 10px; margin-right: 0.3rem;
          border: 2px solid currentColor; border-top-color: transparent; border-radius: 50%;
          vertical-align: -1px;
          animation: nq-spin 0.7s linear infinite;
        }
        .nq-file.nq-error {
          color: var(--color-danger); background: var(--color-danger-soft);
        }
        @keyframes nq-spin { to { transform: rotate(360deg); } }

        .nq-img-preview { max-height: 90px; margin-top: 0.6rem; border: 1px solid var(--color-rule); border-radius: var(--radius-sm); display: block; }

        .nq-footer { padding: 0 2rem 2rem; max-width: var(--page-max); margin: 0 auto; position: relative; width: 100%; }
        .nq-error {
          font-size: 0.85rem; color: var(--color-danger);
          margin-bottom: 0.75rem; line-height: 1.5; padding: 0.55rem 0.75rem;
          border-radius: var(--radius-sm); background: var(--color-danger-soft);
        }
        .nq-toast {
          font-size: 0.85rem; color: var(--color-mint-deep);
          margin-bottom: 0.75rem; line-height: 1.5; padding: 0.55rem 0.75rem;
          border-radius: var(--radius-sm); background: var(--color-tint-mint);
        }
        .nq-submit {
          width: 100%; background: var(--color-accent); color: var(--color-on-accent); border: 0;
          border-radius: var(--radius-pill); padding: 0.8rem; font-family: var(--font-display); font-weight: 600; font-size: 0.88rem;
          letter-spacing: -0.01em; cursor: pointer; text-transform: none;
          box-shadow: 0 4px 0 0 var(--color-accent-deep), 0 6px 12px -3px var(--color-accent-cast);
          transition: transform var(--dur-micro) var(--ease-press), box-shadow var(--dur-micro) var(--ease-press);
        }
        .nq-submit:hover { transform: translateY(-2px); box-shadow: 0 6px 0 0 var(--color-accent-deep), 0 12px 20px -4px var(--color-accent-cast); }
        .nq-submit:active { transform: translateY(2px); box-shadow: 0 1px 0 0 var(--color-accent-deep); }
        .nq-submit:disabled { opacity: 0.6; cursor: not-allowed; }
        .nq-waiting {
          font-family: var(--font-mono); font-size: 0.66rem; font-weight: 500; color: var(--color-muted);
          margin-bottom: 0.5rem; letter-spacing: 0.06em;
        }

        /* ---- Live preview pane ---- */
        .nq-preview-card {
          border: 1px solid var(--color-rule); background: var(--color-paper); position: relative; border-radius: var(--radius-card);
          box-shadow: var(--shadow-card); padding: 1.5rem 1.5rem 1.75rem;
        }
        .nq-preview-meta { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.9rem; }
        .nq-badge {
          font-family: var(--font-body); font-size: 0.6rem; font-weight: 600;
          letter-spacing: 0.06em; padding: 0.2rem 0.55rem; border-radius: var(--radius-pill); border: 0;
          background: var(--color-paper-2); color: var(--color-ink-2);
        }
        .nq-badge.accent { background: var(--color-tint-cyan); color: var(--color-accent-2-deep); }
        .nq-preview-img { max-height: 140px; max-width: 100%; margin-bottom: 0.9rem; border: 1px solid var(--color-rule); border-radius: var(--radius-sm); }
        .nq-preview-prompt {
          font-family: var(--font-body); font-size: 1.05rem; color: var(--color-ink);
          line-height: 1.65; word-break: break-word; margin-bottom: 1.1rem;
        }
        .nq-preview-inline {
          font-family: var(--font-body); font-size: 1rem;
          color: var(--color-ink); line-height: 1.6; word-break: break-word;
        }
        .nq-preview-body {
          font-family: var(--font-body); font-size: 1.05rem;
          color: var(--color-ink); line-height: 1.65; word-break: break-word;
        }
        .nq-prev-math { padding: 0 1px; }
        .nq-frac { display: inline-flex; flex-direction: column; vertical-align: middle; text-align: center; margin: 0 2px; font-size: 0.78em; }
        .nq-frac-num { border-bottom: 1px solid var(--color-ink); padding: 0 5px; }
        .nq-frac-den { padding: 0 5px; }
        .nq-vec { position: relative; display: inline-block; }
        .nq-vec-arrow { position: absolute; top: -0.55em; left: 50%; transform: translateX(-50%); font-size: 0.8em; line-height: 1; letter-spacing: -0.05em; pointer-events: none; }
        .nq-vec-body { padding: 0 1px; }
        .nq-hat { position: relative; display: inline-block; }
        .nq-hat-cap { position: absolute; top: -0.55em; left: 50%; transform: translateX(-55%) scaleX(1.1); font-size: 0.85em; line-height: 1; pointer-events: none; }
        .nq-hat-body { padding: 0 1px; }
        .nq-sqrt { border-top: 1px solid var(--color-ink); padding: 0 2px; }
        .nq-sqrt-body { border-top: 1px solid var(--color-ink); padding: 0 2px; }

        .nq-options { display: flex; flex-direction: column; gap: 0.45rem; margin-top: 0.2rem; }
        .nq-option {
          display: flex; align-items: flex-start; gap: 0.65rem; border: 1.5px solid var(--color-rule); border-radius: var(--radius-input);
          padding: 0.65rem 0.75rem; background: var(--color-paper); transition: border-color var(--dur-micro), background var(--dur-micro);
        }
        .nq-option.correct { border-color: var(--color-mint-deep); background: var(--color-tint-mint); }
        .nq-opt-key-badge {
          flex: 0 0 auto; width: 28px; height: 28px; border: 1.5px solid var(--color-rule-2); border-radius: var(--radius-sm);
          display: grid; place-items: center; font-family: var(--font-mono);
          font-size: 0.72rem; font-weight: 600; color: var(--color-ink-2); background: var(--color-paper-2);
        }
        .nq-option.correct .nq-opt-key-badge { background: var(--color-mint); border-color: var(--color-mint); color: var(--color-ink); }
        .nq-opt-text { flex: 1; min-width: 0; overflow-wrap: anywhere; }
        .nq-opt-img { max-height: 60px; max-width: 160px; margin-top: 0.5rem; border: 1px solid var(--color-rule); border-radius: var(--radius-sm); object-fit: contain; }
        .nq-correct-tag {
          flex: 0 0 auto; font-family: var(--font-body); font-size: 0.55rem; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.1em; color: var(--color-mint-deep); border-radius: var(--radius-pill); padding: 0.15rem 0.5rem;
          background: var(--color-tint-mint); align-self: center;
        }
        .nq-placeholder { color: var(--color-muted); font-style: normal; }
        .nq-empty-hint { color: var(--color-muted); font-size: 0.85rem; line-height: 1.6; }

      `}</style>

      <header className="nq-header">
        <div>
          <h1 className="nq-header-title">{title.indexOf(" ") === -1 ? <span className="hl">{title}</span> : (
            <>
              {title.split(" ")[0]} <span className="hl">{title.split(" ").slice(1).join(" ")}</span>
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
            <label htmlFor="chapter">Chapter <span className="nq-req" aria-hidden="true">*</span></label>
            <div className="nq-select" ref={chapterRef}>
              <input
                ref={chapterInputRef}
                id="chapter"
                type="text"
                role="combobox"
                aria-expanded={chapterOpen}
                aria-haspopup="listbox"
                aria-autocomplete="list"
                aria-controls="nq-chapter-listbox"
                aria-activedescendant={
                  chapterOpen && chapterHighlight < chapterMatches.length
                    ? `nq-chapter-opt-${chapterHighlight}`
                    : chapterOpen && createRowVisible
                      ? "nq-chapter-create"
                      : undefined
                }
                value={chapter}
                placeholder="e.g. Kinematics, Thermodynamics"
                autoComplete="off"
                required
                onFocus={() => setChapterOpen(true)}
                onClick={() => setChapterOpen(true)}
                onChange={(e) => {
                  onChapterChange(e.target.value);
                  setChapterOpen(true);
                  setChapterHighlight(0);
                }}
                onKeyDown={onChapterKeyDown}
              />
              <button
                type="button"
                className="nq-caret-btn"
                tabIndex={-1}
                aria-hidden="true"
                onClick={() => setChapterOpen((o) => !o)}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {chapterOpen && (
                <ul className="nq-select-menu" role="listbox" id="nq-chapter-listbox" aria-label="Chapters">
                  {chapterMatches.map((c, i) => (
                    <li
                      key={c}
                      role="option"
                      id={`nq-chapter-opt-${i}`}
                      aria-selected={c === chapter}
                      className={`nq-select-opt${c === chapter ? " sel" : ""}${i === chapterHighlight ? " hi" : ""}`}
                      onMouseEnter={() => setChapterHighlight(i)}
                      onClick={() => pickChapter(c)}
                    >
                      {c}
                    </li>
                  ))}
                  {chapterMatches.length === 0 && (
                    <li className="nq-chapter-empty">
                      {existingChapters.length === 0
                        ? "No chapters yet — type one, it will be created on save."
                        : "No matches — keep typing to create a new one."}
                    </li>
                  )}
                  {chapterTerm && !chapterExactMatch && (
                    <li
                      role="option"
                      aria-selected={false}
                      id="nq-chapter-create"
                      className="nq-select-opt nq-chapter-create"
                      onMouseEnter={() => setChapterHighlight(chapterMatches.length)}
                      onClick={() => setChapterOpen(false)}
                    >
                      Create chapter “{chapter.trim()}”
                    </li>
                  )}
                </ul>
              )}
            </div>
            <div className="nq-hint">Required — used to group questions when adding them to an exam by chapter.</div>
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
                  <>Image attached (change)</>
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
        {saved && <div className="nq-toast">Question saved — returning to list…</div>}
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
                ? "Saved"
                : "Save Question"}
        </button>
        {isDirty && !saving && !saved && !error && (
          <div className="nq-hint" style={{ textAlign: "center", marginTop: 8 }}>
            You have unsaved changes.
          </div>
        )}
      </div>

      <ConfirmDialog
        open={leaveConfirm !== null}
        title={leaveConfirm === "upload" ? "Leave with an image still uploading?" : "Leave without saving?"}
        description={
          leaveConfirm === "upload"
            ? "An image is still uploading. Leaving now will cancel the upload and discard this question."
            : "You have unsaved changes. Leaving this page will discard them."
        }
        confirmLabel={leaveConfirm === "upload" ? "Leave anyway" : "Discard changes"}
        danger
        onCancel={() => setLeaveConfirm(null)}
        onConfirm={() => {
          setLeaveConfirm(null);
          router.push(backHref);
        }}
      />
    </div>
  );
}
