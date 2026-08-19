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

type PaletteState = "un" | "vis" | "ans" | "mk";

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
    setVisited(new Array(rt.length).fill(false));
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
      next[current] = optIdx;
      return next;
    });
    setVisited((v) => {
      const next = [...v];
      next[current] = true;
      return next;
    });
  };

  const toggleMark = () => {
    setMarked((m) => {
      const next = [...m];
      next[current] = !next[current];
      return next;
    });
  };

  const paletteState = (idx: number): PaletteState => {
    if (marked[idx]) return "mk";
    if (answers[idx] != null) return "ans";
    if (visited[idx]) return "vis";
    return "un";
  };

  const answeredCount = useMemo(
    () => answers.filter((a) => a != null).length,
    [answers]
  );
  const markedCount = useMemo(() => marked.filter(Boolean).length, [marked]);

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
          return (
        <div className="v2-preview-wrap v2-test-wrap">
          <div className="v2-preview">
            <div className="v2-preview-bar">
              <span className="v2-bar-title">NTA CBT · {exam.title}</span>
              <span className="v2-bar-candidate">Candidate: {name.trim() || "—"}</span>
              <span className="v2-bar-rec" style={{ color: "#d9a300" }}>● Recording</span>
            </div>

            <div className="v2-preview-body">
              <div className="v2-q2">
                <div className="v2-q2-meta">
                  <span>Section A · {exam.subject}</span>
                  <span>
                    <strong>Q. {current + 1}</strong> of {totalQuestions}
                  </span>
                </div>

                {/* Mobile sticky top: time + palette button */}
                <div className="v2-mobile-strip">
                  <div className="v2-mobile-time">
                    <span className="v2-mobile-time-label">Time</span>
                    <span
                      className="v2-mobile-time-val"
                      style={{ color: secondsLeft <= 300 ? "#d9a300" : "var(--accent)" }}
                    >
                      {formatTime(secondsLeft)}
                    </span>
                  </div>
                  <div className="v2-mobile-stats">
                    <span>{answeredCount}/{totalQuestions} done</span>
                    {markedCount > 0 && <span>· {markedCount} marked</span>}
                  </div>
                  <button
                    className="v2-mobile-pal-btn"
                    onClick={() => setShowMobilePalette(true)}
                    aria-label="Open question palette"
                  >
                    <span className="v2-mobile-pal-icon">◫</span> Palette
                  </button>
                </div>

                <p
                  className="v2-q2-text"
                  dangerouslySetInnerHTML={{
                    __html: renderMathHtml(currentQuestion.prompt),
                  }}
                />

                {(imageUrls.length > 0) && (
                  <div className="v2-q-imgs">
                    {imageUrls.map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={`${src}-${i}`}
                        src={src}
                        alt="Question diagram"
                        className="v2-q-img"
                      />
                    ))}
                  </div>
                )}

                <div className="v2-opts2">
                  {currentQuestion.options.map((opt, i) => {
                    const selected = answers[current] === i;
                    return (
                      <div
                        key={opt.id}
                        className={`v2-opt2${selected ? " sel" : ""}`}
                        onClick={() => selectOption(i)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') selectOption(i); }}
                      >
                        <div className="v2-opt2-k">{OPTION_KEYS[i]}</div>
                        <div className="v2-opt2-main">
                          <div
                            className="v2-opt2-t"
                            dangerouslySetInnerHTML={{ __html: renderMathHtml(opt.text) }}
                          />
                          {opt.imageUrl && (
                            <img className="v2-opt2-img" src={opt.imageUrl} alt={`Option ${OPTION_KEYS[i]}`} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="v2-nav">
                  <button
                    className="v2-nav-btn"
                    disabled={current === 0}
                    onClick={() => visit(current - 1)}
                  >
                    ← Previous
                  </button>
                  <button
                    className={`v2-nav-btn v2-mark${marked[current] ? " on" : ""}`}
                    onClick={toggleMark}
                  >
                    {marked[current] ? "★ Marked" : "☆ Mark for review"}
                  </button>
                  <button
                    className="v2-nav-btn"
                    disabled={current === totalQuestions - 1}
                    onClick={() => visit(current + 1)}
                  >
                    Next →
                  </button>
                </div>

                <button className="v2-mobile-submit" onClick={() => setConfirmOpen(true)}>
                  Submit Test
                </button>
              </div>

              <aside className={`v2-side2 ${showMobilePalette ? "open" : ""}`}>
                <div className="v2-side-scroll">
                  <div className="v2-side-header-mobile">
                    <div>
                      <div className="v2-tlabel" style={{ marginBottom: 4 }}>Question Palette</div>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#b8ad96' }}>
                        {answeredCount} answered · {markedCount} marked
                      </div>
                    </div>
                    <button
                      className="v2-side-close"
                      onClick={() => setShowMobilePalette(false)}
                      aria-label="Close palette"
                    >
                      ×
                    </button>
                  </div>

                  <div className="v2-tlabel hide-mobile">Time remaining</div>
                  <div
                    className="v2-tval hide-mobile"
                    style={{
                      color: secondsLeft <= 300 ? "#d9a300" : "var(--accent)",
                    }}
                  >
                    {formatTime(secondsLeft)}
                  </div>

                  <div className="v2-tlabel hide-mobile">Progress</div>
                  <div className="v2-prog hide-mobile">
                    <span>
                      <strong>{answeredCount}</strong> answered
                    </span>
                    <span>
                      <strong>{markedCount}</strong> marked
                    </span>
                  </div>

                  <div className="v2-tlabel" style={{ marginTop: 0 }}>
                    Palette · Section A
                  </div>
                  <div className="v2-pal">
                    {runtime.map((_, i) => {
                      const st = paletteState(i);
                      const isCurrent = i === current;
                      return (
                        <button
                          key={i}
                          className={`v2-pdot2 ${st}${isCurrent ? " cur" : ""}`}
                          onClick={() => { visit(i); setShowMobilePalette(false); }}
                        >
                          {i + 1}
                        </button>
                      );
                    })}
                  </div>

                  <div className="v2-tlabel" style={{ margin: "14px 0 6px" }}>
                    Legend
                  </div>
                  <div className="v2-legend">
                    <span>
                      <i className="v2-lg ans" />
                      Answered
                    </span>
                    <span>
                      <i className="v2-lg mk" />
                      Marked
                    </span>
                    <span>
                      <i className="v2-lg vis" />
                      Visited
                    </span>
                    <span>
                      <i className="v2-lg un" />
                      Not visited
                    </span>
                  </div>

                  <button className="v2-submit-btn hide-mobile" onClick={() => setConfirmOpen(true)}>
                    Submit Test
                  </button>

                  <button className="v2-submit-btn show-mobile-drawer" onClick={() => { setShowMobilePalette(false); setConfirmOpen(true); }}>
                    Submit Test
                  </button>
                </div>
              </aside>
            </div>

            {showMobilePalette && (
              <div className="v2-drawer-backdrop" onClick={() => setShowMobilePalette(false)} />
            )}
          </div>

          {/* Bottom sticky action bar for mobile */}
          <div className="v2-mobile-bottom">
            <button disabled={current===0} onClick={()=>visit(current-1)}>← Prev</button>
            <button onClick={()=>setShowMobilePalette(true)} className="mid">◫ {current+1}/{totalQuestions}</button>
            <button disabled={current===totalQuestions-1} onClick={()=>visit(current+1)}>Next →</button>
          </div>
        </div>
          );
        })()
      )}

      {!loading && !error && exam && stage === "result" && (
        <SubmittedScreen exam={exam} name={name} runtime={runtime} />
      )}

      {confirmOpen && (
        <div className="v2-overlay" onClick={() => setConfirmOpen(false)}>
          <div className="v2-dialog" onClick={(e) => e.stopPropagation()}>
            <button
              className="v2-dialog-close"
              onClick={() => setConfirmOpen(false)}
              aria-label="Close"
            >
              ×
            </button>
            <h3 className="v2-cta-title">
              Submit your <em>test</em>?
            </h3>
            <p className="v2-cta-desc">
              Answered {answeredCount} of {totalQuestions}. You can&apos;t return
              after submitting.
            </p>
            <div className="v2-modal-foot">
              <button
                className="v2-set-btn ghost"
                onClick={() => setConfirmOpen(false)}
              >
                Keep going
              </button>
              <button className="v2-submit" onClick={submit}>
                Submit now
              </button>
            </div>
          </div>
        </div>
      )}

      {focusWarnOpen && (
        <div className="v2-overlay" onClick={() => setFocusWarnOpen(false)}>
          <div className="v2-dialog" onClick={(e) => e.stopPropagation()}>
            <button
              className="v2-dialog-close"
              onClick={() => setFocusWarnOpen(false)}
              aria-label="Close"
            >
              ×
            </button>
            <h3 className="v2-cta-title">
              Stay in the <em>test</em>
            </h3>
            <p className="v2-cta-desc">
              You left the test window. If you leave again, your test will be
              automatically submitted.
            </p>
            <div className="v2-modal-foot">
              <button className="v2-submit" onClick={() => setFocusWarnOpen(false)}>
                Return to test
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
    background: #0f0d0a;
    color: #eee6d5;
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
    background: #14110d;
    border: 1px solid #2a251d;
    position: relative;
    padding: 44px 36px 32px;
    text-align: left;
    box-shadow: 12px 12px 0 #000;
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
    color: #f4ecd8;
  }
  .v2-lobby-title em { font-style: italic; color: var(--accent); }

  .v2-lobby-desc {
    font-size: 14px;
    line-height: 1.6;
    color: #b8ad96;
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
    border: 1px solid #2a251d;
    background: #0b0908;
    font-size: 13.5px;
    line-height: 1.7;
    color: #b8ad96;
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
  .v2-instr strong { color: #f4ecd8; }

  .v2-check {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    font-size: 13.5px;
    color: #b8ad96;
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
    background: #0b0908;
    border: 1px solid #2a251d;
    border-radius: 0;
    padding: 14px 16px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 16px;
    color: #f4ecd8;
    outline: none;
  }
  .v2-name::placeholder { color: #6f685c; }
  .v2-name:focus { background: #14110d; border-color: var(--accent); }

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

  /* ---------- TEST WINDOW ---------- */
  .v2-test-wrap {
    padding: 24px;
    padding-bottom: 24px;
  }

  .v2-preview {
    border: 1px solid var(--ink);
    background: #0f0d0a;
    color: #eee6d5;
    position: relative;
    box-shadow: 12px 12px 0 var(--ink);
    display: flex;
    flex-direction: column;
    min-height: calc(100vh - 48px);
    min-height: calc(100dvh - 48px);
    width: 100%;
    max-width: 100%;
    overflow: hidden;
  }
  .v2-preview-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 12px 18px;
    background: #14110d;
    border-bottom: 1px solid #2a251d;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: #b8ad96;
    letter-spacing: 0.06em;
    flex-wrap: wrap;
  }
  .v2-preview-body { display: grid; grid-template-columns: 1fr 260px; flex: 1; min-height: 0; min-width: 0; }

  .v2-q2 {
    padding: 32px 32px 28px;
    border-right: 1px solid #2a251d;
    min-height: 480px;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .v2-q2-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: #b8ad96;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 18px;
    flex-wrap: wrap;
  }
  .v2-q2-meta strong { color: var(--accent); }

  /* Mobile top strip - hidden on desktop */
  .v2-mobile-strip {
    display: none;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 12px 14px;
    background: #0b0908;
    border: 1px solid #2a251d;
    margin-bottom: 16px;
    position: sticky;
    top: 0;
    z-index: 20;
  }
  .v2-mobile-time {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .v2-mobile-time-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #8a8275;
    line-height: 1;
  }
  .v2-mobile-time-val {
    font-family: 'JetBrains Mono', monospace;
    font-size: 16px;
    font-weight: 600;
    letter-spacing: 0.02em;
    line-height: 1;
  }
  .v2-mobile-stats {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #b8ad96;
    display: flex;
    gap: 4px;
    align-items: center;
    flex-wrap: wrap;
  }
  .v2-mobile-pal-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #14110d;
    border: 1px solid #2a251d;
    color: #f4ecd8;
    padding: 10px 14px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    cursor: pointer;
    min-height: 40px;
    flex-shrink: 0;
  }
  .v2-mobile-pal-btn:active { background: #1e1a14; }
  .v2-mobile-pal-icon { font-size: 14px; }

  .v2-q2-text {
    font-family: 'Instrument Serif', serif;
    font-size: 20px;
    line-height: 1.45;
    color: #f4ecd8;
    margin: 0 0 24px;
    word-break: break-word;
    overflow-wrap: anywhere;
  }
  .v2-q-img { max-width: 100%; max-height: 320px; object-fit: contain; border: 1px solid #2a251d; margin: 0 auto 20px; display: block; width: auto; height: auto; }
  .v2-q-imgs { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; width: 100%; }
  .v2-q-imgs .v2-q-img { margin-bottom: 0; }

  .v2-opts2 { display: flex; flex-direction: column; gap: 10px; width: 100%; }
  .v2-opt2 {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 14px 14px;
    border: 1px solid #2a251d;
    cursor: pointer;
    transition: border-color 0.12s ease, background 0.12s ease, transform 0.08s ease;
    min-height: 48px;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
    touch-action: manipulation;
  }
  .v2-opt2:hover { border-color: #4a4135; }
  .v2-opt2:active { transform: scale(0.995); }
  .v2-opt2.sel { border-color: var(--accent); background: rgba(200,50,30,0.10); }
  .v2-opt2-k {
    width: 28px;
    height: 28px;
    border: 1px solid #2a251d;
    display: grid;
    place-items: center;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: #b8ad96;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .v2-opt2.sel .v2-opt2-k { background: var(--accent); border-color: var(--accent); color: #fff; }
  .v2-opt2-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
  .v2-opt2-t { font-family: 'JetBrains Mono', monospace; font-size: 13.5px; line-height: 1.5; word-break: break-word; overflow-wrap: anywhere; }
  .v2-opt2-img { display: block; max-width: 100%; max-width: 200px; max-height: 140px; object-fit: contain; border: 1px solid var(--rule); }

  .v2-nav {
    display: grid;
    grid-template-columns: 1fr 1.2fr 1fr;
    gap: 8px;
    margin-top: 28px;
  }
  .v2-nav-btn {
    background: transparent;
    border: 1px solid #2a251d;
    color: #eee6d5;
    padding: 14px 10px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    cursor: pointer;
    transition: border-color 0.12s ease, color 0.12s ease, background 0.12s ease;
    min-height: 44px;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  .v2-nav-btn:hover:not(:disabled) { border-color: var(--accent); color: #fff; }
  .v2-nav-btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .v2-mark.on { border-color: #d9a300; color: #d9a300; background: rgba(217,163,0,0.08); }

  .v2-mobile-submit {
    display: none;
    width: 100%;
    margin-top: 16px;
    background: var(--accent);
    color: #fff;
    border: 1px solid var(--accent);
    padding: 16px;
    font-family: 'Inter', sans-serif;
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
    min-height: 50px;
  }

  .v2-side2 {
    padding: 22px 20px;
    background: #0b0908;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .v2-side-scroll {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: none;
  }
  .v2-side-scroll::-webkit-scrollbar { display: none; }
  .v2-side-header-mobile {
    display: none;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 18px;
    padding-bottom: 14px;
    border-bottom: 1px solid #2a251d;
  }
  .v2-side-close {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    background: #14110d;
    border: 1px solid #2a251d;
    color: #f4ecd8;
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
    flex-shrink: 0;
  }
  .v2-tlabel {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #8a8275;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  .v2-tval {
    font-family: 'JetBrains Mono', monospace;
    font-size: 32px;
    font-weight: 500;
    color: var(--accent);
    letter-spacing: 0.02em;
    margin-bottom: 22px;
    line-height: 1;
  }
  .v2-prog {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: #b8ad96;
    margin-bottom: 18px;
  }
  .v2-prog strong { color: #f4ecd8; }

  .v2-pal { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; margin-bottom: 8px; }
  .v2-pdot2 {
    aspect-ratio: 1;
    min-height: 36px;
    display: grid;
    place-items: center;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    cursor: pointer;
    border: 0;
    color: inherit;
    padding: 0;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    transition: transform 0.08s ease, filter 0.12s ease;
  }
  .v2-pdot2:active { transform: scale(0.94); }
  .v2-pdot2.ans { background: var(--accent); color: #fff; }
  .v2-pdot2.mk  { background: #d9a300; color: #14110d; }
  .v2-pdot2.vis { background: #4a2a14; color: #f4ecd8; }
  .v2-pdot2.un  { background: transparent; color: #8a8275; border: 1px solid #2a251d; }
  .v2-pdot2.cur { outline: 2px solid #f4ecd8; outline-offset: 1px; z-index: 1; }

  .v2-legend {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #8a8275;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .v2-legend span { display: flex; align-items: center; gap: 6px; }
  .v2-lg { width: 10px; height: 10px; display: inline-block; flex-shrink: 0; }
  .v2-lg.ans { background: oklch(0.52 0.20 25); }
  .v2-lg.mk { background: #d9a300; }
  .v2-lg.vis { background: #4a2a14; }
  .v2-lg.un { border: 1px solid #2a251d; background: transparent; }

  .v2-submit-btn {
    width: 100%;
    margin-top: 20px;
    background: var(--accent);
    color: #fff;
    border: 1px solid var(--accent);
    padding: 14px;
    font-family: 'Inter', sans-serif;
    font-weight: 600;
    font-size: 13px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    cursor: pointer;
    min-height: 44px;
  }
  .v2-submit-btn:hover { background: var(--accent-2); border-color: var(--accent-2); }
  .v2-submit-btn.show-mobile-drawer { display: none; }

  /* Mobile bottom sticky bar - hidden on desktop */
  .v2-mobile-bottom {
    display: none;
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 180;
    background: #14110d;
    border-top: 1px solid #2a251d;
    padding: 8px 10px;
    padding-bottom: max(8px, env(safe-area-inset-bottom));
    gap: 8px;
    box-shadow: 0 -8px 24px rgba(0,0,0,0.4);
  }
  .v2-mobile-bottom button {
    flex: 1;
    background: transparent;
    border: 1px solid #2a251d;
    color: #f4ecd8;
    padding: 14px 8px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    cursor: pointer;
    min-height: 46px;
    -webkit-tap-highlight-color: transparent;
  }
  .v2-mobile-bottom button:disabled { opacity: 0.35; }
  .v2-mobile-bottom button.mid {
    background: #0b0908;
    border-color: #3a3226;
    font-weight: 600;
  }

  /* Drawer backdrop */
  .v2-drawer-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.55);
    backdrop-filter: blur(2px);
    z-index: 190;
    animation: v2-fadeIn 0.2s ease;
  }
  @keyframes v2-fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .hide-mobile { display: block; }
  .show-mobile-drawer { display: none !important; }

  /* ---------- DIALOG ---------- */
  .v2-overlay {
    position: fixed;
    inset: 0;
    background: rgba(20, 17, 13, 0.65);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    z-index: 1000;
  }
  .v2-dialog {
    width: 100%;
    max-width: 460px;
    background: linear-gradient(180deg, #fbf7ee, var(--paper));
    border: 1px solid var(--ink);
    color: var(--ink);
    position: relative;
    padding: 38px 32px 28px;
    text-align: left;
    box-shadow: 12px 12px 0 var(--ink);
    max-height: 90vh;
    max-height: 90dvh;
    overflow-y: auto;
  }
  .v2-dialog::before, .v2-dialog::after {
    content: "";
    position: absolute;
    width: 12px;
    height: 12px;
    background: var(--ink);
  }
  .v2-dialog::before { top: -1px; left: -1px; }
  .v2-dialog::after { bottom: -1px; right: -1px; }
  .v2-dialog-close {
    position: absolute;
    top: 14px;
    right: 16px;
    background: transparent;
    border: 1px solid var(--ink);
    width: 36px;
    height: 36px;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    color: var(--ink);
    transition: background 0.15s ease, color 0.15s ease;
    display: grid;
    place-items: center;
  }
  .v2-dialog-close:hover { background: var(--ink); color: var(--paper); }
  .v2-cta-title {
    font-family: 'Instrument Serif', serif;
    font-size: 27px;
    line-height: 1.15;
    margin: 0 0 12px;
    color: var(--ink);
  }
  .v2-cta-title em { font-style: italic; color: var(--accent); }
  .v2-cta-desc {
    font-size: 13.5px;
    line-height: 1.6;
    color: var(--ink-2);
    margin: 0;
  }
  .v2-modal-foot {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 24px;
    flex-wrap: wrap;
  }
  .v2-set-btn {
    background: transparent;
    border: 1px solid var(--ink);
    color: var(--ink);
    padding: 12px 20px;
    font-family: 'Inter', sans-serif;
    font-weight: 600;
    font-size: 13px;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
    min-height: 44px;
  }
  .v2-set-btn.ghost:hover { background: var(--ink); color: var(--paper); }
  .v2-submit {
    background: var(--accent);
    color: #fff;
    border: 1px solid var(--accent);
    padding: 12px 22px;
    font-family: 'Inter', sans-serif;
    font-weight: 600;
    font-size: 13px;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
    min-height: 44px;
  }
  .v2-submit:hover { background: var(--accent-2); border-color: var(--accent-2); }

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
    border: 1px solid #2a251d;
    background: #0b0908;
    padding: 14px 16px;
    font-size: 13px;
    line-height: 1.6;
    color: #b8ad96;
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
  .fn { font-style: italic; }
  sup, sub { font-size: 0.72em; line-height: 0; }

  /* ---------- RESPONSIVE ---------- */
  @media (max-width: 1024px) {
    .v2-preview-body { grid-template-columns: 1fr 240px; }
    .v2-pal { grid-template-columns: repeat(5, 1fr); }
  }

  @media (max-width: 960px) {
    .v2-test-wrap {
      padding: 0;
      padding-bottom: calc(64px + env(safe-area-inset-bottom));
    }
    .v2-preview {
      border: 0;
      box-shadow: none;
      min-height: 100vh;
      min-height: 100dvh;
      border-radius: 0;
    }
    .v2-preview-bar {
      padding: 10px 14px;
      font-size: 10px;
      gap: 8px;
      position: sticky;
      top: 0;
      z-index: 30;
    }
    .v2-bar-title { flex: 1 1 100%; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .v2-bar-candidate, .v2-bar-rec { font-size: 10px; }
    .v2-preview-body {
      grid-template-columns: 1fr;
      display: flex;
      flex-direction: column;
    }
    .v2-q2 {
      border-right: 0;
      border-bottom: 0;
      padding: 14px 14px 20px;
      min-height: auto;
      flex: 1;
    }
    .v2-mobile-strip { display: flex; }
    .v2-q2-meta { margin-bottom: 12px; font-size: 10px; }
    .v2-q2-text { font-size: 18px; line-height: 1.4; margin-bottom: 18px; }
    .v2-opts2 { gap: 10px; }
    .v2-opt2 { padding: 12px 12px; }
    .v2-nav { grid-template-columns: 1fr 1fr; margin-top: 20px; }
    .v2-nav .v2-mark { grid-column: 1 / -1; order: 3; }
    .v2-mobile-submit { display: block; }
    .v2-mobile-bottom { display: flex; }

    /* Side drawer */
    .v2-side2 {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      top: auto;
      z-index: 200;
      max-height: 85vh;
      max-height: 85dvh;
      border-top: 1px solid #2a251d;
      border-left: 0;
      border-right: 0;
      border-bottom: 0;
      border-radius: 16px 16px 0 0;
      padding: 0;
      transform: translateY(105%);
      transition: transform 0.32s cubic-bezier(0.32,0.72,0,1);
      box-shadow: 0 -12px 40px rgba(0,0,0,0.6);
      background: #0f0d0a;
      overflow: hidden;
    }
    .v2-side2.open {
      transform: translateY(0);
    }
    .v2-side-scroll {
      padding: 18px 16px;
      padding-bottom: max(18px, env(safe-area-inset-bottom));
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }
    .v2-side-header-mobile { display: flex; }
    .hide-mobile { display: none !important; }
    .show-mobile-drawer { display: block !important; }
    .v2-side2 .v2-tlabel { margin-top: 10px; }
    .v2-pal { grid-template-columns: repeat(6, minmax(0,1fr)); gap: 8px; }
    .v2-pdot2 { min-height: 44px; font-size: 12px; }
    .v2-tval { font-size: 28px; }
  }

  @media (max-width: 640px) {
    .v2-center { padding: 16px 12px; padding-top: max(16px, env(safe-area-inset-top)); padding-bottom: max(16px, env(safe-area-inset-bottom)); }
    .v2-lobby-card { padding: 22px 16px 18px; box-shadow: 6px 6px 0 #000; max-width: 100%; }
    .v2-lobby-title { font-size: 28px; }
    .v2-lobby-desc { font-size: 13px; }
    .v2-instr { padding: 14px 12px 14px 28px; font-size: 12.5px; }
    .v2-instr li::before { left: -18px; }
    .v2-check { font-size: 12.5px; }
    .v2-field { margin-bottom: 18px; }
    .v2-name { font-size: 16px; padding: 12px 14px; } /* 16px prevents iOS zoom */
    .v2-join { width: 100%; justify-content: center; padding: 14px 18px; }

    .v2-preview-bar { padding: 10px 12px; }
    .v2-q2 { padding: 12px 12px 16px; }
    .v2-q2-text { font-size: 17px; }
    .v2-opt2-t { font-size: 13px; }
    .v2-opt2-k { width: 26px; height: 26px; font-size: 11px; }
    .v2-pal { grid-template-columns: repeat(5, minmax(0,1fr)); }
    .v2-overlay { padding: 12px; }
    .v2-dialog { padding: 26px 18px 18px; max-width: 100%; box-shadow: 8px 8px 0 var(--ink); }
    .v2-cta-title { font-size: 22px; }
    .v2-modal-foot { flex-direction: column-reverse; }
    .v2-modal-foot .v2-set-btn, .v2-modal-foot .v2-submit { width: 100%; justify-content: center; }
    .v2-res-grid { grid-template-columns: 1fr; }
    .v2-score-num { font-size: 56px; }
  }

  @media (max-width: 380px) {
    .v2-lobby-title { font-size: 24px; }
    .v2-pal { grid-template-columns: repeat(4, minmax(0,1fr)); gap: 6px; }
    .v2-mobile-strip { flex-wrap: wrap; }
    .v2-mobile-time-val { font-size: 14px; }
    .v2-mobile-pal-btn { padding: 8px 10px; font-size: 10px; }
    .v2-nav { gap: 6px; }
    .v2-nav-btn { font-size: 10px; padding: 12px 6px; }
    .v2-mobile-bottom { padding: 6px 8px; gap: 6px; }
    .v2-mobile-bottom button { font-size: 11px; padding: 12px 4px; min-height: 44px; }
  }

  @media (min-width: 961px) {
    .v2-pal { grid-template-columns: repeat(5, 1fr); }
    .v2-mobile-strip, .v2-mobile-bottom, .v2-mobile-submit, .v2-drawer-backdrop, .v2-side-header-mobile, .show-mobile-drawer { display: none !important; }
  }

  /* Landscape small height */
  @media (max-height: 520px) and (max-width: 960px) {
    .v2-mobile-strip { position: relative; top: auto; }
    .v2-side2 { max-height: 92vh; max-height: 92dvh; }
  }

  /* Print safety - don't print test chrome */
  @media print {
    .v2-preview-bar, .v2-side2, .v2-mobile-bottom, .v2-mobile-strip, .v2-nav, .v2-mobile-submit { display: none !important; }
    .v2-preview { box-shadow: none; border: none; min-height: auto; }
    .v2-q2 { border: 0; padding: 0; }
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
