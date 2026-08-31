"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  fetchExamByCode,
  fetchExamQuestionIds,
  fetchExamQuestionMarks,
  type Exam,
} from "@/lib/exams";
import { fetchQuestions, type Question, type QuestionType } from "@/lib/questions";
import { saveAttempt, hasAttemptBySession, hasAttemptByName } from "@/lib/attempts";
import { getDeviceId } from "@/lib/session";
import { renderMathHtml, extractImageUrls } from "@/lib/render-math";

interface RuntimeOption {
  id: string;
  text: string;
  imageUrl?: string;
}

interface RuntimeQuestion {
  id: string;
  prompt: string;
  type: QuestionType;
  marks: number;
  negative: number;
  chapter?: string;
  imageUrl?: string;
  options: RuntimeOption[];
  correctIndex: number;
}

type PaletteState = "un" | "no" | "ans" | "mk" | "mkans";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildRuntime(questions: Question[]): RuntimeQuestion[] {
  return shuffle(questions).map((q) => {
    const options = q.options.map((o) => ({ id: o.id, text: o.text, imageUrl: o.imageUrl }));
    const shuffled = shuffle(options);
    const correctIndex = shuffled.findIndex((o) => {
      const original = q.options.find((opt) => opt.id === o.id);
      return original?.correct === true;
    });
    return {
      id: q.id,
      prompt: q.prompt,
      type: q.type,
      marks: q.marks,
      negative: q.negative,
      chapter: q.chapter,
      imageUrl: q.imageUrl,
      options: shuffled,
      correctIndex: correctIndex < 0 ? 0 : correctIndex,
    };
  });
}

function parseMinutes(duration: string): number {
  const match = duration.match(/\d+/);
  if (!match) return 60;
  return Math.max(1, parseInt(match[0], 10));
}

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

