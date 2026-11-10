/* Hallmark · genre: playful · theme: Hum · macrostructure: Workbench · design-system: design.md · designed-as-app */
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdSlot } from "./AdSlot";
import {
  fetchCourseGradesFromApi,
  type CourseGrade,
  type CourseTopic,
} from "@/lib/courses";
import { getAuthInstance, onAuthState } from "@/lib/firebase/client";
import { getIdToken, type User } from "firebase/auth";
import FormulaMarks from "../_components/FormulaMarks";
import PhoneAuth from "../_components/PhoneAuth";
import Image from "next/image";

type Step = "grade" | "topic" | "signin" | "payment" | "success";
type BucketKey = "c11" | "c12" | "jee" | "other";

interface BucketedTopic extends CourseTopic {
  gradeName: string;
}

const BUCKETS: Array<{
  key: BucketKey;
  title: string;
  sub: string;
  icon: "cap" | "doc" | "flame";
  matches: (gradeName: string) => boolean;
}> = [
  {
    key: "c11",
    title: "Class 11",
    sub: "(Physics)",
    icon: "cap",
    matches: (g) => /^class\s*11/i.test(g.trim()),
  },
  {
    key: "c12",
    title: "Class 12",
    sub: "(Physics)",
    icon: "cap",
    matches: (g) => /^class\s*12/i.test(g.trim()),
  },
  {
    key: "jee",
    title: "JEE",
    sub: "Mains & Advanced",
    icon: "doc",
    matches: (g) => /^jee\b/i.test(g.trim()),
  },
  {
    key: "other",
    title: "Other Exams",
    sub: "NEET & Boards",
    icon: "flame",
    matches: () => true, // everything not claimed above lands here
  },
];

function bucketKeyFor(gradeName: string): BucketKey {
  const g = gradeName.trim();
  if (/^class\s*11/i.test(g)) return "c11";
  if (/^class\s*12/i.test(g)) return "c12";
  if (/^jee\b/i.test(g)) return "jee";
  return "other";
}

