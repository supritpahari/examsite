"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthState } from "@/lib/firebase/client";
import { fetchExamByCode, type Exam } from "@/lib/exams";
import { fetchAttemptsByExam, type Attempt } from "@/lib/attempts";

const STATUS_LABEL: Record<string, string> = {
  completed: "Completed",
  scheduled: "Scheduled",
  draft: "Draft",
};

function AdminExamResults() {
  const params = useSearchParams();
  const code = params.get("exam") ?? "";
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [exam, setExam] = useState<Exam | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [error, setError] = useState<string | null>(null);

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
        if (!code) {
          setError("No exam was specified. Open this page from the Exams section of the admin panel.");
        } else {
          const found = await fetchExamByCode(code);
          if (!active) return;
          if (!found) {
            setError(`No exam found with code “${code}”.`);
          } else {
            setExam(found);
            const list = await fetchAttemptsByExam(found.id);
            if (!active) return;
            list.sort(
              (a, b) => b.score - a.score || a.submittedAt - b.submittedAt
            );
            setAttempts(list);
          }
        }
      } catch {
        if (active) setError("Could not load results for this exam. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [checking, code]);

  const stats = useMemo(() => {
    if (attempts.length === 0) {
      return { count: 0, avgPct: 0, topPct: 0, lowPct: 0, topName: "" };
    }
    const pcts = attempts.map((a) =>
      a.total > 0 ? (a.score / a.total) * 100 : 0
    );
    const avgPct =
      Math.round((pcts.reduce((s, p) => s + p, 0) / pcts.length) * 10) / 10;
    let topIdx = 0;
    let lowIdx = 0;
    pcts.forEach((p, i) => {
      if (p > pcts[topIdx]) topIdx = i;
      if (p < pcts[lowIdx]) lowIdx = i;
    });
    return {
      count: attempts.length,
      avgPct,
      topPct: Math.round(pcts[topIdx]),
      lowPct: Math.round(pcts[lowIdx]),
      topName: attempts[topIdx].studentName,
    };
  }, [attempts]);

  const openStudent = (name: string) => {
    router.push(
      `/admin/students?name=${encodeURIComponent(name.trim())}&exam=${encodeURIComponent(code)}`
    );
  };

  if (checking) {
    return (
      <div className="adr-root">
        <style>{CSS}</style>
        <div className="adr-center">Checking session…</div>
      </div>
    );
  }

  return (
    <div className="adr-root">
      <style>{CSS}</style>
      <main className="adr-main">
        <div className="adr-topbar">
          <Link href="/admin" className="adr-back">← Admin panel</Link>
          <span className="adr-mono">Admin · Results</span>
        </div>

        {loading && <div className="adr-center">Loading results…</div>}

        {!loading && error && (
          <div className="adr-card">
            <h1 className="adr-title">Results <em>unavailable</em></h1>
            <p className="adr-sub">{error}</p>
            <Link href="/admin" className="adr-btn">Back to admin panel →</Link>
          </div>
        )}

        {!loading && !error && exam && (
          <>
            <div className="adr-head">
              <div>
                <h1 className="adr-title">Exam <em>Results</em></h1>
                <div className="adr-meta">
                  <span className="adr-exam-name">{exam.title}</span>
                  <span>·</span>
                  <span>{exam.subject}</span>
                  <span>·</span>
                  <span>{exam.duration}</span>
                  <span>·</span>
                  <span>{STATUS_LABEL[exam.status] ?? exam.status}</span>
                  {exam.status !== "draft" && (
                    <>
                      <span>·</span>
                      <span>{exam.takenOn}</span>
                    </>
                  )}
                </div>
              </div>
              <code className="adr-code">{exam.code}</code>
            </div>

            <div className="adr-stats">
              <div className="adr-stat">
                <strong>{stats.count}</strong>
                <span>Students attempted</span>
              </div>
              <div className="adr-stat">
                <strong>{stats.avgPct}%</strong>
                <span>Class average</span>
              </div>
              <div className="adr-stat hi">
                <strong>{stats.topPct}%</strong>
                <span>Highest{stats.topName ? ` · ${stats.topName}` : ""}</span>
              </div>
              <div className="adr-stat lo">
                <strong>{stats.lowPct}%</strong>
                <span>Lowest</span>
              </div>
            </div>

            {attempts.length === 0 ? (
              <div className="adr-empty">
                No students have attempted this exam yet. Share the exam code
                “{exam.code}” with your class.
              </div>
            ) : (
              <>
                <div className="adr-mono adr-list-head">
                  Ranked by score · click a student for full analysis
                </div>
                <div className="adr-list">
                  {attempts.map((a, i) => {
                    const pct = a.total > 0 ? Math.round((a.score / a.total) * 100) : 0;
                    const when = a.submittedAt
                      ? new Date(a.submittedAt).toLocaleString()
                      : "—";
                    return (
                      <button
                        key={a.id}
                        className="adr-row"
                        onClick={() => openStudent(a.studentName)}
                      >
                        <span className="adr-rank">#{i + 1}</span>
                        <span className="adr-name">{a.studentName}</span>
                        <span className="adr-score">
                          {a.score}
                          <em> / {a.total}</em>
                        </span>
                        <span className="adr-pct">{pct}%</span>
                        <span className="adr-tags">
                          <span className="adr-tag ok">{a.correct}✓</span>
                          <span className="adr-tag bad">{a.wrong}✗</span>
                          <span className="adr-tag skip">{a.unattempted}–</span>
                        </span>
                        <span className="adr-when">{when}</span>
                        <span className="adr-go">Analysis →</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

const CSS = `
  .adr-root {
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
  .adr-center {
    min-height: 100vh;
    display: grid; place-items: center;
    font-family: 'JetBrains Mono', monospace; font-size: 12px;
    text-transform: uppercase; letter-spacing: 0.16em; color: var(--dim);
  }
  .adr-main { max-width: 980px; margin: 0 auto; padding: 30px 24px 64px; }
  .adr-topbar {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 30px; gap: 12px; flex-wrap: wrap;
  }
  .adr-back {
    font-family: 'JetBrains Mono', monospace; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--ink-2); text-decoration: none;
    border: 1px solid var(--rule); padding: 8px 12px; background: var(--paper);
  }
  .adr-back:hover { color: var(--accent); border-color: var(--accent); }
  .adr-mono {
    font-family: 'JetBrains Mono', monospace; font-size: 10px;
    text-transform: uppercase; letter-spacing: 0.16em; color: var(--dim);
  }
  .adr-head {
    display: flex; justify-content: space-between; align-items: flex-start;
    gap: 18px; flex-wrap: wrap; margin-bottom: 22px;
  }
  .adr-title {
    font-family: 'Instrument Serif', serif; font-size: 42px; line-height: 1;
    letter-spacing: -0.02em; color: var(--ink); margin: 0 0 10px;
  }
  .adr-title em { font-style: italic; color: var(--accent); }
  .adr-meta {
    display: flex; gap: 8px; flex-wrap: wrap;
    font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--dim);
    letter-spacing: 0.04em;
  }
  .adr-meta .adr-exam-name { color: var(--ink); }
  .adr-code {
    font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--accent);
    border: 1px solid var(--rule); background: var(--paper-2); padding: 8px 12px;
    white-space: nowrap;
  }
  .adr-stats {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 26px;
  }
  .adr-stat {
    border: 1px solid var(--rule); background: var(--paper-2);
    padding: 14px 12px; text-align: center;
  }
  .adr-stat strong {
    display: block; font-family: 'Instrument Serif', serif; font-size: 30px;
    color: var(--ink); line-height: 1.05;
  }
  .adr-stat span {
    font-family: 'JetBrains Mono', monospace; font-size: 9.5px;
    text-transform: uppercase; letter-spacing: 0.1em; color: var(--dim);
  }
  .adr-stat.hi strong { color: #0f7a3d; }
  .adr-stat.lo strong { color: var(--accent); }
  .adr-list-head { margin-bottom: 10px; }
  .adr-list { display: flex; flex-direction: column; gap: 8px; }
  .adr-row {
    display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
    width: 100%; text-align: left;
    border: 1px solid var(--rule); background: var(--paper);
    padding: 13px 16px; cursor: pointer; font-family: inherit; color: inherit;
    transition: border-color 0.12s ease, background 0.12s ease;
  }
  .adr-row:hover { border-color: var(--accent); background: var(--paper-2); }
  .adr-rank {
    font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--dim);
    width: 34px; flex: 0 0 auto;
  }
  .adr-name {
    font-family: 'Instrument Serif', serif; font-size: 19px; color: var(--ink);
    flex: 1; min-width: 140px;
  }
  .adr-score { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--ink); }
  .adr-score em { font-style: normal; color: var(--dim); font-size: 11px; }
  .adr-pct {
    font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 600;
    color: var(--accent); border: 1px solid var(--rule); padding: 3px 9px;
  }
  .adr-tags { display: flex; gap: 6px; }
  .adr-tag {
    font-family: 'JetBrains Mono', monospace; font-size: 10px; padding: 2px 6px; color: #fff;
  }
  .adr-tag.ok { background: #0f7a3d; }
  .adr-tag.bad { background: var(--accent); }
  .adr-tag.skip { background: #b8ad96; color: #14110d; }
  .adr-when {
    font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--dim);
    letter-spacing: 0.02em;
  }
  .adr-go {
    font-family: 'JetBrains Mono', monospace; font-size: 10px;
    text-transform: uppercase; letter-spacing: 0.1em; color: var(--accent);
    margin-left: auto; flex: 0 0 auto;
  }
  .adr-card, .adr-empty {
    border: 1px dashed var(--rule); background: var(--paper);
    padding: 36px 28px; text-align: center;
    font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--dim);
    letter-spacing: 0.04em; line-height: 1.8;
  }
  .adr-card { border-style: solid; }
  .adr-card .adr-title { font-size: 30px; }
  .adr-sub { font-size: 13px; color: var(--ink-2); margin: 0 0 20px; font-family: 'Inter', sans-serif; letter-spacing: 0; }
  .adr-btn {
    display: inline-block; background: var(--accent); color: #fff;
    border: 1px solid var(--accent); padding: 12px 22px; text-decoration: none;
    font-family: 'JetBrains Mono', monospace; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.08em;
  }
  .adr-btn:hover { background: var(--accent-2); border-color: var(--accent-2); }
  @media (max-width: 720px) {
    .adr-stats { grid-template-columns: 1fr 1fr; }
    .adr-when { flex-basis: 100%; }
  }
`;

export default function AdminResultsPage() {
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
      <AdminExamResults />
    </Suspense>
  );
}
