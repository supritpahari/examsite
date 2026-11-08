/* Hallmark · genre: playful · theme: Hum · macrostructure: Workbench · design-system: design.md · designed-as-app
 * Student account — phone-verified only. Profile (name prefilled into the lobby),
 * purchased formula sheets with re-download, and attempt history. */
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthState, getAuthInstance } from "@/lib/firebase/client";
import PhoneAuth from "../_components/PhoneAuth";
import FormulaMarks from "../_components/FormulaMarks";
import { fetchProfile, saveProfile } from "@/lib/profile";
import { fetchPurchasesByUid, fetchCourseGradesFromApi } from "@/lib/courses";
import { fetchAttemptsByUid, type Attempt } from "@/lib/attempts";
import { fetchExams, type Exam } from "@/lib/exams";
import { signOut, type User } from "firebase/auth";
import Image from "next/image";

type Sheet = { id: string; name: string; grade: string; pdfUrl: string };
type PurchaseRow = {
  purchaseId: string;
  sheet: Sheet | null;
  topicId: string;
  amount: number;
  paidAt: unknown;
};
type HistoryRow = { attempt: Attempt; examTitle: string };

function maskPhone(raw: string | null | undefined): string {
  if (!raw) return "+91 •••• ••••••";
  const digits = raw.replace(/\D/g, "").slice(-10);
  return `+91 ••••• ${digits.slice(-4)}`;
}

function initials(name: string, phone: string | null | undefined): string {
  const trimmed = name.trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] ?? "";
    const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (a + b).toUpperCase();
  }
  return (phone ?? "?").replace(/\D/g, "").slice(-2);
}

