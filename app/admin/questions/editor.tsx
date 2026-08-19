"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Question, QuestionOption as Option, QuestionType } from "@/lib/questions";
import { MathPreview } from "../shared";

const PLACEHOLDER = "Type using LaTeX-style syntax: $x^2$, $\\frac{a}{b}$, $\\vec{v}$, $\\sqrt{x}$";

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
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
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
          ref={ref as React.RefObject<HTMLTextAreaElement>}
          className="nq-math-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
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
  const [imageUrl, setImageUrl] = useState<string | undefined>(initial?.imageUrl);
  const [uploading, setUploading] = useState(false);
  const [chapter, setChapter] = useState(initial?.chapter ?? "");
  const [typeOpen, setTypeOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const typeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!typeOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (typeRef.current && !typeRef.current.contains(e.target as Node)) {
        setTypeOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [typeOpen]);

  const setOptText = (id: string, text: string) =>
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, text } : o)));
  const setOptImage = (id: string, imageUrl: string | undefined) =>
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, imageUrl } : o)));
  const toggleCorrect = (id: string) =>
    setOptions((prev) =>
      prev.map((o) =>
        o.id === id
          ? { ...o, correct: type === "single" ? true : !o.correct }
          : type === "single"
          ? { ...o, correct: false }
          : o
      )
    );

  const onImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("image", f);
      const res = await fetch(
        "https://api.imgbb.com/1/upload?key=4125525efeb9a21fe49db324919cdeaf",
        { method: "POST", body: form }
      );
      const data = (await res.json()) as {
        success?: boolean;
        data?: { url?: string; display_url?: string };
      };
      if (data.success && data.data?.url) {
        setImageUrl(data.data.url);
      } else {
        throw new Error("Upload failed");
      }
    } catch {
      setImageUrl(URL.createObjectURL(f));
    } finally {
      setUploading(false);
    }
  };

  const onOptionImage = async (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const form = new FormData();
      form.append("image", f);
      const res = await fetch(
        "https://api.imgbb.com/1/upload?key=4125525efeb9a21fe49db324919cdeaf",
        { method: "POST", body: form }
      );
      const data = (await res.json()) as {
        success?: boolean;
        data?: { url?: string; display_url?: string };
      };
      if (data.success && data.data?.url) {
        setOptImage(id, data.data.url);
      } else {
        throw new Error("Upload failed");
      }
    } catch {
      setOptImage(id, URL.createObjectURL(f));
    } finally {
      e.target.value = "";
    }
  };

  const save = async () => {
    const filled = options.filter((o) => o.text.trim().length > 0 || Boolean(o.imageUrl));
    if (!prompt.trim() || filled.length !== 4 || !filled.some((o) => o.correct)) {
      setError("Please fill the question text, all 4 options, and mark at least one correct answer.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        type,
        prompt: prompt.trim(),
        options: filled,
        marks: 0,
        negative: 0,
        chapter: chapter.trim() || undefined,
        imageUrl,
      });
      router.push(backHref);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save the question. Please try again.");
      setSaving(false);
    }
  };

  const filled = options.filter((o) => o.text.trim().length > 0 || Boolean(o.imageUrl));

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

        .nq-stepper { display: flex; align-items: stretch; }
        .nq-stepper input {
          flex: 1; width: 100%; background: transparent; border: 1px solid var(--ink); border-right: 0;
          border-radius: 0; padding: 12px 14px; font-family: 'JetBrains Mono', monospace; font-size: 14px;
          color: var(--ink); outline: none;
        }
        .nq-stepper input:focus { background: #fff; }
        .nq-stepper-btns { display: flex; flex-direction: column; border: 1px solid var(--ink); border-left: 0; }
        .nq-stepper-btns button {
          flex: 1; width: 34px; background: transparent; border: 0; border-bottom: 1px solid var(--ink);
          cursor: pointer; color: var(--ink-2); font-size: 9px; line-height: 1; display: grid; place-items: center;
        }
        .nq-stepper-btns button:last-child { border-bottom: 0; }
        .nq-stepper-btns button:hover { background: var(--accent); color: #fff; }

        .nq-hint { font-size: 11px; color: var(--dim); margin-top: 6px; font-family: 'JetBrains Mono', monospace; }

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
          border: 1px solid var(--rule); padding: 10px 12px; display: block; cursor: pointer;
        }
        .nq-file input { display: none; }
        .nq-file-sm { display: inline-block; padding: 6px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; }
        .nq-file-sm-remove {
          background: transparent; border: 1px solid var(--rule); color: var(--ink-2);
          font-family: 'JetBrains Mono', monospace; font-size: 10px; text-transform: uppercase;
          letter-spacing: 0.08em; padding: 6px 10px; cursor: pointer;
        }
        .nq-file-sm-remove:hover { color: var(--accent); border-color: var(--accent); }
        .nq-img-preview { max-height: 90px; margin-top: 10px; border: 1px solid var(--rule); }

        .nq-footer { padding: 0 34px 34px; max-width: 1280px; margin: 0 auto; }
        .nq-error {
          font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--accent);
          margin-bottom: 12px; line-height: 1.5;
        }
        .nq-submit {
          width: 100%; background: var(--accent); color: #fff; border: 1px solid var(--accent);
          padding: 14px; font-family: 'Inter', sans-serif; font-weight: 600; font-size: 14px;
          letter-spacing: 0.04em; cursor: pointer; text-transform: uppercase;
        }
        .nq-submit:hover { background: var(--accent-2); border-color: var(--accent-2); }
        .nq-submit:disabled { opacity: 0.6; cursor: not-allowed; }

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
        .nq-vec { position: relative; }
        .nq-vec-arrow { display: inline-block; margin-left: 1px; }
        .nq-hat { position: relative; display: inline-block; }
        .nq-hat-cap { position: absolute; top: -0.12em; left: 50%; transform: translateX(-50%); font-size: 0.82em; line-height: 1; }
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
        <button className="nq-back" onClick={() => router.push(backHref)} aria-label="Back to questions">
          ← Back
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
                      onClick={() => {
                        setType("single");
                        setTypeOpen(false);
                      }}
                    >
                      Single Correct
                    </li>
                    <li
                      role="option"
                      aria-selected={type === "mcq"}
                      className={`nq-select-opt${type === "mcq" ? " sel" : ""}`}
                      onClick={() => {
                        setType("mcq");
                        setTypeOpen(false);
                      }}
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
              onChange={(e) => setChapter(e.target.value)}
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
              value={prompt}
              onChange={setPrompt}
              placeholder={PLACEHOLDER}
              multiline
            />
            <div className="nq-hint">Use the toolbar to insert formulae, exponents, fractions, vectors and Greek symbols.</div>
          </div>

          <div className="nq-field">
            <label>Image (optional, max 1)</label>
            <label className="nq-file">
              {uploading
                ? "Uploading to ImgBB…"
                : imageUrl
                  ? "Image attached ✓ (change)"
                  : "Choose image…"}
              <input type="file" accept="image/*" onChange={onImage} disabled={uploading} />
            </label>
            {imageUrl && <img className="nq-img-preview" src={imageUrl} alt="preview" />}
          </div>

          <div className="nq-field">
            <label>Options (4 required) — optional image per option</label>
            {options.map((o, i) => (
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
                    value={o.text}
                    onChange={(v) => setOptText(o.id, v)}
                    placeholder="Option text — e.g. $\\vec{F} = m\\vec{a}$"
                  />
                  <div className="nq-opt-img-row">
                    {o.imageUrl && (
                      <img className="nq-opt-img-preview" src={o.imageUrl} alt="option preview" />
                    )}
                    <label className="nq-file nq-file-sm">
                      {o.imageUrl ? "Change image" : "+ Image"}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => onOptionImage(e, o.id)}
                      />
                    </label>
                    {o.imageUrl && (
                      <button
                        type="button"
                        className="nq-file-sm-remove"
                        onClick={() => setOptImage(o.id, undefined)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
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
                            {o.imageUrl && <img className="nq-opt-img" src={o.imageUrl} alt="option" />}
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

      <div className="nq-footer">
        {error && <div className="nq-error">{error}</div>}
        <button className="nq-submit" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save Question"}
        </button>
      </div>
    </div>
  );
}