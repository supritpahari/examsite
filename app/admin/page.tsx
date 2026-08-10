"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthState } from "@/lib/firebase/client";
import { signOut } from "firebase/auth";
import {
  fetchQuestions,
  addQuestion as saveQuestion,
  deleteQuestion,
  type Question,
  type QuestionOption as Option,
  type QuestionType,
} from "@/lib/questions";

const NAV = [
  { key: "questions", label: "Questions" },
  { key: "exams", label: "Exams" },
  { key: "results", label: "Results" },
  { key: "faculty", label: "Faculty" },
  { key: "settings", label: "Settings" },
];

function NavIcon({ name }: { name: string }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "questions":
      return (
        <svg {...common}><path d="M9.1 9a3 3 0 1 1 4.2 2.7c-.8.4-1.3 1.1-1.3 2.1V14" /><line x1="12" y1="17.5" x2="12" y2="17.5" /></svg>
      );
    case "exams":
      return (
        <svg {...common}><path d="M5 4h11l3 3v13H5z" /><path d="M9 9h6M9 13h6" /></svg>
      );
    case "results":
      return (
        <svg {...common}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
      );
    case "faculty":
      return (
        <svg {...common}><circle cx="12" cy="8" r="3.2" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>
      );
    case "settings":
      return (
        <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" /></svg>
      );
    case "signout":
      return (
        <svg {...common}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 12h10M17 9l3 3-3 3" /></svg>
      );
    default:
      return null;
  }
}

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