function formatDate(value: unknown): string {
  try {
    let d: Date | null = null;
    if (value && typeof value === "object" && "seconds" in (value as Record<string, unknown>)) {
      d = new Date(Number((value as { seconds: number }).seconds) * 1000);
    } else if (typeof value === "number") {
      d = new Date(value);
    } else if (typeof value === "string" || value instanceof Date) {
      d = new Date(value);
    }
    if (!d || isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

const MAX_NAME = 80;

export default function AccountPage() {
  const router = useRouter();
  const [auth, setAuth] = useState<"loading" | "in" | "out">("loading");
  const [user, setUser] = useState<User | null>(null);

  const [profileName, setProfileName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveNote, setSaveNote] = useState<"ok" | "err" | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const [purchases, setPurchases] = useState<PurchaseRow[] | null>(null);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [historyBlocked, setHistoryBlocked] = useState(false);

  useEffect(() => {
    const unsub = onAuthState((u) => {
      const phoneOk = Boolean(u?.providerData?.some((p) => p.providerId === "phone"));
      setUser(u);
      setAuth(phoneOk ? "in" : "out");
    });
    return unsub;
  }, []);

  // Profile
  useEffect(() => {
    if (auth !== "in" || !user) return;
    let active = true;
    fetchProfile(user.uid).then((p) => {
      if (!active) return;
      const n = p?.name ?? "";
      setProfileName(n);
      setNameDraft(n);
      setProfileLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [auth, user]);

  // Purchases joined to the live sheet catalog
  useEffect(() => {
    if (auth !== "in" || !user) return;
    let active = true;
    (async () => {
      try {
        const [mine, catalog] = await Promise.all([
          fetchPurchasesByUid(user.uid),
          fetchCourseGradesFromApi(),
        ]);
        const byTopic = new Map<string, Sheet>();
        for (const g of catalog) {
          for (const t of g.topics) {
            byTopic.set(t.id, { id: t.id, name: t.name, grade: g.name, pdfUrl: t.pdfUrl });
          }
        }
        if (!active) return;
        setPurchases(
          mine
            .map((p) => ({
              purchaseId: p.id,
              sheet: byTopic.get(p.topicId) ?? null,
              topicId: p.topicId,
              amount: p.amount,
              paidAt: p.paidAt,
            }))
            .sort((a, b) => tsOf(b.paidAt) - tsOf(a.paidAt))
        );
      } catch {
        if (active) setPurchases([]); // purchase list is best-effort; never blocks the page
      }
    })();
    return () => {
      active = false;
    };
  }, [auth, user]);

  // Attempt history joined to exams
  useEffect(() => {
    if (auth !== "in" || !user) return;
    let active = true;
    (async () => {
      try {
        const [attempts, exams] = await Promise.all([
          fetchAttemptsByUid(user.uid),
          fetchExams().catch(() => [] as Exam[]),
        ]);
        const titleById = new Map(exams.map((e) => [e.id, e.title]));
        if (!active) return;
        setHistory(
          attempts.slice(0, 30).map((attempt) => ({
            attempt,
            examTitle: titleById.get(attempt.examId) ?? `Exam ${attempt.examCode || attempt.examId.slice(0, 6)}`,
          }))
        );
      } catch {
        if (active) setHistoryBlocked(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [auth, user]);

  const onSaveName = async () => {
    if (!user) return;
    const trimmed = nameDraft.trim().slice(0, MAX_NAME);
    if (!trimmed) {
      setSaveNote("err");
      return;
    }
    setSaving(true);
    setSaveNote(null);
    try {
      await saveProfile(user.uid, trimmed);
      setProfileName(trimmed);
      setSaveNote("ok");
    } catch {
      setSaveNote("err");
    } finally {
      setSaving(false);
    }
  };

  const onSignOut = async () => {
    try {
      await signOut(getAuthInstance());
    } finally {
      router.push("/");
    }
  };

  if (auth === "loading") {
    return (
      <div className="course-guard" role="status">
        Loading…
      </div>
    );
  }
  if (auth === "out") {
    return <PhoneAuth />;
  }

  const phone = user?.phoneNumber ?? null;
  const memberSince = user?.metadata?.creationTime
    ? formatDate(new Date(user.metadata.creationTime))
    : "—";
  const greetingName = profileName.trim() || "student";
  const tsOf = (v: unknown): number => {
    if (v && typeof v === "object" && "seconds" in (v as Record<string, unknown>)) {
      return Number((v as { seconds: number }).seconds);
    }
    if (typeof v === "number") return v > 1e12 ? v / 1000 : v;
    return 0;
  };

  return (
    <div className="ac-root">
      <FormulaMarks />
      <style>{`
        .ac-root { min-height: 100vh; min-height: 100dvh; background: var(--color-paper); color: var(--color-ink); position: relative; isolation: isolate; overflow-x: clip; font-family: var(--font-body); }
        .ac-nav { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem var(--page-gutter); border-bottom: 1px solid var(--color-rule); max-width: var(--page-max); margin-inline: auto; }
        .ac-brand { display: inline-flex; align-items: center; gap: 0.6rem; text-decoration: none; font-family: var(--font-display); font-weight: 700; letter-spacing: -0.03em; color: var(--color-ink); }
        .ac-back { font-family: var(--font-mono); font-size: 0.68rem; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-muted); text-decoration: none; }
        .ac-back:hover { color: var(--color-accent-2-deep); }

        .ac-main { max-width: var(--page-max); margin-inline: auto; padding: var(--space-xl) var(--page-gutter) var(--space-2xl); position: relative; z-index: 1; }
        .ac-kicker { font-family: var(--font-mono); font-size: 0.62rem; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: var(--color-accent-2-deep); margin: 0 0 0.5rem; }
        .ac-h1 { font-size: var(--text-display); line-height: 1.02; margin: 0 0 var(--space-xl); letter-spacing: -0.03em; }
        .ac-grid { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: var(--space-lg); align-items: start; }
        .ac-col-stack { display: flex; flex-direction: column; gap: var(--space-lg); }

        .ac-card { background: var(--color-paper); border: 1px solid var(--color-rule); border-radius: var(--radius-card); box-shadow: var(--shadow-card); padding: var(--space-lg); }
        .ac-card-head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-md); margin-bottom: var(--space-md); }
        .ac-card-title { font-family: var(--font-display); font-weight: 600; letter-spacing: -0.02em; font-size: 1.15rem; margin: 0; }
        .ac-card-hint { font-family: var(--font-mono); font-size: 0.6rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-muted); }

        /* profile */
        .ac-id { display: flex; align-items: center; gap: 1rem; margin-bottom: var(--space-md); }
        .ac-avatar { flex: 0 0 auto; width: 56px; height: 56px; border-radius: 18px; background: var(--color-accent); color: var(--color-on-accent); display: grid; place-items: center; font-family: var(--font-display); font-weight: 700; font-size: 1.25rem; letter-spacing: -0.02em; border: 1.5px solid oklch(74% 0.19 85); }
        .ac-phone { font-family: var(--font-mono); font-size: 0.9rem; color: var(--color-ink); letter-spacing: 0.08em; }
        .ac-since { font-size: 0.78rem; color: var(--color-muted); margin-top: 0.2rem; }
        .ac-uid { font-family: var(--font-mono); font-size: 0.6rem; letter-spacing: 0.12em; color: var(--color-faint); margin-top: 0.35rem; text-transform: uppercase; }
        .ac-name-row { display: flex; gap: 0.6rem; align-items: stretch; }
        .ac-name-input { flex: 1; min-width: 0; background: var(--color-paper-2); border: 1.5px solid transparent; border-radius: var(--radius-input); padding: 0.7rem 0.8rem; font-family: var(--font-body); font-size: 0.95rem; color: var(--color-ink); outline: none; transition: border-color var(--dur-micro), background var(--dur-micro); }
        .ac-name-input:focus { border-color: var(--color-accent-2); background: var(--color-paper); }
        .ac-note { font-size: 0.78rem; margin: var(--space-sm) 0 0; line-height: 1.5; }
        .ac-note-ok { color: var(--color-mint-deep); }
        .ac-note-err { color: var(--color-danger); }

        /* rows */
        .ac-row { display: flex; align-items: center; gap: 0.85rem; padding: 0.7rem 0.75rem; border: 1px solid var(--color-rule); border-radius: var(--radius-input); background: var(--color-paper); }
        .ac-row + .ac-row { margin-top: 0.55rem; }
        .ac-row-main { flex: 1; min-width: 0; }
        .ac-row-title { font-weight: 600; font-size: 0.92rem; overflow-wrap: anywhere; }
        .ac-row-sub { font-family: var(--font-mono); font-size: 0.62rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-muted); margin-top: 0.15rem; }
        .ac-row-action { flex: 0 0 auto; }
        .ac-score { font-family: var(--font-display); font-weight: 600; font-size: 1.05rem; letter-spacing: -0.02em; text-align: right; min-width: 4.5ch; }
        .ac-score-sub { font-family: var(--font-mono); font-size: 0.56rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-muted); text-align: right; }
        .ac-empty { border: 1.5px dashed var(--color-rule-2); border-radius: var(--radius-input); padding: var(--space-lg); text-align: center; color: var(--color-muted); font-size: 0.9rem; line-height: 1.65; }
        .ac-empty a { color: var(--color-accent-2-deep); font-weight: 600; }

        .ac-signout { margin-top: var(--space-xl); display: flex; justify-content: center; }
        .ac-signout-btn { background: transparent; border: 1.5px solid var(--color-rule-2); border-radius: var(--radius-pill); padding: 0.55rem 1.25rem; font-family: var(--font-mono); font-size: 0.66rem; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-muted); cursor: pointer; transition: color var(--dur-micro), border-color var(--dur-micro); }
        .ac-signout-btn:hover { color: var(--color-danger); border-color: var(--color-danger); }

        .ac-foot { max-width: var(--page-max); margin-inline: auto; padding: var(--space-md) var(--page-gutter) var(--space-lg); border-top: 1px solid var(--color-rule); display: flex; justify-content: space-between; gap: var(--space-md); flex-wrap: wrap; font-family: var(--font-mono); font-size: 0.6rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--color-muted); }

        @media (max-width: 900px) {
          .ac-grid { grid-template-columns: minmax(0, 1fr); }
          .ac-h1 { font-size: clamp(2rem, 9vw, 2.75rem); }
          .ac-row { flex-wrap: wrap; }
          .ac-row-action { flex-basis: 100%; }
          .ac-name-row { flex-direction: column; }
          .ac-name-row .btn, .ac-name-row button { width: 100%; }
        }
      `}</style>

      {/* Header */}
      <nav className="ac-nav">
        <Link href="/" className="ac-brand" aria-label="World of Physics — home">
          <Image src="/logo.png" alt="" width={30} height={30} style={{ borderRadius: 8, border: "1px solid var(--color-rule-2)" }} priority />
          World of Physics
        </Link>
        <Link href="/" className="ac-back">
          ← Back to portal
        </Link>
      </nav>

      <main className="ac-main">
        <p className="ac-kicker">Your account</p>
        <h1 className="ac-h1">
          Hello, <span className="hl">{greetingName}</span>
        </h1>

        <div className="ac-grid">
          <div className="ac-col-stack">
            {/* ---------- Profile ---------- */}
            <section className="ac-card" aria-labelledby="profile-title">
              <div className="ac-card-head">
                <h2 className="ac-card-title" id="profile-title">Profile</h2>
                <span className="ac-card-hint">Phone verified</span>
              </div>
              <div className="ac-id">
                <div className="ac-avatar" aria-hidden="true">
                  {profileName.trim()
                    ? initials(profileName, phone)
                    : initials("", phone)}
                </div>
                <div>
                  <div className="ac-phone">{maskPhone(phone)}</div>
                  <div className="ac-since">Member since {memberSince}</div>
                  <div className="ac-uid">ID {user?.uid.slice(0, 8).toUpperCase()}</div>
                </div>
              </div>
              <label className="ac-card-hint" htmlFor="profile-name" style={{ display: "block", marginBottom: "0.35rem" }}>
                Display name
              </label>
              <div className="ac-name-row">
                <input
                  id="profile-name"
                  className="ac-name-input"
                  type="text"
                  maxLength={MAX_NAME}
                  placeholder="e.g. Riya Sharma"
                  value={nameDraft}
                  onChange={(e) => {
                    setNameDraft(e.target.value);
                    setSaveNote(null);
                  }}
                  autoComplete="name"
                  aria-describedby="profile-name-note"
                />
                <button className="btn btn--soft" onClick={onSaveName} disabled={saving || !profileLoaded}>
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
              {saveNote === "ok" && (
                <p className="ac-note ac-note-ok" id="profile-name-note" role="status">
                  Saved — this name prefills when you take a test.
                </p>
              )}
              {saveNote === "err" && (
                <p className="ac-note ac-note-err" id="profile-name-note" role="alert">
                  Couldn&apos;t save — check the name and try again.
                </p>
              )}
            </section>

            {/* ---------- Sign out ---------- */}
            <div className="ac-signout">
              <button className="ac-signout-btn" onClick={onSignOut}>
                Sign out — this browser forgets you
              </button>
            </div>
          </div>

          <div className="ac-col-stack">
            {/* ---------- Purchases ---------- */}
            <section className="ac-card" aria-labelledby="purchases-title">
              <div className="ac-card-head">
                <h2 className="ac-card-title" id="purchases-title">Your formula sheets</h2>
                <Link href="/course" className="ac-back">Browse →</Link>
              </div>
              {purchases === null ? (
                <div className="ac-empty">Loading your sheets…</div>
              ) : purchases.length === 0 ? (
                <div className="ac-empty">
                  Nothing purchased yet.<br />
                  <Link href="/course">Browse formula sheets →</Link>
                </div>
              ) : (
                purchases.map((row) => (
                  <div className="ac-row" key={row.purchaseId}>
                    <div className="ac-row-main">
                      <div className="ac-row-title">
                        {row.sheet?.name ?? row.topicId}
                      </div>
                      <div className="ac-row-sub">
                        {row.sheet?.grade ?? "Formula sheet"} · Bought {formatDate(row.paidAt)} · ₹{row.amount}
                      </div>
                    </div>
                    <div className="ac-row-action">
                      {row.sheet ? (
                        <a
                          className="btn btn--soft"
                          href={row.sheet.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ padding: "0.5rem 0.9rem", fontSize: "0.78rem" }}
                        >
                          Download PDF
                        </a>
                      ) : (
                        <span className="ac-row-sub" style={{ border: "1px solid var(--color-rule)", borderRadius: "var(--radius-pill)", padding: "0.4rem 0.7rem" }}>
                          No longer available
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </section>

            {/* ---------- Test history ---------- */}
            <section className="ac-card" aria-labelledby="history-title">
              <div className="ac-card-head">
                <h2 className="ac-card-title" id="history-title">Test history</h2>
                <span className="ac-card-hint">Latest first</span>
              </div>
              {historyBlocked ? (
                <div className="ac-empty">
                  History can&apos;t be loaded right now — the attempt records aren&apos;t readable from this browser yet. Ask your teacher, or try again later.
                </div>
              ) : history === null ? (
                <div className="ac-empty">Loading your attempts…</div>
              ) : history.length === 0 ? (
                <div className="ac-empty">
                  No attempts recorded under this number yet.<br />
                  Attempts from before phone sign-in were tied to the device, not your account.
                </div>
              ) : (
                history.map(({ attempt, examTitle }) => {
                  const pct = attempt.total > 0 ? Math.round((attempt.score / attempt.total) * 100) : 0;
                  return (
                    <div className="ac-row" key={attempt.id}>
                      <div className="ac-row-main">
                        <div className="ac-row-title">{examTitle}</div>
                        <div className="ac-row-sub">
                          {formatDate(attempt.submittedAt)} · {attempt.correct}✓ {attempt.wrong}✗ · {attempt.unattempted} skipped
                        </div>
                      </div>
                      <div>
                        <div className="ac-score">{attempt.score}<span style={{ fontSize: "0.6em", color: "var(--color-muted)" }}>/{attempt.total}</span></div>
                        <div className="ac-score-sub">{pct}%</div>
                      </div>
                    </div>
                  );
                })
              )}
            </section>
          </div>
        </div>
      </main>

      <footer className="ac-foot">
        <span>World of Physics</span>
        <span>For practice only · Not affiliated with NTA</span>
      </footer>
    </div>
  );
}
