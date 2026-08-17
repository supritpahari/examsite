"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Question } from "@/lib/questions";
import { addExam, setExamQuestions, type Exam, type ExamStatus } from "@/lib/exams";
import { MathPreview, Stepper } from "../shared";

const STEPS = [
  { label: "Details", desc: "Give your exam a name, duration and status." },
  { label: "Questions", desc: "Pick questions by chapter or choose them individually." },
  { label: "Review", desc: "Confirm the details and question set, then create your exam." },
  { label: "Created", desc: "Your exam is saved — share the code or link with students." },
];

const STATUS_META: Record<ExamStatus, { label: string; cls: string }> = {
  completed: { label: "Completed", cls: "ec-badge green" },
  scheduled: { label: "Scheduled", cls: "ec-badge blue" },
  draft: { label: "Draft", cls: "ec-badge gray" },
};

export default function ExamCreator({
  questions = [],
  backHref = "/admin",
}: {
  questions?: Question[];
  backHref?: string;
}) {
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("60");
  const [status, setStatus] = useState<ExamStatus>("draft");
  const [takenOn, setTakenOn] = useState("");
  const [mode, setMode] = useState<"chapter" | "choose">("chapter");
  const [selectedChapters, setSelectedChapters] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [created, setCreated] = useState<Exam | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  const today = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
  const resolvedDate = status === "draft" ? "—" : takenOn.trim() || today;

  const chapters = useMemo(
    () =>
      Array.from(
        new Set(questions.map((q) => q.chapter?.trim() || "Uncategorized").filter(Boolean))
      ).sort(),
    [questions]
  );

  const chapterQuestionIds = (chapter: string) =>
    questions
      .filter((q) => (q.chapter?.trim() || "Uncategorized") === chapter)
      .map((q) => q.id);

  const finalIds = useMemo(() => {
    const chapterIds = chapters
      .filter((c) => selectedChapters.has(c))
      .flatMap((c) =>
        questions
          .filter((q) => (q.chapter?.trim() || "Uncategorized") === c)
          .map((q) => q.id)
      );
    return Array.from(new Set([...chapterIds, ...selectedIds]));
  }, [chapters, selectedChapters, selectedIds, questions]);

  const groupedByChapter = useMemo(() => {
    const map: Record<string, Question[]> = {};
    for (const id of finalIds) {
      const q = questions.find((x) => x.id === id);
      if (!q) continue;
      const ch = q.chapter?.trim() || "Uncategorized";
      (map[ch] ||= []).push(q);
    }
    return map;
  }, [finalIds, questions]);

  const filtered = questions.filter((q) =>
    q.prompt.toLowerCase().includes(search.trim().toLowerCase())
  );

  const generateCode = (): string => {
    const word = (title.trim().split(/\s+/)[0] || "EXAM")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 12);
    const subj = "MIX";
    const seq = String((Date.now() % 100)).padStart(2, "0");
    return `${word}_${subj}_${seq}`;
  };

  const create = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const exam = await addExam({
        title: title.trim(),
        subject: "Mixed",
        code: generateCode(),
        takenOn: resolvedDate,
        status,
        attempts: 0,
        avgScore: 0,
        duration: `${duration || "0"} min`,
      });
      if (finalIds.length) {
        await setExamQuestions(exam.id, finalIds);
      }
      setCreated(exam);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create the exam. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const toggleChapter = (c: string) =>
    setSelectedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

  const toggleQuestion = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const clearSelection = () => {
    setSelectedChapters(new Set());
    setSelectedIds(new Set());
    setSearch("");
  };

  const copy = async (value: string, which: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  const examLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/exam?id=${encodeURIComponent(created?.code ?? "")}`
      : `/exam?id=${encodeURIComponent(created?.code ?? "")}`;

  const canNext = step === 0 ? Boolean(title.trim()) : true;
  const goNext = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const progress = Math.round((step / (STEPS.length - 1)) * 100);
  const stepOrder = ["Details", "Questions", "Review", "Created"];

  return (
    <div
      className="ec-root"
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
        .ec-root {
          min-height: 100vh; background: var(--paper); color: var(--ink);
          font-family: 'Inter', sans-serif;
          display: flex; flex-direction: column;
        }

        .ec-header {
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
          padding: 22px 34px; border-bottom: 1px solid var(--rule); flex-wrap: wrap;
        }
        .ec-header-title { font-family: 'Instrument Serif', serif; font-size: 28px; margin: 0; color: var(--ink); }
        .ec-header-title em { font-style: italic; color: var(--accent); }
        .ec-header-sub { font-size: 13px; color: var(--dim); margin-top: 4px; font-family: 'JetBrains Mono', monospace; }
        .ec-back {
          background: transparent; border: 1px solid var(--ink); color: var(--ink);
          padding: 10px 16px; cursor: pointer; font-family: 'JetBrains Mono', monospace;
          font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em;
        }
        .ec-back:hover { background: var(--ink); color: var(--paper); }

        /* ---- Progress rail ---- */
        .ec-progress {
          border-bottom: 1px solid var(--rule); background: var(--paper-2);
          padding: 18px 34px 16px;
        }
        .ec-progress-inner { max-width: 720px; margin: 0 auto; }
        .ec-steps { display: flex; align-items: center; justify-content: space-between; }
        .ec-node { display: flex; align-items: center; gap: 10px; }
        .ec-node-dot {
          width: 30px; height: 30px; border: 1px solid var(--rule); border-radius: 999px;
          display: grid; place-items: center; font-family: 'JetBrains Mono', monospace;
          font-size: 12px; color: var(--dim); background: var(--paper); flex: 0 0 auto;
          transition: all 0.15s ease;
        }
        .ec-node.active .ec-node-dot { border-color: var(--accent); color: var(--accent); box-shadow: 0 0 0 3px rgba(220,60,40,0.12); }
        .ec-node.done .ec-node-dot { background: var(--accent); color: #fff; border-color: var(--accent); }
        .ec-node-label { font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--dim); }
        .ec-node.active .ec-node-label { color: var(--accent); }
        .ec-node.done .ec-node-label { color: var(--ink); }
        .ec-node.clickable { cursor: pointer; }
        .ec-track {
          position: relative; height: 3px; background: var(--rule); margin: 14px 2px 12px;
        }
        .ec-track-fill { position: absolute; inset: 0 auto 0 0; background: var(--accent); transition: width 0.25s ease; }
        .ec-progress-caption {
          font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--dim);
          text-transform: uppercase; letter-spacing: 0.1em; display: flex; justify-content: space-between;
        }
        .ec-progress-caption b { color: var(--ink-2); font-weight: 500; }

        /* ---- Body / panel ---- */
        .ec-body { flex: 1; padding: 30px 20px 90px; }
        .ec-panel {
          max-width: 720px; margin: 0 auto; background: var(--paper);
          border: 1px solid var(--rule); padding: 30px 34px 26px;
        }
        .ec-panel-head { margin-bottom: 24px; border-bottom: 1px solid var(--rule); padding-bottom: 18px; }
        .ec-kicker {
          font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--accent);
          text-transform: uppercase; letter-spacing: 0.2em; margin: 0 0 8px;
        }
        .ec-panel-title { font-family: 'Instrument Serif', serif; font-size: 24px; margin: 0 0 6px; color: var(--ink); }
        .ec-panel-desc { font-size: 13px; line-height: 1.6; color: var(--dim); margin: 0; }

        /* ---- Fields ---- */
        .ec-field { margin-bottom: 20px; }
        .ec-field label {
          display: block; font-family: 'JetBrains Mono', monospace; font-size: 10px;
          text-transform: uppercase; letter-spacing: 0.16em; color: var(--ink-2); margin-bottom: 8px;
        }
        .ec-field input {
          width: 100%; background: transparent; border: 1px solid var(--ink); border-radius: 0;
          padding: 12px 14px; font-family: 'JetBrains Mono', monospace; font-size: 14px; color: var(--ink); outline: none;
          transition: background 0.15s ease;
        }
        .ec-field input:focus { background: #fff; }
        .ec-row { display: flex; gap: 16px; }
        .ec-row > * { flex: 1; }
        .ec-hint { font-size: 11px; color: var(--dim); margin-top: 6px; font-family: 'JetBrains Mono', monospace; }

        .ec-seg { display: flex; border: 1px solid var(--ink); overflow: hidden; }
        .ec-seg-btn {
          flex: 1; background: transparent; border: 0; border-right: 1px solid var(--rule);
          padding: 11px 8px; font-family: 'JetBrains Mono', monospace; font-size: 11px;
          text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-2); cursor: pointer;
          transition: all 0.15s ease;
        }
        .ec-seg-btn:last-child { border-right: 0; }
        .ec-seg-btn:hover { background: var(--paper-2); color: var(--ink); }
        .ec-seg-btn.active { background: var(--accent); color: #fff; }

        .ec-badge {
          display: inline-block; font-family: 'JetBrains Mono', monospace; font-size: 9px;
          text-transform: uppercase; letter-spacing: 0.14em; padding: 3px 9px; border: 1px solid var(--rule);
        }
        .ec-badge.green { background: #d9ead3; color: #274e13; }
        .ec-badge.blue { background: #cfe2f3; color: #0b3d66; }
        .ec-badge.gray { background: var(--paper); color: var(--dim); }

        /* ---- Question picking ---- */
        .ec-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; flex-wrap: wrap; }
        .ec-count-chip {
          font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--ink-2);
          border: 1px solid var(--rule); background: var(--paper-2); padding: 6px 10px;
        }
        .ec-count-chip b { color: var(--accent); }
        .ec-clear {
          background: transparent; border: 1px solid var(--rule); color: var(--dim);
          font-family: 'JetBrains Mono', monospace; font-size: 10px; text-transform: uppercase;
          letter-spacing: 0.08em; padding: 6px 10px; cursor: pointer;
        }
        .ec-clear:hover { color: var(--accent); border-color: var(--accent); }
        .ec-seg-wide { display: flex; border: 1px solid var(--ink); overflow: hidden; margin-bottom: 20px; }

        .ec-chapter-list { display: flex; flex-direction: column; gap: 8px; }
        .ec-chapter-item {
          display: flex; align-items: center; gap: 14px; width: 100%; text-align: left;
          background: var(--paper); border: 1px solid var(--rule); padding: 13px 16px;
          cursor: pointer; transition: all 0.15s ease; font-family: 'Inter', sans-serif;
          color: var(--ink-2); font-size: 14px;
        }
        .ec-chapter-item:hover { border-color: var(--accent); color: var(--ink); }
        .ec-chapter-item.on { border-color: var(--accent); background: rgba(220,60,40,0.06); color: var(--ink); }
        .ec-chapter-check {
          flex: 0 0 auto; width: 22px; height: 22px; border: 1px solid var(--rule);
          display: grid; place-items: center; font-size: 13px; color: #fff;
        }
        .ec-chapter-item.on .ec-chapter-check { background: var(--accent); border-color: var(--accent); }
        .ec-chapter-name { flex: 1; }
        .ec-chapter-count {
          font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--dim);
          border: 1px solid var(--rule); padding: 2px 8px;
        }
        .ec-choose-scroll { max-height: 46vh; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
        .ec-choose-prompt { font-family: 'Instrument Serif', serif; font-size: 15px; color: var(--ink); line-height: 1.4; }
        .ec-empty { color: var(--dim); font-size: 13px; font-family: 'JetBrains Mono', monospace; padding: 12px 0; }

        /* ---- Review ---- */
        .ec-card { border: 1px solid var(--ink); background: #fffdf8; position: relative; padding: 22px 24px; margin-bottom: 24px; }
        .ec-card::before, .ec-card::after {
          content: ""; position: absolute; width: 12px; height: 12px; background: var(--ink);
        }
        .ec-card::before { top: -1px; left: -1px; }
        .ec-card::after { bottom: -1px; right: -1px; }
        .ec-card-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .ec-card-title { font-family: 'Instrument Serif', serif; font-size: 21px; color: var(--ink); margin: 12px 0 4px; line-height: 1.2; }
        .ec-card-meta { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--dim); letter-spacing: 0.04em; }

        .ec-group { margin-bottom: 20px; }
        .ec-group-head {
          display: flex; align-items: baseline; justify-content: space-between; gap: 12px;
          font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase;
          letter-spacing: 0.12em; color: var(--ink-2); margin-bottom: 8px; border-bottom: 1px dashed var(--rule); padding-bottom: 6px;
        }
        .ec-group-count { color: var(--dim); }
        .ec-qlist { display: flex; flex-direction: column; gap: 8px; }
        .ec-qrow { border: 1px solid var(--rule); background: var(--paper); padding: 12px 14px; display: flex; align-items: center; gap: 12px; }
        .ec-qnum {
          flex: 0 0 auto; width: 26px; height: 26px; border: 1px solid var(--rule);
          display: grid; place-items: center; font-family: 'JetBrains Mono', monospace;
          font-size: 11px; color: var(--ink-2); background: var(--paper-2);
        }
        .ec-qprompt { flex: 1; min-width: 0; }
        .ec-qchapter { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: var(--dim); text-transform: uppercase; letter-spacing: 0.1em; }

        /* ---- Created ---- */
        .ec-success {
          border: 1px solid var(--ink); background: #fffdf8; position: relative; padding: 28px 26px; margin-bottom: 24px; text-align: center;
        }
        .ec-success::before, .ec-success::after { content: ""; position: absolute; width: 12px; height: 12px; background: var(--ink); }
        .ec-success::before { top: -1px; left: -1px; }
        .ec-success::after { bottom: -1px; right: -1px; }
        .ec-success-ico {
          width: 46px; height: 46px; border-radius: 999px; background: #d9ead3; color: #274e13;
          display: grid; place-items: center; font-size: 22px; margin: 0 auto 14px;
        }
        .ec-success-title { font-family: 'Instrument Serif', serif; font-size: 22px; margin: 0 0 6px; color: var(--ink); }
        .ec-success-sub { font-size: 13px; color: var(--dim); margin: 0 0 20px; line-height: 1.6; }
        .ec-code-block { border: 1px solid var(--rule); background: var(--paper-2); padding: 16px 18px; margin-bottom: 14px; text-align: left; }
        .ec-code-label { font-family: 'JetBrains Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.16em; color: var(--dim); margin-bottom: 10px; }
        .ec-code-row { display: flex; align-items: center; gap: 12px; }
        .ec-code-value {
          flex: 1; font-family: 'JetBrains Mono', monospace; font-size: 14px; color: var(--ink);
          background: var(--paper); border: 1px solid var(--rule); padding: 10px 12px;
          overflow-x: auto; white-space: nowrap;
        }
        .ec-code-link { font-size: 12px; color: var(--accent); }
        .ec-share-btn {
          font-family: 'JetBrains Mono', monospace; font-size: 10px; text-transform: uppercase;
          letter-spacing: 0.08em; border: 1px solid var(--rule); background: transparent;
          color: var(--ink-2); padding: 8px 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
        }
        .ec-share-btn:hover { color: var(--accent); border-color: var(--accent); }
        .ec-share-btn.done { color: #274e13; border-color: #d9ead3; background: #d9ead3; }

        /* ---- Sticky footer nav ---- */
        .ec-footer {
          position: fixed; left: 0; right: 0; bottom: 0; z-index: 20;
          background: var(--paper); border-top: 1px solid var(--rule);
          padding: 14px 34px;
        }
        .ec-footer-inner { max-width: 720px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
        .ec-btn {
          background: transparent; border: 1px solid var(--ink); color: var(--ink);
          padding: 12px 20px; cursor: pointer; font-family: 'JetBrains Mono', monospace;
          font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em;
        }
        .ec-btn:hover { background: var(--ink); color: var(--paper); }
        .ec-btn.primary {
          background: var(--accent); color: #fff; border-color: var(--accent);
          font-family: 'Inter', sans-serif; font-weight: 600; letter-spacing: 0.04em;
        }
        .ec-btn.primary:hover { background: var(--accent-2); border-color: var(--accent-2); }
        .ec-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .ec-error { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--accent); margin-bottom: 12px; line-height: 1.5; }

        /* math preview classes (shared with question editor) */
        .nq-preview-inline {
          font-family: 'Georgia', 'Times New Roman', serif; font-size: 15px;
          color: var(--ink); line-height: 1.6; word-break: break-word;
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

        .ec-stepper { display: flex; align-items: stretch; }
        .ec-stepper input {
          flex: 1; width: 100%; background: transparent; border: 1px solid var(--ink); border-right: 0;
          border-radius: 0; padding: 12px 14px; font-family: 'JetBrains Mono', monospace; font-size: 14px;
          color: var(--ink); outline: none;
        }
        .ec-stepper input:focus { background: #fff; }
        .ec-stepper-btns { display: flex; flex-direction: column; border: 1px solid var(--ink); border-left: 0; }
        .ec-stepper-btns button {
          flex: 1; width: 34px; background: transparent; border: 0; border-bottom: 1px solid var(--ink);
          cursor: pointer; color: var(--ink-2); font-size: 9px; line-height: 1; display: grid; place-items: center;
        }
        .ec-stepper-btns button:last-child { border-bottom: 0; }
        .ec-stepper-btns button:hover { background: var(--accent); color: #fff; }

        @media (max-width: 560px) {
          .ec-row { flex-direction: column; gap: 0; }
          .ec-node-label { display: none; }
          .ec-panel { padding: 22px 20px; }
        }
      `}</style>

      <header className="ec-header">
        <div>
          <h1 className="ec-header-title">New <em>Exam</em></h1>
          <div className="ec-header-sub">Create your exam step by step.</div>
        </div>
        <button className="ec-back" onClick={() => router.push(backHref)} aria-label="Back to admin">
          ← Back
        </button>
      </header>

      {/* Progress rail */}
      <div className="ec-progress">
        <div className="ec-progress-inner">
          <div className="ec-steps">
            {STEPS.map((s, i) => {
              const state = i === step ? "active" : step > i ? "done" : "";
              return (
                <div
                  key={s.label}
                  className={`ec-node ${state}${i < step ? " clickable" : ""}`}
                  onClick={i < step ? () => setStep(i) : undefined}
                  title={i < step ? `Go to ${s.label}` : undefined}
                >
                  <span className="ec-node-dot">{state === "done" ? "✓" : i + 1}</span>
                  <span className="ec-node-label">{s.label}</span>
                </div>
              );
            })}
          </div>
          <div className="ec-track">
            <div className="ec-track-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="ec-progress-caption">
            <span>Step {step + 1} of {STEPS.length}</span>
            <span><b>{stepOrder[step]}</b></span>
          </div>
        </div>
      </div>

      <div className="ec-body">
        <div className="ec-panel">
          {error && <div className="ec-error">{error}</div>}

          {/* STEP 0 — Details */}
          {step === 0 && (
            <>
              <div className="ec-panel-head">
                <p className="ec-kicker">Step 1 of 4</p>
                <h2 className="ec-panel-title">Details</h2>
                <p className="ec-panel-desc">{STEPS[0].desc}</p>
              </div>

              <div className="ec-field">
                <label>Title</label>
                <input
                  type="text"
                  value={title}
                  autoFocus
                  placeholder="e.g. JEE Main 2026 · Mock V"
                  onChange={(e) => setTitle(e.target.value)}
                />
                {!title.trim() && <div className="ec-hint">A title is required to create the exam.</div>}
              </div>

              <div className="ec-row">
                <div className="ec-field">
                  <label>Duration</label>
                  <Stepper label="" value={duration} onChange={setDuration} step={5} min={5} />
                </div>
                <div className="ec-field">
                  <label>Status</label>
                  <div className="ec-seg">
                    {(["draft", "scheduled", "completed"] as ExamStatus[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={`ec-seg-btn${status === s ? " active" : ""}`}
                        onClick={() => setStatus(s)}
                      >
                        {STATUS_META[s].label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {status !== "draft" && (
                <div className="ec-field">
                  <label>Taken on</label>
                  <input
                    type="text"
                    value={takenOn}
                    placeholder={`e.g. ${today}`}
                    onChange={(e) => setTakenOn(e.target.value)}
                  />
                  <div className="ec-hint">Leave blank to use today&apos;s date ({today}).</div>
                </div>
              )}
            </>
          )}

          {/* STEP 1 — Questions */}
          {step === 1 && (
            <>
              <div className="ec-panel-head">
                <p className="ec-kicker">Step 2 of 4</p>
                <h2 className="ec-panel-title">Questions</h2>
                <p className="ec-panel-desc">{STEPS[1].desc}</p>
              </div>

              <div className="ec-toolbar">
                <span className="ec-count-chip">
                  <b>{finalIds.length}</b> question{finalIds.length === 1 ? "" : "s"} selected
                </span>
                {finalIds.length > 0 && (
                  <button className="ec-clear" onClick={clearSelection}>Clear selection</button>
                )}
              </div>

              <div className="ec-seg-wide">
                <button
                  type="button"
                  className={`ec-seg-btn${mode === "chapter" ? " active" : ""}`}
                  onClick={() => setMode("chapter")}
                >
                  Question by Chapter
                </button>
                <button
                  type="button"
                  className={`ec-seg-btn${mode === "choose" ? " active" : ""}`}
                  onClick={() => setMode("choose")}
                >
                  Questions You Choose
                </button>
              </div>

              {mode === "chapter" && (
                <div className="ec-chapter-list">
                  {chapters.length === 0 && (
                    <div className="ec-empty">No chapters assigned to your questions yet.</div>
                  )}
                  {chapters.map((c) => {
                    const count = chapterQuestionIds(c).length;
                    const on = selectedChapters.has(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        className={`ec-chapter-item${on ? " on" : ""}`}
                        onClick={() => toggleChapter(c)}
                      >
                        <span className="ec-chapter-check">{on ? "✓" : ""}</span>
                        <span className="ec-chapter-name">{c}</span>
                        <span className="ec-chapter-count">{count}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {mode === "choose" && (
                <>
                  <div className="ec-field" style={{ marginBottom: 14 }}>
                    <input
                      type="text"
                      value={search}
                      placeholder="Search questions…"
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  {filtered.length === 0 && <div className="ec-empty">No questions match your search.</div>}
                  <div className="ec-choose-scroll">
                    {filtered.map((q) => {
                      const on = selectedIds.has(q.id);
                      return (
                        <button
                          key={q.id}
                          type="button"
                          className={`ec-chapter-item${on ? " on" : ""}`}
                          onClick={() => toggleQuestion(q.id)}
                        >
                          <span className="ec-chapter-check">{on ? "✓" : ""}</span>
                          <span className="ec-chapter-name ec-choose-prompt">
                            <MathPreview text={q.prompt} compact />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {/* STEP 2 — Review */}
          {step === 2 && (
            <>
              <div className="ec-panel-head">
                <p className="ec-kicker">Step 3 of 4</p>
                <h2 className="ec-panel-title">Review</h2>
                <p className="ec-panel-desc">{STEPS[2].desc}</p>
              </div>

              <div className="ec-card">
                <div className="ec-card-top">
                  <span className={`${STATUS_META[status].cls}`}>{STATUS_META[status].label}</span>
                  <span className="ec-card-meta">{finalIds.length} question{finalIds.length === 1 ? "" : "s"}</span>
                </div>
                <div className="ec-card-title">{title.trim() || "Untitled exam"}</div>
                <div className="ec-card-meta">
                  {duration || "0"} min{status !== "draft" && ` · ${resolvedDate}`}
                </div>
              </div>

              {finalIds.length === 0 ? (
                <div className="ec-empty">
                  No questions selected. You can add questions to this exam later from the admin panel.
                </div>
              ) : (
                Object.entries(groupedByChapter).map(([chapter, qs]) => (
                  <div className="ec-group" key={chapter}>
                    <div className="ec-group-head">
                      <span>{chapter}</span>
                      <span className="ec-group-count">{qs.length} question{qs.length === 1 ? "" : "s"}</span>
                    </div>
                    <div className="ec-qlist">
                      {qs.map((q) => (
                        <div className="ec-qrow" key={q.id}>
                          <span className="ec-qnum">{finalIds.indexOf(q.id) + 1}</span>
                          <div className="ec-qprompt">
                            <MathPreview text={q.prompt} compact />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {/* STEP 3 — Created */}
          {step === 3 && created && (
            <>
              <div className="ec-success">
                <div className="ec-success-ico">✓</div>
                <h2 className="ec-success-title">Exam created</h2>
                <p className="ec-success-sub">
                  “{created.title}” is saved with {finalIds.length} question{finalIds.length === 1 ? "" : "s"}.
                  Share it with students using the code or link below.
                </p>

                <div className="ec-code-block">
                  <div className="ec-code-label">Exam code</div>
                  <div className="ec-code-row">
                    <code className="ec-code-value">{created.code}</code>
                    <button
                      className={`ec-share-btn${copied === "code" ? " done" : ""}`}
                      onClick={() => copy(created.code, "code")}
                    >
                      <span>{copied === "code" ? "✓" : "⧉"}</span>
                      {copied === "code" ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>

                <div className="ec-code-block">
                  <div className="ec-code-label">Exam link</div>
                  <div className="ec-code-row">
                    <code className="ec-code-value ec-code-link">{examLink}</code>
                    <button
                      className={`ec-share-btn${copied === "link" ? " done" : ""}`}
                      onClick={() => copy(examLink, "link")}
                    >
                      <span>{copied === "link" ? "✓" : "⧉"}</span>
                      {copied === "link" ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Sticky footer nav */}
      <div className="ec-footer">
        <div className="ec-footer-inner">
          {step < 3 ? (
            <button className="ec-btn" onClick={() => (step === 0 ? router.push(backHref) : setStep((s) => s - 1))}>
              {step === 0 ? "Cancel" : "← Back"}
            </button>
          ) : (
            <span />
          )}

          <div>
            {step === 2 && (
              <button className="ec-btn primary" onClick={create} disabled={saving}>
                {saving ? "Creating…" : `Create Exam${finalIds.length ? ` (${finalIds.length} Q)` : ""}`}
              </button>
            )}
            {step < 2 && (
              <button className="ec-btn primary" onClick={goNext} disabled={!canNext}>
                {step === 0 ? "Continue →" : "Review →"}
              </button>
            )}
            {step === 3 && (
              <button className="ec-btn primary" onClick={() => router.push(backHref)}>
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}