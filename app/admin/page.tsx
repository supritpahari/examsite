/* Hallmark · genre: playful · theme: Hum · design-system: design.md · designed-as-app */
"use client";

import { useEffect, useMemo, useRef, useState, Fragment } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import ConfirmDialog from "../_components/ConfirmDialog";
import { copyText } from "@/lib/clipboard";
import { onAuthState } from "@/lib/firebase/client";
import { signOut } from "firebase/auth";
import {
  fetchQuestions,
  deleteQuestion,
  type Question,
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
  todayIsoLocal, formatTakenOn, toIsoLocal, parseTakenOn,
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
import { fetchSiteStats } from "@/lib/stats";
import NoticesPanel from "./notices/panel";
import FormulaSheetsPage from "./formula-sheets/FormulaSheets";
import CouponsPanel from "./coupons/CouponsPanel";

const NAV = [
  { key: "notices", label: "Notices" },
  { key: "questions", label: "Questions" },
  { key: "exams", label: "Exams" },
  { key: "students", label: "Students" },
  { key: "formula-sheets", label: "Formula Sheets" },
  { key: "coupons", label: "Coupons" },
  { key: "information", label: "Information" },
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
    case "students":
      return (
        <svg {...common}><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 5.4a3.2 3.2 0 1 1 0 5.6" /><path d="M17.5 14.2a5.5 5.5 0 0 1 3 4.8" /></svg>
      );
    case "notices":
      return (
        <svg {...common}>
          <path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 2h16l-2-2z" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
      );
    case "information":
      return (
        <svg {...common}><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
      );
    case "settings":
      return (
        <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" /></svg>
      );
    case "formula-sheets":
      return (
        <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M16 13h3M16 17h3" /></svg>
      );
    case "coupons":
      return (
        <svg {...common}><path d="M1 4l3 2v11l-3 2V4zm19 2l-3 2v11l3 2V8zM19 4l3 2v3l-3 2v-3l3 2V4zM10 14l3-2V4l-3 2zm0 0l3 2v3l-3 2v-3l3 2v-3z" /></svg>
      );
    case "control":
      return (
        <svg {...common}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
      );
    case "signout":
      return (
        <svg {...common}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 12h10M17 9l3 3-3 3" /></svg>
      );
    case "globe":
      return (
        <svg {...common}><circle cx="12" cy="12" r="10" /><path d="M12 2v20M2 12h20M5 6a7 7 0 1 1 14 0a7 7 0 0 1-14 0" /></svg>
      );
    default:
      return null;
  }
}

