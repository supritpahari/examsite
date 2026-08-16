"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthState } from "@/lib/firebase/client";
import { fetchExams, type Exam } from "@/lib/exams";
import {
  fetchAllAttemptSummaries,
  type Attempt,
} from "@/lib/attempts";
import { fetchQuestions, type Question } from "@/lib/questions";
import { renderMathHtml, extractImageUrls } from "@/lib/render-math";

const KEYS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const canon = (s: string) => s.trim().toLowerCase();

interface Match {
  exam: Exam | undefined;
  attempt: Attempt;
}

function AdminStudentAnalysis() {
  const params = useSearchParams();
  const name = params.get("name") ?? "";
  const fromExam = params.get("exam") ?? "";
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [bankById, setBankById] = useState<Map<string, Question>>(new Map());
  const [openExams, setOpenExams] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsub = onAuthState((user) => {
      if (!user) router.replace("/admin/login");
      else setChecking(false);
    });
    return unsub;
  }, [router]);

  useEffect(() => {
    if (checking) return;
    let active = true;
    (async () => {
      try {
        if (!name.trim()) {
          setError("No student name was provided. Open this page from the exam results list.");
          return;
        }
        const [summaries, exams, bank] = await Promise.all([
          fetchAllAttemptSummaries(),
          fetchExams(),
          fetchQuestions(),
        ]);
        if (!active) return;
        const examById = new Map(exams.map((e) => [e.id, e]));
        const key = canon(name);
        const found: Match[] = [];
        for (const [examId, summary] of Object.entries(summaries)) {
          for (const a of summary.attempts) {
            if (canon(a.studentName) === key) {
              found.push({ exam: examById.get(examId), attempt: a });
            }
          }
        }
        found.sort(
          (x, y) => (y.attempt.submittedAt ?? 0) - (x.attempt.submittedAt ?? 0)
        );
        setMatches(found);
        setBankById(new Map(bank.map((q) => [q.id, q])));
        if (found.length > 0) setOpenExams(new Set([found[0].attempt.id]));
      } catch {
        if (active) setError("Could not load this student's data. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [checking, name]);

  const totals = useMemo(() => {
    let score = 0, max = 0, correct = 0, wrong = 0, unattempted = 0;
    for (const { attempt } of matches) {
      score += attempt.score;
      max += attempt.total;
      correct += attempt.correct;
      wrong += attempt.wrong;
      unattempted += attempt.unattempted;
    }
    const n = matches.length;
    const avgPct = n
      ? Math.round(
          (matches.reduce(
            (s, { attempt }) =>
              s + (attempt.total > 0 ? (attempt.score / attempt.total) * 100 : 0),
            0
          ) / n) * 10
        ) / 10
      : 0;
    const accuracy = correct + wrong > 0 ? Math.round((correct / (correct + wrong)) * 100) : 0;
    let best: { title: string; pct: number } | null = null;
    for (const m of matches) {
      const pct = m.attempt.total > 0 ? (m.attempt.score / m.attempt.total) * 100 : 0;
      if (!best || pct > best.pct) best = { title: m.exam?.title ?? m.attempt.examCode, pct };
    }
    return { score, max, correct, wrong, unattempted, n, avgPct, accuracy, best };
  }, [matches]);

  const toggleExam = (id: string) =>
    setOpenExams((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const displayName = matches[0]?.attempt.studentName.trim() || name.trim();

  return (
    <div className="ads-root">
      <style>{CSS}</style>
      <main className="ads-main">
        <div className="ads-topbar">
          <span style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/admin" className="ads-back">← Admin panel</Link>
            {fromExam && (
              <Link
                href={`/admin/results?exam=${encodeURIComponent(fromExam)}`}
                className="ads-back"
              >
                ← Exam results
              </Link>
            )}
          </span>
          <span className="ads-mono">Admin · Student analysis</span>
        </div>

        {(checking || loading) && <div className="ads-center">Loading analysis…</div>}

        {!checking && !loading && error && (
          <div className="ads-card">
            <h1 className="ads-title">No <em>data</em></h1>
            <p className="ads-sub">{error}</p>
            <Link href="/admin" className="ads-btn">Back to admin panel →</Link>
          </div>
        )}

        {!checking && !loading && !error && matches.length === 0 && (
          <div className="ads-card">
            <h1 className="ads-title">No <em>attempts</em></h1>
            <p className="ads-sub">
              No exam attempts found for “{name.trim()}”. The match is case-insensitive but the
              spelling must be exactly what the student entered.
            </p>
            <Link href="/admin" className="ads-btn">Back to admin panel →</Link>
          </div>
        )}

        {!checking && !loading && !error && matches.length > 0 && (
          <>
            <div className="ads-head">
              <h1 className="ads-title">
                <em>{displayName}</em>
              </h1>
              <div className="ads-meta">
                <span>{totals.n} exam{totals.n === 1 ? "" : "s"} attempted</span>
                <span>·</span>
                <span>combined across all exams</span>
              </div>
            </div>

            <div className="ads-card ads-summary">
              <div className="ads-summary-head">
                <div className="ads-mono">Combined performance</div>
                <div className="ads-total">
                  {totals.score}
                  <em> / {totals.max} marks</em>
                </div>
              </div>
              <div className="ads-grid">
                <div className="ads-cell">
                  <strong>{totals.avgPct}%</strong>
                  <span>Average score</span>
                </div>
                <div className="ads-cell">
                  <strong>{totals.accuracy}%</strong>
                  <span>Accuracy</span>
                </div>
                <div className="ads-cell ok">
                  <strong>{totals.correct}</strong>
                  <span>Correct</span>
                </div>
                <div className="ads-cell bad">
                  <strong>{totals.wrong}</strong>
                  <span>Wrong</span>
                </div>
                <div className="ads-cell skip">
                  <strong>{totals.unattempted}</strong>
                  <span>Unattempted</span>
                </div>
                <div className="ads-cell best">
                  <strong>{totals.best ? `${Math.round(totals.best.pct)}%` : "—"}</strong>
                  <span>{totals.best ? `Best · ${totals.best.title}` : "Best exam"}</span>
                </div>
              </div>
            </div>

            <div className="ads-mono ads-list-head">
              Exam by exam · tap to see every answer
            </div>

            <div className="ads-list">
              {matches.map(({ exam, attempt }) => {
                const pct = attempt.total > 0 ? Math.round((attempt.score / attempt.total) * 100) : 0;
                const open = openExams.has(attempt.id);
                const title = exam?.title ?? attempt.examCode ?? "Unknown exam";
                const when = attempt.submittedAt
                  ? new Date(attempt.submittedAt).toLocaleString()
                  : "—";
                return (
                  <div className={`ads-exam${open ? " open" : ""}`} key={attempt.id}>
                    <button className="ads-exam-row" onClick={() => toggleExam(attempt.id)}>
                      <span className="ads-caret">{open ? "▾" : "▸"}</span>
                      <span className="ads-exam-title">{title}</span>
                      <span className="ads-pct">{pct}%</span>
                      <span className="ads-exam-chips">
                        <span className="ads-chip"><strong>{attempt.score}</strong> / {attempt.total} marks</span>
                        <span className="ads-chip"><strong>{attempt.correct}</strong>✓</span>
                        <span className="ads-chip"><strong>{attempt.wrong}</strong>✗</span>
                        <span className="ads-chip"><strong>{attempt.unattempted}</strong>–</span>
                        <span className="ads-chip ads-chip-mono">{exam?.code ?? attempt.examCode}</span>
                        <span className="ads-chip">{when}</span>
                      </span>
                    </button>

                    {open && (
                      <ol className="ads-qlist">
                        {attempt.answers.map((ans, qi) => {
                          const q = bankById.get(ans.questionId);
                          const chosenIdx =
                            q && ans.chosenOptionId
                              ? q.options.findIndex((o) => o.id === ans.chosenOptionId)
                              : -1;
                          const correctIdx = q
                            ? q.options.findIndex((o) => o.id === ans.correctOptionId)
                            : -1;
                          const status =
                            ans.chosen == null ? "skip" : ans.correct ? "ok" : "bad";
                          return (
                            <li className={`ads-q ${status}`} key={`${ans.questionId}-${qi}`}>
                              <div className="ads-q-head">
                                <span className="ads-q-num">Q. {qi + 1}</span>
                                {q?.chapter && <span className="ads-q-chapter">{q.chapter}</span>}
                                <span className={`ads-q-tag ${status}`}>
                                  {status === "ok" ? "Correct" : status === "bad" ? "Wrong" : "Unattempted"}
                                </span>
                                <span className="ads-q-marks">
                                  {ans.marks > 0 ? `+${ans.marks}` : ans.marks < 0 ? `${ans.marks}` : "0"}
                                </span>
                              </div>
                              <p
                                className="ads-q-prompt"
                                dangerouslySetInnerHTML={{
                                  __html: renderMathHtml(q?.prompt ?? "—"),
                                }}
                              />
                              {q &&
                                [q.imageUrl, ...extractImageUrls(q.prompt)]
                                  .filter(
                                    (u, i, arr): u is string =>
                                      Boolean(u) && arr.indexOf(u) === i
                                  )
                                  .map((src, imgIdx) => (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      key={`${src}-${imgIdx}`}
                                      src={src}
                                      alt="Question diagram"
                                      className="ads-q-img"
                                    />
                                  ))}
                              {q && (
                                <div className="ads-q-opts">
                                  {q.options.map((o, oi) => {
                                    const cls =
                                      oi === correctIdx
                                        ? "answer"
                                        : oi === chosenIdx && status !== "ok"
                                        ? "chosen"
                                        : "";
                                    return (
<div key={o.id} className={`ads-q-opt ${cls}`}>
                                          <span className="ads-q-k">{KEYS[oi]}</span>
                                          <span
                                            className="ads-q-t"
                                            dangerouslySetInnerHTML={{
                                              __html: renderMathHtml(o.text),
                                            }}
                                          />
                                          {o.imageUrl && (
                                            <img
                                              className="ads-q-opt-img"
                                              src={o.imageUrl}
                                              alt={`Option ${KEYS[oi]}`}
                                            />
                                          )}
                                        </div>
                                    );
                                  })}
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

const CSS = `
  .ads-root {
    min-height: 100vh;
    background: #f4f0e8;
    color: #14110d;
    font-family: 'Inter', sans-serif;
    --paper: #f4f0e8;
    --paper-2: #ebe6da;
    --ink: #14110d;
    --ink-2: #3a352c;
    --dim: #8a8275;
    --rule: #d9d1bf;
    --accent: oklch(0.52 0.20 25);
    --accent-2: oklch(0.42 0.22 25);
  }
  .ads-center {
    min-height: 60vh; display: grid; place-items: center;
    font-family: 'JetBrains Mono', monospace; font-size: 12px;
    text-transform: uppercase; letter-spacing: 0.16em; color: var(--dim);
  }
  .ads-main { max-width: 980px; margin: 0 auto; padding: 30px 24px 64px; }
  .ads-topbar {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 30px; gap: 12px; flex-wrap: wrap;
  }
  .ads-back {
    font-family: 'JetBrains Mono', monospace; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--ink-2); text-decoration: none;
    border: 1px solid var(--rule); padding: 8px 12px; background: var(--paper);
  }
  .ads-back:hover { color: var(--accent); border-color: var(--accent); }
  .ads-mono {
    font-family: 'JetBrains Mono', monospace; font-size: 10px;
    text-transform: uppercase; letter-spacing: 0.16em; color: var(--dim);
  }
  .ads-title {
    font-family: 'Instrument Serif', serif; font-size: 46px; line-height: 1;
    letter-spacing: -0.02em; color: var(--ink); margin: 0 0 10px;
  }
  .ads-title em { font-style: italic; color: var(--accent); }
  .ads-meta {
    display: flex; gap: 8px; flex-wrap: wrap;
    font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--dim);
    letter-spacing: 0.04em;
  }
  .ads-head { margin-bottom: 22px; }
  .ads-card {
    border: 1px solid var(--rule); background: var(--paper); padding: 24px 26px;
  }
  .ads-card .ads-title { font-size: 32px; }
  .ads-sub { font-size: 13.5px; color: var(--ink-2); line-height: 1.7; margin: 0 0 20px; }
  .ads-btn {
    display: inline-block; background: var(--accent); color: #fff;
    border: 1px solid var(--accent); padding: 12px 22px; text-decoration: none;
    font-family: 'JetBrains Mono', monospace; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.08em;
  }
  .ads-btn:hover { background: var(--accent-2); border-color: var(--accent-2); }
  .ads-summary { margin-bottom: 28px; }
  .ads-summary-head {
    display: flex; justify-content: space-between; align-items: baseline;
    gap: 14px; flex-wrap: wrap; margin-bottom: 16px;
    border-bottom: 1px solid var(--rule); padding-bottom: 14px;
  }
  .ads-total {
    font-family: 'Instrument Serif', serif; font-size: 44px; line-height: 1; color: var(--accent);
  }
  .ads-total em {
    font-style: normal; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--dim);
  }
  .ads-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .ads-cell {
    border: 1px solid var(--rule); background: var(--paper-2);
    padding: 13px 12px; text-align: center;
  }
  .ads-cell strong {
    display: block; font-family: 'Instrument Serif', serif; font-size: 28px;
    color: var(--ink); line-height: 1.05;
  }
  .ads-cell span {
    font-family: 'JetBrains Mono', monospace; font-size: 9.5px;
    text-transform: uppercase; letter-spacing: 0.12em; color: var(--dim);
  }
  .ads-cell.ok strong { color: #0f7a3d; }
  .ads-cell.bad strong { color: var(--accent); }
  .ads-cell.skip strong { color: #9a8f78; }
  .ads-cell.best strong { font-size: 24px; }
  .ads-cell.best span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ads-list-head { margin-bottom: 10px; }
  .ads-list { display: flex; flex-direction: column; gap: 12px; }
  .ads-exam { border: 1px solid var(--rule); background: var(--paper); }
  .ads-exam.open { border-color: var(--accent); }
  .ads-exam-row {
    width: 100%; display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
    text-align: left; background: transparent; border: 0; cursor: pointer;
    padding: 16px 18px; font-family: inherit; color: inherit;
  }
  .ads-caret { color: var(--accent); font-size: 14px; flex: 0 0 auto; }
  .ads-exam-title { font-family: 'Instrument Serif', serif; font-size: 21px; color: var(--ink); }
  .ads-pct {
    font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 600;
    color: var(--accent); border: 1px solid var(--rule); padding: 3px 9px;
  }
  .ads-exam-chips { display: flex; gap: 8px; flex-wrap: wrap; }
  .ads-chip {
    font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.04em;
    background: var(--paper-2); border: 1px solid var(--rule); color: var(--ink-2);
    padding: 4px 9px; text-transform: uppercase;
  }
  .ads-chip strong { color: var(--ink); }
  .ads-chip-mono { text-transform: none; letter-spacing: 0.08em; color: var(--accent); }
  .ads-qlist {
    list-style: none; margin: 0; padding: 16px 18px;
    border-top: 1px dashed var(--rule);
    display: flex; flex-direction: column; gap: 12px;
  }
  .ads-q { border-left: 3px solid var(--rule); padding: 6px 0 6px 14px; }
  .ads-q.ok { border-left-color: #0f7a3d; }
  .ads-q.bad { border-left-color: var(--accent); }
  .ads-q.skip { border-left-color: #b8ad96; }
  .ads-q-head { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; flex-wrap: wrap; }
  .ads-q-num {
    font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 600; color: var(--ink);
  }
  .ads-q-chapter {
    font-family: 'JetBrains Mono', monospace; font-size: 9.5px; text-transform: uppercase;
    letter-spacing: 0.1em; color: var(--dim); border: 1px solid var(--rule); padding: 2px 7px;
  }
  .ads-q-tag {
    font-family: 'JetBrains Mono', monospace; font-size: 9px; text-transform: uppercase;
    letter-spacing: 0.1em; padding: 3px 7px; color: #fff;
  }
  .ads-q-tag.ok { background: #0f7a3d; }
  .ads-q-tag.bad { background: var(--accent); }
  .ads-q-tag.skip { background: #b8ad96; color: #14110d; }
  .ads-q-marks {
    margin-left: auto; font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 600;
  }
  .ads-q-prompt {
    font-family: 'Instrument Serif', serif; font-size: 17px; line-height: 1.5;
    color: var(--ink); margin: 0 0 10px;
  }
  .ads-q-img { max-width: 100%; max-height: 220px; border: 1px solid var(--rule); margin: 0 0 10px; display: block; }
  .ads-q-opts { display: flex; flex-direction: column; gap: 5px; }
  .ads-q-opt {
    display: flex; align-items: center; gap: 10px;
    padding: 7px 10px; border: 1px solid var(--rule); background: var(--paper-2);
  }
  .ads-q-opt.answer { border-color: #0f7a3d; background: #eef7ee; }
  .ads-q-opt.chosen { border-color: var(--accent); background: rgba(200, 50, 30, 0.07); }
  .ads-q-k {
    width: 20px; height: 20px; border: 1px solid var(--rule); display: grid; place-items: center;
    font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--dim); flex-shrink: 0;
  }
  .ads-q-opt.answer .ads-q-k { background: #0f7a3d; border-color: #0f7a3d; color: #fff; }
  .ads-q-opt.chosen .ads-q-k { background: var(--accent); border-color: var(--accent); color: #fff; }
  .ads-q-t { font-family: 'JetBrains Mono', monospace; font-size: 12.5px; color: var(--ink-2); }
  .ads-q-opt-img { display: block; max-width: 150px; max-height: 100px; margin-top: 6px; object-fit: contain; border: 1px solid var(--rule); }

  /* math rendering (lib/render-math output) */
  .frac { display: inline-flex; flex-direction: column; text-align: center; vertical-align: middle; margin: 0 3px; line-height: 1.1; }
  .frac > .num { border-bottom: 1px solid currentColor; padding: 0 5px 1px; }
  .frac > .den { padding: 1px 5px 0; }
  .sqrt { display: inline-flex; align-items: stretch; margin: 0 1px; vertical-align: middle; }
  .sqrt > .sym { font-size: 1.1em; line-height: 1; transform: scaleX(0.82); transform-origin: bottom; }
  .sqrt > .body { border-top: 1px solid currentColor; padding: 2px 3px 0; }
  .oline { border-top: 1px solid currentColor; padding-top: 1px; }
  .fn { font-style: italic; }
  sup, sub { font-size: 0.72em; line-height: 0; }

  @media (max-width: 720px) {
    .ads-grid { grid-template-columns: 1fr 1fr; }
    .ads-exam-chips { flex-basis: 100%; }
  }
`;

export default function AdminStudentsPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            background: "#f4f0e8",
            display: "grid",
            placeItems: "center",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "#8a8275",
          }}
        >
          Loading…
        </div>
      }
    >
      <AdminStudentAnalysis />
    </Suspense>
  );
}