export default function AdminDashboard() {
  const [collapsed, setCollapsed] = useState(false);
  const [active, setActive] = useState("questions");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [explain, setExplain] = useState<{
    q: Question;
    text: string;
    loading: boolean;
    error: string;
  } | null>(null);

  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthState((user) => {
      if (user) {
        setAuthed(true);
        setChecking(false);
        fetchQuestions()
          .then(setQuestions)
          .catch(() => setQuestions([]))
          .finally(() => setLoadingQuestions(false));
      } else {
        router.replace("/admin/login");
      }
    });
    return unsub;
  }, [router]);

  const addQuestion = async (q: Omit<Question, "id" | "createdAt">) => {
    const saved = await saveQuestion(q);
    setQuestions((prev) => [saved, ...prev]);
    setModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this question? This cannot be undone.")) return;
    setQuestions((prev) => prev.filter((q) => q.id !== id));
    try {
      await deleteQuestion(id);
    } catch {
      // reload to restore state if delete failed
      fetchQuestions().then(setQuestions).catch(() => {});
    }
  };

  const handleSignOut = async () => {
    const { getAuthInstance } = await import("@/lib/firebase/client");
    await signOut(getAuthInstance());
    router.replace("/admin/login");
  };

  const generateExplanation = async (q: Question) => {
    const apiKey =
      typeof window !== "undefined" ? localStorage.getItem(GROQ_STORAGE_KEY) : null;
    const baseUrl =
      (typeof window !== "undefined"
        ? localStorage.getItem(GROQ_BASE_KEY) || GROQ_DEFAULT_BASE
        : GROQ_DEFAULT_BASE
      ).replace(/\/+$/, "");
    const model =
      typeof window !== "undefined" ? localStorage.getItem(GROQ_MODEL_KEY) : null;

    if (!apiKey || !model) {
      setExplain({ q, text: "", loading: false, error: "Add your Groq API key and pick a model in Settings first." });
      return;
    }

    const correctLetters = q.options
      .map((o, i) => ({ o, i }))
      .filter(({ o }) => o.correct)
      .map(({ i }) => String.fromCharCode(65 + i));
    const optionLines = q.options
      .map((o, i) => `${String.fromCharCode(65 + i)}. ${o.text}`)
      .join("\n");

    const prompt = `You are a JEE/NEET exam tutor. Explain the solution to this question clearly, step by step, and justify why the correct answer (${correctLetters.join(", ")}) is right and the others are wrong. Use plain text; you may use simple LaTeX-like notation for formulas if needed.\n\nQuestion: ${q.prompt}\n\nOptions:\n${optionLines}`;

    setExplain({ q, text: "", loading: true, error: "" });
    try {
      const res = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Request failed (${res.status}). ${detail.slice(0, 200)}`.trim());
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data?.choices?.[0]?.message?.content?.trim() ?? "";
      setExplain({ q, text: content || "(No explanation returned.)", loading: false, error: "" });
    } catch (err) {
      setExplain({
        q,
        text: "",
        loading: false,
        error: err instanceof Error ? err.message : "Failed to generate explanation.",
      });
    }
  };

  const closeExplain = () => setExplain(null);

  if (checking || !authed) {
    return (
      <div className="ad-guard">
        <style>{`
          .ad-guard {
            min-height: 100vh;
            display: grid;
            place-items: center;
            background: #f4f0e8;
            color: #8a8275;
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.16em;
          }
        `}</style>
        Checking session…
    </div>
  );
}

  return (
    <div
      className="ad-root"
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
        .ad-root {
          height: 100vh;
          overflow: hidden;
          background: var(--paper);
          color: var(--ink);
          font-family: 'Inter', sans-serif;
          position: relative;
          display: grid;
          grid-template-columns: ${collapsed ? "64px" : "240px"} 1fr;
          transition: grid-template-columns 0.22s ease;
        }
        .ad-root::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image: radial-gradient(rgba(20,17,13,0.04) 1px, transparent 1px);
          background-size: 4px 4px;
          opacity: 0.6;
        }
        .ad-side {
          position: relative;
          border-right: 1px solid var(--rule);
          padding: 20px 14px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          overflow-y: auto;
        }
        .ad-brand {
          font-family: 'Instrument Serif', serif;
          font-size: 20px;
          display: flex;
          align-items: baseline;
          gap: 6px;
          padding: 4px 8px 18px;
          white-space: nowrap;
          overflow: hidden;
        }
        .ad-brand em { font-style: italic; color: var(--accent); }
        .ad-toggle {
          position: absolute;
          top: 22px;
          right: -12px;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: var(--ink);
          color: var(--paper);
          border: 0;
          cursor: pointer;
          font-size: 12px;
          display: grid;
          place-items: center;
          z-index: 5;
        }
        .ad-nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 11px 12px;
          border-radius: 0;
          border: 1px solid transparent;
          background: transparent;
          color: var(--ink-2);
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          cursor: pointer;
          white-space: nowrap;
          overflow: hidden;
          text-align: left;
          width: 100%;
        }
        .ad-nav-item .dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: var(--dim); flex: 0 0 auto;
        }
        .ad-nav-item:hover { color: var(--ink); background: var(--paper-2); }
        .ad-nav-item.active { color: var(--accent); border-color: var(--rule); background: var(--paper-2); }
        .ad-nav-item.active .dot { background: var(--accent); }
        .ad-signout {
          margin-top: auto;
          display: flex; align-items: center; gap: 10px;
          padding: 11px 12px; background: transparent; border: 1px solid var(--rule);
          color: var(--dim); font-family: 'JetBrains Mono', monospace; font-size: 11px;
          text-transform: uppercase; letter-spacing: 0.08em; cursor: pointer; white-space: nowrap;
          overflow: hidden; width: 100%; text-align: left;
        }
        .ad-signout:hover { color: var(--accent); border-color: var(--accent); }
        .ad-nav-icon { width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; flex: 0 0 auto; color: inherit; }
        .ad-brand-text { white-space: nowrap; }
        .ad-root.collapsed .ad-brand-text { display: none; }
        .ad-root.collapsed .ad-nav-label {
          opacity: 0;
          max-width: 0;
          overflow: hidden;
          transition: opacity 0.18s ease;
        }
        .ad-root.collapsed .ad-nav-item,
        .ad-root.collapsed .ad-signout { justify-content: center; padding-left: 0; padding-right: 0; }
        .ad-root:not(.collapsed) .ad-nav-label { opacity: 1; transition: opacity 0.18s ease; }

        .ad-main {
          position: relative;
          padding: 32px 40px;
          overflow-y: auto;
        }
        .ad-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          margin-bottom: 28px;
        }
        .ad-title { font-family: 'Instrument Serif', serif; font-size: 40px; line-height: 1; letter-spacing: -0.02em; }
        .ad-title em { font-style: italic; color: var(--accent); }
        .ad-count { font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--dim); }
        .ad-empty { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--dim); padding: 28px 0; border: 1px dashed var(--rule); text-align: center; letter-spacing: 0.04em; }

        .ad-q {
          border: 1px solid var(--rule);
          background: var(--paper);
          padding: 20px 22px;
          margin-bottom: 16px;
        }
        .ad-q-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 12px; }
        .ad-q-top-right { display: flex; align-items: center; gap: 12px; }
        .ad-q-type {
          font-family: 'JetBrains Mono', monospace; font-size: 10px; text-transform: uppercase;
          letter-spacing: 0.14em; color: var(--accent); border: 1px solid var(--rule); padding: 3px 8px;
        }
        .ad-q-meta { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--dim); }
        .ad-q-del {
          font-family: 'JetBrains Mono', monospace; font-size: 10px; text-transform: uppercase;
          letter-spacing: 0.1em; color: var(--dim); background: transparent;
          border: 1px solid var(--rule); padding: 4px 10px; cursor: pointer; transition: all 0.15s ease;
        }
        .ad-q-del:hover { color: #fff; background: #b3261e; border-color: #b3261e; }
        .ad-q-prompt { font-family: 'Instrument Serif', serif; font-size: 19px; line-height: 1.4; color: var(--ink); margin-bottom: 14px; }
        .ad-q-img { max-height: 160px; border: 1px solid var(--rule); margin-bottom: 14px; }
        .ad-opts { display: grid; gap: 8px; }
        .ad-opt { display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--ink-2); }
        .ad-opt .k { width: 24px; height: 24px; border: 1px solid var(--rule); display: grid; place-items: center; font-family: 'JetBrains Mono', monospace; font-size: 11px; flex: 0 0 auto; }
        .ad-opt.correct { color: var(--accent); }
        .ad-opt.correct .k { background: var(--accent); color: #fff; border-color: var(--accent); }

        .ad-q-gen {
          font-family: 'JetBrains Mono', monospace; font-size: 10px; text-transform: uppercase;
          letter-spacing: 0.1em; color: var(--dim); background: transparent;
          border: 1px solid var(--rule); padding: 4px 10px; cursor: pointer; transition: all 0.15s ease;
          display: inline-flex; align-items: center; gap: 6px;
        }
        .ad-q-gen:hover { color: var(--accent); border-color: var(--accent); }
        .ad-q-gen:disabled { opacity: 0.55; cursor: not-allowed; }
        .ad-q-gen .spark { color: var(--accent); }

        .ad-explain-body {
          font-family: 'Inter', sans-serif; font-size: 15px; line-height: 1.7; color: var(--ink-2);
          white-space: pre-wrap; word-break: break-word; max-height: 52vh; overflow-y: auto;
        }
        .ad-explain-status {
          font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.06em;
          margin-top: 14px;
        }
        .ad-explain-status.loading { color: var(--dim); }
        .ad-explain-status.err { color: #b3261e; }

        .ad-fab {
          position: fixed;
          bottom: 32px;
          right: 32px;
          background: var(--accent);
          color: #fff;
          border: 0;
          border-radius: 999px;
          height: 56px;
          padding: 0 24px 0 18px;
          font-size: 14px;
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          letter-spacing: 0.02em;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(0,0,0,0.25);
          display: flex;
          align-items: center;
          gap: 10px;
          z-index: 50;
          transition: transform 0.15s ease, background 0.15s ease;
        }
        .ad-fab .plus { font-size: 24px; line-height: 1; }
        .ad-fab:hover { transform: scale(1.04); background: var(--accent-2); }

        .ad-overlay {
          position: fixed; inset: 0; background: rgba(20,17,13,0.55);
          display: flex; align-items: flex-start; justify-content: center;
          padding: 40px 24px; z-index: 100; overflow-y: auto;
        }
        .ad-modal {
          width: 100%; max-width: 620px; background: var(--paper);
          border: 1px solid var(--ink); position: relative; padding: 36px 32px 28px;
        }
        .ad-modal::before, .ad-modal::after {
          content: ""; position: absolute; width: 12px; height: 12px; background: var(--ink);
        }
        .ad-modal::before { top: -1px; left: -1px; }
        .ad-modal::after { bottom: -1px; right: -1px; }
        .ad-close {
          position: absolute; top: 14px; right: 16px; background: transparent;
          border: 1px solid var(--ink); width: 30px; height: 30px; font-size: 16px;
          cursor: pointer; color: var(--ink); line-height: 1;
        }
        .ad-close:hover { background: var(--ink); color: var(--paper); }
        .ad-form-title { font-family: 'Instrument Serif', serif; font-size: 26px; margin: 0 0 18px; }
        .ad-form-title em { font-style: italic; color: var(--accent); }

        .ad-row { display: flex; gap: 14px; margin-bottom: 16px; }
        .ad-row > * { flex: 1; }
        .ad-field label {
          display: block; font-family: 'JetBrains Mono', monospace; font-size: 10px;
          text-transform: uppercase; letter-spacing: 0.16em; color: var(--ink-2); margin-bottom: 8px;
        }
        .ad-field input, .ad-field textarea, .ad-field select {
          width: 100%; background: transparent; border: 1px solid var(--ink); border-radius: 0;
          padding: 12px 14px; font-family: 'JetBrains Mono', monospace; font-size: 14px; color: var(--ink); outline: none;
        }
        .ad-field textarea { resize: vertical; min-height: 70px; line-height: 1.5; }
        .ad-field input:focus, .ad-field textarea:focus, .ad-field select:focus { background: #fff; }

        .ad-select { position: relative; }
        .ad-select-trigger {
          width: 100%; background: transparent; border: 1px solid var(--ink); border-radius: 0;
          padding: 12px 14px; font-family: 'JetBrains Mono', monospace; font-size: 14px; color: var(--ink);
          outline: none; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px;
        }
        .ad-select-trigger:focus { background: #fff; }
        .ad-caret { transition: transform 0.18s ease; font-size: 12px; color: var(--dim); }
        .ad-caret.open { transform: rotate(180deg); }
        .ad-select-menu {
          position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 20;
          list-style: none; margin: 0; padding: 4px; background: var(--paper);
          border: 1px solid var(--ink); box-shadow: 6px 6px 0 rgba(20,17,13,0.12);
        }
        .ad-select-opt {
          padding: 10px 12px; font-family: 'JetBrains Mono', monospace; font-size: 13px;
          color: var(--ink-2); cursor: pointer; border: 1px solid transparent;
        }
        .ad-select-opt:hover { background: var(--paper-2); color: var(--ink); }
        .ad-select-opt.sel { color: var(--accent); border-color: var(--rule); background: var(--paper-2); }

        .ad-stepper { display: flex; align-items: stretch; }
        .ad-stepper input {
          flex: 1; width: 100%; background: transparent; border: 1px solid var(--ink); border-right: 0;
          border-radius: 0; padding: 12px 14px; font-family: 'JetBrains Mono', monospace; font-size: 14px;
          color: var(--ink); outline: none;
        }
        .ad-stepper input:focus { background: #fff; }
        .ad-stepper-btns { display: flex; flex-direction: column; border: 1px solid var(--ink); border-left: 0; }
        .ad-stepper-btns button {
          flex: 1; width: 34px; background: transparent; border: 0; border-bottom: 1px solid var(--ink);
          cursor: pointer; color: var(--ink-2); font-size: 9px; line-height: 1; display: grid; place-items: center;
        }
        .ad-stepper-btns button:last-child { border-bottom: 0; }
        .ad-stepper-btns button:hover { background: var(--accent); color: #fff; }

        .ad-hint { font-size: 11px; color: var(--dim); margin-top: 6px; font-family: 'JetBrains Mono', monospace; }

        .ad-q-label {
          display: block; font-family: 'JetBrains Mono', monospace; font-size: 10px;
          text-transform: uppercase; letter-spacing: 0.16em; color: var(--ink-2); margin-bottom: 8px;
        }
        .ad-toolbar {
          display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 0;
          border: 1px solid var(--rule); border-bottom: 0; padding: 8px;
          background: var(--paper-2);
        }
        .ad-tool {
          min-width: 34px; height: 32px; padding: 0 8px; background: var(--paper);
          border: 1px solid var(--rule); cursor: pointer; font-family: 'JetBrains Mono', monospace;
          font-size: 13px; color: var(--ink-2); line-height: 1;
        }
        .ad-tool:hover { color: var(--accent); border-color: var(--accent); }
        .ad-tool:active { transform: translateY(1px); }
        .ad-field > .ad-toolbar + textarea,
        .ad-field > .ad-toolbar + input { border-top: 0; }
        .ad-field > .ad-toolbar + textarea { resize: vertical; min-height: 90px; line-height: 1.5; }
        .MathField-input { width: 100%; }
        .ad-opt-edit .ad-field { flex: 1; margin-bottom: 0; }
        .ad-preview {
          margin-top: 10px; border: 1px solid var(--ink); background: #fffdf8;
          box-shadow: 4px 4px 0 var(--rule);
        }
        .ad-preview-label {
          display: block; font-family: 'JetBrains Mono', monospace; font-size: 9px;
          text-transform: uppercase; letter-spacing: 0.18em; color: var(--dim);
          padding: 6px 12px 0;
        }
        .ad-preview-body {
          padding: 8px 12px 12px; font-family: 'Georgia', 'Times New Roman', serif;
          font-size: 18px; color: var(--ink); line-height: 1.7; word-break: break-word;
          min-height: 24px;
        }
        .ad-prev-math { padding: 0 1px; }
        .ad-frac { display: inline-flex; flex-direction: column; vertical-align: middle; text-align: center; margin: 0 2px; font-size: 0.78em; }
        .ad-frac-num { border-bottom: 1px solid var(--ink); padding: 0 5px; }
        .ad-frac-den { padding: 0 5px; }
        .ad-vec { position: relative; }
        .ad-vec-arrow { display: inline-block; margin-left: 1px; }
        .ad-sqrt { border-top: 1px solid var(--ink); padding: 0 2px; }
        .ad-sqrt-body { border-top: 1px solid var(--ink); padding: 0 2px; }
        .ad-preview-inline {
          font-family: 'Georgia', 'Times New Roman', serif; font-size: 17px;
          color: var(--ink); line-height: 1.6; word-break: break-word;
        }

        .ad-opt-edit { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 8px; transition: background 0.15s ease; }
        .ad-opt-edit.correct-row { background: rgba(220, 60, 40, 0.08); border: 1px solid var(--accent); padding: 6px; }
        .ad-opt-edit input[type="text"] { flex: 1; }
        .ad-opt-key {
          flex: 0 0 auto; width: 32px; height: 32px; border: 1px solid var(--rule);
          background: var(--paper); color: var(--ink-2); cursor: pointer;
          font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 600;
          display: grid; place-items: center; transition: all 0.15s ease;
        }
        .ad-opt-key:hover { border-color: var(--accent); color: var(--accent); }
        .ad-opt-key.correct { background: var(--accent); color: #fff; border-color: var(--accent); }
        .ad-opt-del {
          background: transparent; border: 1px solid var(--rule); color: var(--dim);
          width: 28px; height: 28px; cursor: pointer; flex: 0 0 auto; align-self: center;
        }
        .ad-opt-del:hover { color: var(--accent); border-color: var(--accent); }
        .ad-add-opt {
          background: transparent; border: 1px dashed var(--rule); color: var(--ink-2);
          padding: 8px 12px; cursor: pointer; font-family: 'JetBrains Mono', monospace; font-size: 11px;
          text-transform: uppercase; letter-spacing: 0.1em;
        }
        .ad-add-opt:hover { color: var(--accent); border-color: var(--accent); }
        .ad-file {
          font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--ink-2);
          border: 1px solid var(--rule); padding: 10px 12px; display: block; cursor: pointer;
        }
        .ad-file input { display: none; }
        .ad-submit {
          width: 100%; background: var(--accent); color: #fff; border: 1px solid var(--accent);
          padding: 14px; font-family: 'Inter', sans-serif; font-weight: 600; font-size: 14px;
          letter-spacing: 0.04em; cursor: pointer; text-transform: uppercase; margin-top: 6px;
        }
        .ad-submit:hover { background: var(--accent-2); border-color: var(--accent-2); }
        .ad-img-preview { max-height: 90px; margin-top: 10px; border: 1px solid var(--rule); }

        .ad-set-card {
          border: 1px solid var(--rule);
          background: var(--paper);
          padding: 24px 26px;
          max-width: 620px;
          margin-bottom: 20px;
        }
        .ad-set-card-title {
          font-family: 'Instrument Serif', serif; font-size: 22px; margin: 0 0 6px;
        }
        .ad-set-card-title em { font-style: italic; color: var(--accent); }
        .ad-set-desc { font-size: 13px; line-height: 1.6; color: var(--ink-2); margin: 0 0 20px; }
        .ad-set-desc code {
          font-family: 'JetBrains Mono', monospace; font-size: 12px;
          background: var(--paper-2); padding: 1px 5px; border: 1px solid var(--rule);
        }
        .ad-set-row { display: flex; gap: 10px; align-items: stretch; }
        .ad-set-row input {
          flex: 1; background: transparent; border: 1px solid var(--ink); border-radius: 0;
          padding: 12px 14px; font-family: 'JetBrains Mono', monospace; font-size: 14px;
          color: var(--ink); outline: none;
        }
        .ad-set-row input:focus { background: #fff; }
        .ad-set-btn {
          background: var(--accent); color: #fff; border: 1px solid var(--accent);
          padding: 0 22px; font-family: 'Inter', sans-serif; font-weight: 600; font-size: 14px;
          letter-spacing: 0.04em; cursor: pointer; text-transform: uppercase; white-space: nowrap;
        }
        .ad-set-btn:hover { background: var(--accent-2); border-color: var(--accent-2); }
        .ad-set-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .ad-set-btn.ghost { background: transparent; color: var(--ink-2); border-color: var(--rule); }
        .ad-set-btn.ghost:hover { color: var(--accent); border-color: var(--accent); }
        .ad-set-status { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.06em; margin-top: 12px; }
        .ad-set-status.ok { color: var(--accent); }
        .ad-set-status.err { color: #b3261e; }
        .ad-set-status.dim { color: var(--dim); }

        .ad-set-model { max-width: 620px; margin-top: 8px; }
        .ad-set-hint { font-size: 11px; color: var(--dim); margin-top: 8px; font-family: 'JetBrains Mono', monospace; }

        .ad-model {
          position: relative;
        }
        .ad-model-trigger {
          width: 100%; background: transparent; border: 1px solid var(--ink); border-radius: 0;
          padding: 13px 14px; font-family: 'JetBrains Mono', monospace; font-size: 14px; color: var(--ink);
          outline: none; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px;
        }
        .ad-model-trigger:focus { background: #fff; }
        .ad-model-trigger.placeholder { color: var(--dim); }
        .ad-model-caret { transition: transform 0.18s ease; font-size: 12px; color: var(--dim); }
        .ad-model-caret.open { transform: rotate(180deg); }
        .ad-model-menu {
          position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 20;
          background: var(--paper); border: 1px solid var(--ink);
          box-shadow: 6px 6px 0 rgba(20,17,13,0.12); display: flex; flex-direction: column;
          max-height: 320px;
        }
        .ad-model-search {
          border: 0; border-bottom: 1px solid var(--rule); background: var(--paper-2);
          padding: 12px 14px; font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--ink); outline: none;
        }
        .ad-model-list { list-style: none; margin: 0; padding: 4px; overflow-y: auto; }
        .ad-model-opt {
          padding: 10px 12px; font-family: 'JetBrains Mono', monospace; font-size: 13px;
          color: var(--ink-2); cursor: pointer; border: 1px solid transparent;
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
        }
        .ad-model-opt:hover { background: var(--paper-2); color: var(--ink); }
        .ad-model-opt.sel { color: var(--accent); border-color: var(--rule); background: var(--paper-2); }
        .ad-model-opt .tag { font-size: 10px; color: var(--dim); letter-spacing: 0.08em; text-transform: uppercase; }
        .ad-model-empty { padding: 14px 12px; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--dim); }

        @media (max-width: 720px) {
          .ad-root { grid-template-columns: 1fr; }
          .ad-side { display: none; }
          .ad-main { padding: 24px 18px; }
        }
      `}</style>

      <aside className={`ad-side${collapsed ? " collapsed" : ""}`}>
        <button className="ad-toggle" onClick={() => setCollapsed((c) => !c)} aria-label="Toggle sidebar">
          {collapsed ? "»" : "«"}
        </button>
        <div className="ad-brand">
          <span className="ad-brand-text">Exam<em>Site</em></span>
        </div>
        {NAV.map((n) => (
          <button
            key={n.key}
            className={`ad-nav-item${active === n.key ? " active" : ""}`}
            onClick={() => setActive(n.key)}
            title={n.label}
          >
            <span className="ad-nav-icon"><NavIcon name={n.key} /></span>
            <span className="ad-nav-label">{n.label}</span>
          </button>
        ))}
        <button className="ad-signout" onClick={handleSignOut} title="Sign out">
          <span className="ad-nav-icon"><NavIcon name="signout" /></span>
          <span className="ad-nav-label">Sign out</span>
        </button>
      </aside>

      <main className="ad-main">
        {active === "questions" && (
          <>
            <div className="ad-head">
              <h1 className="ad-title">All <em>Questions</em></h1>
              <span className="ad-count">{questions.length} in bank</span>
            </div>

            {loadingQuestions && <div className="ad-empty">Loading questions…</div>}

            {!loadingQuestions && questions.length === 0 && (
              <div className="ad-empty">
                No questions yet. Tap <strong>+</strong> to add your first one.
              </div>
            )}

            {questions.map((q) => (
              <div className="ad-q" key={q.id}>
                <div className="ad-q-top">
                  <span className="ad-q-type">{q.type === "mcq" ? "MCQ · Multi" : "Single Correct"}</span>
                  <span className="ad-q-top-right">
                    <span className="ad-q-meta">+{q.marks} / -{q.negative}</span>
                    <button
                      type="button"
                      className="ad-q-gen"
                      onClick={() => generateExplanation(q)}
                      aria-label="Generate explanation"
                    >
                      <span className="spark">✦</span> Generate
                    </button>
                    <button
                      type="button"
                      className="ad-q-del"
                      onClick={() => handleDelete(q.id)}
                      aria-label="Delete question"
                    >
                      Delete
                    </button>
                  </span>
                </div>
                <div className="ad-q-prompt">
                  <MathPreview text={q.prompt} compact />
                </div>
                {q.imageUrl && <img className="ad-q-img" src={q.imageUrl} alt="question" />}
                <div className="ad-opts">
                  {q.options.map((o, i) => (
                    <div className={`ad-opt${o.correct ? " correct" : ""}`} key={o.id}>
                      <span className="k">{String.fromCharCode(65 + i)}</span>
                      <span className="ad-opt-text"><MathPreview text={o.text} compact /></span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {active === "settings" && (
          <>
            <div className="ad-head">
              <h1 className="ad-title">AI <em>Settings</em></h1>
              <span className="ad-count">Groq</span>
            </div>
            <SettingsPanel />
          </>
        )}

        {active !== "questions" && active !== "settings" && (
          <div className="ad-head">
            <h1 className="ad-title">{NAV.find((n) => n.key === active)?.label}</h1>
            <span className="ad-count">coming soon</span>
          </div>
        )}
      </main>

      {active === "questions" && (
        <button className="ad-fab" onClick={() => setModalOpen(true)} aria-label="Add question">
          <span className="plus">+</span> New Question
        </button>
      )}

      {modalOpen && (
        <AddQuestionModal onClose={() => setModalOpen(false)} onSave={addQuestion} />
      )}

      {explain && (
        <ExplanationDialog
          q={explain.q}
          text={explain.text}
          loading={explain.loading}
          error={explain.error}
          onClose={closeExplain}
        />
      )}
    </div>
  );
}

function AddQuestionModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (q: Omit<Question, "id" | "createdAt">) => void;
}) {
  const [type, setType] = useState<QuestionType>("single");
  const [prompt, setPrompt] = useState("");
  const [marks, setMarks] = useState("4");
  const [negative, setNegative] = useState("1");
  const [options, setOptions] = useState<Option[]>([
    { id: "a", text: "", correct: false },
    { id: "b", text: "", correct: false },
    { id: "c", text: "", correct: false },
    { id: "d", text: "", correct: false },
  ]);
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [typeOpen, setTypeOpen] = useState(false);
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
  const addOption = () => {
    if (options.length >= 4) return;
    const id = String.fromCharCode(97 + options.length);
    setOptions((prev) => [...prev, { id, text: "", correct: false }]);
  };
  const removeOption = (id: string) =>
    setOptions((prev) => prev.filter((o) => o.id !== id).slice(0, 4));
  const onImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setImageUrl(URL.createObjectURL(f));
  };

  const save = () => {
    const filled = options.filter((o) => o.text.trim().length > 0).slice(0, 4);
    if (!prompt.trim() || filled.length === 0 || !filled.some((o) => o.correct)) return;
    onSave({
      type,
      prompt: prompt.trim(),
      options: filled,
      marks: Number(marks) || 0,
      negative: Number(negative) || 0,
      imageUrl,
    });
  };

  return (
    <div className="ad-overlay" onClick={onClose}>
      <div className="ad-modal" onClick={(e) => e.stopPropagation()}>
        <button className="ad-close" onClick={onClose} aria-label="Close">×</button>
        <h3 className="ad-form-title">New <em>Question</em></h3>

        <div className="ad-row">
          <div className="ad-field">
            <label>Type</label>
            <div className="ad-select" ref={typeRef}>
              <button
                type="button"
                className="ad-select-trigger"
                onClick={() => setTypeOpen((o) => !o)}
                aria-haspopup="listbox"
                aria-expanded={typeOpen}
              >
                <span>{type === "single" ? "Single Correct" : "MCQ (Multiple)"}</span>
                <span className={`ad-caret${typeOpen ? " open" : ""}`}>▾</span>
              </button>
              {typeOpen && (
                <ul className="ad-select-menu" role="listbox">
                  <li
                    role="option"
                    aria-selected={type === "single"}
                    className={`ad-select-opt${type === "single" ? " sel" : ""}`}
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
                    className={`ad-select-opt${type === "mcq" ? " sel" : ""}`}
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
          <Stepper label="Marks" value={marks} onChange={setMarks} />
          <Stepper label="Negative" value={negative} onChange={setNegative} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label className="ad-q-label">Question {type === "mcq" ? "(select all correct)" : "(select one correct)"}</label>
          <MathField
            value={prompt}
            onChange={setPrompt}
            placeholder={PLACEHOLDER}
            multiline
          />
          <div className="ad-hint">Use the toolbar to insert formulae, exponents, fractions, vectors and Greek symbols.</div>
        </div>

        <div className="ad-field" style={{ marginBottom: 16 }}>
          <label>Options (max 4)</label>
          {options.map((o, i) => (
            <div className={`ad-opt-edit${o.correct ? " correct-row" : ""}`} key={o.id}>
              <button
                type="button"
                className={`ad-opt-key${o.correct ? " correct" : ""}`}
                onClick={() => toggleCorrect(o.id)}
                aria-pressed={o.correct}
                title={type === "single" ? "Select correct answer" : "Toggle correct answer"}
              >
                {String.fromCharCode(65 + i)}
              </button>
              <MathField
                value={o.text}
                onChange={(v) => setOptText(o.id, v)}
                placeholder="Option text — e.g. $\\vec{F} = m\\vec{a}$"
              />
              {options.length > 2 && (
                <button className="ad-opt-del" onClick={() => removeOption(o.id)} aria-label="Remove">×</button>
              )}
            </div>
          ))}
          {options.length < 4 && (
            <button className="ad-add-opt" onClick={addOption}>+ Add option</button>
          )}
        </div>

        <div className="ad-field" style={{ marginBottom: 20 }}>
          <label>Image (optional, max 1)</label>
          <label className="ad-file">
            {imageUrl ? "Image attached ✓ (change)" : "Choose image…"}
            <input type="file" accept="image/*" onChange={onImage} />
          </label>
          {imageUrl && <img className="ad-img-preview" src={imageUrl} alt="preview" />}
        </div>

        <button className="ad-submit" onClick={save}>Save Question</button>
      </div>
    </div>
  );
}

function Stepper({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step?: number;
  min?: number;
}) {
  const num = Number(value) || 0;
  const set = (v: number) => onChange(String(Math.max(min, v)));
  return (
    <div className="ad-field">
      <label>{label}</label>
      <div className="ad-stepper">
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => {
            const cleaned = e.target.value.replace(/[^0-9.-]/g, "");
            onChange(cleaned);
          }}
        />
        <div className="ad-stepper-btns">
          <button type="button" aria-label={`Increase ${label}`} onClick={() => set(num + step)}>▲</button>
          <button type="button" aria-label={`Decrease ${label}`} onClick={() => set(num - step)}>▼</button>
        </div>
      </div>
    </div>
  );
}

const GREEK: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", Delta: "Δ", epsilon: "ε",
  theta: "θ", Theta: "Θ", lambda: "λ", mu: "μ", pi: "π", Pi: "Π", rho: "ρ",
  sigma: "σ", Sigma: "Σ", tau: "τ", phi: "φ", Phi: "Φ", psi: "ψ", omega: "ω",
  Omega: "Ω", eta: "η", kappa: "κ", nu: "ν", xi: "ξ", zeta: "ζ", Gamma: "Γ",
};

const SIMPLE: Record<string, string> = {
  infty: "∞", to: "→", cdot: "·", times: "×", div: "÷", pm: "±", mp: "∓",
  leq: "≤", geq: "≥", neq: "≠", approx: "≈", equiv: "≡", propto: "∝",
  partial: "∂", nabla: "∇", sum: "∑", int: "∫", prod: "∏", cup: "∪", cap: "∩",
  in: "∈", notin: "∉", subset: "⊂", supset: "⊃", forall: "∀", exists: "∃",
  rightarrow: "→", leftarrow: "←", Rightarrow: "⇒", Leftarrow: "⇐",
  langle: "⟨", rangle: "⟩", ldots: "…", cdots: "⋯", ll: "«", gg: "»",
  angle: "∠", circ: "°", prime: "′",
};

function readGroup(str: string, i: number): [string, number] {
  if (str[i] !== "{") return [str[i] ?? "", i + 1];
  let depth = 0;
  let j = i;
  for (; j < str.length; j++) {
    if (str[j] === "{") depth++;
    else if (str[j] === "}") {
      depth--;
      if (depth === 0) return [str.slice(i + 1, j), j + 1];
    }
  }
  return [str.slice(i + 1), j];
}

function parseMath(str: string, keyBase = "m"): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let i = 0;
  let k = 0;
  const push = (n: React.ReactNode) => out.push(<span key={`${keyBase}-${k++}`}>{n}</span>);

  while (i < str.length) {
    const c = str[i];
    if (c === "\\") {
      let j = i + 1;
      while (j < str.length && /[a-zA-Z]/.test(str[j])) j++;
      const cmd = str.slice(i + 1, j);
      if (cmd === "frac") {
        const [num, n1] = readGroup(str, j);
        const [den, n2] = readGroup(str, n1);
        i = n2;
        push(
          <span key={`${keyBase}-${k++}`} className="ad-frac">
            <span className="ad-frac-num">{parseMath(num, keyBase + "n")}</span>
            <span className="ad-frac-den">{parseMath(den, keyBase + "d")}</span>
          </span>
        );
        continue;
      }
      if (cmd === "vec") {
        const [body, n1] = readGroup(str, j);
        i = n1;
        push(
          <span key={`${keyBase}-${k++}`} className="ad-vec">
            {parseMath(body, keyBase + "v")}
            <span className="ad-vec-arrow">⃗</span>
          </span>
        );
        continue;
      }
      if (cmd === "sqrt") {
        const [body, n1] = readGroup(str, j);
        i = n1;
        push(
          <span key={`${keyBase}-${k++}`} className="ad-sqrt">
            √<span className="ad-sqrt-body">{parseMath(body, keyBase + "s")}</span>
          </span>
        );
        continue;
      }
      if (cmd in GREEK) { push(GREEK[cmd as keyof typeof GREEK]); i = j; continue; }
      if (SIMPLE[cmd]) { push(SIMPLE[cmd]); i = j; continue; }
      push(cmd);
      i = j;
      continue;
    }
    if (c === "^" || c === "_") {
      const [body, n1] = readGroup(str, i + 1);
      i = n1;
      push(
        c === "^" ? (
          <sup key={`${keyBase}-${k++}`}>{parseMath(body, keyBase + "sup")}</sup>
        ) : (
          <sub key={`${keyBase}-${k++}`}>{parseMath(body, keyBase + "sub")}</sub>
        )
      );
      continue;
    }
    if (c === "{") {
      const [body, n1] = readGroup(str, i);
      i = n1;
      push(parseMath(body, keyBase + "g"));
      continue;
    }
    push(c);
    i++;
  }
  return out;
}

function MathPreview({ text, compact }: { text: string; compact?: boolean }) {
  if (!text.trim()) return null;
  // Render the whole string as math-capable text, treating $...$ as explicit
  // math regions but ALSO parsing LaTeX commands outside of $ delimiters.
  const segments = text.split(/(\$[^$]*\$)/g).filter((s) => s !== "");
  const nodes = segments.map((seg, idx) => {
    if (seg.startsWith("$") && seg.endsWith("$") && seg.length >= 2) {
      return (
        <span key={idx} className="ad-prev-math">
          {parseMath(seg.slice(1, -1), "p" + idx)}
        </span>
      );
    }
    return <span key={idx}>{parseMath(seg, "p" + idx)}</span>;
  });
  if (compact) {
    return <span className="ad-preview-inline">{nodes}</span>;
  }
  return (
    <div className="ad-preview">
      <span className="ad-preview-label">Live preview</span>
      <div className="ad-preview-body">{nodes}</div>
    </div>
  );
}

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
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label?: string;
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
    <div className="ad-field" style={label ? undefined : { marginBottom: 8 }}>
      {label && <label>{label}</label>}
      <div className="ad-toolbar">
        {TOOLBAR.map((item) => (
          <button
            key={item.label}
            type="button"
            className="ad-tool"
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
          className="MathField-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          type="text"
          ref={ref as React.RefObject<HTMLInputElement>}
          className="MathField-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
      <MathPreview text={value} />
    </div>
  );
}

const GROQ_STORAGE_KEY = "examsite.groqApiKey";
const GROQ_MODEL_KEY = "examsite.groqModel";
const GROQ_BASE_KEY = "examsite.groqBaseUrl";
const GROQ_DEFAULT_BASE = "https://api.groq.com/openai/v1";

interface OrModel {
  id: string;
  owned_by?: string;
}

function SettingsPanel() {
  const [baseUrl, setBaseUrl] = useState(() =>
    typeof window !== "undefined"
      ? localStorage.getItem(GROQ_BASE_KEY) || GROQ_DEFAULT_BASE
      : GROQ_DEFAULT_BASE
  );
  const [apiKey, setApiKey] = useState("");
  const [savedKey, setSavedKey] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem(GROQ_STORAGE_KEY) || "" : ""
  );
  const [status, setStatus] = useState<{ kind: "ok" | "err" | "dim"; text: string }>(
    typeof window !== "undefined" && localStorage.getItem(GROQ_STORAGE_KEY)
      ? { kind: "ok", text: "API key loaded from this browser." }
      : { kind: "dim", text: "" }
  );

  const [models, setModels] = useState<OrModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [selected, setSelected] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem(GROQ_MODEL_KEY) || "" : ""
  );
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const modelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const saveKey = async () => {
    const trimmed = apiKey.trim();
    const base = (baseUrl.trim() || GROQ_DEFAULT_BASE).replace(/\/+$/, "");
    if (!trimmed) {
      setStatus({ kind: "err", text: "Enter a Groq API key to continue." });
      return;
    }
    setLoadingModels(true);
    setStatus({ kind: "dim", text: "Verifying key and fetching models…" });
    try {
      const res = await fetch(`${base}/v1/models`, {
        headers: { Authorization: `Bearer ${trimmed}` },
      });
      if (!res.ok) {
        throw new Error(`Request failed (${res.status}). Check your key and base URL.`);
      }
      const data = (await res.json()) as { data?: OrModel[] };
      const list = Array.isArray(data?.data) ? data.data : [];
      list.sort((a, b) => a.id.localeCompare(b.id));
      setModels(list);
      setSavedKey(trimmed);
      setBaseUrl(base);
      if (typeof window !== "undefined") {
        localStorage.setItem(GROQ_STORAGE_KEY, trimmed);
        localStorage.setItem(GROQ_BASE_KEY, base);
      }
      setStatus({
        kind: "ok",
        text: list.length
          ? `Connected. ${list.length} model${list.length === 1 ? "" : "s"} available — pick one below.`
          : "Connected, but no models were returned.",
      });
      if (list.length && !list.some((m) => m.id === selected)) setOpen(true);
    } catch (err) {
      setStatus({
        kind: "err",
        text: err instanceof Error ? err.message : "Could not reach Groq.",
      });
    } finally {
      setLoadingModels(false);
    }
  };

  const clearKey = () => {
    setApiKey("");
    setSavedKey("");
    setModels([]);
    setSelected("");
    setSearch("");
    setOpen(false);
    if (typeof window !== "undefined") {
      localStorage.removeItem(GROQ_STORAGE_KEY);
      localStorage.removeItem(GROQ_BASE_KEY);
      localStorage.removeItem(GROQ_MODEL_KEY);
    }
    setStatus({ kind: "dim", text: "API key cleared from this browser." });
  };

  const pickModel = (id: string) => {
    setSelected(id);
    setOpen(false);
    setSearch("");
    if (typeof window !== "undefined") localStorage.setItem(GROQ_MODEL_KEY, id);
  };

  const filtered = models.filter((m) =>
    m.id.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <>
      <div className="ad-set-card">
        <h2 className="ad-set-card-title">Groq <em>API</em></h2>
        <p className="ad-set-desc">
          Supply your Groq API key to enable AI explanations. We call{" "}
          <code>{`${baseUrl}/v1/models`}</code> (OpenAI-compatible) to list available
          models. The key is stored only in this browser&apos;s local storage.
        </p>
        <div className="ad-field" style={{ marginBottom: 12 }}>
          <label>Base URL</label>
          <div className="ad-set-row">
            <input
              type="text"
              value={baseUrl}
              spellCheck={false}
              autoComplete="off"
              placeholder={GROQ_DEFAULT_BASE}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>
        </div>
        <div className="ad-field" style={{ marginBottom: 12 }}>
          <label>API Key</label>
          <div className="ad-set-row">
            <input
              type="password"
              value={apiKey}
              spellCheck={false}
              autoComplete="off"
              placeholder={savedKey ? "•••••••• (stored locally)" : "gsk_..."}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <button className="ad-set-btn" onClick={saveKey} disabled={loadingModels}>
              {loadingModels ? "Verifying…" : savedKey ? "Update" : "Save"}
            </button>
          </div>
        </div>
        {savedKey && (
          <button className="ad-set-btn ghost" onClick={clearKey} disabled={loadingModels}>
            Clear key
          </button>
        )}
        {status.text && (
          <div className={`ad-set-status ${status.kind}`}>{status.text}</div>
        )}
      </div>

      {models.length > 0 && (
        <div className="ad-set-model">
          <h2 className="ad-set-card-title">AI <em>Model</em></h2>
          <p className="ad-set-desc">
            Choose the model used for explanations. Type to search the list.
          </p>
          <div className="ad-model" ref={modelRef}>
            <button
              type="button"
              className={`ad-model-trigger${selected ? "" : " placeholder"}`}
              onClick={() => setOpen((o) => !o)}
              aria-haspopup="listbox"
              aria-expanded={open}
            >
              <span>{selected || "Select a model…"}</span>
              <span className={`ad-model-caret${open ? " open" : ""}`}>▾</span>
            </button>
            {open && (
              <div className="ad-model-menu" role="listbox">
                <input
                  className="ad-model-search"
                  type="text"
                  value={search}
                  autoFocus
                  placeholder="Search models…"
                  onChange={(e) => setSearch(e.target.value)}
                />
                <ul className="ad-model-list">
                  {filtered.length === 0 && (
                    <li className="ad-model-empty">No models match “{search}”.</li>
                  )}
                  {filtered.map((m) => (
                    <li
                      key={m.id}
                      role="option"
                      aria-selected={m.id === selected}
                      className={`ad-model-opt${m.id === selected ? " sel" : ""}`}
                      onClick={() => pickModel(m.id)}
                    >
                      <span>{m.id}</span>
                      {m.owned_by && <span className="tag">{m.owned_by}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {selected && <div className="ad-set-hint">Selected: {selected}</div>}
        </div>
      )}
    </>
  );
}

function ExplanationDialog({
  q,
  text,
  loading,
  error,
  onClose,
}: {
  q: Question;
  text: string;
  loading: boolean;
  error: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="ad-overlay" onClick={onClose}>
      <div className="ad-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680 }}>
        <button className="ad-close" onClick={onClose} aria-label="Close">×</button>
        <h3 className="ad-form-title">AI <em>Explanation</em></h3>
        <div className="ad-q-prompt" style={{ marginBottom: 18 }}>
          <MathPreview text={q.prompt} compact />
        </div>
        {loading && (
          <div className="ad-explain-body" style={{ color: "var(--dim)" }}>
            Generating explanation…
          </div>
        )}
        {!loading && error && <div className="ad-explain-status err">{error}</div>}
        {!loading && !error && <div className="ad-explain-body">{text}</div>}
        <div className="ad-set-status dim" style={{ marginTop: 18 }}>
          Powered by Groq · {localStorage.getItem(GROQ_MODEL_KEY) || "no model selected"}
        </div>
      </div>
    </div>
  );
}
