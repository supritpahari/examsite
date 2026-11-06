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
