"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdSlot } from "./AdSlot";
import {
  COURSE_GRADES,
  getTopic,
  recordPurchase,
  type CourseGrade,
  type CourseTopic,
} from "@/lib/courses";
import { getAuthInstance, onAuthState } from "@/lib/firebase/client";
import { getIdToken, type User } from "firebase/auth";

type Step = "grade" | "topic" | "payment" | "success";

export default function CoursePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState<Step>("grade");
  const [selectedGrade, setSelectedGrade] = useState<CourseGrade | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<CourseTopic | null>(null);
  const [purchased, setPurchased] = useState<Record<string, boolean>>({});
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [paidTopic, setPaidTopic] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthState((u) => {
      setUser(u);
      setChecking(false);
    });
    return unsub;
  }, []);

  const checkPurchased = useCallback(async (topicId: string) => {
    try {
      const res = await fetch(
        `/api/course/purchase/check?topicId=${encodeURIComponent(topicId)}`
      );
      if (res.ok) {
        const data = (await res.json()) as { purchased: boolean };
        setPurchased((prev) => ({ ...prev, [topicId]: data.purchased }));
      }
    } catch {
      /* ignore — user can still attempt purchase */
    }
  }, []);

  const selectGrade = (grade: CourseGrade) => {
    setSelectedGrade(grade);
    setSelectedTopic(null);
    setPaidTopic(null);
    setStep("topic");
  };

  const selectTopic = (topic: CourseTopic) => {
    setSelectedTopic(topic);
    setStep("payment");
  };

  const goBack = () => {
    if (step === "topic") {
      setSelectedGrade(null);
      setSelectedTopic(null);
      setStep("grade");
    } else if (step === "payment") {
      setSelectedTopic(null);
      setStep("topic");
    }
  };

  const handlePay = async () => {
    if (!selectedTopic) return;
    setPayError(null);
    setPaying(true);
    try {
      // ---- Mock payment flow ----
      // Replace this block with a real Razorpay / Stripe checkout integration.
      await new Promise((resolve) => setTimeout(resolve, 1400)); // simulate gateway

      const auth = getAuthInstance();
      const uid = auth.currentUser ? auth.currentUser.uid : undefined;

      await recordPurchase({
        courseId: selectedGrade!.id,
        topicId: selectedTopic.id,
        gradeId: selectedGrade!.id,
        amount: selectedTopic.price,
        status: "paid",
        userId: uid,
      });

      setPurchased((prev) => ({ ...prev, [selectedTopic.id]: true }));
      setPaidTopic(selectedTopic.id);
      setStep("success");
    } catch (err) {
      setPayError(
        err instanceof Error ? err.message : "Payment failed. Please try again."
      );
    } finally {
      setPaying(false);
    }
  };

  const formatPrice = (paise: number) => {
    const rupees = paise / 100;
    return rupees.toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    });
  };

  const downloadPdf = () => {
    if (!selectedTopic) return;
    // Open the PDF in a new tab; purchased topics are served publicly via the URL.
    window.open(selectedTopic.pdfUrl, "_blank");
  };

  if (checking) {
    return (
      <div className="course-guard">
        Loading course catalog…
      </div>
    );
  }

  return (
    <div className="course-root">
      <style>{`
        .course-root {
          min-height: 100vh;
          background: #f4f0e8;
          color: #14110d;
          font-family: 'Inter', sans-serif;
          position: relative;
        }
        .course-root *, .course-root *::before, .course-root *::after {
          box-sizing: border-box;
        }
        .course-root::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image: radial-gradient(rgba(20,17,13,0.04) 1px, transparent 1px);
          background-size: 4px 4px;
          opacity: 0.6;
        }

        .course-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 24px 48px;
          position: relative;
          z-index: 10;
        }
        .course-brand {
          font-family: 'Instrument Serif', serif;
          font-size: 24px;
          line-height: 1;
          color: #14110d;
          text-decoration: none;
          display: flex;
          align-items: baseline;
          gap: 4px;
        }
        .course-brand-em { font-style: italic; color: oklch(0.52 0.20 25); }
        .course-back {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          color: #8a8275;
          text-decoration: none;
        }
        .course-back:hover { color: oklch(0.52 0.20 25); }

        .course-main {
          padding: 0 48px 64px;
          max-width: 1000px;
          margin: 0 auto;
          position: relative;
          z-index: 1;
        }

        .course-guard {
          min-height: 60vh;
          display: grid;
          place-items: center;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          color: #8a8275;
        }

        .course-card {
          border: 1px solid #d9d1bf;
          background: #f4f0e8;
          padding: 28px 30px;
          margin-bottom: 24px;
          position: relative;
        }
        .course-card-wide { max-width: 720px; }

        .course-step-head {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }
        .course-back-btn {
          background: transparent;
          border: 1px solid #d9d1bf;
          color: #8a8275;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }
        .course-back-btn:hover { color: oklch(0.52 0.20 25); border-color: oklch(0.52 0.20 25); }
        .course-step-badge {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.24em;
          color: oklch(0.52 0.20 25);
          flex: 0 0 auto;
        }
        .course-step-title {
          font-family: 'Instrument Serif', serif;
          font-size: 26px;
          line-height: 1.1;
          color: #14110d;
          margin: 0;
          flex: 1;
        }
        .course-step-title em { font-style: italic; color: oklch(0.52 0.20 25); }

        .course-step-desc {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          color: #3a352c;
          line-height: 1.6;
          margin-bottom: 24px;
        }

        /* ---------- Grade grid ---------- */
        .course-grade-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
        }
        .course-grade-btn {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: transparent;
          border: 1px solid #14110d;
          padding: 16px 18px;
          text-align: left;
          cursor: pointer;
          font-family: 'Instrument Serif', serif;
          font-size: 17px;
          color: #14110d;
          transition: all 0.15s ease;
        }
        .course-grade-btn:hover {
          background: oklch(0.52 0.20 25);
          border-color: oklch(0.52 0.20 25);
          color: #fff;
        }
        .course-grade-btn:hover .course-grade-arrow { color: #fff; }
        .course-grade-name { font-family: 'Instrument Serif', serif; }
        .course-grade-arrow {
          font-size: 14px;
          color: #8a8275;
          flex: 0 0 auto;
        }

        /* ---------- Topic grid ---------- */
        .course-topic-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }
        .course-topic-btn {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: transparent;
          border: 1px solid #d9d1bf;
          padding: 14px 16px;
          text-align: left;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .course-topic-btn:not(.course-topic-bought):hover {
          border-color: oklch(0.52 0.20 25);
          color: oklch(0.52 0.20 25);
        }
        .course-topic-btn:not(.course-topic-bought):hover .course-topic-arrow { color: oklch(0.52 0.20 25); }
        .course-topic-btn.course-topic-bought {
          background: #d9ead3;
          border-color: #274e13;
          color: #274e13;
          cursor: default;
        }
        .course-topic-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
          min-width: 0;
        }
        .course-topic-name {
          font-family: 'Instrument Serif', serif;
          font-size: 15px;
          color: #14110d;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .course-topic-price {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: #8a8275;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        .course-topic-btn.course-topic-bought .course-topic-price { color: #274e13; }
        .course-topic-check, .course-topic-arrow {
          font-size: 14px;
          flex: 0 0 auto;
          color: #8a8275;
        }
        .course-topic-btn.course-topic-bought .course-topic-check { color: #274e13; }

        /* ---------- Payment ---------- */
        .course-pay-summary {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 20px;
        }
        .course-pay-item {
          display: flex;
          justify-content: space-between;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          color: #3a352c;
          padding: 10px 14px;
          border: 1px solid #d9d1bf;
          background: #f4f0e8;
        }
        .course-pay-label { color: #8a8275; }
        .course-pay-value { color: #14110d; }
        .course-pay-item-total {
          border-top: 2px solid #14110d;
          font-size: 13px;
          font-weight: 600;
        }
        .course-pay-total { color: oklch(0.52 0.20 25); }

        .course-pay-btn {
          width: 100%;
          background: oklch(0.52 0.20 25);
          color: #fff;
          border: 1px solid oklch(0.52 0.20 25);
          padding: 14px;
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 14px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          cursor: pointer;
          margin-bottom: 10px;
        }
        .course-pay-btn:hover:not(:disabled) { background: oklch(0.42 0.22 25); border-color: oklch(0.42 0.22 25); }
        .course-pay-btn:disabled { opacity: 0.55; cursor: not-allowed; }

        .course-pay-err {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: #b3261e;
          margin-bottom: 10px;
        }
        .course-pay-note {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          color: #8a8275;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        /* ---------- Success ---------- */
        .course-success {
          text-align: center;
          max-width: 620px;
        }
        .course-success-icon {
          font-size: 40px;
          color: oklch(0.52 0.20 25);
          margin-bottom: 12px;
        }
        .course-desc {
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          color: #3a352c;
          line-height: 1.6;
          margin-bottom: 24px;
        }
        .course-download {
          margin-bottom: 24px;
        }
        .course-download-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: oklch(0.52 0.20 25);
          color: #fff;
          border: 1px solid oklch(0.52 0.20 25);
          padding: 14px 22px;
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 14px;
          letter-spacing: 0.04em;
          text-decoration: none;
          text-transform: uppercase;
        }
        .course-download-btn:hover { background: oklch(0.42 0.22 25); border-color: oklch(0.42 0.22 25); }
        .course-download-hint {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          color: #8a8275;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-top: 8px;
        }

        .course-actions {
          display: flex;
          justify-content: center;
        }
        .course-btn-ghost {
          background: transparent;
          color: #8a8275;
          border: 1px solid #d9d1bf;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          padding: 10px 22px;
          cursor: pointer;
        }
        .course-btn-ghost:hover { color: oklch(0.52 0.20 25); border-color: oklch(0.52 0.20 25); }

        /* ---------- Modal buttons (reused from admin palette) ---------- */
        .ad-submit {
          width: 100%;
          background: oklch(0.52 0.20 25);
          color: #fff;
          border: 1px solid oklch(0.52 0.20 25);
          padding: 14px;
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 14px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          cursor: pointer;
          margin-top: 6px;
        }
        .ad-submit:hover:not(:disabled) { background: oklch(0.42 0.22 25); border-color: oklch(0.42 0.22 25); }
        .ad-submit:disabled { opacity: 0.55; cursor: not-allowed; }

        .ad-set-btn {
          background: oklch(0.52 0.20 25);
          color: #fff;
          border: 1px solid oklch(0.52 0.20 25);
          padding: 0 22px;
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 14px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          cursor: pointer;
          white-space: nowrap;
        }
        .ad-set-btn.ghost {
          background: transparent;
          color: #8a8275;
          border-color: #d9d1bf;
        }
        .ad-set-btn.ghost:hover { color: oklch(0.52 0.20 25); border-color: oklch(0.52 0.20 25); }
        .ad-set-btn:disabled { opacity: 0.55; cursor: not-allowed; }

        .ad-exam-btn {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 8px 14px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .ad-exam-btn.ghost {
          background: transparent;
          color: #8a8275;
          border-color: #d9d1bf;
        }
        .ad-exam-btn.ghost:hover { color: oklch(0.52 0.20 25); border-color: oklch(0.52 0.20 25); }
        .ad-exam-btn.danger {
          background: transparent;
          color: #b42318;
          border-color: #f0c2bb;
        }
        .ad-exam-btn.danger:hover { background: #b42318; color: #fff; border-color: #b42318; }

        .course-foot {
          padding: 32px 48px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #8a8275;
          text-align: center;
        }

        @media (max-width: 720px) {
          .course-nav { padding: 20px 24px; }
          .course-main { padding: 0 24px 48px; }
          .course-grade-grid { grid-template-columns: 1fr; }
          .course-foot { padding: 24px; }
        }
      `}</style>

      {/* Ad slot — only on this page */}
      <AdSlot slotId={process.env.NEXT_PUBLIC_ADSENSE_SLOT_COURSE_TOP} />

      <nav className="course-nav">
        <Link href="/" className="course-brand">
          World of <span className="course-brand-em">Physics</span>
        </Link>
        <Link href="/" className="course-back">
          ← Back to portal
        </Link>
      </nav>

      <main className="course-main">
        {/* ---------- Step 1: Grade ---------- */}
        {step === "grade" && (
          <section className="course-card">
            <div className="course-step-head">
              <span className="course-step-badge">Step 1</span>
              <h2 className="course-step-title">Choose your <em>grade</em></h2>
            </div>
            <p className="course-step-desc">
              Pick the class or exam you&rsquo;re preparing for. Each topic below
              is a downloadable formula-sheet PDF.
            </p>
            <div className="course-grade-grid">
              {COURSE_GRADES.map((g) => (
                <button
                  key={g.id}
                  className="course-grade-btn"
                  onClick={() => selectGrade(g)}
                >
                  <span className="course-grade-name">{g.name}</span>
                  <span className="course-grade-arrow">›</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ---------- Step 2: Topic ---------- */}
        {step === "topic" && selectedGrade && (
          <>
            <section className="course-card">
              <div className="course-step-head">
                <button
                  className="course-back-btn"
                  onClick={goBack}
                  aria-label="Back"
                >
                  ←
                </button>
                <span className="course-step-badge">Step 2</span>
                <h2 className="course-step-title">
                  {selectedGrade.name} · Choose <em>topic</em>
                </h2>
              </div>
              <div className="course-topic-grid">
                {selectedGrade.topics.map((t) => {
                  const already = purchased[t.id];
                  return (
                    <button
                      key={t.id}
                      className={`course-topic-btn${already ? " course-topic-bought" : ""}`}
                      onClick={() => selectTopic(t)}
                      disabled={already}
                    >
                      <div className="course-topic-info">
                        <span className="course-topic-name">{t.name}</span>
                        <span className="course-topic-price">
                          {already ? "Purchased" : formatPrice(t.price)}
                        </span>
                      </div>
                      {already ? (
                        <span className="course-topic-check">✓</span>
                      ) : (
                        <span className="course-topic-arrow">›</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
            <AdSlot slotId={process.env.NEXT_PUBLIC_ADSENSE_SLOT_COURSE_MID} />
          </>
        )}

        {/* ---------- Step 3: Payment ---------- */}
        {step === "payment" && selectedTopic && (
          <section className="course-card course-card-wide">
            <div className="course-step-head">
              <button className="course-back-btn" onClick={goBack} aria-label="Back">
                ←
              </button>
              <span className="course-step-badge">Step 3</span>
              <h2 className="course-step-title">Pay to <em>download</em></h2>
            </div>
            <div className="course-pay-summary">
              <div className="course-pay-item">
                <span className="course-pay-label">Topic</span>
                <span className="course-pay-value">{selectedTopic.name}</span>
              </div>
              <div className="course-pay-item">
                <span className="course-pay-label">Grade</span>
                <span className="course-pay-value">
                  {selectedGrade?.name ?? "—"}
                </span>
              </div>
              <div className="course-pay-item course-pay-item-total">
                <span className="course-pay-label">Amount</span>
                <span className="course-pay-value course-pay-total">
                  {formatPrice(selectedTopic.price)}
                </span>
              </div>
            </div>
            {payError && (
              <div className="course-pay-err">{payError}</div>
            )}
            <button
              className="course-pay-btn"
              onClick={handlePay}
              disabled={paying}
            >
              {paying ? "Processing…" : `Pay ${formatPrice(selectedTopic.price)}`}
            </button>
            <p className="course-pay-note">
              Demo checkout — replace with Razorpay/Stripe for real payments.
            </p>
          </section>
        )}

        {/* ---------- Step 4: Success / Download ---------- */}
        {step === "success" && paidTopic && (
          <section className="course-card course-card-wide course-success">
            <div className="course-success-icon">✓</div>
            <h2 className="course-step-title">Payment <em>successful</em></h2>
            <p className="course-desc">
              Your formula sheet is ready to download. Click below to open or
              save the PDF.
            </p>
            <div className="course-download">
              <a
                href={
                  getTopic(selectedGrade!.id, paidTopic)?.pdfUrl ?? "#"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="course-download-btn"
                onClick={downloadPdf}
              >
                ⬇ Download PDF
              </a>
              <p className="course-download-hint">
                The PDF opens in a new tab. You can re-download anytime from
                this page.
              </p>
            </div>
            <div className="course-actions">
              <button className="course-btn-ghost" onClick={() => router.push("/")}>
                Browse more
              </button>
            </div>
          </section>
        )}
      </main>

      {/* Ad slot — only on this page */}
      <AdSlot slotId={process.env.NEXT_PUBLIC_ADSENSE_SLOT_COURSE_MID} />

      <footer className="course-foot">
        <p>
          World of Physics · For practice only · Not affiliated with NTA
        </p>
      </footer>
    </div>
  );
}