export default function AdminDashboard() {
  const [active, setActive] = useState("notices");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<AdminExam | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string;
    description: string;
    confirmLabel?: string;
    danger?: boolean;
    action: () => void;
  } | null>(null);
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
  const [stats, setStats] = useState<{ totalVisitors: number; onlineUsers: number } | null>(null);
  const [explain, setExplain] = useState<{
    q: Question;
    text: string;
    loading: boolean;
    error: string;
  } | null>(null);
  const [qSearch, setQSearch] = useState("");
  const [qVisibleCount, setQVisibleCount] = useState(20);
  const [qLoadingMore, setQLoadingMore] = useState(false);
  const qSentinelRef = useRef<HTMLDivElement>(null);
  const [qChapter, setQChapter] = useState("all");
  const [qSort, setQSort] = useState("newest");

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
        fetchSiteStats()
          .then(setStats)
          .catch(() => setStats(null));
      } else {
        router.replace("/admin/login");
      }
    });
    return unsub;
  }, [router]);

  const handleDelete = (id: string) => {
    setPendingConfirm({
      title: "Delete this question?",
      description: "It will be removed from every exam that uses it. This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
      action: () => doDeleteQuestion(id),
    });
  };

  const doDeleteQuestion = async (id: string) => {
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

  const handleDeleteExam = (id: string) => {
    setPendingConfirm({
      title: "Delete this exam?",
      description: "All attempts recorded against it will also be deleted. This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
      action: () => doDeleteExam(id),
    });
  };

  const doDeleteExam = async (id: string) => {
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

  const openEditExam = (exam: AdminExam) => {
    setEditingExam(exam);
    setExamModalOpen(true);
  };

  const openManageQuestions = (exam: AdminExam) => {
    setAddQuestionsExam(exam);
    setAddQuestionsInitial(examQuestionMap[exam.id] ?? []);
  };

  const copyExamLink = async (exam: AdminExam): Promise<boolean> => {
    const link = `${window.location.origin}/exam?id=${encodeURIComponent(exam.code)}`;
    return copyText(link);
  };

  const copyExamCode = async (exam: AdminExam): Promise<boolean> => {
    return copyText(exam.code);
  };

  const toggleStopExam = (exam: AdminExam) => {
    const stopping = exam.status !== "stopped";
    if (stopping) {
      setPendingConfirm({
        title: "Stop this exam?",
        description: "Students can no longer join this exam — the link stops working until you start it again.",
        confirmLabel: "Stop exam",
        danger: true,
        action: () => doToggleStopExam(exam),
      });
      return;
    }
    void doToggleStopExam(exam);
  };

  const doToggleStopExam = async (exam: AdminExam) => {
    const stopping = exam.status !== "stopped";
    const nextStatus: AdminExam["status"] = stopping ? "stopped" : "scheduled";
    setExams((prev) =>
      prev.map((e) => (e.id === exam.id ? { ...e, status: nextStatus } : e))
    );
    try {
      await updateExam(exam.id, { status: nextStatus });
    } catch {
      fetchExams().then(setExams).catch(() => {});
    }
  };

  const handleSignOut = () => {
    setPendingConfirm({
      title: "Sign out of the admin console?",
      description: "You'll need to sign back in to manage exams, notices and formula sheets.",
      confirmLabel: "Sign out",
      action: doSignOut,
    });
  };

  const doSignOut = async () => {
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

  const questionChapters = useMemo(() => {
    const chapters = new Set<string>();
    for (const q of questions) {
      const c = q.chapter?.trim();
      if (c) chapters.add(c);
    }
    return Array.from(chapters).sort((a, b) => a.localeCompare(b));
  }, [questions]);

  useEffect(() => {
    setQVisibleCount(20);
    setQLoadingMore(false);
  }, [questions, qSearch, qChapter, qSort]);

  const visibleQuestions = useMemo(() => {
    const term = qSearch.trim().toLowerCase();
    let list = questions;
    if (term) {
      list = list.filter(
        (q) =>
          q.prompt.toLowerCase().includes(term) ||
          q.options.some((o) => o.text.toLowerCase().includes(term)) ||
          (q.chapter ?? "").toLowerCase().includes(term)
      );
    }
    if (qChapter !== "all") {
      list = list.filter((q) => (q.chapter?.trim() || "Uncategorized") === qChapter);
    }
    const sorted = [...list];
    switch (qSort) {
      case "chapter":
        sorted.sort((a, b) => (a.chapter ?? "").localeCompare(b.chapter ?? ""));
        break;
      case "type":
        sorted.sort((a, b) => a.type.localeCompare(b.type));
        break;
      case "marks":
        sorted.sort((a, b) => b.marks - a.marks);
        break;
      case "newest":
      default:
        sorted.sort((a, b) => {
          const ta = (a.createdAt as { seconds?: number } | undefined)?.seconds ?? 0;
          const tb = (b.createdAt as { seconds?: number } | undefined)?.seconds ?? 0;
          return tb - ta;
        });
        break;
    }
    return sorted;
  }, [questions, qSearch, qChapter, qSort]);
  const pagedQuestions = visibleQuestions.slice(0, qVisibleCount);
  const qHasMore = qVisibleCount < visibleQuestions.length;

  useEffect(() => {
    const el = qSentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        if (!qHasMore || qLoadingMore) return;
        setQLoadingMore(true);
        window.setTimeout(() => {
          setQVisibleCount((c) => c + 20);
          setQLoadingMore(false);
        }, 420);
      },
      { rootMargin: "400px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [qHasMore, qLoadingMore, pagedQuestions.length]);


  if (checking || !authed) {
    return (
      <div className="ad-guard">
        Checking session…
    </div>
  );
}

  return (
    <div className="ad-root">

      <aside className="ad-side">
        <div className="ad-brand">
          <Image src="/logo.png" alt="" width={30} height={30} className="ad-brand-logo" priority />
          <span className="ad-brand-text">World of <span className="hl">Physics</span></span>
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
        {stats && (
          <div className="ad-stats-card">
            <div className="ad-stats-row">
              <span className="ad-stats-label">Visitors</span>
              <span className="ad-stats-value">{stats.totalVisitors}</span>
            </div>
            <div className="ad-stats-row">
              <span className="ad-stats-label">Online</span>
              <span className="ad-stats-value">{stats.onlineUsers}</span>
            </div>
          </div>
        )}
        <button className="ad-signout" onClick={handleSignOut} title="Sign out">
          <span className="ad-nav-icon"><NavIcon name="signout" /></span>
          <span className="ad-nav-label">Sign out</span>
        </button>
        <button className="ad-signout--secondary" onClick={() => router.push("/")} title="Back to website">
          <span className="ad-nav-icon"><NavIcon name="globe" /></span>
          <span className="ad-nav-label">Back to website</span>
        </button>
      </aside>

      <main className="ad-main">
        {active === "notices" && (
          <NoticesPanel onNavigateTab={(tab) => setActive(tab)} />
        )}

        {active === "questions" && (
          <>
            <div className="ad-head">
              <h1 className="ad-title">All <span className="hl">Questions</span></h1>
              <span className="ad-count">
                {`Showing ${pagedQuestions.length} of ${visibleQuestions.length}`}
              </span>
            </div>

            <div className="ad-q-toolbar">
              <div className="ad-q-search">
                <input
                  type="text"
                  value={qSearch}
                  placeholder="Search questions, options or chapters…"
                  onChange={(e) => setQSearch(e.target.value)}
                  aria-label="Search questions"
                />
              </div>
              <div className="ad-q-select">
                <select value={qChapter} onChange={(e) => setQChapter(e.target.value)} aria-label="Filter by chapter">
                  <option value="all">All chapters</option>
                  {questionChapters.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  <option value="Uncategorized">Uncategorized</option>
                </select>
              </div>
              <div className="ad-q-select">
                <select value={qSort} onChange={(e) => setQSort(e.target.value)} aria-label="Sort questions">
                  <option value="newest">Newest first</option>
                  <option value="chapter">Sort by chapter</option>
                  <option value="type">Sort by type</option>
                  <option value="marks">Highest marks</option>
                </select>
              </div>
              {(qSearch || qChapter !== "all") && (
                <button
                  type="button"
                  className="ad-q-clear"
                  onClick={() => {
                    setQSearch("");
                    setQChapter("all");
                  }}
                >
                  Clear
                </button>
              )}
            </div>

            {loadingQuestions && <div className="ad-empty">Loading questions…</div>}

            {!loadingQuestions && questions.length === 0 && (
              <div className="ad-empty">
                No questions yet. Tap <strong>+</strong> to add your first one.
              </div>
            )}

            {!loadingQuestions && questions.length > 0 && visibleQuestions.length === 0 && (
              <div className="ad-empty">No questions match your filters.</div>
            )}

            {pagedQuestions.map((q) => (
              <div className="ad-q" key={q.id}>
                <div className="ad-q-top">
                  <span className="ad-q-type">{q.type === "mcq" ? "MCQ · Multi" : "Single Correct"}</span>
                  <span className="ad-q-top-right">
                    {q.chapter && <span className="ad-q-chapter">{q.chapter}</span>}
                    <button
                      type="button"
                      className="ad-q-edit"
                      onClick={() => router.push(`/admin/questions/${q.id}/edit`)}
                      aria-label="Edit question"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="ad-q-gen"
                      onClick={() => generateExplanation(q)}
                      aria-label="Generate explanation"
                    >
                      <span className="spark"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7L12 2z" /></svg></span> Generate
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
                      <span className="ad-opt-text">
                        <MathPreview text={o.text} compact />
                        {o.imageUrl && (
                          <img className="ad-opt-view" src={o.imageUrl} alt={`option ${String.fromCharCode(65 + i)}`} />
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {qLoadingMore && (
              <>
                {[0, 1].map((i) => (
                  <div className="ad-q-skeleton" key={`skel-${i}`} aria-hidden="true">
                    <div className="ad-skel-row">
                      <div className="ad-skel-line w40" />
                      <div className="ad-skel-line w20" />
                    </div>
                    <div className="ad-skel-line w80" />
                    <div className="ad-skel-line w60" />
                    <div className="ad-skel-opts">
                      <div className="ad-skel-line pill" />
                      <div className="ad-skel-line pill" />
                      <div className="ad-skel-line pill" />
                    </div>
                  </div>
                ))}
              </>
            )}

            <div ref={qSentinelRef} aria-hidden="true" style={{ height: 1 }} />

            {!qHasMore && visibleQuestions.length > 20 && (
              <div className="ad-list-end">— End of the list —</div>
            )}
          </>
        )}

        {active === "settings" && (
          <>
            <div className="ad-head">
              <h1 className="ad-title">AI <span className="hl">Settings</span></h1>
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
            onToggleStop={toggleStopExam}
            onShowResults={(exam) =>
              router.push(`/admin/results?exam=${encodeURIComponent(exam.code)}`)
            }
          />
        )}

        {active === "students" && (
          <StudentsPanel attemptsMap={attemptsMap} />
        )}

        {active === "information" && <InformationPanel siteInfo={siteInfo} onSaved={setSiteInfo} />}

        {active === "formula-sheets" && <FormulaSheetsPage />}

        {active === "coupons" && <CouponsPanel />}

        {active !== "notices" && active !== "questions" && active !== "settings" && active !== "exams" && active !== "students" && active !== "information" && active !== "formula-sheets" && active !== "coupons" && (
          <div className="ad-head">
            <h1 className="ad-title">{NAV.find((n) => n.key === active)?.label}</h1>
            <span className="ad-count">coming soon</span>
          </div>
        )}
      </main>

      {active === "questions" && (
        <button className="ad-fab" onClick={() => router.push("/admin/questions/new")} aria-label="Add question">
          <span className="plus">+</span> New Question
        </button>
      )}

      {active === "exams" && (
        <button className="ad-fab" onClick={() => router.push("/admin/exams/new")} aria-label="New exam">
          <span className="plus">+</span> New Exam
        </button>
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
          onSave={async (questionIds, marksMap, negativeMap) => {
            await setExamQuestions(addQuestionsExam.id, questionIds, marksMap, negativeMap);
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

      <ConfirmDialog
        open={pendingConfirm !== null}
        title={pendingConfirm?.title ?? ""}
        description={pendingConfirm?.description ?? ""}
        confirmLabel={pendingConfirm?.confirmLabel}
        danger={pendingConfirm?.danger}
        onCancel={() => setPendingConfirm(null)}
        onConfirm={() => {
          const action = pendingConfirm?.action;
          setPendingConfirm(null);
          action?.();
        }}
      />
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
            <span className="ad-vec-arrow">→</span>
            <span className="ad-vec-body">{parseMath(body, keyBase + "v")}</span>
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
        <h2 className="ad-set-card-title">Google <span className="hl">Gemini</span></h2>
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
          <h2 className="ad-set-card-title">AI <span className="hl">Model</span></h2>
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
    const ok = await copyText(shareText);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
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
        <h3 className="ad-form-title">AI <span className="hl">Explanation</span></h3>
        <div className="ad-q-prompt" style={{ marginBottom: 18 }}>
          <MathPreview text={q.prompt} compact />
        </div>
        {loading && (
          <div className="ad-explain-body" style={{ color: "var(--color-muted)" }}>
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
              <span className="ad-share-ico">{copied ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" /></svg> : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>}</span>
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
  completed: { label: "Completed", cls: "tint-neutral" },
  scheduled: { label: "Scheduled", cls: "tint-cyan" },
  draft: { label: "Live", cls: "tint-mint" },
  stopped: { label: "Stopped", cls: "tint-danger" },
};

/** Icon set for the exams panel — single stroke voice, matches NavIcon. */
function ExamIcon({ name, size = 16 }: { name: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  switch (name) {
    case "chart":
      return <svg {...common}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>;
    case "edit":
      return <svg {...common}><path d="M14.5 5.5l4 4L8 20H4v-4l10.5-10.5z" /><path d="M12.5 7.5l4 4" /></svg>;
    case "eye":
      return <svg {...common}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>;
    case "stack":
      return <svg {...common}><path d="M6 3h9l4 4v14H6z" /><path d="M9 10h6M9 14h6" /></svg>;
    case "link":
      return <svg {...common}><path d="M10 13a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1L11.4 4.5" /><path d="M14 11a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7.1 7.1l1.6-1.6" /></svg>;
    case "code":
      return <svg {...common}><path d="M8 8l-4 4 4 4M16 8l4 4-4 4" /></svg>;
    case "trash":
      return <svg {...common}><path d="M4 7h16" /><path d="M9 7V5h6v2" /><path d="M6 7l1.3 14h9.4L18 7" /><path d="M10.5 11v6M13.5 11v6" /></svg>;
    case "search":
      return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.8-3.8" /></svg>;
    case "list":
      return <svg {...common}><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" strokeWidth={2.4} /></svg>;
    case "grid":
      return <svg {...common}><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></svg>;
    case "bookmark":
      return <svg {...common}><path d="M7 3h10v18l-5-4-5 4z" /></svg>;
    case "bookmark-fill":
      return <svg {...common} fill="currentColor"><path d="M7 3h10v18l-5-4-5 4z" /></svg>;
    case "alert":
      return <svg {...common}><path d="M12 8v5" /><path d="M12 16.5h.01" /><path d="M10.3 3.9L2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>;
    case "check":
      return <svg {...common}><path d="M4 12.5l5 5L20 6.5" /></svg>;
    case "chevron":
      return <svg {...common}><path d="M6 9l6 6 6-6" /></svg>;
    case "file":
      return <svg {...common}><path d="M6 3h9l4 4v14H6z" /><path d="M9 8h5M9 12h5M9 16h5" /></svg>;
    default:
      return null;
  }
}

function PinButton({ questionId, pinned, onToggle }: { questionId: string; pinned: boolean; onToggle: (id: string) => void }) {
  return (
    <button
      type="button"
      className={`ad-pin${pinned ? " on" : ""}`}
      onClick={() => onToggle(questionId)}
      aria-pressed={pinned}
      title={pinned ? "Unpin" : "Pin for later review"}
      aria-label={pinned ? "Unpin question" : "Pin question for later review"}
    >
      <ExamIcon name={pinned ? "bookmark-fill" : "bookmark"} size={15} />
    </button>
  );
}

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
  onToggleStop,
  onShowResults,
}: {
  exams: AdminExam[];
  questionMap: Record<string, string[]>;
  attemptsMap: Record<string, ExamAttemptSummary>;
  bank: Question[];
  onDelete: (id: string) => void;
  onEdit: (exam: AdminExam) => void;
  onManageQuestions: (exam: AdminExam) => void;
  onCopyLink: (exam: AdminExam) => Promise<boolean> | boolean;
  onCopyCode: (exam: AdminExam) => Promise<boolean> | boolean;
  onToggleStop: (exam: AdminExam) => void;
  onShowResults: (exam: AdminExam) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tab, setTab] = useState<Record<string, "questions" | "analytics" | "attempts" | "settings">>({});
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [openAttempts, setOpenAttempts] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | AdminExam["status"]>("all");
  const [view, setView] = useState<"list" | "grid">("list");
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem("examsite.pinned-questions");
      if (raw) setPinned(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* session storage unavailable — pins live in memory only */
    }
  }, []);
  const [collapsedQ, setCollapsedQ] = useState(false);

  const togglePin = (id: string) => {
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        window.sessionStorage.setItem("examsite.pinned-questions", JSON.stringify([...next]));
      } catch {
        /* session storage unavailable — pin lives in state only */
      }
      return next;
    });
  };

  const bankById = useMemo(() => {
    const m = new Map<string, Question>();
    for (const q of bank) m.set(q.id, q);
    return m;
  }, [bank]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exams.filter((exam) => {
      if (filter !== "all" && exam.status !== filter) return false;
      if (!q) return true;
      return (
        exam.title.toLowerCase().includes(q) ||
        exam.subject.toLowerCase().includes(q) ||
        exam.code.toLowerCase().includes(q) ||
        exam.takenOn.toLowerCase().includes(q)
      );
    });
  }, [exams, query, filter]);

  const counts = useMemo(() => {
    const c = { all: exams.length, draft: 0, scheduled: 0, stopped: 0, completed: 0 };
    for (const e of exams) c[e.status] += 1;
    return c;
  }, [exams]);

  const questionsFor = (examId: string): Question[] => {
    const ids = questionMap[examId] ?? [];
    return ids
      .map((id) => bankById.get(id))
      .filter((q): q is Question => Boolean(q));
  };

  const statsFor = (examId: string) => {
    const summary = attemptsMap[examId];
    const attempts = summary?.attempts ?? [];
    if (attempts.length === 0) return { attempts: 0, avg: 0, best: 0, low: 0 };
    const pcts = attempts.map((a) => (a.total > 0 ? (a.score / a.total) * 100 : 0));
    const avg = Math.round((pcts.reduce((s, p) => s + p, 0) / pcts.length) * 10) / 10;
    return { attempts: pcts.length, avg, best: Math.round(Math.max(...pcts)), low: Math.round(Math.min(...pcts)) };
  };

  const [copyFailLinkId, setCopyFailLinkId] = useState<string | null>(null);
  const [copyFailCodeId, setCopyFailCodeId] = useState<string | null>(null);

  const handleCopyLink = async (exam: AdminExam) => {
    const ok = await onCopyLink(exam);
    if (ok) {
      setCopiedLinkId(exam.id);
      setTimeout(() => setCopiedLinkId((c) => (c === exam.id ? null : c)), 1600);
    } else {
      setCopyFailLinkId(exam.id);
      setTimeout(() => setCopyFailLinkId((c) => (c === exam.id ? null : c)), 1600);
    }
  };
  const handleCopyCode = async (exam: AdminExam) => {
    const ok = await onCopyCode(exam);
    if (ok) {
      setCopiedCodeId(exam.id);
      setTimeout(() => setCopiedCodeId((c) => (c === exam.id ? null : c)), 1600);
    } else {
      setCopyFailCodeId(exam.id);
      setTimeout(() => setCopyFailCodeId((c) => (c === exam.id ? null : c)), 1600);
    }
  };

  const filterPills: Array<{ key: "all" | AdminExam["status"]; label: string }> = [
    { key: "all", label: "All" },
    { key: "draft", label: "Live" },
    { key: "scheduled", label: "Scheduled" },
    { key: "stopped", label: "Stopped" },
    { key: "completed", label: "Completed" },
  ];

  return (
    <>
      <div className="ad-head">
        <div>
          <h1 className="ad-title">All <span className="hl">Exams</span></h1>
          <p className="ad-subhead">Create, manage and take exams.</p>
        </div>
        <span className="ad-count ad-total"><ExamIcon name="file" size={13} /> {exams.length} TOTAL</span>
      </div>

      <div className="ad-exam-toolbar">
        <label className="ad-search">
          <ExamIcon name="search" size={15} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exams…"
            aria-label="Search exams"
          />
        </label>
        <div className="ad-pills" role="tablist" aria-label="Filter by status">
          {filterPills.map((p) => (
            <button
              key={p.key}
              role="tab"
              aria-selected={filter === p.key}
              className={`ad-pill${filter === p.key ? " active" : ""}`}
              onClick={() => setFilter(p.key)}
            >
              {p.label}
              <span className="ad-pill-count">{counts[p.key]}</span>
            </button>
          ))}
        </div>
        <div className="ad-segview" aria-label="View">
          <button
            className={`ad-segview-btn${view === "list" ? " active" : ""}`}
            onClick={() => setView("list")}
            aria-pressed={view === "list"}
            title="List view"
            aria-label="List view"
          >
            <ExamIcon name="list" size={15} />
          </button>
          <button
            className={`ad-segview-btn${view === "grid" ? " active" : ""}`}
            onClick={() => setView("grid")}
            aria-pressed={view === "grid"}
            title="Grid view"
            aria-label="Grid view"
          >
            <ExamIcon name="grid" size={15} />
          </button>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="ad-empty">
          {exams.length === 0
            ? "No exams yet. Tap “+ New Exam” to create your first one."
            : "No exams match that search."}
        </div>
      )}

      <div className={`ad-exam-list${view === "grid" ? " grid" : ""}`}>
        {filtered.map((exam) => {
          const taken = parseTakenOn(exam.takenOn);
          const liveNow = exam.status === "scheduled" && taken !== null && Date.now() >= taken.getTime();
          const meta = liveNow ? { label: "Live", cls: "tint-mint" } : EXAM_STATUS_META[exam.status] ?? EXAM_STATUS_META.draft;
          const qIds = questionMap[exam.id] ?? [];
          const count = qIds.length;
          const summary = attemptsMap[exam.id];
          const attempts = summary?.attempts ?? [];
          const stats = statsFor(exam.id);
          const isOpen = expanded === exam.id;
          const activeTab = tab[exam.id] ?? "questions";
          const questions = isOpen && activeTab === "questions" ? questionsFor(exam.id) : [];
          const setActiveTab = (t: typeof activeTab) =>
            setTab((prev) => ({ ...prev, [exam.id]: t }));
          return (
            <div className={`ad-exam-row${isOpen ? " open" : ""}`} key={exam.id}>
              <div className="ad-exam-main">
                <button
                  className="ad-exam-caret"
                  onClick={() => setExpanded(isOpen ? null : exam.id)}
                  aria-label={isOpen ? "Collapse exam" : "Expand exam"}
                  aria-expanded={isOpen}
                >
                  <ExamIcon name="chevron" size={14} />
                </button>
                <div className="ad-exam-fileicon" aria-hidden="true">
                  <ExamIcon name="file" size={22} />
                </div>
                <div className="ad-exam-body">
                  <div className="ad-exam-top">
                    <span className="ad-exam-title">{exam.title}</span>
                    <code className="ad-exam-codechip">{exam.code}</code>
                    <span className={`ad-status-chip ${meta.cls}`}>{meta.label}</span>
                  </div>
                  <div className="ad-exam-meta">
                    <span>{exam.subject}</span>
                    <span>·</span>
                    <span>{exam.duration}</span>
                    <span>·</span>
                    <span>{exam.status === "draft" ? "Not published" : `Taken ${formatTakenOn(exam.takenOn)}`}</span>
                  </div>
                  <div className="ad-exam-chips">
                    <span className="ad-chip"><ExamIcon name="file" size={12} /><strong>{count}</strong> Questions</span>
                    <span className="ad-chip"><strong>{stats.attempts}</strong> Attempted</span>
                    <span className="ad-chip"><strong>{stats.attempts ? `${stats.avg}%` : "—"}</strong> Avg</span>
                  </div>
                </div>
              </div>
              <div className="ad-icon-actions" role="group" aria-label="Exam actions">
                <button className="ad-icon-btn" onClick={() => onShowResults(exam)} title="Open results" aria-label="Open results">
                  <ExamIcon name="chart" size={16} />
                </button>
                <button className="ad-icon-btn" onClick={() => onEdit(exam)} title="Edit exam" aria-label="Edit exam">
                  <ExamIcon name="edit" size={16} />
                </button>
                <a className="ad-icon-btn" href={`/exam?id=${encodeURIComponent(exam.code)}`} target="_blank" rel="noopener noreferrer" title="Preview as student" aria-label="Preview as student">
                  <ExamIcon name="eye" size={16} />
                </a>
                <button className="ad-icon-btn" onClick={() => onManageQuestions(exam)} title={count ? "Manage questions" : "Add questions"} aria-label={count ? "Manage questions" : "Add questions"}>
                  <ExamIcon name="stack" size={16} />
                </button>
                <button className="ad-icon-btn" onClick={() => handleCopyLink(exam)} title={copiedLinkId === exam.id ? "Copied!" : copyFailLinkId === exam.id ? "Couldn't copy — select the code and copy manually" : "Copy link"} aria-label="Copy exam link">
                  <ExamIcon name={copiedLinkId === exam.id ? "check" : copyFailLinkId === exam.id ? "alert" : "link"} size={16} />
                </button>
                <button className="ad-icon-btn" onClick={() => handleCopyCode(exam)} title={copiedCodeId === exam.id ? "Copied!" : copyFailCodeId === exam.id ? "Couldn't copy — select the code and copy manually" : "Copy code"} aria-label="Copy exam code">
                  <ExamIcon name={copiedCodeId === exam.id ? "check" : copyFailCodeId === exam.id ? "alert" : "code"} size={16} />
                </button>
                <button className="ad-icon-btn danger" onClick={() => onDelete(exam.id)} title="Delete exam" aria-label={`Delete ${exam.title}`}>
                  <ExamIcon name="trash" size={16} />
                </button>
              </div>

              {isOpen && (
                <div className="ad-exam-detail">
                  <div className="ad-exam-tabsbar">
                    <div className="ad-tabs" role="tablist" aria-label="Exam detail tabs">
                      <button role="tab" aria-selected={activeTab === "questions"} className={`ad-tab${activeTab === "questions" ? " active" : ""}`} onClick={() => setActiveTab("questions")}>
                        Questions <span className="ad-tab-count">{count}</span>
                      </button>
                      <button role="tab" aria-selected={activeTab === "analytics"} className={`ad-tab${activeTab === "analytics" ? " active" : ""}`} onClick={() => setActiveTab("analytics")}>
                        <ExamIcon name="chart" size={13} /> Analytics
                      </button>
                      <button role="tab" aria-selected={activeTab === "attempts"} className={`ad-tab${activeTab === "attempts" ? " active" : ""}`} onClick={() => setActiveTab("attempts")}>
                        Attempts <span className="ad-tab-count">{attempts.length}</span>
                      </button>
                      <button role="tab" aria-selected={activeTab === "settings"} className={`ad-tab${activeTab === "settings" ? " active" : ""}`} onClick={() => setActiveTab("settings")}>
                        Settings
                      </button>
                    </div>
                    {activeTab === "questions" && (
                      <button className="ad-expandall" onClick={() => setCollapsedQ((v) => !v)} aria-pressed={!collapsedQ}>
                        {collapsedQ ? "Expand all" : "Collapse all"}
                        <ExamIcon name="chevron" size={12} />
                      </button>
                    )}
                  </div>

                  {activeTab === "questions" && (
                    questions.length === 0 ? (
                      <div className="ad-empty small">
                        No questions added yet. Use the <strong>stack</strong> button above to add questions.
                      </div>
                    ) : (
                      <ol className="ad-qrows">
                        {questions.map((q, i) => {
                          const correctIdx = q.options.findIndex((o) => o.correct);
                          const keys = ["A", "B", "C", "D", "E", "F", "G", "H"];
                          return (
                            <li className="ad-qrow" key={q.id}>
                              <div className="ad-qrow-num">{String(i + 1).padStart(2, "0")}</div>
                              <div className="ad-qrow-body">
                                <div className="ad-qrow-head">
                                  <span className="ad-qrow-tags">
                                    {q.chapter && <span>{q.chapter}</span>}
                                    <span>{q.marks} MARKS{q.negative ? ` · −${q.negative} NEG` : ""}</span>
                                  </span>
                                  <PinButton questionId={q.id} pinned={pinned.has(q.id)} onToggle={togglePin} />
                                </div>
                                <div className="ad-qrow-prompt">
                                  <MathPreview text={q.prompt} compact />
                                </div>
                                {!collapsedQ && (
                                  <div className="ad-qrow-opts">
                                    {q.options.map((o, oi) => (
                                      <span key={o.id} className={`ad-optpill${oi === correctIdx ? " correct" : ""}`}>
                                        <i>{keys[oi]}</i>
                                        <span><MathPreview text={o.text} compact /></span>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    )
                  )}

                  {activeTab === "analytics" && (
                    <div className="ad-ana">
                      <div className="ad-ana-grid">
                        <div className="ad-ana-cell"><strong className="tnum">{stats.attempts}</strong><span>Attempts</span></div>
                        <div className="ad-ana-cell"><strong className="tnum">{stats.attempts ? `${stats.avg}%` : "—"}</strong><span>Average</span></div>
                        <div className="ad-ana-cell ok"><strong className="tnum">{stats.attempts ? `${stats.best}%` : "—"}</strong><span>Best</span></div>
                        <div className="ad-ana-cell bad"><strong className="tnum">{stats.attempts ? `${stats.low}%` : "—"}</strong><span>Lowest</span></div>
                      </div>
                      <p className="ad-ana-note">Per-attempt detail lives in the <button className="ad-inline-link" onClick={() => setActiveTab("attempts")}>Attempts</button> tab.</p>
                    </div>
                  )}

                  {activeTab === "attempts" && (
                    <ExamAttempts
                      attempts={attempts}
                      bankById={bankById}
                      openAttempts={openAttempts}
                      setOpenAttempts={setOpenAttempts}
                    />
                  )}

                  {activeTab === "settings" && (
                    <div className="ad-settings-list">
                      <div className="ad-settings-row">
                        <div>
                          <div className="ad-settings-title">{exam.status === "stopped" ? "Start exam" : "Stop exam"}</div>
                          <div className="ad-settings-desc">{exam.status === "stopped" ? "Make the exam link work again for students." : "Disable the exam link — students can no longer join."}</div>
                        </div>
                        <button className={`ad-set-btn ${exam.status === "stopped" ? "" : "ghost danger-text"}`} onClick={() => onToggleStop(exam)}>
                          {exam.status === "stopped" ? "Start" : "Stop"}
                        </button>
                      </div>
                      <div className="ad-settings-row">
                        <div>
                          <div className="ad-settings-title">Edit exam</div>
                          <div className="ad-settings-desc">Title, subject, duration, schedule, marks.</div>
                        </div>
                        <button className="ad-set-btn ghost" onClick={() => onEdit(exam)}>Edit</button>
                      </div>
                      <div className="ad-settings-row danger-zone">
                        <div>
                          <div className="ad-settings-title">Delete this exam</div>
                          <div className="ad-settings-desc">Removes the exam and its attempts. Question bank stays intact.</div>
                        </div>
                        <button className="ad-exam-btn danger" onClick={() => onDelete(exam.id)}>Delete</button>
                      </div>
                    </div>
                  )}
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
        <h1 className="ad-title">Student <span className="hl">Analysis</span></h1>
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
        <h1 className="ad-title">Site <span className="hl">Information</span></h1>
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
          <span className="ad-saved">{saved ? (<span style={{ display: "inline-flex", alignItems: "center", gap: "0.35em" }}>Saved <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" /></svg></span>) : ""}</span>
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
                  <span className="ad-atag ok" style={{display:"inline-flex",alignItems:"center",gap:"0.3em"}}>{a.correct}<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" /></svg></span>
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
    exam && exam.takenOn !== "—" ? toIsoLocal(exam.takenOn) : ""
  );

  const today = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
  const resolvedDate = status === "draft" ? "—" : takenOn || todayIsoLocal();

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
        <h3 className="ad-form-title">{exam ? "Edit" : "New"} <span className="hl">Exam</span></h3>
        <p className="ad-modal-sub">
          {exam
            ? "Update this exam. Changes are saved to Firestore immediately."
            : "Set up a new exam. Students can join right away with the exam code."}
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
    const ok = await copyText(value);
    if (ok) {
      setCopied(which);
      setTimeout(() => setCopied(null), 1800);
    }
  };

  return (
    <div className="ad-overlay" onClick={onClose}>
      <div className="ad-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <button className="ad-close" onClick={onClose} aria-label="Close">×</button>
        <h3 className="ad-form-title">Exam <span className="hl">Created</span></h3>
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
              <span className="ad-share-ico">{copied === "code" ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" /></svg> : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>}</span>
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
              <span className="ad-share-ico">{copied === "link" ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" /></svg> : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>}</span>
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
  onSave: (
    questionIds: string[],
    marksMap: Record<string, number>,
    negativeMap: Record<string, number>
  ) => void;
}) {
  const [mode, setMode] = useState<"chapter" | "choose">("chapter");
  const [selectedChapters, setSelectedChapters] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialIds));
  const [marksMap, setMarksMap] = useState<Record<string, number>>({});
  const [negativeMap, setNegativeMap] = useState<Record<string, number>>({});
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
      if (next.has(chapter)) {
        next.delete(chapter);
        setMarksMap((m) => {
          const n = { ...m };
          for (const qid of chapterQuestionIds(chapter)) {
            if (!selectedIds.has(qid)) delete n[qid];
          }
          return n;
        });
        setNegativeMap((m) => {
          const n = { ...m };
          for (const qid of chapterQuestionIds(chapter)) {
            if (!selectedIds.has(qid)) delete n[qid];
          }
          return n;
        });
      } else {
        next.add(chapter);
        setMarksMap((m) => {
          const n = { ...m };
          for (const qid of chapterQuestionIds(chapter)) if (n[qid] == null) n[qid] = 4;
          return n;
        });
        setNegativeMap((m) => {
          const n = { ...m };
          for (const qid of chapterQuestionIds(chapter)) if (n[qid] == null) n[qid] = 0;
          return n;
        });
      }
      return next;
    });
  };

  const toggleQuestion = (id: string) => {
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
        <h3 className="ad-form-title">Add Questions to <span className="hl">{exam.title}</span></h3>
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
                  <span className="ad-chapter-check">{on ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" /></svg> : null}</span>
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
                    <span className="ad-chapter-check">{on ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" /></svg> : null}</span>
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

        {finalIds.length > 0 && (
          <div className="ad-qmarks-box">
            <div className="ad-qmarks-head">Set marks for this exam</div>
            <div className="ad-qmarks-list">
              {finalIds.map((id, i) => {
                const q = questions.find((x) => x.id === id);
                return (
                  <div className="ad-qmarks-row" key={id}>
                    <span className="ad-qmarks-num">{i + 1}</span>
                    <span className="ad-qmarks-prompt">
                      {q ? <MathPreview text={q.prompt} compact /> : "…"}
                    </span>
                    <label className="ad-qmarks-input">
                      <span>Marks</span>
                      <input
                        type="number"
                        min={0}
                        value={marksMap[id] ?? 4}
                        onChange={(e) =>
                          setMarksMap((prev) => ({
                            ...prev,
                            [id]: Math.max(0, Number(e.target.value) || 0),
                          }))
                        }
                      />
                    </label>
                    <label className="ad-qmarks-input">
                      <span>Neg.</span>
                      <input
                        type="number"
                        min={0}
                        value={negativeMap[id] ?? 0}
                        onChange={(e) =>
                          setNegativeMap((prev) => ({
                            ...prev,
                            [id]: Math.max(0, Number(e.target.value) || 0),
                          }))
                        }
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="ad-modal-foot">
          <button className="ad-set-btn ghost" onClick={onClose}>Skip for now</button>
          <button
            className="ad-submit ad-submit-inline"
            onClick={() => onSave(finalIds, marksMap, negativeMap)}
          >
            {finalIds.length ? `Save ${finalIds.length} Question${finalIds.length === 1 ? "" : "s"}` : "Save Exam"}
          </button>
        </div>
      </div>
    </div>
  );
}
