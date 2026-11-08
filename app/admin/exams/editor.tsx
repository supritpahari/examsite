/* Hallmark · genre: playful · theme: Hum · design-system: design.md · designed-as-app */
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Question } from "@/lib/questions";
import { addExam, setExamQuestions, type Exam, type ExamStatus } from "@/lib/exams";
import { MathPreview, Stepper } from "../shared";
import { copyText } from "@/lib/clipboard";
import { todayIsoLocal } from "@/lib/exams";

const STEPS = [
  { label: "Details", desc: "Give your exam a name, duration and status." },
  { label: "Questions", desc: "Pick questions by chapter or choose them individually." },
  { label: "Review", desc: "Set the marks and negative marking for each question, confirm the set, then create your exam." },
  { label: "Created", desc: "Your exam is saved — share the code or link with students." },
];

const STATUS_META: Record<ExamStatus, { label: string; cls: string }> = {
  completed: { label: "Completed", cls: "ec-badge green" },
  scheduled: { label: "Scheduled", cls: "ec-badge blue" },
  draft: { label: "Live", cls: "ec-badge green" },
  stopped: { label: "Stopped", cls: "ec-badge gray" },
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
  const [marksMap, setMarksMap] = useState<Record<string, number>>({});
  const [negativeMap, setNegativeMap] = useState<Record<string, number>>({});
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
  const resolvedDate = status === "draft" ? "—" : takenOn || todayIsoLocal();

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
        await setExamQuestions(exam.id, finalIds, marksMap, negativeMap);
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
      if (next.has(c)) {
        next.delete(c);
        setMarksMap((m) => {
          const n = { ...m };
          for (const qid of chapterQuestionIds(c)) {
            if (!selectedIds.has(qid)) delete n[qid];
          }
          return n;
        });
        setNegativeMap((m) => {
          const n = { ...m };
          for (const qid of chapterQuestionIds(c)) {
            if (!selectedIds.has(qid)) delete n[qid];
          }
          return n;
        });
      } else {
        next.add(c);
        setMarksMap((m) => {
          const n = { ...m };
          for (const qid of chapterQuestionIds(c)) if (n[qid] == null) n[qid] = 4;
          return n;
        });
        setNegativeMap((m) => {
          const n = { ...m };
          for (const qid of chapterQuestionIds(c)) if (n[qid] == null) n[qid] = 0;
          return n;
        });
      }
      return next;
    });

  const toggleQuestion = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setMarksMap((m) => {
          const n = { ...m };
          delete n[id];
          return n;
        });
        setNegativeMap((m) => {
          const n = { ...m };
          delete n[id];
          return n;
        });
      } else {
        next.add(id);
        setMarksMap((m) => (m[id] != null ? m : { ...m, [id]: 4 }));
        setNegativeMap((m) => (m[id] != null ? m : { ...m, [id]: 0 }));
      }
      return next;
    });

  const clearSelection = () => {
    setSelectedChapters(new Set());
    setSelectedIds(new Set());
    setMarksMap({});
    setNegativeMap({});
    setSearch("");
  };

  const copy = async (value: string, which: "code" | "link") => {
    const ok = await copyText(value);
    if (ok) {
      setCopied(which);
      setTimeout(() => setCopied(null), 1800);
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
    <div className="ec-root">
      <style>{`
        .ec-root {
          min-height: 100vh; background: var(--color-paper); color: var(--color-ink);
          font-family: var(--font-body);
          display: flex; flex-direction: column;
        }

        .ec-header {
          display: flex; align-items: center; justify-content: space-between; gap: 1rem;
          padding: 0.9rem var(--page-gutter); border-bottom: 1px solid var(--color-rule); flex-wrap: wrap;
          max-width: var(--page-max); margin-inline: auto; width: 100%;
        }
        .ec-header-title { font-family: var(--font-display); font-weight: 600; font-size: 1.5rem; letter-spacing: -0.03em; margin: 0; color: var(--color-ink); }
        .ec-header-sub { font-size: 0.66rem; color: var(--color-muted); margin-top: 0.25rem; font-family: var(--font-mono); font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; }
        .ec-back {
          background: var(--color-paper-2); border: 0; color: var(--color-ink-2);
          padding: 0.55rem 1rem; border-radius: var(--radius-pill); cursor: pointer; font-family: var(--font-body);
          font-size: 0.78rem; font-weight: 600; text-decoration: none;
        }
        .ec-back:hover { background: var(--color-paper-3); color: var(--color-ink); }

        /* ---- Progress rail ---- */
        .ec-progress {
          border-bottom: 1px solid var(--color-rule); background: var(--color-paper-2);
          padding: 1.1rem var(--page-gutter) 1rem;
        }
        .ec-progress-inner { max-width: 44rem; margin: 0 auto; }
        .ec-steps { display: flex; align-items: center; justify-content: space-between; }
        .ec-node { display: flex; align-items: center; gap: 0.6rem; }
        .ec-node-dot {
          width: 30px; height: 30px; border: 1.5px solid var(--color-rule-2); border-radius: 999px;
          display: grid; place-items: center; font-family: var(--font-mono);
          font-size: 0.7rem; font-weight: 600; color: var(--color-muted); background: var(--color-paper); flex: 0 0 auto;
          transition: all var(--dur-short) var(--ease-out);
        }
        .ec-node.active .ec-node-dot { border-color: var(--color-accent-2); background: var(--color-tint-cyan); color: var(--color-accent-2-deep); box-shadow: 0 0 0 3px oklch(66% 0.18 235 / 0.18); }
        .ec-node.done .ec-node-dot { background: var(--color-accent); color: var(--color-on-accent); border-color: var(--color-accent); }
        .ec-node-label { font-family: var(--font-body); font-size: 0.75rem; font-weight: 600; color: var(--color-muted); }
        .ec-node.active .ec-node-label { color: var(--color-accent-2-deep); }
        .ec-node.done .ec-node-label { color: var(--color-ink); }
        .ec-node.clickable { cursor: pointer; }
        .ec-track {
          position: relative; height: 4px; background: var(--color-rule); border-radius: 999px; margin: 0.85rem 2px 0.75rem; overflow: hidden;
        }
        .ec-track-fill { position: absolute; inset: 0 auto 0 0; background: var(--color-accent); border-radius: 999px; transition: width 0.25s var(--ease-out); }
        .ec-progress-caption {
          font-family: var(--font-mono); font-size: 0.6rem; font-weight: 500; color: var(--color-muted);
          text-transform: uppercase; letter-spacing: 0.14em; display: flex; justify-content: space-between;
        }
        .ec-progress-caption b { color: var(--color-ink-2); font-weight: 600; }

        /* ---- Body / panel ---- */
        .ec-body { flex: 1; padding: 1.5rem 1.25rem 6rem; }
        .ec-panel {
          max-width: 44rem; margin: 0 auto; background: var(--color-paper);
          border: 1px solid var(--color-rule); border-radius: var(--radius-card); box-shadow: var(--shadow-lift);
          padding: 1.5rem 1.75rem 1.35rem;
        }
        .ec-panel-head { margin-bottom: 1.25rem; border-bottom: 1px solid var(--color-rule); padding-bottom: 1rem; }
        .ec-kicker {
          font-family: var(--font-mono); font-size: 0.6rem; font-weight: 600; color: var(--color-muted);
          text-transform: uppercase; letter-spacing: 0.2em; margin: 0 0 0.4rem;
        }
        .ec-panel-title { font-family: var(--font-display); font-weight: 600; font-size: 1.5rem; letter-spacing: -0.03em; margin: 0 0 0.3rem; color: var(--color-ink); }
        .ec-panel-desc { font-size: 0.88rem; line-height: 1.6; color: var(--color-ink-2); margin: 0; }

        /* ---- Fields ---- */
        .ec-field { margin-bottom: 1rem; }
        .ec-field label {
          display: block; font-family: var(--font-mono); font-size: 0.58rem; font-weight: 500;
          text-transform: uppercase; letter-spacing: 0.18em; color: var(--color-muted); margin-bottom: 0.4rem;
        }
        .ec-field input {
          width: 100%; background: var(--color-paper-2); border: 1.5px solid transparent; border-radius: var(--radius-input);
          padding: 0.7rem 0.85rem; font-family: var(--font-mono); font-size: 0.9rem; color: var(--color-ink); outline: none;
          transition: border-color var(--dur-micro), background var(--dur-micro);
        }
        .ec-field input:focus { border-color: var(--color-accent-2); background: var(--color-paper); }
        .ec-row { display: flex; gap: 1rem; }
        .ec-row > * { flex: 1; }
        .ec-hint { font-size: 0.66rem; color: var(--color-muted); margin-top: 0.35rem; font-family: var(--font-mono); }

        .ec-seg { display: flex; background: var(--color-paper-2); overflow: hidden; border-radius: var(--radius-input); padding: 0.2rem; gap: 0.2rem; }
        .ec-seg-btn {
          flex: 1; background: transparent; border: 0; border-radius: var(--radius-sm);
          padding: 0.55rem 0.5rem; font-family: var(--font-body); font-size: 0.75rem; font-weight: 600;
          color: var(--color-muted); cursor: pointer;
          transition: background var(--dur-micro), color var(--dur-micro), box-shadow var(--dur-micro);
        }
        .ec-seg-btn:hover { color: var(--color-ink); }
        .ec-seg-btn.active { background: var(--color-paper); color: var(--color-ink); box-shadow: var(--shadow-card); }

        .ec-badge {
          display: inline-block; font-family: var(--font-body); font-size: 0.62rem; font-weight: 600;
          letter-spacing: 0.06em; padding: 0.2rem 0.55rem; border-radius: var(--radius-pill); border: 0;
        }
        .ec-badge.green { background: var(--color-tint-mint); color: var(--color-mint-deep); }
        .ec-badge.blue { background: var(--color-tint-cyan); color: var(--color-accent-2-deep); }
        .ec-badge.gray { background: var(--color-paper-2); color: var(--color-muted); }

        /* ---- Question picking ---- */
        .ec-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap; }
        .ec-count-chip {
          font-family: var(--font-body); font-size: 0.72rem; font-weight: 500; color: var(--color-ink-2);
          border-radius: var(--radius-pill); background: var(--color-tint-cyan); padding: 0.3rem 0.7rem;
        }
        .ec-count-chip b { color: var(--color-accent-2-deep); font-weight: 700; }
        .ec-clear {
          background: transparent; border: 1px solid var(--color-rule-2); color: var(--color-muted);
          border-radius: var(--radius-pill); font-family: var(--font-body); font-size: 0.68rem; font-weight: 600;
          padding: 0.35rem 0.7rem; cursor: pointer;
        }
        .ec-clear:hover { color: var(--color-ink); border-color: var(--color-ink); }
        .ec-seg-wide { display: flex; background: var(--color-paper-2); border-radius: var(--radius-input); overflow: hidden; padding: 0.2rem; gap: 0.2rem; margin-bottom: 1rem; }

        .ec-chapter-list { display: flex; flex-direction: column; gap: 0.45rem; }
        .ec-chapter-item {
          display: flex; align-items: center; gap: 0.75rem; width: 100%; text-align: left;
          background: var(--color-paper); border: 1.5px solid var(--color-rule); border-radius: var(--radius-input); padding: 0.75rem 0.9rem;
          cursor: pointer; transition: border-color var(--dur-micro), background var(--dur-micro); font-family: var(--font-body);
          color: var(--color-ink-2); font-size: 0.88rem;
        }
        .ec-chapter-item:hover { border-color: var(--color-accent-2); }
        .ec-chapter-item.on { border-color: var(--color-accent-2); background: var(--color-tint-cyan); color: var(--color-ink); }
        .ec-chapter-check {
          flex: 0 0 auto; width: 22px; height: 22px; border: 1.5px solid var(--color-rule-2); border-radius: 6px;
          display: grid; place-items: center; font-size: 0.8rem; color: transparent;
        }
        .ec-chapter-item.on .ec-chapter-check { background: var(--color-accent-2); border-color: var(--color-accent-2); color: var(--color-on-accent-2); }
        .ec-chapter-name { flex: 1; }
        .ec-chapter-count {
          font-family: var(--font-mono); font-size: 0.66rem; color: var(--color-muted);
          border: 1px solid var(--color-rule); border-radius: var(--radius-pill); padding: 0.15rem 0.5rem;
        }
        .ec-choose-scroll { max-height: 46vh; overflow-y: auto; display: flex; flex-direction: column; gap: 0.45rem; }
        .ec-choose-prompt { font-family: var(--font-body); font-weight: 500; font-size: 0.88rem; color: var(--color-ink); line-height: 1.5; }
        .ec-empty { color: var(--color-muted); font-size: 0.85rem; padding: 0.75rem 0; }

        /* ---- Review ---- */
        .ec-card { border-radius: var(--radius-card); box-shadow: var(--shadow-card); border: 1px solid var(--color-rule); background: var(--color-paper); padding: 1.35rem 1.5rem; margin-bottom: 1.25rem; }
        .ec-card-top { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
        .ec-card-title { font-family: var(--font-display); font-weight: 600; font-size: 1.3rem; letter-spacing: -0.03em; color: var(--color-ink); margin: 0.75rem 0 0.15rem; line-height: 1.2; }
        .ec-card-meta { font-family: var(--font-mono); font-size: 0.64rem; color: var(--color-muted); letter-spacing: 0.03em; }

        .ec-group { margin-bottom: 1.25rem; }
        .ec-group-head {
          display: flex; align-items: baseline; justify-content: space-between; gap: 0.75rem;
          font-family: var(--font-body); font-size: 0.75rem; font-weight: 600;
          color: var(--color-ink-2); margin-bottom: 0.5rem; border-bottom: 1.5px dashed var(--color-rule-2); padding-bottom: 0.4rem;
        }
        .ec-group-count { color: var(--color-muted); font-weight: 400; }
        .ec-qlist { display: flex; flex-direction: column; gap: 0.45rem; }
        .ec-qrow { border: 1px solid var(--color-rule); background: var(--color-paper); border-radius: var(--radius-input); padding: 0.7rem 0.85rem; display: flex; align-items: center; gap: 0.7rem; }
        .ec-qnum {
          flex: 0 0 auto; width: 26px; height: 26px; border: 1px solid var(--color-rule); border-radius: 6px;
          display: grid; place-items: center; font-family: var(--font-mono);
          font-size: 0.68rem; color: var(--color-ink-2); background: var(--color-paper-2);
        }
        .ec-qprompt { flex: 1; min-width: 0; overflow-wrap: anywhere; }
        .ec-qchapter { font-family: var(--font-mono); font-size: 0.54rem; color: var(--color-muted); text-transform: uppercase; letter-spacing: 0.12em; }
        .ec-qmarks { flex: 0 0 auto; display: flex; flex-direction: column; gap: 0.2rem; align-items: flex-end; }
        .ec-qmarks span { font-family: var(--font-mono); font-size: 0.52rem; color: var(--color-muted); text-transform: uppercase; letter-spacing: 0.14em; }
        .ec-qmarks input {
          width: 68px; background: var(--color-paper-2); border: 1.5px solid transparent; border-radius: var(--radius-sm);
          padding: 0.4rem 0.5rem; font-family: var(--font-mono); font-size: 0.82rem; color: var(--color-ink);
          outline: none; text-align: center; transition: border-color var(--dur-micro);
        }
        .ec-qmarks input:focus { border-color: var(--color-accent-2); background: var(--color-paper); }

        /* ---- Created ---- */
        .ec-success {
          border: 1px solid var(--color-rule); background: var(--color-paper); padding: 1.5rem 1.5rem; margin-bottom: 1.5rem; text-align: center;
          border-radius: var(--radius-card); box-shadow: var(--shadow-card);
        }
        .ec-success-ico {
          width: 54px; height: 54px; border-radius: 999px; background: var(--color-mint); color: var(--color-ink);
          display: grid; place-items: center; font-size: 1.5rem; margin: 0 auto 0.85rem;
        }
        .ec-success-title { font-family: var(--font-display); font-weight: 600; font-size: 1.4rem; letter-spacing: -0.03em; margin: 0 0 0.35rem; color: var(--color-ink); }
        .ec-success-sub { font-size: 0.86rem; color: var(--color-ink-2); margin: 0 auto 1.25rem; line-height: 1.6; max-width: 44ch; }
        .ec-code-block { border: 1px solid var(--color-rule); background: var(--color-paper-2); border-radius: var(--radius-input); padding: 0.9rem 1rem; margin-bottom: 0.85rem; text-align: left; }
        .ec-code-label { font-family: var(--font-mono); font-size: 0.58rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.18em; color: var(--color-muted); margin-bottom: 0.5rem; }
        .ec-code-row { display: flex; align-items: center; gap: 0.65rem; }
        .ec-code-value {
          flex: 1; font-family: var(--font-mono); font-size: 0.85rem; color: var(--color-ink);
          background: var(--color-paper); border: 1px solid var(--color-rule); border-radius: var(--radius-sm); padding: 0.55rem 0.75rem;
          overflow-x: auto; white-space: nowrap;
        }
        .ec-code-link { font-size: 0.75rem; font-weight: 600; color: var(--color-accent-2-deep); text-decoration: underline; text-underline-offset: 2px; }
        .ec-share-btn {
          font-family: var(--font-body); font-size: 0.66rem; font-weight: 600; letter-spacing: 0.02em; border: 1px solid var(--color-rule-2); background: transparent;
          border-radius: var(--radius-pill); color: var(--color-ink-2); padding: 0.4rem 0.7rem; cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem;
        }
        .ec-share-btn:hover { color: var(--color-ink); border-color: var(--color-ink); }
        .ec-share-btn.done { color: var(--color-mint-deep); border-color: var(--color-mint); background: var(--color-tint-mint); }

        /* ---- Sticky footer nav ---- */
        .ec-footer {
          position: fixed; left: 0; right: 0; bottom: 0; z-index: var(--z-sticky);
          background: color-mix(in oklch, var(--color-paper) 88%, transparent); backdrop-filter: blur(10px);
          border-top: 1px solid var(--color-rule);
          padding: 0.7rem var(--page-gutter);
        }
        .ec-footer-inner { max-width: 44rem; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; }
        .ec-btn {
          background: var(--color-paper-2); border: 0; color: var(--color-ink-2);
          padding: 0.75rem 1.25rem; border-radius: var(--radius-pill); cursor: pointer; font-family: var(--font-body);
          font-size: 0.82rem; font-weight: 600; text-decoration: none;
        }
        .ec-btn:hover { background: var(--color-paper-3); color: var(--color-ink); }
        .ec-btn.primary {
          background: var(--color-accent); color: var(--color-on-accent); border: 0;
          font-family: var(--font-display); font-weight: 600; font-size: 0.88rem; letter-spacing: -0.01em; text-transform: none;
          box-shadow: 0 4px 0 0 var(--color-accent-deep), 0 6px 12px -3px var(--color-accent-cast);
          transition: transform var(--dur-micro) var(--ease-press), box-shadow var(--dur-micro) var(--ease-press);
        }
        .ec-btn.primary:hover { transform: translateY(-2px); box-shadow: 0 6px 0 0 var(--color-accent-deep), 0 12px 20px -4px var(--color-accent-cast); }
        .ec-btn.primary:active { transform: translateY(2px); box-shadow: 0 1px 0 0 var(--color-accent-deep); }
        .ec-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .ec-error { font-size: 0.85rem; color: var(--color-danger); background: var(--color-danger-soft); border-radius: var(--radius-sm); padding: 0.55rem 0.75rem; margin-bottom: 0.75rem; line-height: 1.5; }

        /* math preview classes (shared with question editor) */
        .nq-preview-inline {
          font-family: var(--font-body); font-size: 15px;
          color: var(--color-ink); line-height: 1.6; word-break: break-word;
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

        .ec-stepper { display: flex; align-items: stretch; }
        .ec-stepper input {
          flex: 1; width: 100%; background: var(--color-paper-2); border: 1.5px solid transparent; border-right: 0;
          border-radius: var(--radius-input) 0 0 var(--radius-input); padding: 0.7rem 0.8rem; font-family: var(--font-mono); font-size: 0.9rem;
          color: var(--color-ink); outline: none;
        }
        .ec-stepper input:focus { border-color: var(--color-accent-2); background: var(--color-paper); outline: none; }
        .ec-stepper-btns { display: flex; flex-direction: column; background: var(--color-paper-2); border-radius: 0 var(--radius-input) var(--radius-input) 0; overflow: hidden; }
        .ec-stepper-btns button {
          flex: 1; width: 34px; background: transparent; border: 0; border-bottom: 1px solid var(--color-rule);
          cursor: pointer; color: var(--color-ink-2); font-size: 0.55rem; line-height: 1; display: grid; place-items: center;
        }
        .ec-stepper-btns button:last-child { border-bottom: 0; }
        .ec-stepper-btns button:hover { background: var(--color-tint-pear); color: var(--color-ink); }

        @media (max-width: 560px) {
          .ec-row { flex-direction: column; gap: 0; }
          .ec-node-label { display: none; }
          .ec-panel { padding: 1.25rem 1.1rem; }
          .ec-footer { padding: 0.6rem 1rem; }
        }

      `}</style>

      <header className="ec-header">
        <div>
          <h1 className="ec-header-title">New <span className="hl">Exam</span></h1>
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
                  <span className="ec-node-dot">{state === "done" ? (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" /></svg>) : i + 1}</span>
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
                    {(["draft", "scheduled"] as ExamStatus[]).map((s) => (
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
                    type="datetime-local"
                    value={takenOn}
                    onChange={(e) => setTakenOn(e.target.value)}
                  />
                  <div className="ec-hint">Pick a date and time. Leave blank to use today ({today}).</div>
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
                        <span className="ec-chapter-check">{on ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" /></svg> : null}</span>
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
                          <span className="ec-chapter-check">{on ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" /></svg> : null}</span>
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
                          <label className="ec-qmarks">
                            <span>Marks</span>
                            <input
                              type="number"
                              min={0}
                              value={marksMap[q.id] ?? 4}
                              onChange={(e) =>
                                setMarksMap((prev) => ({
                                  ...prev,
                                  [q.id]: Math.max(0, Number(e.target.value) || 0),
                                }))
                              }
                            />
                          </label>
                          <label className="ec-qmarks">
                            <span>Negative</span>
                            <input
                              type="number"
                              min={0}
                              value={negativeMap[q.id] ?? 0}
                              onChange={(e) =>
                                setNegativeMap((prev) => ({
                                  ...prev,
                                  [q.id]: Math.max(0, Number(e.target.value) || 0),
                                }))
                              }
                            />
                          </label>
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
                <div className="ec-success-ico" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" /></svg></div>
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
                      <span style={{display:"inline-flex"}}>{copied === "code" ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" /></svg> : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>}</span>
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
                      <span style={{display:"inline-flex"}}>{copied === "link" ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" /></svg> : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>}</span>
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