export default function CoursePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [auth, setAuth] = useState<"loading" | "in" | "out">("loading");
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [grades, setGrades] = useState<CourseGrade[]>([]);
  const [step, setStep] = useState<Step>("grade");
  const [bucket, setBucket] = useState<BucketKey | null>(null);
  const [bucketName, setBucketName] = useState<string>("");
  const [selectedTopic, setSelectedTopic] = useState<BucketedTopic | null>(null);
  const [purchased, setPurchased] = useState<Record<string, boolean>>({});
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [paidTopic, setPaidTopic] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthState((u) => {
      setUser(u);
      setChecking(false);
      setAuth(u ? "in" : "out");
    });
    return unsub;
  }, []);

  // Promote from the sign-in gate back to payment once the OTP lands.
  useEffect(() => {
    if (auth === "in" && step === "signin") setStep("payment");
  }, [auth, step]);

  useEffect(() => {
    let mounted = true;
    fetchCourseGradesFromApi()
      .then((g) => {
        if (mounted) setGrades(g);
      })
      .catch(() => {
        if (mounted) setGrades([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  /** Bucket every sheet we can find into one of the four cards, with honest counts. */
  const bucketTopics = useCallback(
    (key: BucketKey): BucketedTopic[] => {
      const out: BucketedTopic[] = [];
      for (const g of grades) {
        const name = g.name ?? "";
        if (bucketKeyFor(name) !== key) continue;
        for (const t of g.topics) {
          out.push({ ...t, gradeName: name });
        }
      }
      return out;
    },
    [grades]
  );

  const bucketCounts: Record<BucketKey, number> = { c11: 0, c12: 0, jee: 0, other: 0 };
  for (const g of grades) {
    const key = bucketKeyFor(g.name ?? "");
    bucketCounts[key] += g.topics.length;
  }

  const selectBucket = (key: BucketKey) => {
    setBucket(key);
    setBucketName(BUCKETS.find((b) => b.key === key)?.title ?? "");
    setSelectedTopic(null);
    setPaidTopic(null);
    setStep("topic");
    bucketTopics(key).forEach((t) => checkPurchased(t.id));
  };

  const checkPurchased = useCallback(async (topicId: string) => {
    try {
      const auth = getAuthInstance();
      const token = auth.currentUser ? await getIdToken(auth.currentUser) : null;
      if (!token) return; // signed-out visitors simply see the buy buttons
      const res = await fetch(
        `/api/course/purchase/check?topicId=${encodeURIComponent(topicId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = (await res.json()) as { purchased: boolean };
        setPurchased((prev) => ({ ...prev, [topicId]: data.purchased }));
      }
    } catch {
      /* ignore — user can still attempt purchase */
    }
  }, []);

  const selectTopic = (topic: BucketedTopic) => {
    setSelectedTopic(topic);
    // Gate: buying requires a signed-in (phone-verified) account.
    if (auth === "in") setStep("payment");
    else setAuthDialogOpen(true);
  };

  const goBack = () => {
    if (step === "topic") {
      setBucket(null);
      setSelectedTopic(null);
      setStep("grade");
    } else if (step === "payment") {
      setSelectedTopic(null);
      setStep("topic");
    }
  };

  const razorpayRef = useRef<boolean>(false);

  const loadRazorpay = (): Promise<void> => {
    if (razorpayRef.current) return Promise.resolve();
    if (typeof window === "undefined") return Promise.reject();
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => {
        razorpayRef.current = true;
        resolve();
      };
      script.onerror = () => reject(new Error("Failed to load Razorpay"));
      document.head.appendChild(script);
    });
  };

  const handlePay = async () => {
    if (!selectedTopic) return;
    if (auth !== "in") {
      setAuthDialogOpen(true);
      return;
    }
    setPayError(null);
    setPaying(true);
    try {
      // 1. Create Razorpay order server-side
      const createRes = await fetch("/api/course/payment/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getIdToken(getAuthInstance().currentUser!)}`,
        },
        body: JSON.stringify({
          topicId: selectedTopic.id,
          amount: selectedTopic.price,
          courseId: bucket ?? "",
          gradeId: bucket ?? "",
          topicName: selectedTopic.name,
          gradeName: selectedTopic.gradeName,
        }),
      });

      if (!createRes.ok) {
        const errData = await createRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to create payment order");
      }

      const { orderId, amount, currency, key } = await createRes.json();

      // 2. Load Razorpay checkout script
      await loadRazorpay();

      // 3. Open Razorpay checkout
      const options = {
        key,
        amount,
        currency,
        name: "World of Physics",
        description: `Formula Sheet: ${selectedTopic.name}`,
        order_id: orderId,
        prefill: {
          name: "",
          contact: user?.phoneNumber?.replace("+91", "") || "",
          email: "",
        },
        theme: {
          color: "#f39c12",
        },
        handler: async (response: any) => {
          // 4. Verify payment server-side
          const verifyRes = await fetch("/api/course/payment/verify", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${await getIdToken(getAuthInstance().currentUser!)}`,
            },
            body: JSON.stringify({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });

          if (!verifyRes.ok) {
            const errData = await verifyRes.json().catch(() => ({}));
            throw new Error(errData.error || "Payment verification failed");
          }

          // 5. Mark purchased locally
          setPurchased((prev) => ({ ...prev, [selectedTopic.id]: true }));
          setPaidTopic(selectedTopic.id);
          setStep("success");
        },
        modal: {
          ondismiss: () => {
            setPayError("Payment cancelled.");
            setPaying(false);
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err) {
      setPayError(
        err instanceof Error ? err.message : "Payment failed. Please try again."
      );
    } finally {
      setPaying(false);
    }
  };

  // Prices are stored as whole rupees by the admin panel — display them as-is.
  const formatPrice = (rupees: number) =>
    rupees.toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    });

  const downloadPdf = () => {
    if (!selectedTopic) return;
    window.open(selectedTopic.pdfUrl, "_blank");
  };

  const stepIndex: Record<Step, number> = { grade: 1, topic: 2, signin: 3, payment: 3, success: 4 };
  const topics = bucket ? bucketTopics(bucket) : [];

  if (checking) {
    return (
      <div className="course-guard" role="status">
        Loading formula sheets…
      </div>
    );
  }

  return (
    <div className="co-root">
      <FormulaMarks />
      <style>{`
        .co-root { min-height: 100vh; background: var(--color-paper); color: var(--color-ink); position: relative; isolation: isolate; overflow-x: clip; font-family: var(--font-body); }

        /* ---------- Header ---------- */
        .co-nav { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem var(--page-gutter); border-bottom: 1px solid var(--color-rule); max-width: var(--page-max); margin-inline: auto; }
        .co-brand { font-family: var(--font-display); font-weight: 700; font-size: 1.05rem; letter-spacing: -0.03em; color: var(--color-ink); text-decoration: none; display: inline-flex; align-items: center; gap: 0.6rem; }
        .co-brand-logo { width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--color-rule-2); flex: 0 0 auto; }
        .co-back { font-family: var(--font-mono); font-size: 0.68rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.14em; color: var(--color-muted); text-decoration: none; }
        .co-back:hover { color: var(--color-accent-2-deep); }

        /* ---------- Hero ---------- */
        .co-hero { max-width: var(--page-max); margin-inline: auto; padding: clamp(1.5rem, 3vw, 2.5rem) var(--page-gutter) clamp(1.25rem, 2.5vw, 2rem); display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr); gap: var(--space-xl); align-items: center; }
        .co-stepchip { display: inline-flex; align-items: center; gap: 0.45rem; background: var(--color-tint-cyan); color: var(--color-accent-2-deep); font-family: var(--font-mono); font-size: 0.62rem; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; border-radius: var(--radius-pill); padding: 0.35rem 0.8rem; margin-bottom: var(--space-md); }
        .co-h1 { font-size: var(--text-display); font-weight: 600; letter-spacing: -0.03em; line-height: 1.0; margin: 0 0 var(--space-md); max-width: 12ch; }
        .co-sub { font-size: 1rem; line-height: 1.6; color: var(--color-ink-2); max-width: 44ch; margin: 0; }
        .co-art { display: grid; place-items: center; min-width: 0; }
        .co-art svg { width: min(100%, 360px); height: auto; display: block; }

        /* ---------- Grade cards ---------- */
        .co-grades { max-width: var(--page-max); margin-inline: auto; padding: 0 var(--page-gutter) var(--space-xl); display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.75rem; }
        .co-grade { position: relative; overflow: hidden; display: flex; align-items: center; gap: 0.85rem; text-align: left; background: var(--color-paper); border: 1.5px solid var(--color-rule); border-radius: var(--radius-card); padding: 0.95rem 0.9rem; cursor: pointer; transition: border-color var(--dur-micro); text-decoration: none; color: inherit; font-family: inherit; }
        .co-grade::before { content: ""; position: absolute; inset: 0; z-index: 0; background: var(--color-tint-pear); transform: scaleX(0); transform-origin: left center; pointer-events: none; transition: transform 320ms var(--ease-out); }
        .co-grade > * { position: relative; z-index: 1; }
        .co-grade:hover, .co-grade:focus-visible { border-color: var(--color-accent-2); }
        .co-grade:hover::before, .co-grade:focus-visible::before { transform: scaleX(1); }
        .co-grade-icon { flex: 0 0 auto; width: 44px; height: 44px; border-radius: var(--radius-input); background: var(--color-tint-cyan); color: var(--color-accent-2-deep); display: grid; place-items: center; transition: transform 280ms var(--ease-out); }
        .co-grade:hover .co-grade-icon, .co-grade:focus-visible .co-grade-icon { transform: rotate(-6deg); }
        .co-grade-body { min-width: 0; flex: 1 1 auto; }
        .co-grade-name { display: block; font-family: var(--font-display); font-weight: 600; font-size: 1.05rem; letter-spacing: -0.02em; line-height: 1.2; }
        .co-grade-sub { display: block; font-size: 0.78rem; color: var(--color-muted); margin-top: 0.15rem; }
        .co-grade-count { display: block; font-family: var(--font-mono); font-size: 0.56rem; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-muted); margin-top: 0.4rem; }
        .co-grade-arrow { flex: 0 0 auto; width: 34px; height: 34px; border-radius: 999px; border: 1.5px solid var(--color-rule-2); display: grid; place-items: center; color: var(--color-ink-2); transition: transform 280ms var(--ease-out), background var(--dur-micro), border-color var(--dur-micro), color var(--dur-micro); }
        .co-grade:hover .co-grade-arrow, .co-grade:focus-visible .co-grade-arrow { background: var(--color-accent-2); border-color: var(--color-accent-2); color: var(--color-on-accent-2); transform: translateX(5px); }

        /* ---------- Trust bar ---------- */
        .co-trust { max-width: var(--page-max); margin-inline: auto; padding: 0 var(--page-gutter) var(--space-xl); display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.5rem; border-top: 1px solid var(--color-rule); padding-top: var(--space-lg); margin-top: var(--space-md); }
        .co-trust-item { display: flex; align-items: center; gap: 0.75rem; }
        .co-trust-item + .co-trust-item { border-left: 1px solid var(--color-rule); padding-left: 1.5rem; }
        .co-trust-ico { flex: 0 0 auto; color: var(--color-accent-deep); }
        .co-trust-title { display: block; font-family: var(--font-display); font-weight: 600; font-size: 0.92rem; letter-spacing: -0.015em; }
        .co-trust-sub { display: block; font-size: 0.76rem; color: var(--color-muted); margin-top: 0.1rem; }

        /* ---------- Multi-step flow (topic / payment / success) ---------- */
        .course-main { max-width: var(--page-max); margin: 0 auto; padding: var(--space-xl) var(--page-gutter) var(--space-2xl); position: relative; z-index: 1; }
        .course-card { background: var(--color-paper); border: 1px solid var(--color-rule); border-radius: var(--radius-card); box-shadow: var(--shadow-card); padding: var(--space-lg); margin-bottom: var(--space-lg); max-width: 46rem; }
        .course-card-wide { max-width: 40rem; }
        .course-step-head { display: flex; align-items: center; gap: 0.75rem; margin-bottom: var(--space-md); }
        .course-back-btn { background: var(--color-paper-2); border: 0; color: var(--color-ink-2); font-size: 1rem; width: 36px; height: 36px; border-radius: 999px; display: grid; place-items: center; cursor: pointer; padding: 0; line-height: 1; transition: background var(--dur-micro), color var(--dur-micro); }
        .course-back-btn:hover { background: var(--color-paper-3); color: var(--color-ink); }
        .course-step-badge { font-family: var(--font-mono); font-size: 0.62rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.2em; color: var(--color-accent-2-deep); }
        .course-step-title { font-size: 1.5rem; letter-spacing: -0.03em; margin: 0; flex: 1; min-width: 0; font-family: var(--font-display); font-weight: 600; }
        .course-step-desc { color: var(--color-ink-2); font-size: 0.92rem; line-height: 1.6; margin: 0 0 var(--space-lg); max-width: 56ch; }
        .course-topic-grid { display: flex; flex-direction: column; gap: 0.5rem; }
        .course-topic-btn { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; background: var(--color-paper); border: 1.5px solid var(--color-rule); border-radius: var(--radius-input); padding: 0.8rem 1rem; text-align: left; cursor: pointer; transition: border-color var(--dur-micro), background var(--dur-micro); }
        .course-topic-btn:not(.course-topic-bought):hover { border-color: var(--color-accent-2); background: var(--color-tint-cyan); }
        .course-topic-btn.course-topic-bought { background: var(--color-tint-mint); border-color: oklch(80% 0.16 150 / 0.6); cursor: default; }
        .course-topic-btn.course-topic-disabled { opacity: 0.6; cursor: not-allowed; border-color: var(--color-rule-2); }
        .course-topic-btn.course-topic-disabled:hover { border-color: var(--color-rule-2); background: var(--color-paper); }
        .course-topic-info { display: flex; flex-direction: column; gap: 0.15rem; flex: 1; min-width: 0; }
        .course-topic-name { font-family: var(--font-display); font-weight: 600; font-size: 0.95rem; overflow-wrap: anywhere; }
        .course-topic-price { font-family: var(--font-mono); font-size: 0.68rem; color: var(--color-muted); text-transform: uppercase; letter-spacing: 0.1em; }
        .course-topic-btn.course-topic-bought .course-topic-price { color: var(--color-mint-deep); font-weight: 600; }
        .course-topic-check, .course-topic-arrow { font-size: 1rem; flex: 0 0 auto; color: var(--color-muted); }
        .course-topic-btn.course-topic-bought .course-topic-check { color: var(--color-mint-deep); font-weight: 700; }
        .course-empty { border: 1.5px dashed var(--color-rule-2); border-radius: var(--radius-input); padding: var(--space-xl); text-align: center; color: var(--color-muted); line-height: 1.6; }

        .course-pay-summary { display: flex; flex-direction: column; margin-bottom: var(--space-lg); border: 1px dashed var(--color-rule-2); border-radius: var(--radius-input); padding: 0.25rem 1rem; background: var(--color-paper-2); }
        .course-pay-item { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; font-size: 0.88rem; padding: 0.7rem 0; border-bottom: 1px dashed var(--color-rule-2); }
        .course-pay-item:last-child { border-bottom: 0; }
        .course-pay-label { color: var(--color-muted); font-family: var(--font-mono); font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.12em; }
        .course-pay-value { font-weight: 600; text-align: right; }
        .course-pay-item-total .course-pay-value { font-size: 1.15rem; color: var(--color-accent-3-deep); }
        .course-pay-btn { width: 100%; margin-bottom: var(--space-sm); }
        .course-pay-err { font-size: 0.85rem; color: var(--color-danger); background: var(--color-danger-soft); border-radius: var(--radius-sm); padding: 0.6rem 0.8rem; margin-bottom: var(--space-sm); }
        .course-pay-note { font-family: var(--font-mono); font-size: 0.6rem; color: var(--color-muted); text-transform: uppercase; letter-spacing: 0.12em; margin: 0; }

        .course-success { text-align: center; overflow: hidden; }
        .course-success-badge { width: 72px; height: 72px; margin: 0 auto var(--space-md); border-radius: 999px; background: var(--color-mint); display: grid; place-items: center; position: relative; }
        .course-success-badge svg { width: 34px; height: 34px; stroke: var(--color-ink); stroke-width: 3; fill: none; stroke-linecap: round; stroke-linejoin: round; }
        .course-star { position: absolute; top: 50%; left: 50%; width: 26px; height: 26px; pointer-events: none; background:
          linear-gradient(90deg, transparent 46%, var(--color-accent-3) 46% 54%, transparent 54%),
          linear-gradient(0deg, transparent 46%, var(--color-accent-3) 46% 54%, transparent 54%);
          animation: course-star 620ms var(--ease-out) 150ms both; }
        @keyframes course-star { 0% { transform: translate(-50%, -50%) scale(0) rotate(0deg); opacity: 1; } 60% { transform: translate(-50%, -50%) scale(1.4) rotate(35deg); opacity: 0.9; } 100% { transform: translate(-50%, -50%) scale(1.9) rotate(45deg); opacity: 0; } }
        .course-desc { color: var(--color-ink-2); line-height: 1.6; margin: 0 auto var(--space-lg); max-width: 40ch; }
        .course-download { margin-bottom: var(--space-lg); }
        .course-download-hint { font-family: var(--font-mono); font-size: 0.6rem; color: var(--color-muted); text-transform: uppercase; letter-spacing: 0.12em; margin-top: var(--space-sm); }
        .course-actions { display: flex; justify-content: center; }
        @media (prefers-reduced-motion: reduce) { .course-star { display: none; } .co-grade::before, .co-grade-icon, .co-grade-arrow { transition: none; } }

        .course-guard { min-height: 60vh; display: grid; place-items: center; font-family: var(--font-mono); font-size: 0.72rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.18em; color: var(--color-muted); background: var(--color-paper); }

        /* ---------- Footer ---------- */
        .co-foot { max-width: var(--page-max); margin-inline: auto; padding: var(--space-md) var(--page-gutter) var(--space-lg); border-top: 1px solid var(--color-rule); display: flex; justify-content: space-between; align-items: baseline; gap: var(--space-md); flex-wrap: wrap; font-family: var(--font-mono); font-size: 0.62rem; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; color: var(--color-muted); }

        /* ---------- Responsive ---------- */
        @media (max-width: 1080px) {
          .co-hero { grid-template-columns: minmax(0, 1fr); gap: var(--space-lg); }
          .co-art { order: -1; }
          .co-art svg { width: min(100%, 300px); }
          .co-grades { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .co-trust { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }
          .co-trust-item + .co-trust-item { padding-left: 1rem; }
        }
        @media (max-width: 760px) {
          .co-grades { grid-template-columns: minmax(0, 1fr); }
          .co-trust { grid-template-columns: minmax(0, 1fr); gap: 0.9rem; }
          .co-trust-item + .co-trust-item { border-left: 0; padding-left: 0; border-top: 1px dashed var(--color-rule-2); padding-top: 0.9rem; }
          .co-h1 { font-size: clamp(2.2rem, 10vw, 3rem); }
          .co-sub { font-size: 0.92rem; }
          .co-nav { padding: 0.9rem var(--page-gutter); }
          .co-foot { font-size: 0.56rem; letter-spacing: 0.14em; }
        }
      `}</style>

      {authDialogOpen && (
        <PhoneAuth dialog onClose={() => setAuthDialogOpen(false)} />
      )}

      {/* Header */}
      {step !== "signin" && (
      <nav className="co-nav">
        <Link href="/" className="co-brand">
          <Image src="/logo.png" alt="" width={30} height={30} className="co-brand-logo" priority />
          World of Physics
        </Link>
        <Link href="/" className="co-back">
          ← Back to portal
        </Link>
      </nav>
      )}

      {step === "grade" && (
        <>
          {/* Hero — the mock, wired to the real catalog */}
          <section className="co-hero" aria-labelledby="grade-heading">
            <div>
              <span className="co-stepchip">Step 1 of {Object.keys(stepIndex).length}</span>
              <h1 className="co-h1" id="grade-heading">Pick your <span className="hl">grade</span></h1>
              <p className="co-sub">
                Choose the class or exam you&apos;re preparing for. Each topic below
                is a downloadable formula-sheet PDF.
              </p>
            </div>
            <div className="co-art" aria-hidden="true">
              <FormulaSheetArt />
            </div>
          </section>

          {/* Grade cards */}
          <section className="co-grades" aria-label="Choose a grade">
            {BUCKETS.map((b) => (
              <button key={b.key} className="co-grade" onClick={() => selectBucket(b.key)}>
                <span className="co-grade-icon" aria-hidden="true">
                  <GradeIcon name={b.icon} />
                </span>
                <span className="co-grade-body">
                  <span className="co-grade-name">{b.title}</span>
                  <span className="co-grade-sub">{b.sub}</span>
                  <span className="co-grade-count">
                    {bucketCounts[b.key] === 0
                      ? "No sheets yet"
                      : `${bucketCounts[b.key]} formula sheet${bucketCounts[b.key] === 1 ? "" : "s"}`}
                  </span>
                </span>
                <span className="co-grade-arrow" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" /><path d="M13 6l6 6-6 6" />
                  </svg>
                </span>
              </button>
            ))}
          </section>

          {/* Trust bar */}
          <section className="co-trust" aria-label="What you get">
            <div className="co-trust-item">
              <svg className="co-trust-ico" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 3h9l4 4v14H6z" /><path d="M9 8h6M9 12h6M9 16h4" />
              </svg>
              <span>
                <span className="co-trust-title">Formula Sheets</span>
                <span className="co-trust-sub">Chapter-wise PDF downloads</span>
              </span>
            </div>
            <div className="co-trust-item">
              <svg className="co-trust-ico" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" />
              </svg>
              <span>
                <span className="co-trust-title">Exam Focused</span>
                <span className="co-trust-sub">For Boards, JEE &amp; NEET</span>
              </span>
            </div>
            <div className="co-trust-item">
              <svg className="co-trust-ico" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3v13" /><path d="M7 11l5 5 5-5" /><path d="M4 20h16" />
              </svg>
              <span>
                <span className="co-trust-title">Quick Access</span>
                <span className="co-trust-sub">Download anytime, anywhere</span>
              </span>
            </div>
          </section>
        </>
      )}

      {/* ---------- Step 2: Topics (this bucket) ---------- */}
      {step === "topic" && bucket && (
        <main className="course-main">
          <section className="course-card">
            <div className="course-step-head">
              <button className="course-back-btn" onClick={goBack} aria-label="Back">←</button>
              <span className="course-step-badge">Step 2 of 4</span>
              <h1 className="course-step-title">{bucketName} — pick a sheet</h1>
            </div>
            {topics.length === 0 ? (
              <div className="course-empty">
                No formula sheets uploaded for <strong>{bucketName}</strong> yet.<br />
                Your teacher uploads new sheets before every mock — check back after the next one.
              </div>
            ) : (
              <div className="course-topic-grid">
                {topics.map((t) => {
                  const already = purchased[t.id];
                  return (
                    <button
                      key={t.id}
                      className={`course-topic-btn${already ? " course-topic-bought" : ""}${auth !== "in" ? " course-topic-disabled" : ""}`}
                      onClick={() => selectTopic(t)}
                      disabled={already || auth !== "in"}
                    >
                      <span className="course-topic-info">
                        <span className="course-topic-name">{t.name}</span>
                        <span className="course-topic-price">
                          {already ? "Purchased" : `${formatPrice(t.price)} · ${t.gradeName}`}
                        </span>
                      </span>
                      {already ? (
                        <span className="course-topic-check" aria-hidden="true">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5l5 5L20 6.5" /></svg>
                        </span>
                      ) : (
                        <span className="course-topic-arrow" aria-hidden="true">→</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
          <AdSlot slotId={process.env.NEXT_PUBLIC_ADSENSE_SLOT_COURSE_MID} />
        </main>
      )}

      {/* ---------- Step 3: Payment ---------- */}
      {step === "payment" && selectedTopic && (
        <main className="course-main">
          <section className="course-card course-card-wide">
            <div className="course-step-head">
              <button className="course-back-btn" onClick={goBack} aria-label="Back">←</button>
              <span className="course-step-badge">Step 3 of 4</span>
              <h1 className="course-step-title">Pay to download</h1>
            </div>
            <div className="course-pay-summary">
              <div className="course-pay-item">
                <span className="course-pay-label">Sheet</span>
                <span className="course-pay-value">{selectedTopic.name}</span>
              </div>
              <div className="course-pay-item">
                <span className="course-pay-label">Bucket</span>
                <span className="course-pay-value">{selectedTopic.gradeName}</span>
              </div>
              <div className="course-pay-item course-pay-item-total">
                <span className="course-pay-label">Amount</span>
                <span className="course-pay-value tnum">{formatPrice(selectedTopic.price)}</span>
              </div>
            </div>
            {payError && <div className="course-pay-err" role="alert">{payError}</div>}
            <button className="btn course-pay-btn" onClick={handlePay} disabled={paying}>
              {paying ? "Processing…" : `Pay ${formatPrice(selectedTopic.price)}`}
            </button>
            <p className="course-pay-note">Demo checkout — replace with Razorpay/Stripe for real payments.</p>
          </section>
        </main>
      )}

      {/* ---------- Step 4: Success / Download ---------- */}
      {step === "success" && paidTopic && (
        <main className="course-main">
          <section className="course-card course-card-wide course-success">
            <div className="course-success-badge" aria-hidden="true">
              <div className="course-star" />
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" /></svg>
            </div>
            <h1 className="course-step-title">Payment successful</h1>
            <p className="course-desc">
              Your formula sheet is ready to download. Click below to open or save the PDF.
            </p>
            <div className="course-download">
              <a
                href={
                  bucket
                    ? bucketTopics(bucket).find((t) => t.id === paidTopic)?.pdfUrl ?? "#"
                    : "#"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="btn"
                onClick={downloadPdf}
              >
                Download PDF
              </a>
              <p className="course-download-hint">Opens in a new tab · re-download anytime from this page</p>
            </div>
            <div className="course-actions">
              <button className="btn btn--soft" onClick={() => { setStep("grade"); setBucket(null); setPaidTopic(null); setSelectedTopic(null); }}>
                Browse more sheets
              </button>
            </div>
          </section>
        </main>
      )}

      {/* Footer */}
      {step !== "signin" && (
        <footer className="co-foot">
          <span>World of Physics</span>
          <span>For practice only · Not affiliated with NTA</span>
        </footer>
      )}
    </div>
  );
}

/* ---------- Inline SVG artwork — formula sheet illustration (hand-built) ---------- */
function FormulaSheetArt() {
  return (
    <svg viewBox="0 0 340 320" role="img" aria-label="A physics formula sheet with an atom symbol and a PDF download badge">
      {/* pear organic blob */}
      <path
        fill="oklch(93% 0.07 95)"
        d="M84 58c26-25 78-30 120-14 40 15 72 48 78 96 6 47-20 95-62 116-40 20-96 24-132 4C56 240 30 200 26 152 22 108 58 83 84 58z"
      />
      {/* sheet shadow */}
      <g transform="rotate(-7 170 160)">
        <rect x="96" y="52" width="150" height="200" rx="10" fill="oklch(20% 0.012 250 / 0.10)" transform="translate(8 10)" />
        <rect x="96" y="52" width="150" height="200" rx="10" fill="#ffffff" stroke="oklch(88% 0.012 95)" strokeWidth="1.5" />
        {/* folded corner */}
        <path d="M216 52l30 30h-30z" fill="oklch(92% 0.014 95)" stroke="oklch(88% 0.012 95)" strokeWidth="1.5" strokeLinejoin="round" />
        {/* atom */}
        <g transform="translate(171 122)" stroke="oklch(78% 0.16 85)" strokeWidth="3.4" fill="none">
          <ellipse rx="26" ry="9.5" />
          <ellipse rx="26" ry="9.5" transform="rotate(60)" />
          <ellipse rx="26" ry="9.5" transform="rotate(120)" />
        </g>
        <circle cx="171" cy="122" r="6.5" fill="oklch(78% 0.16 85)" />
        {/* equation lines */}
        <rect x="122" y="172" width="98" height="6" rx="3" fill="oklch(88% 0.012 95)" />
        <rect x="122" y="188" width="120" height="6" rx="3" fill="oklch(84% 0.014 95)" />
        <rect x="122" y="204" width="66" height="6" rx="3" fill="oklch(88% 0.012 95)" />
      </g>
      {/* PDF chip */}
      <g transform="translate(108 218) rotate(-7)">
        <rect width="66" height="26" rx="7" fill="oklch(55% 0.19 245)" />
        <text x="33" y="17.5" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontWeight="700" fontSize="12.5" fill="#ffffff" letterSpacing="1">PDF</text>
      </g>
      {/* download badge */}
      <g transform="translate(248 232)">
        <circle r="26" fill="oklch(86% 0.18 95)" stroke="oklch(74% 0.19 85)" strokeWidth="2" />
        <path d="M0 -9v11" stroke="oklch(20% 0.012 250)" strokeWidth="3" strokeLinecap="round" />
        <path d="M-6.5 -3l6.5 6.5 6.5-6.5" fill="none" stroke="oklch(20% 0.012 250)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M-8.5 8h17" stroke="oklch(20% 0.012 250)" strokeWidth="3" strokeLinecap="round" />
      </g>
      {/* spark strokes */}
      <g stroke="oklch(78% 0.16 85)" strokeWidth="4" strokeLinecap="round">
        <path d="M252 96l9-17" />
        <path d="M268 122l15-13" />
      </g>
    </svg>
  );
}

function GradeIcon({ name }: { name: "cap" | "doc" | "flame" }) {
  const common = {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  if (name === "cap") {
    return (
      <svg {...common}>
        <path d="M12 4L2 9.5 12 15l10-5.5L12 4z" />
        <path d="M6 12v4.5c0 1.5 2.7 3 6 3s6-1.5 6-3V12" />
      </svg>
    );
  }
  if (name === "doc") {
    return (
      <svg {...common}>
        <path d="M6 3h9l4 4v14H6z" />
        <path d="M9 9h6M9 13h6M9 17h4" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M12 3c.8 3.5-2.5 4.5-2.5 8a5 5 0 0 0 10 0c0-2-1-3.5-2-5-.8 1.3-2 2-3.5 2 .9-1.5 2.5-3.5-2.5-5z" />
      <path d="M12 22a6 6 0 0 1-6-6" />
    </svg>
  );
}