const OPTION_KEYS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function ExamContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get("id") ?? "";

  const [exam, setExam] = useState<Exam | null>(null);
  const [ordered, setOrdered] = useState<Question[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [stage, setStage] = useState<"lobby" | "test" | "result">("lobby");

  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(false);

  const [sessionId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return getDeviceId();
  });

  const runtimeRef = useRef<RuntimeQuestion[]>([]);
  const [runtime, setRuntime] = useState<RuntimeQuestion[]>([]);
  const totalQuestions = runtime.length;

  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [visited, setVisited] = useState<boolean[]>([]);
  const [marked, setMarked] = useState<boolean[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [focusWarnOpen, setFocusWarnOpen] = useState(false);
  const [showMobilePalette, setShowMobilePalette] = useState(false);
  const blurCountRef = useRef(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const found = await fetchExamByCode(code);
        if (!active) return;
        if (!found) {
          setError(
            "We couldn't find an exam for this link. Double-check the code with your instructor."
          );
          setLoading(false);
          return;
        }
        if (found.status === "stopped") {
          setError(
            "This exam has been stopped by the instructor and is no longer accessible."
          );
          setExam(found);
          setLoading(false);
          return;
        }
        const questionIds = await fetchExamQuestionIds(found.id);
        const allQuestions = await fetchQuestions();
        const byId = new Map(allQuestions.map((q) => [q.id, q]));
        const marksByQid = await fetchExamQuestionMarks(found.id);
        const ord = questionIds
          .map((id) => byId.get(id))
          .filter((q): q is Question => Boolean(q))
          .map((q) => {
            const cfg = marksByQid[q.id];
            return { ...q, marks: cfg?.marks ?? 0, negative: cfg?.negative ?? 0 };
          });
        if (!active) return;
        if (ord.length === 0) {
          setError(
            "This exam has no questions yet. Ask your instructor to add some before you begin."
          );
          setExam(found);
          setLoading(false);
          return;
        }
        const already = await hasAttemptBySession(found.id, sessionId);
        if (!active) return;
        if (already) {
          setError(
            "You already attempted this test from this device. One attempt per candidate."
          );
          setExam(found);
          setLoading(false);
          return;
        }
        setOrdered(ord);
        setExam(found);
      } catch {
        if (!active) return;
        setError("Something went wrong loading the exam. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const durationMinutes = exam ? parseMinutes(exam.duration) : 60;

  const join = async () => {
    if (!exam || !name.trim() || !agreed || ordered.length === 0) return;
    if (!sessionId) return;
    try {
      const already = await hasAttemptBySession(exam.id, sessionId);
      if (already) {
        setError(
          "You already attempted this test from this device. One attempt per candidate."
        );
        return;
      }
      const sameName = await hasAttemptByName(exam.id, name.trim());
      if (sameName) {
        setError(
          "An attempt already exists for the name you entered. One attempt per candidate."
        );
        return;
      }
    } catch {
      /* offline guards fail open */
    }
    // Any number of students may take the same exam at the same time —
    // there is intentionally no global session lock here. (Per-device and
    // per-name duplicate-attempt guards above still apply.)
    const rt = buildRuntime(ordered);
    runtimeRef.current = rt;
    setRuntime(rt);
    setAnswers(new Array(rt.length).fill(null));
    // CBT semantics: the first question is opened immediately, so it counts as
    // "visited" (red / Not Answered) from the start.
    setVisited(rt.map((_, i) => i === 0));
    setMarked(new Array(rt.length).fill(false));
    setSecondsLeft(durationMinutes * 60);
    setCurrent(0);
    setStage("test");
  };

  const submit = () => {
    const rt = runtimeRef.current;
    let score = 0;
    let correct = 0;
    let wrong = 0;
    let unattempted = 0;
    let total = 0;
    const answerRecords = rt.map((q, i) => {
      const a = answers[i];
      const isCorrect = a === q.correctIndex;
      const marks = a == null ? 0 : isCorrect ? q.marks : -q.negative;
      total += q.marks;
      if (a == null) {
        unattempted++;
      } else if (isCorrect) {
        score += q.marks;
        correct++;
      } else {
        score -= q.negative;
        wrong++;
      }
      return {
        questionId: q.id,
        chosen: a == null ? null : a,
        chosenOptionId: a == null ? null : q.options[a].id,
        correctOptionId: q.options[q.correctIndex].id,
        correct: isCorrect,
        marks,
      };
    });
    score = Math.max(0, score);
    if (exam) {
      saveAttempt({
        examId: exam.id,
        examCode: exam.code,
        studentName: name.trim() || "Anonymous",
        sessionId,
        score,
        total,
        correct,
        wrong,
        unattempted,
        answers: answerRecords,
        submittedAt: Date.now(),
      }).catch(() => {
        /* best-effort persistence */
      });
    }
    setStage("result");
    setConfirmOpen(false);
  };

  // Disable right-click / context menu while the test is active
  useEffect(() => {
    if (stage !== "test") return;
    const block = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "ContextMenu" ||
        (e.key === "F12") ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "u")
      ) {
        e.preventDefault();
      }
    };
    const onBlur = () => {
      blurCountRef.current += 1;
      if (blurCountRef.current >= 2) {
        submit();
      } else {
        setFocusWarnOpen(true);
      }
    };
    window.addEventListener("contextmenu", block);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("contextmenu", block);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onBlur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // Timer
  useEffect(() => {
    if (stage !== "test") return;
    if (secondsLeft <= 0) {
      const t = setTimeout(() => submit(), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, stage]);

  // Prevent background scroll when mobile palette drawer open
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (showMobilePalette) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    } else {
      document.body.style.overflow = "";
    }
  }, [showMobilePalette]);

  const visit = (idx: number) => {
    setVisited((v) => {
      const next = [...v];
      next[idx] = true;
      return next;
    });
    setCurrent(idx);
  };

  const selectOption = (optIdx: number) => {
    setAnswers((a) => {
      const next = [...a];
      // NTA CBT behaviour: clicking the selected option again clears it.
      next[current] = next[current] === optIdx ? null : optIdx;
      return next;
    });
    setVisited((v) => {
      if (v[current]) return v;
      const next = [...v];
      next[current] = true;
      return next;
    });
  };

  const clearResponse = () => {
    setAnswers((a) => {
      const next = [...a];
      next[current] = null;
      return next;
    });
  };

  const markAndNext = () => {
    setMarked((m) => {
      const next = [...m];
      next[current] = !next[current];
      return next;
    });
    if (current < totalQuestions - 1) visit(current + 1);
  };

  const saveAndNext = () => {
    // Answers are recorded as soon as an option is clicked; "Save & Next"
    // commits and moves on, as in the CBT interface.
    if (current < totalQuestions - 1) visit(current + 1);
  };

  const paletteState = (idx: number): PaletteState => {
    const answered = answers[idx] != null;
    if (marked[idx]) return answered ? "mkans" : "mk";
    if (answered) return "ans";
    if (visited[idx]) return "no";
    return "un";
  };

  const statusCounts = useMemo(() => {
    const c: Record<PaletteState, number> = { un: 0, no: 0, ans: 0, mk: 0, mkans: 0 };
    for (let i = 0; i < runtime.length; i++) c[paletteState(i)]++;
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime, answers, visited, marked]);

  return (
    <div
      className="v2-root"
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
      <style>{CSS}</style>

      {loading && (
        <div className="v2-center">
          <div className="v2-loading">Loading your exam…</div>
        </div>
      )}

      {!loading && error && (
        <div className="v2-center">
          <div className="v2-lobby-card">
            <div className="v2-cta-num">§ 00 · Not Found</div>
            <h1 className="v2-lobby-title">
              Exam <em>unavailable</em>
            </h1>
            <p className="v2-lobby-desc">{error}</p>
            <Link href="/" className="v2-join">
              Return home →
            </Link>
          </div>
        </div>
      )}

      {!loading && !error && exam && stage === "lobby" && (
        <Lobby
          exam={exam}
          questionCount={ordered.length}
          name={name}
          setName={setName}
          agreed={agreed}
          setAgreed={setAgreed}
          onJoin={join}
        />
      )}

      {!loading && !error && exam && stage === "test" && runtime.length > 0 && (
        (() => {
          const currentQuestion = runtime[current];
          const imageUrls = [
            ...(currentQuestion.imageUrl ? [currentQuestion.imageUrl] : []),
            ...extractImageUrls(currentQuestion.prompt),
          ].filter((u, i, arr) => arr.indexOf(u) === i);
          const initials =
            (name.trim().split(/\s+/) ?? [])
              .slice(0, 2)
              .map((w) => w[0]?.toUpperCase() ?? "")
              .join("") || "C";
          const lastQ = current === totalQuestions - 1;
          const firstQ = current === 0;
          return (
            <div className="cbt-app">
              {/* ---------- Header ---------- */}
              <header className="cbt-header">
                <div className="cbt-brand">
                  <div className="cbt-brand-org">World of Physics · Online Examination</div>
                  <div className="cbt-brand-exam">{exam.title}</div>
                  <div className="cbt-brand-sub">
                    Subject: {exam.subject} &nbsp;·&nbsp; Code: {exam.code}
                  </div>
                </div>
                <div className="cbt-head-right">
                  <div className="cbt-cand">
                    <div className="cbt-avatar" aria-hidden="true">{initials}</div>
                    <div className="cbt-cand-meta">
                      <span className="cbt-cand-label">Candidate Name</span>
                      <span className="cbt-cand-name">{name.trim() || "\u2014"}</span>
                    </div>
                  </div>
                  <div className={`cbt-timer${secondsLeft <= 300 ? " warn" : ""}`}>
                    <span className="cbt-timer-label">Time Left</span>
                    <span className="cbt-timer-val">{formatTime(secondsLeft)}</span>
                  </div>
                  <button
                    type="button"
                    className="cbt-pal-toggle"
                    onClick={() => setShowMobilePalette(true)}
                    aria-label="Open question palette"
                  >
                    &#8857;
                  </button>
                </div>
              </header>

              {/* ---------- Section tabs ---------- */}
              <nav className="cbt-tabs">
                <span className="cbt-tab active">
                  {exam.subject}
                  <i className="cbt-tab-n">{totalQuestions}</i>
                </span>
                <span className="cbt-tabs-info">
                  Marking: +{currentQuestion.marks}
                  {currentQuestion.negative > 0 ? ` / \u2212${currentQuestion.negative}` : ""}
                  &nbsp;·&nbsp; MCQ (single correct)
                </span>
              </nav>

              {/* ---------- Main ---------- */}
              <div className="cbt-main">
                <section className="cbt-qcol">
                  <div className="cbt-qhead">
                    <div className="cbt-qno">
                      Question No. {current + 1}
                      {marked[current] && (
                        <span className="cbt-flag" title="Marked for review">&#9873; Marked for Review</span>
                      )}
                    </div>
                    <div className="cbt-marks">
                      <span className="cbt-mk-chip pos">+{currentQuestion.marks}</span>
                      {currentQuestion.negative > 0 && (
                        <span className="cbt-mk-chip neg">{"\u2212"}{currentQuestion.negative}</span>
                      )}
                    </div>
                  </div>

                  <div className="cbt-qbody">
                    <p
                      className="cbt-qtext"
                      dangerouslySetInnerHTML={{
                        __html: renderMathHtml(currentQuestion.prompt),
                      }}
                    />

                    {imageUrls.length > 0 && (
                      <div className="cbt-qimgs">
                        {imageUrls.map((src, i) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={`${src}-${i}`}
                            src={src}
                            alt="Question diagram"
                            className="cbt-qimg"
                          />
                        ))}
                      </div>
                    )}

                    <div className="cbt-opts">
                      {currentQuestion.options.map((opt, i) => {
                        const selected = answers[current] === i;
                        return (
                          <div
                            key={opt.id}
                            className={`cbt-opt${selected ? " sel" : ""}`}
                            onClick={() => selectOption(i)}
                            role="button"
                            tabIndex={0}
                            aria-pressed={selected}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") selectOption(i);
                            }}
                          >
                            <span className="cbt-radio" aria-hidden="true" />
                            <span className="cbt-opt-key">{OPTION_KEYS[i]}.</span>
                            <div className="cbt-opt-main">
                              <div
                                className="cbt-opt-t"
                                dangerouslySetInnerHTML={{ __html: renderMathHtml(opt.text) }}
                              />
                              {opt.imageUrl && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  className="cbt-opt-img"
                                  src={opt.imageUrl}
                                  alt={`Option ${OPTION_KEYS[i]}`}
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Compact actions for small screens */}
                    <div className="cbt-m-actions">
                      <button type="button" className="cbt-btn cbt-mark" onClick={markAndNext}>
                        Mark for Review &amp; Next
                      </button>
                      <button
                        type="button"
                        className="cbt-btn cbt-clear"
                        onClick={clearResponse}
                        disabled={answers[current] == null}
                      >
                        Clear Response
                      </button>
                      <button
                        type="button"
                        className="cbt-btn cbt-save"
                        onClick={saveAndNext}
                        disabled={lastQ}
                      >
                        Save &amp; Next
                      </button>
                    </div>
                  </div>

                  {/* ---------- Action bar ---------- */}
                  <footer className="cbt-actions">
                    <div className="cbt-actions-l">
                      <button type="button" className="cbt-btn cbt-mark" onClick={markAndNext}>
                        Mark for Review &amp; Next
                      </button>
                      <button
                        type="button"
                        className="cbt-btn cbt-clear"
                        onClick={clearResponse}
                        disabled={answers[current] == null}
                      >
                        Clear Response
                      </button>
                    </div>
                    <div className="cbt-actions-r">
                      <button
                        type="button"
                        className="cbt-btn cbt-back"
                        onClick={() => visit(current - 1)}
                        disabled={firstQ}
                      >
                        &lt; Back
                      </button>
                      <button
                        type="button"
                        className="cbt-btn cbt-save"
                        onClick={saveAndNext}
                        disabled={lastQ}
                      >
                        Save &amp; Next
                      </button>
                    </div>
                  </footer>
                </section>

                {/* ---------- Palette sidebar ---------- */}
                <aside className={`cbt-side${showMobilePalette ? " open" : ""}`}>
                  <div className="cbt-side-head">
                    <span>Question Palette</span>
                    <button
                      type="button"
                      className="cbt-side-close"
                      onClick={() => setShowMobilePalette(false)}
                      aria-label="Close question palette"
                    >
                      &times;
                    </button>
                  </div>
                  <div className="cbt-side-scroll">
                    <div className="cbt-legend">
                      <div className="cbt-legend-title">Legend</div>
                      <div className="cbt-legend-grid">
                        <span className="cbt-lg">
                          <i className="cbt-sw un">1</i> Not Visited
                        </span>
                        <span className="cbt-lg">
                          <i className="cbt-sw no">2</i> Not Answered
                        </span>
                        <span className="cbt-lg">
                          <i className="cbt-sw ans">3</i> Answered
                        </span>
                        <span className="cbt-lg">
                          <i className="cbt-sw mk">4</i> Marked for Review
                        </span>
                        <span className="cbt-lg wide">
                          <i className="cbt-sw mkans">5</i> Answered &amp; Marked for Review
                          <em>(will be considered for evaluation)</em>
                        </span>
                      </div>
                    </div>

                    <div className="cbt-pal-title">
                      {exam.subject} &mdash; Section A
                    </div>
                    <div className="cbt-pal">
                      {runtime.map((_, i) => {
                        const st = paletteState(i);
                        const isCurrent = i === current;
                        return (
                          <button
                            type="button"
                            key={i}
                            className={`cbt-pb ${st}${isCurrent ? " cur" : ""}`}
                            onClick={() => {
                              visit(i);
                              setShowMobilePalette(false);
                            }}
                            aria-label={`Question ${i + 1}`}
                          >
                            {i + 1}
                          </button>
                        );
                      })}
                    </div>

                    <div className="cbt-sum-mini">
                      <span>
                        <b>{statusCounts.ans + statusCounts.mkans}</b> answered
                      </span>
                      <span>
                        <b>{statusCounts.no}</b> not answered
                      </span>
                      <span>
                        <b>{statusCounts.mk + statusCounts.mkans}</b> marked
                      </span>
                    </div>
                  </div>
                  <div className="cbt-side-foot">
                    <button
                      type="button"
                      className="cbt-btn cbt-clear cbt-side-btn"
                      onClick={() => setInstructionsOpen(true)}
                    >
                      Instructions
                    </button>
                    <button
                      type="button"
                      className="cbt-btn cbt-submit cbt-side-btn"
                      onClick={() => setConfirmOpen(true)}
                    >
                      Submit
                    </button>
                  </div>
                </aside>
              </div>

              {showMobilePalette && (
                <div
                  className="cbt-backdrop"
                  onClick={() => setShowMobilePalette(false)}
                />
              )}

              {/* Mobile bottom navigation */}
              <div className="cbt-mobile-nav">
                <button
                  type="button"
                  onClick={() => visit(current - 1)}
                  disabled={firstQ}
                  aria-label="Previous question"
                >
                  &#9664;
                </button>
                <button
                  type="button"
                  className="mid"
                  onClick={() => setShowMobilePalette(true)}
                >
                  Q {current + 1} / {totalQuestions} &nbsp;·&nbsp; Palette
                </button>
                <button
                  type="button"
                  onClick={() => visit(current + 1)}
                  disabled={lastQ}
                  aria-label="Next question"
                >
                  &#9654;
                </button>
              </div>
            </div>
          );
        })()
      )}

      {!loading && !error && exam && stage === "result" && (
        <SubmittedScreen exam={exam} name={name} runtime={runtime} />
      )}

      {confirmOpen && (
        <div className="cbt-overlay" onClick={() => setConfirmOpen(false)}>
          <div className="cbt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cbt-modal-head">Submit Test</div>
            <div className="cbt-modal-body">
              <p className="cbt-modal-note">
                You are about to submit your test. Please review the summary
                of your responses below.
              </p>
              <table className="cbt-sum">
                <tbody>
                  <tr>
                    <th>
                      <i className="cbt-sw un" aria-hidden="true" /> Not Visited
                    </th>
                    <td>{statusCounts.un}</td>
                  </tr>
                  <tr>
                    <th>
                      <i className="cbt-sw no" aria-hidden="true" /> Not Answered
                    </th>
                    <td>{statusCounts.no}</td>
                  </tr>
                  <tr>
                    <th>
                      <i className="cbt-sw ans" aria-hidden="true" /> Answered
                    </th>
                    <td>{statusCounts.ans}</td>
                  </tr>
                  <tr>
                    <th>
                      <i className="cbt-sw mk" aria-hidden="true" /> Marked for Review
                    </th>
                    <td>{statusCounts.mk}</td>
                  </tr>
                  <tr>
                    <th>
                      <i className="cbt-sw mkans" aria-hidden="true" /> Answered &amp;
                      Marked for Review
                    </th>
                    <td>{statusCounts.mkans}</td>
                  </tr>
                  <tr className="cbt-sum-total">
                    <th>Total Questions</th>
                    <td>{totalQuestions}</td>
                  </tr>
                </tbody>
              </table>
              <p className="cbt-modal-warn">
                Once submitted, you cannot return to this test.
              </p>
            </div>
            <div className="cbt-modal-foot">
              <button
                type="button"
                className="cbt-btn cbt-clear"
                onClick={() => setConfirmOpen(false)}
              >
                No
              </button>
              <button type="button" className="cbt-btn cbt-save" onClick={submit}>
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {focusWarnOpen && (
        <div className="cbt-overlay" onClick={() => setFocusWarnOpen(false)}>
          <div className="cbt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cbt-modal-head cbt-modal-head-warn">
              &#9888; Test Window Focus Lost
            </div>
            <div className="cbt-modal-body">
              <p className="cbt-modal-note">
                You left the test window. This activity has been recorded. If
                you leave again, your test will be submitted automatically.
              </p>
            </div>
            <div className="cbt-modal-foot">
              <button
                type="button"
                className="cbt-btn cbt-save"
                onClick={() => setFocusWarnOpen(false)}
              >
                Return to Test
              </button>
            </div>
          </div>
        </div>
      )}

      {instructionsOpen && (
        <div className="cbt-overlay" onClick={() => setInstructionsOpen(false)}>
          <div className="cbt-modal cbt-modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="cbt-modal-head">General Instructions</div>
            <div className="cbt-modal-body cbt-instr-body">
              <ul className="cbt-instr">
                <li>
                  The clock is set at the server. The countdown timer at the
                  top right corner of the screen will display the remaining
                  time available for you to complete the examination. When the
                  timer reaches zero, the examination will end by itself.
                </li>
                <li>
                  The Question Palette displayed on the right side of the
                  screen will show the status of each question using one of the
                  following symbols:
                  <div className="cbt-legend-grid cbt-instr-legend">
                    <span className="cbt-lg">
                      <i className="cbt-sw un">1</i> Not Visited
                    </span>
                    <span className="cbt-lg">
                      <i className="cbt-sw no">2</i> Not Answered
                    </span>
                    <span className="cbt-lg">
                      <i className="cbt-sw ans">3</i> Answered
                    </span>
                    <span className="cbt-lg">
                      <i className="cbt-sw mk">4</i> Marked for Review
                    </span>
                    <span className="cbt-lg wide">
                      <i className="cbt-sw mkans">5</i> Answered &amp; Marked for
                      Review (will be considered for evaluation)
                    </span>
                  </div>
                </li>
                <li>
                  You can click any of the question numbers in the palette to
                  go to that question directly.
                </li>
                <li>
                  Click an option to select it as your answer; click the same
                  option again (or <b>Clear Response</b>) to remove it. Use{" "}
                  <b>Save &amp; Next</b> to save your answer and move to the
                  next question.
                </li>
                <li>
                  <b>Mark for Review &amp; Next</b> flags a question for later
                  review and moves to the next question.
                </li>
                <li>
                  Each correct answer awards the marks shown next to the
                  question; an incorrect answer deducts the negative marks
                  shown.
                </li>
                <li>
                  Do not refresh the page or close the tab &mdash; your progress
                  will be lost. Leaving the test window repeatedly will submit
                  your test automatically.
                </li>
                <li>
                  Click <b>Submit</b> only after attempting all the questions
                  you wish to answer.
                </li>
              </ul>
            </div>
            <div className="cbt-modal-foot">
              <button
                type="button"
                className="cbt-btn cbt-save"
                onClick={() => setInstructionsOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Lobby({
  exam,
  questionCount,
  name,
  setName,
  agreed,
  setAgreed,
  onJoin,
}: {
  exam: Exam;
  questionCount: number;
  name: string;
  setName: (v: string) => void;
  agreed: boolean;
  setAgreed: (v: boolean) => void;
  onJoin: () => void;
}) {
  const canJoin = name.trim().length > 0 && agreed;
  return (
    <div className="v2-center">
      <div className="v2-lobby-card">
        <div className="v2-cta-num">§ 00 · Before you begin</div>
        <h1 className="v2-lobby-title">{exam.title}</h1>
        <p className="v2-lobby-desc">
          Read the instructions carefully. Once you join, the clock starts and
          the questions will appear in a randomized order.
        </p>

        <ul className="v2-instr">
          <li>
            You have <strong>{exam.duration}</strong> to complete this test.
          </li>
          <li>
            The test contains <strong>{questionCount}</strong> questions from{" "}
            <strong>{exam.subject}</strong>.
          </li>
          <li>
            Each correct answer carries its stated marks; wrong answers may
            deduct negative marks.
          </li>
          <li>Questions and answer choices are shuffled for every candidate.</li>
          <li>Do not refresh or close the tab — your progress will be lost.</li>
          <li>
            You may navigate freely, jump between questions, and mark any for
            review.
          </li>
        </ul>

        <label className="v2-check">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span>I have read and agree to the instructions above.</span>
        </label>

        <div className="v2-field">
          <label className="v2-flabel">Candidate name</label>
          <input
            type="text"
            className="v2-name"
            placeholder="e.g. Riya Sharma"
            value={name}
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <button className="v2-join" disabled={!canJoin} onClick={onJoin}>
          Join Test →
        </button>
      </div>
    </div>
  );
}

function SubmittedScreen({
  exam,
  name,
  runtime,
}: {
  exam: Exam;
  name: string;
  runtime: RuntimeQuestion[];
}) {
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const downloadPdf = async () => {
    setPdfBusy(true);
    setPdfError(null);
    try {
      const { downloadExamQuestionsPdf } = await import("@/lib/exam-pdf");
      await downloadExamQuestionsPdf({
        examTitle: exam.title,
        subject: exam.subject,
        duration: exam.duration,
        code: exam.code,
        studentName: name.trim() || "Anonymous",
        questions: runtime.map((q) => ({
          prompt: q.prompt,
          marks: q.marks,
          negative: q.negative,
          imageUrl: q.imageUrl,
          options: q.options.map((o) => ({ text: o.text, imageUrl: o.imageUrl })),
        })),
      });
    } catch {
      setPdfError("Could not generate the PDF right now. Please try again.");
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="v2-center">
      <div className="v2-lobby-card v2-result-card">
        <div className="v2-cta-num">§ 03 · Submitted</div>
        <h1 className="v2-lobby-title">
          Test <em>submitted</em>
        </h1>
        <p className="v2-lobby-desc">
          Well done, {name.trim() || "candidate"}. Your responses for{" "}
          {exam.title} have been recorded. Your result will be announced by
          your teacher — it is not shown here.
        </p>

        <div className="v2-submitted-note">
          You can download a PDF copy of the question paper you just attempted
          for practice and revision.
        </div>

        <button
          className="v2-insight-btn"
          onClick={downloadPdf}
          disabled={pdfBusy}
        >
          {pdfBusy ? "Preparing PDF…" : "⬇ Download question paper (PDF)"}
        </button>
        {pdfError && <div className="v2-pdf-err">{pdfError}</div>}

        <Link href="/" className="v2-join v2-done">
          Done →
        </Link>
      </div>
    </div>
  );
}

const CSS = `
  .v2-root {
    min-height: 100vh;
    min-height: 100dvh;
    background: #f4f0e8;
    color: #14110d;
    font-family: 'Inter', sans-serif;
    position: relative;
    overflow-x: clip;
  }
  .v2-root .serif { font-family: 'Instrument Serif', 'Times New Roman', serif; font-weight: 400; }
  .v2-root .mono { font-family: 'JetBrains Mono', monospace; }

  .v2-center {
    min-height: 100vh;
    min-height: 100dvh;
    display: grid;
    place-items: center;
    padding: 40px 24px;
    position: relative;
  }

  .v2-loading {
    font-family: 'JetBrains Mono', monospace;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    font-size: 12px;
    color: var(--ink-2);
  }

  .v2-lobby-card {
    width: 100%;
    max-width: 560px;
    background: #ffffff;
    border: 1px solid #d9d1bf;
    position: relative;
    padding: 44px 36px 32px;
    text-align: left;
    box-shadow: 12px 12px 0 var(--ink);
  }
  .v2-lobby-card::before, .v2-lobby-card::after {
    content: "";
    position: absolute;
    width: 12px;
    height: 12px;
    background: var(--accent);
  }
  .v2-lobby-card::before { top: -1px; left: -1px; }
  .v2-lobby-card::after { bottom: -1px; right: -1px; }

  .v2-lobby-title {
    font-family: 'Instrument Serif', serif;
    font-size: 38px;
    line-height: 1.05;
    margin: 0 0 10px;
    color: #14110d;
  }
  .v2-lobby-title em { font-style: italic; color: var(--accent); }

  .v2-lobby-desc {
    font-size: 14px;
    line-height: 1.6;
    color: #6b6358;
    margin: 0 0 22px;
  }
  .v2-cta-num {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #d9a300;
    margin-bottom: 14px;
  }

  .v2-instr {
    list-style: none;
    margin: 0 0 22px;
    padding: 18px 18px 18px 40px;
    border: 1px solid #d9d1bf;
    background: #f0ece4;
    font-size: 13.5px;
    line-height: 1.7;
    color: #6b6358;
  }
  .v2-instr li { position: relative; margin-bottom: 8px; }
  .v2-instr li:last-child { margin-bottom: 0; }
  .v2-instr li::before {
    content: "§";
    position: absolute;
    left: -22px;
    color: var(--accent);
    font-family: 'JetBrains Mono', monospace;
  }
  .v2-instr strong { color: #14110d; }

  .v2-check {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    font-size: 13.5px;
    color: #6b6358;
    margin-bottom: 20px;
    cursor: pointer;
  }
  .v2-check input {
    margin-top: 2px;
    width: 18px;
    height: 18px;
    accent-color: oklch(0.52 0.20 25);
    flex-shrink: 0;
  }

  .v2-field { margin-bottom: 22px; }
  .v2-flabel {
    display: block;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: #d9a300;
    margin-bottom: 8px;
  }
  .v2-name {
    width: 100%;
    background: #f0ece4;
    border: 1px solid #d9d1bf;
    border-radius: 0;
    padding: 14px 16px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 16px;
    color: #14110d;
    outline: none;
  }
  .v2-name::placeholder { color: #b8ad96; }
  .v2-name:focus { background: #ffffff; border-color: var(--accent); }

  .v2-join {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: var(--accent);
    color: #fff;
    border: 1px solid var(--accent);
    padding: 14px 26px;
    font-family: 'Inter', sans-serif;
    font-weight: 600;
    font-size: 14px;
    letter-spacing: 0.02em;
    cursor: pointer;
    text-transform: uppercase;
    text-decoration: none;
    min-height: 44px;
  }
  .v2-join:hover { background: var(--accent-2); border-color: var(--accent-2); }
  .v2-join:disabled { opacity: 0.4; cursor: not-allowed; }

  /* ================== CBT EXAM WINDOW (NTA / JEE style) ================== */
  .cbt-app {
    --cbt-navy: #1d3d8f;
    --cbt-navy-2: #16306e;
    --cbt-blue: #2563eb;
    --cbt-blue-mid: #2e6bc4;
    --cbt-gray-bg: #e9edf4;
    --cbt-line: #d5dcea;
    --cbt-ink: #1f2937;
    --cbt-un: #98a2b3;   /* not visited  */
    --cbt-no: #e04848;   /* not answered */
    --cbt-ans: #2fa14e;  /* answered     */
    --cbt-mk: #8a3fd1;   /* marked       */
    height: 100vh;
    height: 100dvh;
    display: flex;
    flex-direction: column;
    background: #eef1f6;
    font-family: Arial, Helvetica, sans-serif;
    color: var(--cbt-ink);
    overflow: hidden;
    -webkit-text-size-adjust: 100%;
    text-size-adjust: 100%;
  }
  .cbt-app button { font-family: inherit; }

  /* ---------- Header ---------- */
  .cbt-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 10px 18px;
    background: linear-gradient(180deg, #21479b 0%, var(--cbt-navy) 55%, var(--cbt-navy-2) 100%);
    color: #fff;
    flex-shrink: 0;
  }
  .cbt-brand { min-width: 0; }
  .cbt-brand-org {
    font-size: 9.5px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #b9cdf3;
    margin-bottom: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cbt-brand-exam {
    font-size: 16px;
    font-weight: 700;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cbt-brand-sub {
    font-size: 11px;
    color: #cfdcf8;
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cbt-head-right { display: flex; align-items: center; gap: 14px; flex-shrink: 0; }
  .cbt-cand { display: flex; align-items: center; gap: 10px; }
  .cbt-avatar {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: #fff;
    color: var(--cbt-navy);
    display: grid;
    place-items: center;
    font-weight: 700;
    font-size: 14px;
    border: 2px solid #9db6e8;
    flex-shrink: 0;
  }
  .cbt-cand-meta { display: flex; flex-direction: column; line-height: 1.25; }
  .cbt-cand-label {
    font-size: 9.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #b9cdf3;
  }
  .cbt-cand-name { font-size: 13.5px; font-weight: 700; white-space: nowrap; }
  .cbt-timer {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: #fff;
    border-radius: 4px;
    padding: 5px 14px;
    line-height: 1.25;
    border: 1px solid #9db6e8;
  }
  .cbt-timer-label {
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #64748b;
  }
  .cbt-timer-val {
    font-size: 17px;
    font-weight: 700;
    color: #111827;
    font-variant-numeric: tabular-nums;
  }
  .cbt-timer.warn .cbt-timer-val { color: #d13c3c; }
  .cbt-timer.warn { border-color: #e9a1a1; box-shadow: 0 0 0 2px rgba(209,60,60,0.15); }
  .cbt-pal-toggle {
    display: none;
    width: 40px;
    height: 40px;
    border-radius: 4px;
    border: 1px solid #9db6e8;
    background: rgba(255,255,255,0.12);
    color: #fff;
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
  }

  /* ---------- Section tabs ---------- */
  .cbt-tabs {
    display: flex;
    align-items: center;
    gap: 2px;
    background: #d3dbea;
    padding: 0 10px;
    border-bottom: 1px solid #c3cee3;
    flex-shrink: 0;
    scrollbar-width: none;
  }
  .cbt-tabs::-webkit-scrollbar { display: none; }
  .cbt-tab {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 9px 18px;
    font-size: 13px;
    font-weight: 700;
    color: #45536e;
    background: #c8d2e6;
    border: 1px solid transparent;
    border-bottom: none;
    border-radius: 5px 5px 0 0;
    cursor: default;
  }
  .cbt-tab.active {
    background: #fff;
    color: var(--cbt-navy);
    border-color: #c3cee3;
    position: relative;
    top: 1px;
  }
  .cbt-tab-n {
    font-style: normal;
    font-size: 10.5px;
    background: var(--cbt-navy);
    color: #fff;
    border-radius: 999px;
    padding: 1px 7px;
    font-weight: 700;
  }
  .cbt-tabs-info {
    margin-left: auto;
    font-size: 11px;
    color: #5b6883;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ---------- Main layout ---------- */
  .cbt-main {
    flex: 1;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 292px;
    min-height: 0;
  }

  /* ---------- Question column ---------- */
  .cbt-qcol { display: flex; flex-direction: column; background: #fff; min-width: 0; min-height: 0; }
  .cbt-qhead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 22px;
    border-bottom: 1px solid #e3e8f0;
    flex-shrink: 0;
    flex-wrap: wrap;
  }
  .cbt-qno {
    font-size: 16px;
    font-weight: 700;
    color: #111827;
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .cbt-flag {
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #fff;
    background: var(--cbt-mk);
    border-radius: 3px;
    padding: 3px 8px;
  }
  .cbt-marks { display: flex; gap: 8px; align-items: center; }
  .cbt-mk-chip {
    font-size: 12.5px;
    font-weight: 700;
    border-radius: 3px;
    padding: 3px 10px;
    border: 1px solid;
  }
  .cbt-mk-chip.pos { color: #1c7c3c; border-color: #bfe3cb; background: #f0faf3; }
  .cbt-mk-chip.neg { color: #c02626; border-color: #f0c7c7; background: #fdf3f3; }

  .cbt-qbody {
    flex: 1;
    overflow-y: auto;
    padding: 20px 26px 26px;
    min-height: 0;
  }
  .cbt-qtext {
    font-size: 17px;
    line-height: 1.65;
    color: #111827;
    margin: 0 0 20px;
    word-break: break-word;
    overflow-wrap: anywhere;
  }
  .cbt-qimgs { display: flex; flex-direction: column; gap: 14px; margin: 0 0 20px; }
  .cbt-qimg {
    max-width: 100%;
    max-height: 320px;
    object-fit: contain;
    border: 1px solid #d7dee9;
    border-radius: 4px;
    margin: 0 auto;
    display: block;
    width: auto;
    height: auto;
  }

  .cbt-opts { display: flex; flex-direction: column; gap: 10px; max-width: 780px; }
  .cbt-opt {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 14px;
    border: 1px solid #d7dee9;
    border-radius: 4px;
    background: #fff;
    cursor: pointer;
    min-height: 48px;
    transition: border-color 0.12s ease, background 0.12s ease;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
    touch-action: manipulation;
  }
  .cbt-opt:hover { border-color: #93b4f3; background: #f6f9ff; }
  .cbt-opt:focus-visible { outline: 2px solid var(--cbt-blue); outline-offset: 1px; }
  .cbt-opt.sel { border-color: var(--cbt-blue); background: #e8f0fe; box-shadow: 0 0 0 1px var(--cbt-blue) inset; }
  .cbt-opt:active { background: #eef3fd; }
  .cbt-radio {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid #9aa6bb;
    background: #fff;
    flex-shrink: 0;
    margin-top: 2px;
    transition: border-color 0.12s ease, background 0.12s ease, box-shadow 0.12s ease;
  }
  .cbt-opt.sel .cbt-radio {
    border-color: var(--cbt-blue);
    background: var(--cbt-blue);
    box-shadow: inset 0 0 0 3px #fff;
  }
  .cbt-opt-key { font-weight: 700; font-size: 15px; color: #334155; margin-top: 1px; }
  .cbt-opt-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
  .cbt-opt-t { font-size: 15.5px; line-height: 1.55; color: #1f2937; word-break: break-word; overflow-wrap: anywhere; }
  .cbt-opt-img {
    display: block;
    max-width: min(220px, 100%);
    max-height: 150px;
    object-fit: contain;
    border: 1px solid #d7dee9;
    border-radius: 4px;
  }

  /* ---------- Buttons ---------- */
  .cbt-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 18px;
    font-size: 13px;
    font-weight: 700;
    border-radius: 3px;
    border: 1px solid transparent;
    cursor: pointer;
    min-height: 40px;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    white-space: nowrap;
  }
  .cbt-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .cbt-mark { background: var(--cbt-blue-mid); color: #fff; }
  .cbt-mark:hover:not(:disabled) { background: #255aa8; }
  .cbt-save { background: var(--cbt-navy); color: #fff; }
  .cbt-save:hover:not(:disabled) { background: var(--cbt-navy-2); }
  .cbt-clear, .cbt-back {
    background: #fff;
    color: #3f4c66;
    border-color: #9aa8c2;
  }
  .cbt-clear:hover:not(:disabled), .cbt-back:hover:not(:disabled) {
    background: #f2f5fb;
    border-color: #6d7d9d;
  }
  .cbt-submit { background: #d13c3c; color: #fff; }
  .cbt-submit:hover { background: #b32f2f; }

  .cbt-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 12px 22px;
    background: #f4f7fb;
    border-top: 1px solid #dbe2ee;
    flex-shrink: 0;
    flex-wrap: wrap;
  }
  .cbt-actions-l, .cbt-actions-r { display: flex; gap: 10px; flex-wrap: wrap; }

  /* Compact action row (small screens only) */
  .cbt-m-actions {
    display: none;
    flex-direction: column;
    gap: 8px;
    max-width: 780px;
    margin-top: 22px;
  }
  .cbt-m-actions .cbt-btn { width: 100%; }

  /* ---------- Palette sidebar ---------- */
  .cbt-side {
    background: var(--cbt-gray-bg);
    border-left: 1px solid var(--cbt-line);
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .cbt-side-head {
    display: none;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 14px 16px;
    background: var(--cbt-navy);
    color: #fff;
    font-weight: 700;
    font-size: 14px;
    flex-shrink: 0;
  }
  .cbt-side-close {
    width: 34px;
    height: 34px;
    border-radius: 4px;
    border: 1px solid rgba(255,255,255,0.4);
    background: rgba(255,255,255,0.12);
    color: #fff;
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
  }
  .cbt-side-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 14px;
    min-height: 0;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }

  .cbt-legend {
    background: #fff;
    border: 1px solid var(--cbt-line);
    border-radius: 4px;
    padding: 10px 12px 12px;
    margin-bottom: 14px;
  }
  .cbt-legend-title {
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #5b6883;
    margin-bottom: 8px;
  }
  .cbt-legend-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px 10px; }
  .cbt-lg {
    display: flex;
    align-items: flex-start;
    gap: 7px;
    font-size: 11px;
    line-height: 1.35;
    color: #333f55;
  }
  .cbt-lg.wide { grid-column: 1 / -1; }
  .cbt-lg em { display: block; font-style: normal; color: #64748b; font-size: 10px; }
  .cbt-sw {
    width: 20px;
    height: 20px;
    border-radius: 3px;
    display: inline-grid;
    place-items: center;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    font-style: normal;
    flex-shrink: 0;
    position: relative;
  }
  .cbt-sw.un { background: var(--cbt-un); }
  .cbt-sw.no { background: var(--cbt-no); }
  .cbt-sw.ans { background: var(--cbt-ans); }
  .cbt-sw.mk { background: var(--cbt-mk); }
  .cbt-sw.mkans { background: var(--cbt-mk); }
  .cbt-sw.mkans::after {
    content: "";
    position: absolute;
    inset: 0;
    margin: auto;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #2fa14e;
    box-shadow: 0 0 0 1.5px #fff;
  }

  .cbt-pal-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #45536e;
    margin: 2px 0 8px;
  }
  .cbt-pal { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 7px; }
  .cbt-pb {
    aspect-ratio: 1;
    min-height: 36px;
    width: 100%;
    border: none;
    border-radius: 3px;
    color: #fff;
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
    position: relative;
    display: grid;
    place-items: center;
    -webkit-tap-highlight-color: transparent;
    -webkit-user-select: none;
    user-select: none;
    touch-action: manipulation;
    transition: transform 0.08s ease;
  }
  .cbt-pb:active { transform: scale(0.92); }
  .cbt-pb.un { background: var(--cbt-un); }
  .cbt-pb.no { background: var(--cbt-no); }
  .cbt-pb.ans { background: var(--cbt-ans); }
  .cbt-pb.mk { background: var(--cbt-mk); }
  .cbt-pb.mkans::after {
    content: "";
    position: absolute;
    inset: 0;
    margin: auto;
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: #2fa14e;
    box-shadow: 0 0 0 2px #fff;
  }
  .cbt-pb.cur { outline: 3px solid var(--cbt-navy); outline-offset: 1.5px; z-index: 1; }

  .cbt-sum-mini {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 12px;
    font-size: 11px;
    color: #5b6883;
  }
  .cbt-sum-mini b { color: #1f2937; }

  .cbt-side-foot {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 14px;
    padding-bottom: max(12px, env(safe-area-inset-bottom));
    border-top: 1px solid var(--cbt-line);
    background: #e2e8f2;
    flex-shrink: 0;
  }
  .cbt-side-btn { width: 100%; }

  /* ---------- Mobile bottom nav ---------- */
  .cbt-backdrop {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.45);
    z-index: 190;
    animation: cbt-fade 0.16s ease;
  }
  .cbt-mobile-nav {
    display: none;
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 180;
    background: #fff;
    border-top: 1px solid #c3cee3;
    padding: 8px 10px;
    padding-bottom: max(8px, env(safe-area-inset-bottom));
    gap: 8px;
    box-shadow: 0 -8px 24px rgba(15, 23, 42, 0.1);
  }
  .cbt-mobile-nav button {
    flex: 1;
    background: #fff;
    border: 1px solid #9aa8c2;
    border-radius: 4px;
    color: #1f2937;
    padding: 12px 8px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    min-height: 46px;
    -webkit-tap-highlight-color: transparent;
  }
  .cbt-mobile-nav button:disabled { opacity: 0.4; }
  .cbt-mobile-nav button.mid { background: #e8f0fe; border-color: #93b4f3; color: var(--cbt-navy); }

  /* ---------- Overlays / modals ---------- */
  .cbt-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.55);
    display: grid;
    place-items: center;
    padding: 16px;
    z-index: 300;
    animation: cbt-fade 0.16s ease;
  }
  @keyframes cbt-fade { from { opacity: 0; } to { opacity: 1; } }
  .cbt-modal {
    width: min(430px, 100%);
    max-height: calc(100dvh - 32px);
    overflow-y: auto;
    background: #fff;
    border-radius: 6px;
    box-shadow: 0 22px 60px rgba(15, 23, 42, 0.35);
  }
  .cbt-modal-wide { width: min(560px, 100%); }
  .cbt-modal-head {
    background: var(--cbt-navy);
    color: #fff;
    font-size: 14.5px;
    font-weight: 700;
    padding: 12px 18px;
    letter-spacing: 0.02em;
  }
  .cbt-modal-head-warn { background: #b33636; }
  .cbt-modal-body { padding: 16px 18px; }
  .cbt-modal-note { margin: 0 0 12px; font-size: 13px; line-height: 1.55; color: #374151; }
  .cbt-sum { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 12px; }
  .cbt-sum th {
    text-align: left;
    font-weight: 700;
    color: #1f2937;
    padding: 7px 10px;
    border: 1px solid #e3e8f0;
    background: #f8fafc;
    white-space: nowrap;
  }
  .cbt-sum th .cbt-sw { vertical-align: -5px; margin-right: 7px; }
  .cbt-sum td {
    text-align: center;
    width: 64px;
    padding: 7px 10px;
    border: 1px solid #e3e8f0;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .cbt-sum tr.cbt-sum-total th { background: #eef2f9; color: #111827; }
  .cbt-sum tr.cbt-sum-total td { background: #eef2f9; }
  .cbt-modal-warn {
    margin: 0;
    font-size: 12.5px;
    font-weight: 700;
    color: #b33636;
    background: #fdf3f3;
    border: 1px solid #f0c7c7;
    border-radius: 4px;
    padding: 9px 12px;
  }
  .cbt-modal-foot {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 12px 18px;
    border-top: 1px solid #e5eaf2;
    background: #f7f9fc;
  }
  .cbt-instr-body { max-height: min(60vh, 520px); overflow-y: auto; }
  .cbt-instr {
    margin: 0;
    padding-left: 18px;
    font-size: 12.5px;
    line-height: 1.6;
    color: #374151;
    display: flex;
    flex-direction: column;
    gap: 9px;
  }
  .cbt-instr b { color: #111827; }
  .cbt-instr-legend { margin-top: 8px; }

  /* ---------- Responsive: <= 960px ---------- */
  @media (max-width: 960px) {
    .cbt-app { height: auto; min-height: 100dvh; overflow: visible; }
    .cbt-header { padding: 8px 12px; gap: 10px; position: sticky; top: 0; z-index: 40; }
    .cbt-brand-org { display: none; }
    .cbt-brand-exam { font-size: 13.5px; }
    .cbt-brand-sub { font-size: 10px; }
    .cbt-cand-meta { display: none; }
    .cbt-avatar { width: 32px; height: 32px; font-size: 12px; }
    .cbt-timer { padding: 4px 10px; }
    .cbt-timer-val { font-size: 15px; }
    .cbt-pal-toggle { display: block; }
    .cbt-tabs { padding: 0 6px; overflow-x: auto; }
    .cbt-tab { padding: 8px 12px; font-size: 12px; }
    .cbt-tabs-info { display: none; }

    .cbt-main { grid-template-columns: 1fr; display: flex; flex-direction: column; }
    .cbt-qcol { min-height: 0; }
    .cbt-qhead { padding: 10px 14px; }
    .cbt-qno { font-size: 14.5px; }
    .cbt-qbody { padding: 14px 14px 24px; }
    .cbt-qtext { font-size: 16.5px; line-height: 1.55; margin-bottom: 16px; }
    .cbt-opts { gap: 9px; }
    .cbt-opt { padding: 11px 12px; }
    .cbt-opt-t { font-size: 15px; }
    .cbt-actions { display: none; }
    .cbt-m-actions { display: flex; }
    .cbt-mobile-nav { display: flex; }
    .cbt-app { padding-bottom: calc(70px + env(safe-area-inset-bottom)); }

    /* Palette becomes a bottom drawer */
    .cbt-side {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      top: auto;
      z-index: 200;
      max-height: 84dvh;
      border-top: 1px solid var(--cbt-line);
      border-radius: 14px 14px 0 0;
      transform: translateY(105%);
      transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
      box-shadow: 0 -12px 40px rgba(15, 23, 42, 0.18);
      overflow: hidden;
    }
    .cbt-side.open { transform: translateY(0); }
    .cbt-backdrop { display: block; }
    .cbt-side-head { display: flex; }
    .cbt-pal { grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; }
    .cbt-pb { min-height: 44px; font-size: 13.5px; }
  }

  @media (max-width: 480px) {
    .cbt-brand-sub { display: none; }
    .cbt-cand { display: none; }
    .cbt-header { justify-content: space-between; }
    .cbt-timer-val { font-size: 14px; }
    .cbt-pal { grid-template-columns: repeat(5, minmax(0, 1fr)); }
    .cbt-modal-foot { flex-direction: column-reverse; }
    .cbt-modal-foot .cbt-btn { width: 100%; }
  }

  /* Very small phones */
  @media (max-width: 380px) {
    .cbt-header { gap: 8px; }
    .cbt-brand-exam { font-size: 12.5px; }
    .cbt-timer { padding: 3px 8px; }
    .cbt-timer-label { font-size: 8.5px; }
    .cbt-timer-val { font-size: 13px; }
    .cbt-qno { font-size: 13.5px; }
    .cbt-mk-chip { font-size: 11.5px; padding: 2px 8px; }
    .cbt-legend-grid { grid-template-columns: 1fr; }
    .cbt-pal { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }
    .cbt-pb { min-height: 40px; font-size: 12.5px; }
    .cbt-mobile-nav button { font-size: 12px; }
    .cbt-sum-mini { font-size: 10.5px; }
  }

  /* Landscape phones: use the width — sidebar visible beside the question,
     like the desktop CBT, instead of the stacked phone layout. */
  @media (max-height: 540px) and (max-width: 960px) {
    .cbt-app { height: 100dvh; min-height: 0; overflow: hidden; padding-bottom: 0; }
    .cbt-header { position: static; padding: 5px 14px; gap: 12px; }
    .cbt-brand-org, .cbt-brand-sub { display: none; }
    .cbt-brand-exam { font-size: 13px; }
    .cbt-cand { display: flex; }
    .cbt-cand-meta { display: flex; }
    .cbt-avatar { width: 30px; height: 30px; font-size: 11px; }
    .cbt-tabs .cbt-tab { padding: 6px 12px; }
    .cbt-main { display: grid; grid-template-columns: minmax(0, 1fr) 236px; }
    .cbt-qhead { padding: 7px 14px; }
    .cbt-qbody { padding: 12px 16px 16px; }
    .cbt-qtext { font-size: 15px; margin-bottom: 12px; }
    .cbt-opts { gap: 8px; }
    .cbt-opt { padding: 9px 12px; min-height: 42px; }
    .cbt-opt-t { font-size: 14px; }
    .cbt-qimg { max-height: 200px; }
    .cbt-btn { padding: 8px 14px; min-height: 34px; font-size: 12px; }
    .cbt-actions { display: flex; padding: 8px 14px; }
    .cbt-m-actions { display: none !important; }
    .cbt-mobile-nav { display: none !important; }
    .cbt-pal-toggle { display: none; }
    .cbt-side {
      position: static;
      transform: none;
      max-height: none;
      border-radius: 0;
      box-shadow: none;
      border-top: 0;
    }
    .cbt-side-head { display: none; }
    .cbt-legend { display: none; }
    .cbt-side-scroll { padding: 10px; }
    .cbt-pal-title { margin-top: 0; }
    .cbt-pal { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
    .cbt-pb { min-height: 34px; font-size: 12px; }
    .cbt-side-foot { padding: 8px 10px; flex-direction: row; }
  }

  @media print {
    .cbt-header, .cbt-tabs, .cbt-side, .cbt-actions, .cbt-mobile-nav,
    .cbt-m-actions, .cbt-backdrop { display: none !important; }
    .cbt-app { height: auto; overflow: visible; }
    .cbt-qbody { overflow: visible; }
  }

  /* ---------- RESULT ---------- */
  .v2-score {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 22px;
    padding-bottom: 18px;
    border-bottom: 1px solid var(--rule);
  }
  .v2-score-num {
    font-family: 'Instrument Serif', serif;
    font-size: 72px;
    line-height: 1;
    color: var(--accent);
  }
  .v2-score-of {
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    color: var(--dim);
    letter-spacing: 0.06em;
  }
  .v2-res-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 26px;
  }
  .v2-res-cell {
    border: 1px solid var(--rule);
    background: var(--paper-2);
    padding: 14px 10px;
    text-align: center;
  }
  .v2-res-cell strong {
    display: block;
    font-family: 'Instrument Serif', serif;
    font-size: 32px;
    color: var(--ink);
    line-height: 1;
  }
  .v2-res-cell span {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--dim);
  }
  .v2-res-cell.ok strong { color: oklch(0.45 0.13 150); }
  .v2-res-cell.bad strong { color: var(--accent); }
  .v2-res-cell.skip strong { color: #9a8f78; }

  .v2-insight-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--paper);
    border: 1px solid var(--paper);
    color: var(--ink);
    padding: 13px 20px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
    margin-bottom: 22px;
    min-height: 44px;
  }
  .v2-insight-btn:hover { background: var(--accent); border-color: var(--accent); color: #fff; }

  .v2-review {
    border-top: 1px solid var(--rule);
    padding-top: 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-bottom: 24px;
  }
  .v2-rev-item {
    border: 1px solid var(--rule);
    background: var(--paper-2);
    padding: 16px 16px 14px;
  }
  .v2-rev-item.correct { border-left: 3px solid oklch(0.45 0.13 150); }
  .v2-rev-item.wrong { border-left: 3px solid var(--accent); }
  .v2-rev-item.unattempted { border-left: 3px solid #b8ad96; }

  .v2-rev-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
    flex-wrap: wrap;
  }
  .v2-rev-num {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    font-weight: 600;
    color: var(--ink);
  }
  .v2-rev-tag {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    padding: 3px 7px;
    color: #fff;
  }
  .v2-rev-tag.correct { background: oklch(0.45 0.13 150); }
  .v2-rev-tag.wrong { background: var(--accent); }
  .v2-rev-tag.unattempted { background: #b8ad96; color: #14110d; }
  .v2-rev-marks {
    margin-left: auto;
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    font-weight: 600;
    color: var(--ink);
  }

  .v2-rev-q {
    font-family: 'Instrument Serif', serif;
    font-size: 17px;
    line-height: 1.4;
    color: var(--ink);
    margin: 0 0 12px;
    word-break: break-word;
  }
  .v2-rev-img { max-width: 100%; max-height: 220px; object-fit: contain; border: 1px solid var(--rule); margin: 0 auto 12px; display: block; }
  .v2-rev-opts { display: flex; flex-direction: column; gap: 6px; }
  .v2-rev-opt {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 11px;
    border: 1px solid var(--rule);
    background: var(--paper);
  }
  .v2-rev-opt.answer {
    border-color: oklch(0.45 0.13 150);
    background: oklch(0.96 0.04 150);
  }
  .v2-rev-opt.chosen {
    border-color: var(--accent);
    background: rgba(200,50,30,0.07);
  }
  .v2-rev-k {
    width: 22px;
    height: 22px;
    border: 1px solid var(--rule);
    display: grid;
    place-items: center;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: var(--ink-2);
    flex-shrink: 0;
  }
  .v2-rev-opt.answer .v2-rev-k { background: oklch(0.45 0.13 150); border-color: oklch(0.45 0.13 150); color: #fff; }
  .v2-rev-opt.chosen .v2-rev-k { background: var(--accent); border-color: var(--accent); color: #fff; }
  .v2-rev-t { font-family: 'JetBrains Mono', monospace; font-size: 12.5px; color: var(--ink-2); word-break: break-word; }

  .v2-done { margin-top: 4px; }

  .v2-submitted-note {
    border: 1px solid #d9d1bf;
    background: #f0ece4;
    padding: 14px 16px;
    font-size: 13px;
    line-height: 1.6;
    color: #6b6358;
    margin-bottom: 18px;
  }
  .v2-pdf-err {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    letter-spacing: 0.04em;
    color: #ff8a80;
    margin: -10px 0 16px;
  }

  /* ---------- MATH PREVIEW ---------- */
  .frac {
    display: inline-flex;
    flex-direction: column;
    text-align: center;
    vertical-align: middle;
    margin: 0 3px;
    line-height: 1.1;
  }
  .frac > .num { border-bottom: 1px solid currentColor; padding: 0 5px 1px; }
  .frac > .den { padding: 1px 5px 0; }
  .sqrt { display: inline-flex; align-items: stretch; margin: 0 1px; vertical-align: middle; }
  .sqrt > .sym { font-size: 1.1em; line-height: 1; transform: scaleX(0.82); transform-origin: bottom; }
  .sqrt > .body { border-top: 1px solid currentColor; padding: 2px 3px 0; }
  .oline { border-top: 1px solid currentColor; padding-top: 1px; }
  .mhat { position: relative; display: inline-block; }
  .mhat-cap {
    position: absolute;
    top: -0.55em;
    left: 50%;
    transform: translateX(-55%) scaleX(1.1);
    font-size: 0.85em;
    line-height: 1;
    pointer-events: none;
  }
  .mhat-body { padding: 0 1px; }
  .mvec { position: relative; display: inline-block; }
  .mvec-arrow {
    position: absolute;
    top: -0.55em;
    left: 50%;
    transform: translateX(-50%);
    font-size: 0.8em;
    line-height: 1;
    letter-spacing: -0.05em;
    pointer-events: none;
  }
  .mvec-body { padding: 0 1px; }
  .fn { font-style: italic; }
  sup, sub { font-size: 0.72em; line-height: 0; }

  /* ---------- RESPONSIVE (lobby / result screens) ---------- */
  @media (max-width: 640px) {
    .v2-center { padding: 16px 12px; padding-top: max(16px, env(safe-area-inset-top)); padding-bottom: max(16px, env(safe-area-inset-bottom)); }
    .v2-lobby-card { padding: 22px 16px 18px; box-shadow: 6px 6px 0 var(--ink); max-width: 100%; }
    .v2-lobby-title { font-size: 28px; }
    .v2-lobby-desc { font-size: 13px; }
    .v2-instr { padding: 14px 12px 14px 28px; font-size: 12.5px; }
    .v2-instr li::before { left: -18px; }
    .v2-check { font-size: 12.5px; }
    .v2-field { margin-bottom: 18px; }
    .v2-name { font-size: 16px; padding: 12px 14px; } /* 16px prevents iOS zoom */
    .v2-join { width: 100%; justify-content: center; padding: 14px 18px; }
    .v2-res-grid { grid-template-columns: 1fr; }
    .v2-score-num { font-size: 56px; }
  }

  @media (max-width: 380px) {
    .v2-lobby-title { font-size: 24px; }
  }
`;

export default function ExamPage() {
  return (
    <Suspense
      fallback={<div style={{ minHeight: "100vh", background: "#f4f0e8" }} />}
    >
      <ExamContent />
    </Suspense>
  );
}
