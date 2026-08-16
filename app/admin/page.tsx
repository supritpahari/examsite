"use client";

import { useEffect, useMemo, useRef, useState, Fragment } from "react";
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
import {
  fetchExams,
  addExam as saveExam,
  deleteExam,
  deleteExamQuestions,
  deleteExamQuestionsByQuestion,
  updateExam,
  setExamQuestions,
  fetchAllExamQuestionLinks,
  type Exam as AdminExam,
} from "@/lib/exams";
import {
  fetchAllAttemptSummaries,
  deleteAttemptsByExam,
  type Attempt,
  type ExamAttemptSummary,
} from "@/lib/attempts";
import {
  loadSiteInfo,
  saveSiteInfo,
  DEFAULT_SITE_INFO,
  type SiteInfo,
} from "@/lib/settings";

const NAV = [
  { key: "questions", label: "Questions" },
  { key: "exams", label: "Exams" },
  { key: "students", label: "Students" },
  { key: "information", label: "Information" },
  { key: "settings", label: "Settings" },
];

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

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
    case "students":
      return (
        <svg {...common}><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 5.4a3.2 3.2 0 1 1 0 5.6" /><path d="M17.5 14.2a5.5 5.5 0 0 1 3 4.8" /></svg>
      );
    case "information":
      return (
        <svg {...common}><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
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

export default function AdminDashboard() {
  const [collapsed, setCollapsed] = useState(false);
  const [active, setActive] = useState("questions");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<AdminExam | null>(null);
  const [exams, setExams] = useState<AdminExam[]>([]);
  const [examQuestionMap, setExamQuestionMap] = useState<Record<string, string[]>>({});
  const [attemptsMap, setAttemptsMap] = useState<Record<string, ExamAttemptSummary>>({});
  const [siteInfo, setSiteInfo] = useState<SiteInfo>(DEFAULT_SITE_INFO);
  const [addQuestionsExam, setAddQuestionsExam] = useState<AdminExam | null>(null);
  const [addQuestionsInitial, setAddQuestionsInitial] = useState<string[]>([]);
  const [examCodeExam, setExamCodeExam] = useState<AdminExam | null>(null);
  const [loadingExams, setLoadingExams] = useState(true);
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
        fetchExams()
          .then(setExams)
          .catch(() => setExams([]))
          .finally(() => setLoadingExams(false));
        fetchAllExamQuestionLinks()
          .then((links) => {
            const map: Record<string, string[]> = {};
            for (const l of links) {
              if (!l.examId) continue;
              (map[l.examId] ||= []).push(l.questionId);
            }
            setExamQuestionMap(map);
          })
          .catch(() => setExamQuestionMap({}));
        fetchAllAttemptSummaries()
          .then(setAttemptsMap)
          .catch(() => setAttemptsMap({}));
        loadSiteInfo()
          .then(setSiteInfo)
          .catch(() => setSiteInfo(DEFAULT_SITE_INFO));
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
    if (!window.confirm("Delete this question? It will be removed from every exam that uses it. This cannot be undone.")) return;
    setQuestions((prev) => prev.filter((q) => q.id !== id));
    setExamQuestionMap((prev) => {
      const next: Record<string, string[]> = {};
      for (const [examId, ids] of Object.entries(prev)) {
        next[examId] = ids.filter((qid) => qid !== id);
      }
      return next;
    });
    try {
      await deleteExamQuestionsByQuestion(id);
      await deleteQuestion(id);
    } catch {
      // reload to restore state if delete failed
      fetchQuestions().then(setQuestions).catch(() => {});
    }
  };

  const handleDeleteExam = async (id: string) => {
    if (!window.confirm("Delete this exam? All attempts recorded against it will also be deleted. This cannot be undone.")) return;
    setExams((prev) => prev.filter((e) => e.id !== id));
    setExamQuestionMap((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setAttemptsMap((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      await deleteExamQuestions(id);
      await deleteAttemptsByExam(id);
      await deleteExam(id);
    } catch {
      fetchExams().then(setExams).catch(() => {});
    }
  };

  const openNewExam = () => {
    setEditingExam(null);
    setExamModalOpen(true);
  };

  const openEditExam = (exam: AdminExam) => {
    setEditingExam(exam);
    setExamModalOpen(true);
  };

  const openManageQuestions = (exam: AdminExam) => {
    setAddQuestionsExam(exam);
    setAddQuestionsInitial(examQuestionMap[exam.id] ?? []);
  };

  const copyExamLink = async (exam: AdminExam) => {
    const link = `${window.location.origin}/exam?id=${encodeURIComponent(exam.code)}`;
    await copyText(link);
  };

  const copyExamCode = async (exam: AdminExam) => {
    await copyText(exam.code);
  };

  const handleSignOut = async () => {
    const { getAuthInstance } = await import("@/lib/firebase/client");
    await signOut(getAuthInstance());
    router.replace("/admin/login");
  };

  const generateExplanation = async (q: Question) => {
    const apiKey =
      typeof window !== "undefined" ? localStorage.getItem(GEM_STORAGE_KEY) : null;
    const baseUrl =
      (typeof window !== "undefined"
        ? localStorage.getItem(GEM_BASE_KEY) || GEM_DEFAULT_BASE
        : GEM_DEFAULT_BASE
      ).replace(/\/+$/, "");
    const model =
      typeof window !== "undefined" ? localStorage.getItem(GEM_MODEL_KEY) : null;

    if (!apiKey || !model) {
      setExplain({ q, text: "", loading: false, error: "Add your Google Gemini API key and pick a model in Settings first." });
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
      const res = await fetch(
        `${baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3 },
          }),
        }
      );
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Request failed (${res.status}). ${detail.slice(0, 200)}`.trim());
      }
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const content =
        data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("").trim() ??
        "";
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
        .ad-title { font-family: 'Instrument Serif', serif; font-size: 40px; line-height: 1; letter-spacing: -0.02em; color: var(--ink); }
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

        .ad-explain-body h2 {
          font-family: 'Instrument Serif', serif; font-size: 22px; line-height: 1.2;
          margin: 22px 0 8px; color: var(--ink);
        }
        .ad-explain-body h2:first-child { margin-top: 0; }
        .ad-explain-body h3 {
          font-family: 'JetBrains Mono', monospace; font-size: 12px; text-transform: uppercase;
          letter-spacing: 0.12em; color: var(--accent); margin: 18px 0 6px;
        }
        .ad-explain-body p { margin: 0 0 12px; }
        .ad-explain-body ul { margin: 0 0 12px; padding-left: 20px; }
        .ad-explain-body li { margin-bottom: 6px; }
        .ad-explain-block {
          background: #fffdf8; border: 1px solid var(--rule); box-shadow: 4px 4px 0 var(--rule);
          padding: 12px 16px; margin: 0 0 12px; overflow-x: auto;
          font-family: 'Georgia', 'Times New Roman', serif; font-size: 17px;
        }
        .ad-explain-body strong { color: var(--ink); font-weight: 700; }
        .ad-explain-body em { font-style: italic; }
        .ad-explain-body code, .ad-explain-inline {
          font-family: 'JetBrains Mono', monospace; font-size: 0.9em;
          background: var(--paper-2); padding: 1px 5px; border: 1px solid var(--rule);
        }
        .ad-explain-body .ad-prev-math { font-family: 'Georgia', serif; }

        .ad-share {
          display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px;
          border-top: 1px dashed var(--rule); padding-top: 16px;
        }
        .ad-share-label {
          width: 100%; font-family: 'JetBrains Mono', monospace; font-size: 10px;
          text-transform: uppercase; letter-spacing: 0.16em; color: var(--dim); margin-bottom: 2px;
        }
        .ad-share-btn {
          display: inline-flex; align-items: center; gap: 7px;
          background: transparent; border: 1px solid var(--rule); color: var(--ink-2);
          padding: 9px 13px; font-family: 'JetBrains Mono', monospace; font-size: 11px;
          letter-spacing: 0.06em; text-transform: uppercase; cursor: pointer; transition: all 0.15s ease;
        }
        .ad-share-btn:hover { color: var(--accent); border-color: var(--accent); }
        .ad-share-btn.done { color: var(--accent); border-color: var(--accent); }
        .ad-share-ico { font-size: 13px; line-height: 1; }

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
        .ad-form-title { font-family: 'Instrument Serif', serif; font-size: 26px; margin: 0 0 18px; color: var(--ink); }
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
        .ad-select select {
          width: 100%; background: transparent; border: 1px solid var(--ink); border-radius: 0;
          padding: 12px 14px; font-family: 'JetBrains Mono', monospace; font-size: 14px; color: var(--ink); outline: none;
        }
        .ad-select select:focus { background: #fff; }
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
        .ad-hat { position: relative; display: inline-block; }
        .ad-hat-cap { position: absolute; top: -0.12em; left: 50%; transform: translateX(-50%); font-size: 0.82em; line-height: 1; }
        .ad-hat-body { padding: 0 1px; }
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

        .ad-modal-sub {
          font-size: 13px; line-height: 1.5; color: var(--ink-2);
          margin: -8px 0 22px; max-width: 46ch;
        }

        .ad-seg {
          display: flex; border: 1px solid var(--ink); border-radius: 0; overflow: hidden;
        }
        .ad-seg-btn {
          flex: 1; background: transparent; border: 0; border-right: 1px solid var(--rule);
          padding: 11px 8px; font-family: 'JetBrains Mono', monospace; font-size: 11px;
          text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-2); cursor: pointer;
          transition: all 0.15s ease;
        }
        .ad-seg-btn:last-child { border-right: 0; }
        .ad-seg-btn:hover { background: var(--paper-2); color: var(--ink); }
        .ad-seg-btn.active { background: var(--accent); color: #fff; }

        .ad-exam-preview {
          border: 1px solid var(--rule); background: var(--paper-2); padding: 16px 18px;
          margin-bottom: 22px; display: flex; flex-direction: column; gap: 6px;
        }
        .ad-chapter-list { display: flex; flex-direction: column; gap: 8px; }
        .ad-chapter-item {
          display: flex; align-items: center; gap: 14px; width: 100%; text-align: left;
          background: var(--paper); border: 1px solid var(--rule); padding: 13px 16px;
          cursor: pointer; transition: all 0.15s ease; font-family: 'Inter', sans-serif;
          color: var(--ink-2); font-size: 14px;
        }
        .ad-chapter-item:hover { border-color: var(--accent); color: var(--ink); }
        .ad-chapter-item.on { border-color: var(--accent); background: rgba(220,60,40,0.06); color: var(--ink); }
        .ad-chapter-check {
          flex: 0 0 auto; width: 22px; height: 22px; border: 1px solid var(--rule);
          display: grid; place-items: center; font-size: 13px; color: #fff;
        }
        .ad-chapter-item.on .ad-chapter-check { background: var(--accent); border-color: var(--accent); }
        .ad-chapter-name { flex: 1; }
        .ad-chapter-count {
          font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--dim);
          border: 1px solid var(--rule); padding: 2px 8px;
        }
        .ad-choose-scroll { max-height: 40vh; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
        .ad-choose-prompt { font-family: 'Instrument Serif', serif; font-size: 16px; color: var(--ink); }
        .ad-code-block { border: 1px solid var(--rule); background: var(--paper-2); padding: 16px 18px; margin-bottom: 14px; }
        .ad-code-label {
          font-family: 'JetBrains Mono', monospace; font-size: 10px; text-transform: uppercase;
          letter-spacing: 0.16em; color: var(--dim); margin-bottom: 10px;
        }
        .ad-code-row { display: flex; align-items: center; gap: 12px; }
        .ad-code-value {
          flex: 1; font-family: 'JetBrains Mono', monospace; font-size: 14px; color: var(--ink);
          background: var(--paper); border: 1px solid var(--rule); padding: 10px 12px;
          overflow-x: auto; white-space: nowrap;
        }
        .ad-code-link { font-size: 12px; color: var(--accent); }
        .ad-exam-preview-title {
          font-family: 'Instrument Serif', serif; font-size: 19px; color: var(--ink); line-height: 1.2;
        }
        .ad-exam-preview-meta {
          font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--dim); letter-spacing: 0.04em;
        }

        .ad-modal-foot { display: flex; gap: 12px; }
        .ad-modal-foot .ad-set-btn.ghost { flex: 0 0 auto; padding: 0 22px; }
        .ad-submit-inline { flex: 1; margin-top: 0; }
        .ad-submit:disabled { opacity: 0.5; cursor: not-allowed; }

        .badge {
          align-self: flex-start; font-family: 'JetBrains Mono', monospace; font-size: 9px;
          text-transform: uppercase; letter-spacing: 0.14em; padding: 3px 9px; border-radius: 0;
        }
        .bg-green-100 { background: #d9ead3; color: #274e13; }
        .text-green-800 { color: #274e13; }
        .bg-blue-100 { background: #cfe2f3; color: #0b3d66; }
        .text-blue-800 { color: #0b3d66; }
        .bg-gray-100 { background: var(--paper); color: var(--dim); }
        .text-gray-700 { color: var(--ink-2); }

        .ad-set-card {
          border: 1px solid var(--rule);
          background: var(--paper);
          padding: 24px 26px;
          max-width: 620px;
          margin-bottom: 20px;
        }
        .ad-set-card-title {
          font-family: 'Instrument Serif', serif; font-size: 22px; margin: 0 0 6px; color: var(--ink);
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

        .ad-exam-list { display: flex; flex-direction: column; gap: 12px; }
        .ad-exam-row {
          border: 1px solid var(--rule); background: var(--paper);
          padding: 18px 20px; display: flex; align-items: center; gap: 20px; flex-wrap: wrap;
        }
        .ad-exam-main { flex: 1; min-width: 240px; }
        .ad-exam-top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 6px; }
        .ad-exam-title { font-family: 'Instrument Serif', serif; font-size: 21px; color: var(--ink); }
        .ad-exam-meta {
          font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--dim);
          letter-spacing: 0.04em; display: flex; gap: 8px; flex-wrap: wrap;
        }
        .ad-exam-side { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
        .ad-exam-caret {
          background: transparent; border: 0; cursor: pointer; font-size: 14px; color: var(--accent);
          padding: 0 4px 0 0; line-height: 1;
        }
        .ad-exam-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
        .ad-chip {
          font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.04em;
          background: var(--paper-2); border: 1px solid var(--rule); color: var(--ink-2);
          padding: 4px 9px; text-transform: uppercase;
        }
        .ad-chip strong { color: var(--ink); }
        .ad-chip.mono { text-transform: none; letter-spacing: 0.08em; color: var(--accent); }
        .ad-exam-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .ad-exam-btn {
          font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase;
          letter-spacing: 0.08em; background: var(--accent); color: #fff; border: 1px solid var(--accent);
          padding: 8px 14px; cursor: pointer; transition: all 0.15s ease;
        }
        .ad-exam-btn:hover { background: var(--accent-2); border-color: var(--accent-2); }
        .ad-exam-btn.ghost { background: transparent; color: var(--ink-2); border-color: var(--rule); }
        .ad-exam-btn.ghost:hover { color: var(--accent); border-color: var(--accent); }
        .ad-exam-btn.danger { background: transparent; color: #b42318; border-color: #f0c2bb; }
        .ad-exam-btn.danger:hover { background: #b42318; color: #fff; border-color: #b42318; }
        .ad-exam-row.open { border-color: var(--accent); }
        .ad-exam-detail { flex-basis: 100%; border-top: 1px dashed var(--rule); margin-top: 16px; padding-top: 16px; }
        .ad-empty.small { font-size: 13px; padding: 8px 0; }
        .ad-q-detail-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
        .ad-q-detail { border: 1px solid var(--rule); background: var(--paper-2); padding: 12px 14px; }
        .ad-q-detail-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 6px; }
        .ad-q-detail-num { font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 600; color: var(--accent); }
        .ad-q-detail-sub { font-family: 'JetBrains Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--dim); }
        .ad-q-detail-prompt { font-size: 14px; color: var(--ink); margin-bottom: 8px; }
        .ad-q-detail-opts { display: flex; flex-wrap: wrap; gap: 6px 14px; }
        .ad-q-detail-opt {
          font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--ink-2);
          display: inline-flex; align-items: center; gap: 6px;
        }
        .ad-q-detail-opt i {
          font-style: normal; width: 18px; height: 18px; display: grid; place-items: center;
          border: 1px solid var(--rule); color: var(--dim); font-size: 10px; flex-shrink: 0;
        }
        .ad-q-detail-opt.correct { color: #0f7a3d; }
        .ad-q-detail-opt.correct i { background: #0f7a3d; border-color: #0f7a3d; color: #fff; }

        .ad-attempts { margin-top: 22px; border-top: 1px solid var(--rule); padding-top: 16px; }
        .ad-attempts-head {
          font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase;
          letter-spacing: 0.14em; color: var(--accent); margin-bottom: 12px;
        }
        .ad-attempt-list { display: flex; flex-direction: column; gap: 8px; }
        .ad-attempt { border: 1px solid var(--rule); background: var(--paper-2); }
        .ad-attempt-row {
          width: 100%; display: flex; align-items: center; gap: 12px; padding: 10px 12px;
          background: transparent; border: 0; cursor: pointer; text-align: left;
        }
        .ad-attempt-row:hover { background: rgba(0,0,0,0.03); }
        .ad-attempt-caret { color: var(--accent); font-size: 12px; }
        .ad-attempt-name { font-family: 'Instrument Serif', serif; font-size: 17px; color: var(--ink); flex: 1; }
        .ad-attempt-score { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--ink-2); }
        .ad-attempt-tags { display: flex; gap: 6px; }
        .ad-atag { font-family: 'JetBrains Mono', monospace; font-size: 10px; padding: 2px 6px; color: #fff; }
        .ad-atag.ok { background: #0f7a3d; }
        .ad-atag.bad { background: var(--accent); }
        .ad-atag.skip { background: #b8ad96; color: #14110d; }
        .ad-attempt-detail { border-top: 1px dashed var(--rule); padding: 12px 14px; background: var(--paper); }
        .ad-attempt-qlist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
        .ad-attempt-q { border-left: 3px solid var(--rule); padding: 4px 0 4px 12px; }
        .ad-attempt-q.ok { border-left-color: #0f7a3d; }
        .ad-attempt-q.bad { border-left-color: var(--accent); }
        .ad-attempt-q.skip { border-left-color: #b8ad96; }
        .ad-aq-head { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
        .ad-aq-num { font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 600; color: var(--ink); }
        .ad-aq-tag { font-family: 'JetBrains Mono', monospace; font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; padding: 2px 6px; color: #fff; }
        .ad-aq-tag.ok { background: #0f7a3d; }
        .ad-aq-tag.bad { background: var(--accent); }
        .ad-aq-tag.skip { background: #b8ad96; color: #14110d; }
        .ad-aq-marks { margin-left: auto; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--ink-2); }
        .ad-aq-prompt { font-size: 13px; color: var(--ink); margin-bottom: 6px; }
        .ad-aq-ans { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--ink-2); display: flex; gap: 8px; margin-top: 3px; }
        .ad-aq-label { color: var(--dim); text-transform: uppercase; letter-spacing: 0.08em; font-size: 10px; }
        .ad-aq-chosen.bad { color: var(--accent); }
        .ad-aq-chosen.skip { color: var(--dim); font-style: italic; }
        .ad-aq-correct { color: #0f7a3d; }

        .ad-info-card { max-width: 720px; border: 1px solid var(--rule); background: var(--paper); padding: 24px 26px; }
        .ad-info-sub { font-size: 13.5px; line-height: 1.6; color: var(--ink-2); margin: 0 0 20px; }
        .ad-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; }
        .ad-info-grid .ad-field label { font-family: 'JetBrains Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.14em; color: var(--accent); }
        .ad-info-grid .ad-field input {
          width: 100%; background: var(--paper-2); border: 1px solid var(--rule); border-radius: 0;
          padding: 11px 13px; font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--ink); outline: none;
        }
        .ad-info-grid .ad-field input:focus { background: #fff; border-color: var(--accent); }
        .ad-modal-foot { display: flex; align-items: center; justify-content: flex-end; gap: 14px; margin-top: 22px; }
        .ad-saved { font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #0f7a3d; }
        .ad-submit { background: var(--accent); color: #fff; border: 1px solid var(--accent); padding: 12px 22px; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; cursor: pointer; }
        .ad-submit:hover { background: var(--accent-2); border-color: var(--accent-2); }
        .ad-submit:disabled { opacity: 0.5; cursor: not-allowed; }
        .ad-submit-inline { display: inline-flex; }

        .ad-stu-quick { margin-top: 26px; max-width: 860px; }
        .ad-stu-quick-list { display: flex; flex-wrap: wrap; gap: 8px; }
        .ad-stu-quick-btn {
          cursor: pointer; background: var(--paper); padding: 9px 14px;
          text-transform: none; font-size: 12px; letter-spacing: 0.04em;
        }
        .ad-stu-quick-btn:hover { color: var(--accent); border-color: var(--accent); }

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
          <span className="ad-brand-text">World of <em>Physics</em></span>
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
              <span className="ad-count">Gemini</span>
            </div>
            <SettingsPanel />
          </>
        )}

        {active === "exams" && (
          <ExamsPanel
            exams={exams}
            questionMap={examQuestionMap}
            attemptsMap={attemptsMap}
            bank={questions}
            onDelete={handleDeleteExam}
            onEdit={openEditExam}
            onManageQuestions={openManageQuestions}
            onCopyLink={copyExamLink}
            onCopyCode={copyExamCode}
            onShowResults={(exam) =>
              router.push(`/admin/results?exam=${encodeURIComponent(exam.code)}`)
            }
          />
        )}

        {active === "students" && (
          <StudentsPanel attemptsMap={attemptsMap} />
        )}

        {active === "information" && <InformationPanel siteInfo={siteInfo} onSaved={setSiteInfo} />}

        {active !== "questions" && active !== "settings" && active !== "exams" && active !== "students" && active !== "information" && (
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

      {active === "exams" && (
        <button className="ad-fab" onClick={openNewExam} aria-label="New exam">
          <span className="plus">+</span> New Exam
        </button>
      )}

      {modalOpen && (
        <AddQuestionModal
          onClose={() => setModalOpen(false)}
          onSave={addQuestion}
          existingChapters={Array.from(
            new Set(questions.map((q) => q.chapter?.trim()).filter((c): c is string => Boolean(c)))
          ).sort((a, b) => a.localeCompare(b))}
        />
      )}

      {examModalOpen && (
        <NewExamModal
          exam={editingExam}
          onClose={() => setExamModalOpen(false)}
          onSave={async (exam) => {
            if (editingExam) {
              await updateExam(editingExam.id, exam);
              setExams((prev) =>
                prev.map((e) => (e.id === editingExam.id ? { ...e, ...exam } : e))
              );
              setExamModalOpen(false);
            } else {
              const saved = await saveExam(exam);
              setExams((prev) => [saved, ...prev]);
              setExamModalOpen(false);
              setExamCodeExam(saved);
            }
          }}
        />
      )}

      {examCodeExam && (
        <ExamCodeDialog
          exam={examCodeExam}
          onClose={() => setExamCodeExam(null)}
          onContinue={() => {
            setExamCodeExam(null);
            setAddQuestionsInitial([]);
            setAddQuestionsExam(examCodeExam);
          }}
        />
      )}

      {addQuestionsExam && (
        <AddQuestionsDialog
          exam={addQuestionsExam}
          questions={questions}
          initialIds={addQuestionsInitial}
          onClose={() => setAddQuestionsExam(null)}
          onSave={async (questionIds) => {
            await setExamQuestions(addQuestionsExam.id, questionIds);
            setExamQuestionMap((prev) => ({
              ...prev,
              [addQuestionsExam.id]: questionIds,
            }));
            setAddQuestionsExam(null);
          }}
        />
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
  existingChapters = [],
}: {
  onClose: () => void;
  onSave: (q: Omit<Question, "id" | "createdAt">) => void;
  existingChapters?: string[];
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
  const [uploading, setUploading] = useState(false);
  const [chapter, setChapter] = useState("");
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

  const save = () => {
    const filled = options.filter((o) => o.text.trim().length > 0);
    if (
      !prompt.trim() ||
      filled.length !== 4 ||
      !filled.some((o) => o.correct)
    ) {
      return;
    }
    onSave({
      type,
      prompt: prompt.trim(),
      options: filled,
      marks: Number(marks) || 0,
      negative: Number(negative) || 0,
      chapter: chapter.trim() || undefined,
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

          <div className="ad-field" style={{ marginBottom: 16 }}>
            <label>Chapter (optional)</label>
            <input
              type="text"
              value={chapter}
              placeholder="e.g. Kinematics, Thermodynamics"
              list="ad-chapter-suggestions"
              autoComplete="off"
              onChange={(e) => setChapter(e.target.value)}
            />
            <datalist id="ad-chapter-suggestions">
              {existingChapters.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <div className="ad-hint">Used to group questions when adding them to an exam by chapter.</div>
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
          <label>Options (4 required)</label>
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
            </div>
          ))}
        </div>

        <div className="ad-field" style={{ marginBottom: 20 }}>
          <label>Image (optional, max 1)</label>
          <label className="ad-file">
            {uploading
              ? "Uploading to ImgBB…"
              : imageUrl
                ? "Image attached ✓ (change)"
                : "Choose image…"}
            <input type="file" accept="image/*" onChange={onImage} disabled={uploading} />
          </label>
          {imageUrl && <img className="ad-img-preview" src={imageUrl} alt="preview" />}
          {imageUrl && (
            <div className="ad-hint" style={{ wordBreak: "break-all" }}>
              Stored: {imageUrl}
            </div>
          )}
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
      {label && <label>{label}</label>}
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
      if (cmd === "hat") {
        const [body, n1] = readGroup(str, j);
        i = n1;
        push(
          <span key={`${keyBase}-${k++}`} className="ad-hat">
            <span className="ad-hat-cap">ˆ</span>
            <span className="ad-hat-body">{parseMath(body, keyBase + "h")}</span>
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
      if (cmd === "text") {
        const [body, n1] = readGroup(str, j);
        i = n1;
        push(body);
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
  if (typeof text !== "string" || !text.trim()) return null;
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

const GEM_STORAGE_KEY = "examsite.gemApiKey";
const GEM_MODEL_KEY = "examsite.gemModel";
const GEM_BASE_KEY = "examsite.gemBaseUrl";
const GEM_DEFAULT_BASE = "https://generativelanguage.googleapis.com";

interface GemModel {
  id: string;
  displayName?: string;
  description?: string;
}

function SettingsPanel() {
  const [baseUrl, setBaseUrl] = useState(() =>
    typeof window !== "undefined"
      ? localStorage.getItem(GEM_BASE_KEY) || GEM_DEFAULT_BASE
      : GEM_DEFAULT_BASE
  );
  const [apiKey, setApiKey] = useState("");
  const [savedKey, setSavedKey] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem(GEM_STORAGE_KEY) || "" : ""
  );
  const [status, setStatus] = useState<{ kind: "ok" | "err" | "dim"; text: string }>(
    typeof window !== "undefined" && localStorage.getItem(GEM_STORAGE_KEY)
      ? { kind: "ok", text: "API key loaded from this browser." }
      : { kind: "dim", text: "" }
  );

  const [models, setModels] = useState<GemModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [selected, setSelected] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem(GEM_MODEL_KEY) || "" : ""
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
    const base = (baseUrl.trim() || GEM_DEFAULT_BASE).replace(/\/+$/, "");
    if (!trimmed) {
      setStatus({ kind: "err", text: "Enter a Google AI (Gemini) API key to continue." });
      return;
    }
    setLoadingModels(true);
    setStatus({ kind: "dim", text: "Verifying key and fetching models…" });
    try {
      const res = await fetch(`${base}/v1beta/models?key=${encodeURIComponent(trimmed)}`);
      if (!res.ok) {
        throw new Error(`Request failed (${res.status}). Check your API key.`);
      }
      const data = (await res.json()) as { models?: { name?: string; displayName?: string; description?: string }[] };
      const raw = Array.isArray(data?.models) ? data.models : [];
      const list: GemModel[] = raw
        .map((m) => ({
          id: (m.name || "").replace(/^models\//, ""),
          displayName: m.displayName,
          description: m.description,
        }))
        .filter((m) => m.id && m.id.startsWith("gemini"));
      list.sort((a, b) => a.id.localeCompare(b.id));
      setModels(list);
      setSavedKey(trimmed);
      setBaseUrl(base);
      if (typeof window !== "undefined") {
        localStorage.setItem(GEM_STORAGE_KEY, trimmed);
        localStorage.setItem(GEM_BASE_KEY, base);
      }
      setStatus({
        kind: "ok",
        text: list.length
          ? `Connected. ${list.length} Gemini model${list.length === 1 ? "" : "s"} available — pick one below.`
          : "Connected, but no Gemini models were returned.",
      });
      if (list.length && !list.some((m) => m.id === selected)) setOpen(true);
    } catch (err) {
      setStatus({
        kind: "err",
        text: err instanceof Error ? err.message : "Could not reach Google AI.",
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
      localStorage.removeItem(GEM_STORAGE_KEY);
      localStorage.removeItem(GEM_BASE_KEY);
      localStorage.removeItem(GEM_MODEL_KEY);
    }
    setStatus({ kind: "dim", text: "API key cleared from this browser." });
  };

  const pickModel = (id: string) => {
    setSelected(id);
    setOpen(false);
    setSearch("");
    if (typeof window !== "undefined") localStorage.setItem(GEM_MODEL_KEY, id);
  };

  const filtered = models.filter((m) =>
    m.id.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <>
      <div className="ad-set-card">
        <h2 className="ad-set-card-title">Google <em>Gemini</em></h2>
        <p className="ad-set-desc">
          Supply your Google AI (Gemini) API key to enable AI explanations. We call{" "}
          <code>{`${baseUrl}/v1beta/models`}</code> to list available Gemini
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
              placeholder={GEM_DEFAULT_BASE}
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
              placeholder={savedKey ? "•••••••• (stored locally)" : "AIza..."}
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
                      <span>{m.displayName || m.id}</span>
                      <span className="tag">{m.id}</span>
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

function renderRich(seg: string, keyBase: string): React.ReactNode[] {
  // Inline math: $...$. Bold: **...**. Inline code: `...`.
  const parts = seg.split(/(\$[^$]*\$|\*\*[^*]+\*\*|`[^`]+`)/g).filter((s) => s !== "");
  return parts.map((p, i) => {
    if (p.startsWith("$") && p.endsWith("$") && p.length >= 2) {
      return (
        <span key={`${keyBase}-${i}`} className="ad-prev-math">
          {parseMath(p.slice(1, -1), `${keyBase}m${i}`)}
        </span>
      );
    }
    if (p.startsWith("**") && p.endsWith("**")) {
      return <strong key={`${keyBase}-${i}`}>{renderRich(p.slice(2, -2), `${keyBase}b${i}`)}</strong>;
    }
    if (p.startsWith("`") && p.endsWith("`")) {
      return <span key={`${keyBase}-${i}`} className="ad-explain-inline">{p.slice(1, -1)}</span>;
    }
    return (
      <Fragment key={`${keyBase}-${i}`}>{parseMath(p, `${keyBase}t${i}`)}</Fragment>
    );
  });
}

function renderExplanation(src: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const blocks = src.split(/\n{2,}/);
  let k = 0;
  for (const block of blocks) {
    const b = block.trim();
    if (!b) continue;
    if (b.startsWith("$$") && b.endsWith("$$")) {
      out.push(
        <div className="ad-explain-block" key={`blk-${k++}`}>
          {parseMath(b.slice(2, -2), `d${k}`)}
        </div>
      );
      continue;
    }
    if (b.startsWith("### ")) {
      out.push(<h2 key={`blk-${k++}`}>{renderRich(b.slice(4), `h${k}`)}</h2>);
      continue;
    }
    if (b.startsWith("## ")) {
      out.push(<h2 key={`blk-${k++}`}>{renderRich(b.slice(3), `h${k}`)}</h2>);
      continue;
    }
    if (b.startsWith("#### ") || b.startsWith("**") && b.endsWith("**") && !b.includes("\n")) {
      out.push(<h3 key={`blk-${k++}`}>{renderRich(b.replace(/^#### /, "").replace(/^\*\*|\*\*$/g, ""), `h${k}`)}</h3>);
      continue;
    }
    if (b.startsWith("- ") || b.startsWith("* ")) {
      const items = b
        .split(/\n/)
        .map((l) => l.replace(/^[-*]\s+/, "").trim())
        .filter(Boolean);
      out.push(
        <ul key={`blk-${k++}`}>
          {items.map((it, i) => (
            <li key={i}>{renderRich(it, `li${k}-${i}`)}</li>
          ))}
        </ul>
      );
      continue;
    }
    out.push(<p key={`blk-${k++}`}>{renderRich(b, `p${k}`)}</p>);
  }
  return out;
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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const shareText = `Question: ${q.prompt}\n\nAI Explanation:\n${text}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  const shareTo = (target: "whatsapp" | "x" | "email") => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const encoded = encodeURIComponent(shareText);
    const encodedUrl = encodeURIComponent(url);
    if (target === "whatsapp") {
      window.open(`https://wa.me/?text=${encoded}`, "_blank", "noopener,noreferrer");
    } else if (target === "x") {
      window.open(
        `https://twitter.com/intent/tweet?text=${encoded}&url=${encodedUrl}`,
        "_blank",
        "noopener,noreferrer"
      );
    } else {
      window.location.href = `mailto:?subject=${encodeURIComponent(
        "AI Explanation · World of Physics"
      )}&body=${encoded}`;
    }
  };

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
        {!loading && !error && <div className="ad-explain-body">{renderExplanation(text)}</div>}
        {!loading && !error && (
          <div className="ad-share">
            <span className="ad-share-label">Share explanation</span>
            <button className="ad-share-btn" onClick={() => shareTo("whatsapp")}>
              <span className="ad-share-ico">✆</span> WhatsApp
            </button>
            <button className="ad-share-btn" onClick={() => shareTo("x")}>
              <span className="ad-share-ico">𝕏</span> X
            </button>
            <button className="ad-share-btn" onClick={() => shareTo("email")}>
              <span className="ad-share-ico">✉</span> Email
            </button>
            <button
              className={`ad-share-btn${copied ? " done" : ""}`}
              onClick={copyLink}
            >
              <span className="ad-share-ico">{copied ? "✓" : "⧉"}</span>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
        <div className="ad-set-status dim" style={{ marginTop: 18 }}>
          Powered by Google Gemini · {localStorage.getItem(GEM_MODEL_KEY) || "no model selected"}
        </div>
      </div>
    </div>
  );
}

const EXAM_STATUS_META: Record<AdminExam["status"], { label: string; cls: string }> = {
  completed: { label: "Completed", cls: "bg-green-100 text-green-800" },
  scheduled: { label: "Scheduled", cls: "bg-blue-100 text-blue-800" },
  draft: { label: "Draft", cls: "bg-gray-100 text-gray-700" },
};

function ExamsPanel({
  exams,
  questionMap,
  attemptsMap,
  bank,
  onDelete,
  onEdit,
  onManageQuestions,
  onCopyLink,
  onCopyCode,
  onShowResults,
}: {
  exams: AdminExam[];
  questionMap: Record<string, string[]>;
  attemptsMap: Record<string, ExamAttemptSummary>;
  bank: Question[];
  onDelete: (id: string) => void;
  onEdit: (exam: AdminExam) => void;
  onManageQuestions: (exam: AdminExam) => void;
  onCopyLink: (exam: AdminExam) => void;
  onCopyCode: (exam: AdminExam) => void;
  onShowResults: (exam: AdminExam) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openAttempts, setOpenAttempts] = useState<Set<string>>(new Set());

  const bankById = useMemo(() => {
    const m = new Map<string, Question>();
    for (const q of bank) m.set(q.id, q);
    return m;
  }, [bank]);

  const optionText = (q: Question | undefined, optId: string | null): string | null => {
    if (!q || !optId) return null;
    return q.options.find((o) => o.id === optId)?.text ?? null;
  };

  const questionsFor = (examId: string): Question[] => {
    const ids = questionMap[examId] ?? [];
    return ids
      .map((id) => bankById.get(id))
      .filter((q): q is Question => Boolean(q));
  };

  const handleCopy = async (exam: AdminExam) => {
    await onCopyLink(exam);
    setCopiedId(exam.id);
    setTimeout(() => setCopiedId((c) => (c === exam.id ? null : c)), 1600);
  };

  return (
    <>
      <div className="ad-head">
        <h1 className="ad-title">All <em>Exams</em></h1>
        <span className="ad-count">{exams.length} total</span>
      </div>

      {exams.length === 0 && (
        <div className="ad-empty">
          No exams yet. Tap <strong>+</strong> to create your first one.
        </div>
      )}

      <div className="ad-exam-list">
        {exams.map((exam) => {
          const meta = EXAM_STATUS_META[exam.status] ?? EXAM_STATUS_META.draft;
          const qIds = questionMap[exam.id] ?? [];
          const count = qIds.length;
          const summary = attemptsMap[exam.id];
          const attempts = summary?.attempts ?? [];
          const isOpen = expanded === exam.id;
          const questions = isOpen ? questionsFor(exam.id) : [];
          return (
            <div className={`ad-exam-row${isOpen ? " open" : ""}`} key={exam.id}>
              <div className="ad-exam-main">
                <div className="ad-exam-top">
                  <button
                    className="ad-exam-caret"
                    onClick={() => setExpanded(isOpen ? null : exam.id)}
                    aria-label={isOpen ? "Collapse" : "Expand"}
                  >
                    {isOpen ? "▾" : "▸"}
                  </button>
                  <span className="ad-exam-title">{exam.title}</span>
                  <span className={`badge ${meta.cls}`}>{meta.label}</span>
                </div>
                <div className="ad-exam-meta">
                  <span>{exam.subject}</span>
                  <span>·</span>
                  <span>{exam.duration}</span>
                  <span>·</span>
                  <span>{exam.status === "draft" ? "Not published" : `Taken ${exam.takenOn}`}</span>
                </div>
                <div className="ad-exam-chips">
                  <span className="ad-chip"><strong>{count}</strong> questions</span>
                  <span className="ad-chip"><strong>{attempts.length}</strong> attempted</span>
                  <span className="ad-chip"><strong>{summary?.avgScore ?? 0}%</strong> avg</span>
                  <span className="ad-chip mono">{exam.code}</span>
                </div>
              </div>
              <div className="ad-exam-side">
                <div className="ad-exam-actions">
                  <button className="ad-exam-btn" onClick={() => onShowResults(exam)}>Results</button>
                  <button className="ad-exam-btn" onClick={() => onEdit(exam)}>Edit</button>
                  <button className="ad-exam-btn" onClick={() => onManageQuestions(exam)}>
                    {count ? "Questions" : "Add Questions"}
                  </button>
                  <button className="ad-exam-btn ghost" onClick={() => handleCopy(exam)}>
                    {copiedId === exam.id ? "Copied ✓" : "Copy link"}
                  </button>
                  <button className="ad-exam-btn ghost" onClick={() => onCopyCode(exam)}>
                    Copy code
                  </button>
                  <button
                    className="ad-exam-btn danger"
                    onClick={() => onDelete(exam.id)}
                    aria-label={`Delete ${exam.title}`}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="ad-exam-detail">
                  {questions.length === 0 ? (
                    <div className="ad-empty small">
                      No questions added yet. Use <strong>Add Questions</strong> to build this exam.
                    </div>
                  ) : (
                    <ol className="ad-q-detail-list">
                      {questions.map((q, i) => {
                        const correctIdx = q.options.findIndex((o) => o.correct);
                        const keys = ["A", "B", "C", "D", "E", "F", "G", "H"];
                        return (
                          <li className="ad-q-detail" key={q.id}>
                            <div className="ad-q-detail-head">
                              <span className="ad-q-detail-num">Q. {i + 1}</span>
                              <span className="ad-q-detail-sub">
                                {q.chapter ? `${q.chapter} · ` : ""}
                                {q.marks} marks{q.negative ? ` · −${q.negative} neg` : ""}
                              </span>
                            </div>
                            <div className="ad-q-detail-prompt">
                              <MathPreview text={q.prompt} compact />
                            </div>
                            <div className="ad-q-detail-opts">
                              {q.options.map((o, oi) => (
                                <span
                                  key={o.id}
                                  className={`ad-q-detail-opt${oi === correctIdx ? " correct" : ""}`}
                                >
                                  <i>{keys[oi]}</i>
                                  <MathPreview text={o.text} compact />
                                </span>
                              ))}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}

                  <ExamAttempts
                    attempts={attempts}
                    bankById={bankById}
                    openAttempts={openAttempts}
                    setOpenAttempts={setOpenAttempts}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function StudentsPanel({
  attemptsMap,
}: {
  attemptsMap: Record<string, ExamAttemptSummary>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const knownNames = useMemo(() => {
    const byKey = new Map<string, string>();
    for (const s of Object.values(attemptsMap)) {
      for (const a of s.attempts) {
        const display = a.studentName.trim();
        if (!display) continue;
        const key = display.toLowerCase();
        if (!byKey.has(key)) byKey.set(key, display);
      }
    }
    return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b));
  }, [attemptsMap]);

  const open = (name: string) => {
    const target = name.trim();
    if (!target) return;
    router.push(`/admin/students?name=${encodeURIComponent(target)}`);
  };

  return (
    <>
      <div className="ad-head">
        <h1 className="ad-title">Student <em>Analysis</em></h1>
        <span className="ad-count">combined across all exams</span>
      </div>

      <div className="ad-info-card" style={{ maxWidth: 620 }}>
        <p className="ad-info-sub">
          Type a student&apos;s full name to open their combined performance page across
          every exam they have attempted. Matching is <strong>case-insensitive</strong>
          (e.g. “riya sharma”, “RIYA SHARMA” and “Riya Sharma” all open the same student).
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            open(query);
          }}
        >
          <div className="ad-field" style={{ marginBottom: 14 }}>
            <label>Student name</label>
            <input
              type="text"
              list="ad-students-list"
              placeholder="e.g. Riya Sharma"
              value={query}
              autoComplete="off"
              onChange={(e) => setQuery(e.target.value)}
            />
            <datalist id="ad-students-list">
              {knownNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <button
            type="submit"
            className="ad-submit ad-submit-inline"
            disabled={!query.trim()}
          >
            View analysis →
          </button>
        </form>
      </div>

      {knownNames.length > 0 && (
        <div className="ad-stu-quick">
          <div className="ad-attempts-head">
            On record · {knownNames.length} student{knownNames.length === 1 ? "" : "s"}
          </div>
          <div className="ad-stu-quick-list">
            {knownNames.map((n) => (
              <button
                key={n}
                type="button"
                className="ad-chip ad-stu-quick-btn"
                onClick={() => open(n)}
              >
                {n} →
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function InformationPanel({
  siteInfo,
  onSaved,
}: {
  siteInfo: SiteInfo;
  onSaved: (info: SiteInfo) => void;
}) {
  const [form, setForm] = useState<SiteInfo>(siteInfo);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (key: keyof SiteInfo, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveSiteInfo(form);
      onSaved(form);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const fields: { key: keyof SiteInfo; label: string; placeholder: string; type?: string }[] = [
    { key: "siteName", label: "Site name", placeholder: "World of Physics" },
    { key: "contactName", label: "Contact person", placeholder: "Mr. Biman Dhawa · Physics" },
    { key: "phone", label: "Phone number", placeholder: "+91 00000 00000", type: "tel" },
    { key: "email", label: "Email", placeholder: "hello@examsite.in", type: "email" },
    { key: "address", label: "Address", placeholder: "Belda, IN" },
    { key: "tagline", label: "Tagline", placeholder: "The exam before the exam." },
  ];

  return (
    <>
      <div className="ad-head">
        <h1 className="ad-title">Site <em>Information</em></h1>
        <span className="ad-count">public details</span>
      </div>

      <div className="ad-info-card">
        <p className="ad-info-sub">
          These details appear on the public site — footer, contact info, and the page title. Changes save to Firestore immediately.
        </p>
        <div className="ad-info-grid">
          {fields.map((f) => (
            <div className="ad-field" key={f.key} style={{ marginBottom: 16 }}>
              <label>{f.label}</label>
              <input
                type={f.type ?? "text"}
                value={form[f.key]}
                placeholder={f.placeholder}
                onChange={(e) => set(f.key, e.target.value)}
              />
            </div>
          ))}
        </div>
        <div className="ad-modal-foot">
          <span className="ad-saved">{saved ? "Saved ✓" : ""}</span>
          <button
            className="ad-submit ad-submit-inline"
            onClick={save}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save details"}
          </button>
        </div>
      </div>
    </>
  );
}

function ExamAttempts({
  attempts,
  bankById,
  openAttempts,
  setOpenAttempts,
}: {
  attempts: Attempt[];
  bankById: Map<string, Question>;
  openAttempts: Set<string>;
  setOpenAttempts: (updater: (prev: Set<string>) => Set<string>) => void;
}) {
  if (attempts.length === 0) {
    return (
      <div className="ad-attempts">
        <div className="ad-attempts-head">Attempts</div>
        <div className="ad-empty small">No students have attempted this exam yet.</div>
      </div>
    );
  }
  return (
    <div className="ad-attempts">
      <div className="ad-attempts-head">Attempts · {attempts.length} students</div>
      <div className="ad-attempt-list">
        {attempts.map((a) => {
          const open = openAttempts.has(a.id);
          const pct = a.total > 0 ? Math.round((a.score / a.total) * 100) : 0;
          return (
            <div className="ad-attempt" key={a.id}>
              <button
                className="ad-attempt-row"
                onClick={() =>
                  setOpenAttempts((prev) => {
                    const next = new Set(prev);
                    if (next.has(a.id)) next.delete(a.id);
                    else next.add(a.id);
                    return next;
                  })
                }
              >
                <span className="ad-attempt-caret">{open ? "▾" : "▸"}</span>
                <span className="ad-attempt-name">{a.studentName}</span>
                <span className="ad-attempt-score">{a.score}/{a.total} · {pct}%</span>
                <span className="ad-attempt-tags">
                  <span className="ad-atag ok">{a.correct}✓</span>
                  <span className="ad-atag bad">{a.wrong}✗</span>
                  <span className="ad-atag skip">{a.unattempted}–</span>
                </span>
              </button>
              {open && (
                <div className="ad-attempt-detail">
                  <ol className="ad-attempt-qlist">
                    {a.answers.map((ans, qi) => {
                      const q = bankById.get(ans.questionId);
                      const chosen = ans.chosenOptionId
                        ? q?.options.find((o) => o.id === ans.chosenOptionId)?.text ?? "—"
                        : null;
                      const correct = ans.correctOptionId
                        ? q?.options.find((o) => o.id === ans.correctOptionId)?.text ?? "—"
                        : "—";
                      const status = ans.chosen == null ? "skip" : ans.correct ? "ok" : "bad";
                      return (
                        <li className={`ad-attempt-q ${status}`} key={ans.questionId + "-" + qi}>
                          <div className="ad-aq-head">
                            <span className="ad-aq-num">Q. {qi + 1}</span>
                            <span className={`ad-aq-tag ${status}`}>
                              {status === "ok" ? "Correct" : status === "bad" ? "Wrong" : "Unattempted"}
                            </span>
                            <span className="ad-aq-marks">
                              {ans.marks > 0 ? `+${ans.marks}` : ans.marks < 0 ? `${ans.marks}` : "0"}
                            </span>
                          </div>
                          <div className="ad-aq-prompt"><MathPreview text={q?.prompt ?? "—"} compact /></div>
                          <div className="ad-aq-ans">
                            <span className="ad-aq-label">Their answer:</span>
                            <span className={status === "bad" ? "ad-aq-chosen bad" : status === "skip" ? "ad-aq-chosen skip" : "ad-aq-chosen"}>
                              {chosen ?? "Not attempted"}
                            </span>
                          </div>
                          {status !== "ok" && (
                            <div className="ad-aq-ans">
                              <span className="ad-aq-label">Correct answer:</span>
                              <span className="ad-aq-correct">{correct}</span>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NewExamModal({
  exam,
  onClose,
  onSave,
}: {
  exam?: AdminExam | null;
  onClose: () => void;
  onSave: (exam: AdminExam) => void;
}) {
  const [title, setTitle] = useState(exam?.title ?? "");
  const [duration, setDuration] = useState(
    exam ? exam.duration.replace(/[^0-9]/g, "") || "60" : "60"
  );
  const [status, setStatus] = useState<AdminExam["status"]>(exam?.status ?? "draft");
  const [takenOn, setTakenOn] = useState(
    exam && exam.takenOn !== "—" ? exam.takenOn : ""
  );

  const today = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
  const resolvedDate = status === "draft" ? "—" : takenOn.trim() || today;

  const generateCode = (): string => {
    if (exam?.code) return exam.code;
    const word = (title.trim().split(/\s+/)[0] || "EXAM")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 12);
    const subj = ((exam?.subject ?? "Mixed").slice(0, 3) || "EXM").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const seq = String((Date.now() % 100)).padStart(2, "0");
    return `${word}_${subj}_${seq}`;
  };

  const save = () => {
    if (!title.trim()) return;
    onSave({
      id: exam?.id ?? `exam-${Date.now()}`,
      title: title.trim(),
      subject: exam?.subject ?? "Mixed",
      code: generateCode(),
      takenOn: resolvedDate,
      status,
      attempts: exam?.attempts ?? 0,
      avgScore: exam?.avgScore ?? 0,
      duration: `${duration || "0"} min`,
    });
  };

  const statusMeta = EXAM_STATUS_META[status];

  return (
    <div className="ad-overlay" onClick={onClose}>
      <div className="ad-modal" onClick={(e) => e.stopPropagation()}>
        <button className="ad-close" onClick={onClose} aria-label="Close">×</button>
        <h3 className="ad-form-title">{exam ? "Edit" : "New"} <em>Exam</em></h3>
        <p className="ad-modal-sub">
          {exam
            ? "Update this exam. Changes are saved to Firestore immediately."
            : "Set up a new exam. Drafts stay hidden from students until published."}
        </p>

        <div className="ad-field" style={{ marginBottom: 16 }}>
          <label>Title</label>
          <input
            type="text"
            value={title}
            autoFocus
            placeholder="e.g. JEE Main 2026 · Mock V"
            onChange={(e) => setTitle(e.target.value)}
          />
          {!title.trim() && (
            <div className="ad-hint">A title is required to create the exam.</div>
          )}
        </div>

        <div className="ad-field" style={{ marginBottom: 16 }}>
          <label>Duration</label>
          <Stepper label="" value={duration} onChange={setDuration} step={5} min={5} />
        </div>

        <div className="ad-field" style={{ marginBottom: 16 }}>
          <label>Status</label>
          <div className="ad-seg">
            {(["draft", "scheduled", "completed"] as AdminExam["status"][]).map((s) => (
              <button
                key={s}
                type="button"
                className={`ad-seg-btn${status === s ? " active" : ""}`}
                onClick={() => setStatus(s)}
              >
                {EXAM_STATUS_META[s].label}
              </button>
            ))}
          </div>
        </div>

        {status !== "draft" && (
          <div className="ad-field" style={{ marginBottom: 16 }}>
            <label>Taken on</label>
            <input
              type="text"
              value={takenOn}
              placeholder={`e.g. ${today}`}
              onChange={(e) => setTakenOn(e.target.value)}
            />
            <div className="ad-hint">Leave blank to use today&apos;s date ({today}).</div>
          </div>
        )}

        <div className="ad-exam-preview">
          <span className={`badge ${statusMeta.cls}`}>{statusMeta.label}</span>
          <span className="ad-exam-preview-title">{title.trim() || "Untitled exam"}</span>
          <span className="ad-exam-preview-meta">
            {duration || "0"} min
            {status !== "draft" && ` · ${resolvedDate}`}
          </span>
        </div>

        <div className="ad-modal-foot">
          <button className="ad-set-btn ghost" onClick={onClose}>Cancel</button>
          <button
            className="ad-submit ad-submit-inline"
            onClick={save}
            disabled={!title.trim()}
          >
            Create Exam
          </button>
        </div>
      </div>
    </div>
  );
}

function ExamCodeDialog({
  exam,
  onClose,
  onContinue,
}: {
  exam: AdminExam;
  onClose: () => void;
  onContinue: () => void;
}) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const link =
    typeof window !== "undefined"
      ? `${window.location.origin}/exam?id=${encodeURIComponent(exam.code)}`
      : `/exam?id=${encodeURIComponent(exam.code)}`;

  const copy = async (value: string, which: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="ad-overlay" onClick={onClose}>
      <div className="ad-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <button className="ad-close" onClick={onClose} aria-label="Close">×</button>
        <h3 className="ad-form-title">Exam <em>Created</em></h3>
        <p className="ad-modal-sub">
          Your exam “{exam.title}” is saved. Share it with students using the code or link below.
        </p>

        <div className="ad-code-block">
          <div className="ad-code-label">Exam code</div>
          <div className="ad-code-row">
            <code className="ad-code-value">{exam.code}</code>
            <button
              className={`ad-share-btn${copied === "code" ? " done" : ""}`}
              onClick={() => copy(exam.code, "code")}
            >
              <span className="ad-share-ico">{copied === "code" ? "✓" : "⧉"}</span>
              {copied === "code" ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <div className="ad-code-block">
          <div className="ad-code-label">Exam link</div>
          <div className="ad-code-row">
            <code className="ad-code-value ad-code-link">{link}</code>
            <button
              className={`ad-share-btn${copied === "link" ? " done" : ""}`}
              onClick={() => copy(link, "link")}
            >
              <span className="ad-share-ico">{copied === "link" ? "✓" : "⧉"}</span>
              {copied === "link" ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <div className="ad-modal-foot">
          <button className="ad-set-btn ghost" onClick={onClose}>Done</button>
          <button className="ad-submit ad-submit-inline" onClick={onContinue}>
            Add Questions
          </button>
        </div>
      </div>
    </div>
  );
}

function AddQuestionsDialog({
  exam,
  questions,
  initialIds = [],
  onClose,
  onSave,
}: {
  exam: AdminExam;
  questions: Question[];
  initialIds?: string[];
  onClose: () => void;
  onSave: (questionIds: string[]) => void;
}) {
  const [mode, setMode] = useState<"chapter" | "choose">("chapter");
  const [selectedChapters, setSelectedChapters] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialIds));
  const [search, setSearch] = useState("");

  const chapters = Array.from(
    new Set(questions.map((q) => q.chapter?.trim() || "Uncategorized").filter(Boolean))
  ).sort();

  const chapterQuestionIds = (chapter: string) =>
    questions
      .filter((q) => (q.chapter?.trim() || "Uncategorized") === chapter)
      .map((q) => q.id);

  const toggleChapter = (chapter: string) => {
    setSelectedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chapter)) next.delete(chapter);
      else next.add(chapter);
      return next;
    });
  };

  const toggleQuestion = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const chapterIds = chapters
    .filter((c) => selectedChapters.has(c))
    .flatMap(chapterQuestionIds);
  const finalIds = Array.from(new Set([...chapterIds, ...selectedIds]));

  const filtered = questions.filter((q) =>
    q.prompt.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className="ad-overlay" onClick={onClose}>
      <div className="ad-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
        <button className="ad-close" onClick={onClose} aria-label="Close">×</button>
        <h3 className="ad-form-title">Add Questions to <em>{exam.title}</em></h3>
        <p className="ad-modal-sub">
          Choose how to fill this exam. You can combine both methods — the final set is
          the union of your selections.
        </p>

        <div className="ad-seg" style={{ marginBottom: 20 }}>
          <button
            type="button"
            className={`ad-seg-btn${mode === "chapter" ? " active" : ""}`}
            onClick={() => setMode("chapter")}
          >
            Question by Chapter
          </button>
          <button
            type="button"
            className={`ad-seg-btn${mode === "choose" ? " active" : ""}`}
            onClick={() => setMode("choose")}
          >
            Questions You Choose
          </button>
        </div>

        {mode === "chapter" && (
          <div className="ad-chapter-list">
            {chapters.length === 0 && (
              <div className="ad-empty">No chapters assigned to your questions yet.</div>
            )}
            {chapters.map((c) => {
              const count = chapterQuestionIds(c).length;
              const on = selectedChapters.has(c);
              return (
                <button
                  key={c}
                  type="button"
                  className={`ad-chapter-item${on ? " on" : ""}`}
                  onClick={() => toggleChapter(c)}
                >
                  <span className="ad-chapter-check">{on ? "✓" : ""}</span>
                  <span className="ad-chapter-name">{c}</span>
                  <span className="ad-chapter-count">{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {mode === "choose" && (
          <div className="ad-choose-list">
            <div className="ad-field" style={{ marginBottom: 14 }}>
              <input
                type="text"
                value={search}
                placeholder="Search questions…"
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {filtered.length === 0 && (
              <div className="ad-empty">No questions match your search.</div>
            )}
            <div className="ad-choose-scroll">
              {filtered.map((q) => {
                const on = selectedIds.has(q.id);
                return (
                  <button
                    key={q.id}
                    type="button"
                    className={`ad-chapter-item${on ? " on" : ""}`}
                    onClick={() => toggleQuestion(q.id)}
                  >
                    <span className="ad-chapter-check">{on ? "✓" : ""}</span>
                    <span className="ad-chapter-name ad-choose-prompt">
                      <MathPreview text={q.prompt} compact />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="ad-exam-preview" style={{ marginTop: 22 }}>
          <span className="ad-exam-preview-title">{finalIds.length} question{finalIds.length === 1 ? "" : "s"} selected</span>
          <span className="ad-exam-preview-meta">
            {selectedChapters.size} chapter{selectedChapters.size === 1 ? "" : "s"}
            {selectedIds.size > 0 ? ` · ${selectedIds.size} chosen individually` : ""}
          </span>
        </div>

        <div className="ad-modal-foot">
          <button className="ad-set-btn ghost" onClick={onClose}>Skip for now</button>
          <button
            className="ad-submit ad-submit-inline"
            onClick={() => onSave(finalIds)}
          >
            {finalIds.length ? `Save ${finalIds.length} Question${finalIds.length === 1 ? "" : "s"}` : "Save Exam"}
          </button>
        </div>
      </div>
    </div>
  );
}
