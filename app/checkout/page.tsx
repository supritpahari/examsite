/* Checkout page — cart summary, coupon, Razorpay payment. */
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthState, getAuthInstance } from "@/lib/firebase/client";
import { getIdToken, type User } from "firebase/auth";
import FormulaMarks from "../_components/FormulaMarks";
import PhoneAuth from "../_components/PhoneAuth";
import Image from "next/image";

export default function CheckoutPage() {
  const router = useRouter();
  const [auth, setAuth] = useState<"loading" | "in" | "out">("loading");
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMessage, setCouponMessage] = useState("");
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const razorpayRef = useRef<boolean>(false);

  useEffect(() => {
    const unsub = onAuthState((u) => {
      setUser(u);
      setAuth(u ? "in" : "out");
    });
    return unsub;
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("examsite_cart");
      if (raw) setItems(JSON.parse(raw));
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  const subtotal = items.reduce((sum, i) => sum + (i.amount || 0), 0);
  const total = Math.max(0, subtotal - couponDiscount);

  const loadRazorpay = (): Promise<void> => {
    if (razorpayRef.current) return Promise.resolve();
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

  async function applyCoupon() {
    if (!couponCode.trim()) return;
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode, cartAmount: subtotal }),
      });
      const data = await res.json();
      if (data.valid) {
        setCouponDiscount(data.discountAmount ?? 0);
        setCouponMessage(`Coupon applied: ₹${data.discountAmount} off`);
      } else {
        setCouponDiscount(0);
        setCouponMessage(data.message || "Invalid coupon");
      }
    } catch {
      setCouponMessage("Failed to apply coupon");
    }
  }

  const handlePay = async () => {
    const authInst = getAuthInstance();
    if (!authInst.currentUser) {
      setAuthDialogOpen(true);
      return;
    }
    setPayError(null);
    setPaying(true);
    try {
      const createRes = await fetch("/api/course/payment/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getIdToken(authInst.currentUser as User)}`,
        },
        body: JSON.stringify({
          topicId: items.map((i) => i.topicId).join(","),
          amount: total,
          courseId: items.map((i) => i.gradeId).join(","),
          gradeId: items.map((i) => i.gradeId).join(","),
          topicName: items.map((i) => i.topicName).join(", "),
          gradeName: items.map((i) => i.gradeName).join(", "),
          couponCode: couponCode.trim() || null,
          discountAmount: couponDiscount,
        }),
      });

      if (!createRes.ok) {
        const errData = await createRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to create payment order");
      }

      const { orderId, amount, currency, key } = await createRes.json();
      await loadRazorpay();

      const options = {
        key,
        amount,
        currency,
        name: "World of Physics",
        description: `Formula Sheets: ${items.map((i) => i.topicName).join(", ")}`,
        order_id: orderId,
        prefill: {
          name: "",
          contact: user?.phoneNumber?.replace("+91", "") || "",
          email: "",
        },
        theme: { color: "#f39c12" },
        handler: async (response: any) => {
          const verifyRes = await fetch("/api/course/payment/verify", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${await getIdToken(authInst.currentUser as User)}`,
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

          window.localStorage.removeItem("examsite_cart");
          setItems([]);
          router.push("/course?checkout=success");
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
      setPayError(err instanceof Error ? err.message : "Payment failed.");
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="co-guard" role="status">
        Loading checkout…
      </div>
    );
  }

  if (auth !== "in") {
    return (
      <div className="co-root">
        <FormulaMarks />
        <div className="co-guard" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <PhoneAuth dialog onClose={() => setAuthDialogOpen(true)} />
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="co-root">
        <FormulaMarks />
        <nav className="co-nav">
          <Link href="/" className="co-brand">
            <Image src="/logo.png" alt="" width={30} height={30} className="co-brand-logo" priority />
            World of Physics
          </Link>
          <Link href="/cart" className="co-back">
            ← Back to cart
          </Link>
        </nav>
        <main className="co-main">
          <p className="co-kicker">Checkout</p>
          <h1 className="co-h1">Your cart is empty</h1>
          <div className="co-empty">
            Add some formula sheets to your cart first.<br />
            <Link href="/course">Browse sheets →</Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="co-root">
      <FormulaMarks />
      <style>{`
        .co-root { min-height: 100vh; background: var(--color-paper); color: var(--color-ink); position: relative; isolation: isolate; overflow-x: clip; font-family: var(--font-body); }
        .co-nav { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem var(--page-gutter); border-bottom: 1px solid var(--color-rule); max-width: var(--page-max); margin-inline: auto; }
        .co-brand { font-family: var(--font-display); font-weight: 700; font-size: 1.05rem; letter-spacing: -0.03em; color: var(--color-ink); text-decoration: none; display: inline-flex; align-items: center; gap: 0.6rem; }
        .co-brand-logo { width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--color-rule-2); flex: 0 0 auto; }
        .co-back { font-family: var(--font-mono); font-size: 0.68rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.14em; color: var(--color-muted); text-decoration: none; }
        .co-back:hover { color: var(--color-accent-2-deep); }
        .co-main { max-width: var(--page-max); margin-inline: auto; padding: var(--space-xl) var(--page-gutter) var(--space-2xl); }
        .co-kicker { font-family: var(--font-mono); font-size: 0.62rem; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: var(--color-accent-2-deep); margin: 0 0 0.5rem; }
        .co-h1 { font-size: var(--text-display); line-height: 1.02; margin: 0 0 var(--space-xl); letter-spacing: -0.03em; }
        .co-card { background: var(--color-paper); border: 1px solid var(--color-rule); border-radius: var(--radius-card); box-shadow: var(--shadow-card); padding: var(--space-lg); margin-bottom: var(--space-lg); }
        .co-card-head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-md); margin-bottom: var(--space-md); }
        .co-card-title { font-family: var(--font-display); font-weight: 600; letter-spacing: -0.02em; font-size: 1.15rem; margin: 0; }
        .co-card-hint { font-family: var(--font-mono); font-size: 0.6rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-muted); }
        .co-empty { border: 1.5px dashed var(--color-rule-2); border-radius: var(--radius-input); padding: var(--space-lg); text-align: center; color: var(--color-muted); font-size: 0.9rem; line-height: 1.65; }
        .co-empty a { color: var(--color-accent-2-deep); font-weight: 600; }
        .co-row { display: flex; align-items: center; gap: 0.85rem; padding: 0.7rem 0.75rem; border: 1px solid var(--color-rule); border-radius: var(--radius-input); background: var(--color-paper); }
        .co-row + .co-row { margin-top: 0.55rem; }
        .co-row-main { flex: 1; min-width: 0; }
        .co-row-title { font-weight: 600; font-size: 0.92rem; overflow-wrap: anywhere; }
        .co-row-sub { font-family: var(--font-mono); font-size: 0.62rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-muted); margin-top: 0.15rem; }
        .co-row-action { flex: 0 0 auto; }
        .co-summary { background: var(--color-paper-2); border: 1px solid var(--color-rule); border-radius: var(--radius-card); padding: var(--space-lg); margin-bottom: var(--space-lg); }
        .co-summary-row { display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.9rem; color: var(--color-ink); }
        .co-summary-row.discount { color: var(--color-accent-2-deep); }
        .co-summary-row.total { font-weight: 600; font-size: 1.05rem; border-top: 1px solid var(--color-rule); padding-top: 0.5rem; margin-top: 0.5rem; }
        .co-coupon { display: flex; gap: 0.5rem; margin-bottom: var(--space-lg); flex-wrap: wrap; }
        .co-coupon input { flex: 1; min-width: 0; background: var(--color-paper-2); border: 1.5px solid transparent; border-radius: var(--radius-input); padding: 0.7rem 0.8rem; font-family: var(--font-body); font-size: 0.95rem; color: var(--color-ink); }
        .co-coupon-msg { font-size: 0.78rem; margin-top: 0.3rem; color: var(--color-accent-2-deep); }
        .co-coupon-msg.err { color: var(--color-danger); }
        .co-actions { display: flex; gap: 0.75rem; justify-content: flex-end; }
        @media (max-width: 760px) {
          .co-coupon { flex-direction: column; }
          .co-coupon input { width: 100%; }
          .co-actions { flex-direction: column; }
          .co-actions button { width: 100%; }
        }
      `}</style>
      <nav className="co-nav">
        <Link href="/" className="co-brand">
          <Image src="/logo.png" alt="" width={30} height={30} className="co-brand-logo" priority />
          World of Physics
        </Link>
        <Link href="/cart" className="co-back">
          ← Back to cart
        </Link>
      </nav>
      <main className="co-main">
        <p className="co-kicker">Checkout</p>
        <h1 className="co-h1">Checkout</h1>

        <section className="co-card">
          <div className="co-card-head">
            <h2 className="co-card-title">Order Summary</h2>
          </div>
          {items.map((item) => (
            <div className="co-row" key={`${item.gradeId}-${item.topicId}`}>
              <div className="co-row-main">
                <div className="co-row-title">{item.topicName || item.topicId}</div>
                <div className="co-row-sub">{item.gradeName}</div>
              </div>
              <div className="co-row-sub" style={{ textAlign: "right" }}>
                ₹{item.amount}
              </div>
            </div>
          ))}
        </section>

        <section className="co-summary">
          <div className="co-summary-row">
            <span>Subtotal</span>
            <span>₹{subtotal}</span>
          </div>
          {couponDiscount > 0 && (
            <div className="co-summary-row discount">
              <span>Discount</span>
              <span>−₹{couponDiscount}</span>
            </div>
          )}
          <div className="co-summary-row total">
            <span>Total</span>
            <span>₹{total}</span>
          </div>
        </section>

        <section className="co-card">
          <div className="co-coupon">
            <input
              placeholder="Enter coupon code"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && applyCoupon()}
            />
            <button className="btn" onClick={applyCoupon}>
              Apply
            </button>
          </div>
          {couponMessage && (
            <p className={`co-coupon-msg ${couponDiscount > 0 ? "" : "err"}`}>
              {couponMessage}
            </p>
          )}
        </section>

        <div className="co-actions">
          <button
            className="btn btn--soft"
            onClick={() => router.push("/cart")}
            style={{ padding: "0.7rem 1rem", fontSize: "0.88rem" }}
          >
            Back to cart
          </button>
          <button
            className="btn"
            onClick={handlePay}
            disabled={paying || total <= 0}
          >
            {paying ? "Processing…" : `Pay ₹${total}`}
          </button>
          {payError && <div className="course-pay-err" role="alert">{payError}</div>}
        </div>
      </main>
    </div>
  );
}
