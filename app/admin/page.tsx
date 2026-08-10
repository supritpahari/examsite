"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthState } from "@/lib/firebase/client";
import { signOut } from "firebase/auth";
import {
  fetchQuestions,
  addQuestion as saveQuestion,
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

const PLACEHOLDER = "Type using LaTeX-style syntax: $x^2$, $\\frac{a}{b}$, $\\vec{v}$, $\\sqrt{x}$";

export default function AdminDashboard() {
  const [collapsed, setCollapsed] = useState(false);
  const [active, setActive] = useState("questions");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);

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

  const handleSignOut = async () => {
    const { getAuthInstance } = await import("@/lib/firebase/client");
    await signOut(getAuthInstance());
    router.replace("/admin/login");
  };

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
          min-height: 100vh;
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
        .ad-collapsed-label { display: none; }
        .ad-root.collapsed .ad-brand span,
        .ad-root.collapsed .ad-nav-item span:not(.dot) { display: none; }
        .ad-root.collapsed .ad-nav-item { justify-content: center; }

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
        .ad-q-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .ad-q-type {
          font-family: 'JetBrains Mono', monospace; font-size: 10px; text-transform: uppercase;
          letter-spacing: 0.14em; color: var(--accent); border: 1px solid var(--rule); padding: 3px 8px;
        }
        .ad-q-meta { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--dim); }
        .ad-q-prompt { font-family: 'Instrument Serif', serif; font-size: 19px; line-height: 1.4; color: var(--ink); margin-bottom: 14px; }
        .ad-q-img { max-height: 160px; border: 1px solid var(--rule); margin-bottom: 14px; }
        .ad-opts { display: grid; gap: 8px; }
        .ad-opt { display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--ink-2); }
        .ad-opt .k { width: 24px; height: 24px; border: 1px solid var(--rule); display: grid; place-items: center; font-family: 'JetBrains Mono', monospace; font-size: 11px; flex: 0 0 auto; }
        .ad-opt.correct { color: var(--accent); }
        .ad-opt.correct .k { background: var(--accent); color: #fff; border-color: var(--accent); }

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
        .ad-hint { font-size: 11px; color: var(--dim); margin-top: 6px; font-family: 'JetBrains Mono', monospace; }

        .ad-opt-edit { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
        .ad-opt-edit input[type="text"] { flex: 1; }
        .ad-opt-edit .ad-mark {
          font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--ink-2);
          display: flex; align-items: center; gap: 6px; white-space: nowrap;
        }
        .ad-opt-del {
          background: transparent; border: 1px solid var(--rule); color: var(--dim);
          width: 28px; height: 28px; cursor: pointer; flex: 0 0 auto;
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
          Exam<em>Site</em>
        </div>
        {NAV.map((n) => (
          <button
            key={n.key}
            className={`ad-nav-item${active === n.key ? " active" : ""}`}
            onClick={() => setActive(n.key)}
          >
            <span className="dot" />
            <span>{n.label}</span>
          </button>
        ))}
        <button className="ad-signout" onClick={handleSignOut}>
          <span className="dot" /> Sign out
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
                  <span className="ad-q-meta">+{q.marks} / -{q.negative}</span>
                </div>
                <div className="ad-q-prompt">{q.prompt}</div>
                {q.imageUrl && <img className="ad-q-img" src={q.imageUrl} alt="question" />}
                <div className="ad-opts">
                  {q.options.map((o, i) => (
                    <div className={`ad-opt${o.correct ? " correct" : ""}`} key={o.id}>
                      <span className="k">{String.fromCharCode(65 + i)}</span>
                      <span>{o.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {active !== "questions" && (
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
            <select value={type} onChange={(e) => setType(e.target.value as QuestionType)}>
              <option value="single">Single Correct</option>
              <option value="mcq">MCQ (Multiple)</option>
            </select>
          </div>
          <div className="ad-field">
            <label>Marks</label>
            <input type="number" value={marks} onChange={(e) => setMarks(e.target.value)} />
          </div>
          <div className="ad-field">
            <label>Negative</label>
            <input type="number" value={negative} onChange={(e) => setNegative(e.target.value)} />
          </div>
        </div>

        <div className="ad-field" style={{ marginBottom: 16 }}>
          <label>Question {type === "mcq" ? "(select all correct)" : "(select one correct)"}</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={PLACEHOLDER}
          />
          <div className="ad-hint">Supports regex / LaTeX-style notation for formulae, exponents, fractions, vectors.</div>
        </div>

        <div className="ad-field" style={{ marginBottom: 16 }}>
          <label>Options (max 4)</label>
          {options.map((o, i) => (
            <div className="ad-opt-edit" key={o.id}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, width: 18 }}>{String.fromCharCode(65 + i)}</span>
              <input
                type="text"
                value={o.text}
                onChange={(e) => setOptText(o.id, e.target.value)}
                placeholder="Option text — e.g. $\\vec{F} = m\\vec{a}$"
              />
              <label className="ad-mark">
                <input type="checkbox" checked={o.correct} onChange={() => toggleCorrect(o.id)} />
                correct
              </label>
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
