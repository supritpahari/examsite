/* Hallmark · genre: playful · theme: Hum · design-system: design.md · designed-as-app */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAnalyticsInstance, getAuthInstance, onAuthState } from "@/lib/firebase/client";
import {
  signInWithEmailAndPassword,
  type AuthError,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import FormulaMarks from "../../_components/FormulaMarks";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  useEffect(() => {
    try {
      getAnalyticsInstance();
    } catch {
      /* analytics is optional — never let a failure block auth */
    }
    const unsub = onAuthState((user) => {
      // Mirror AdminGate: only staff (password sign-in) belong in /admin.
      // A student phone-OTP session must NOT bounce the page back to /admin,
      // or the two guards redirect forever.
      const isStaff = Boolean(
        user && user.providerData?.some((p) => p.providerId === "password")
      );
      if (isStaff) router.replace("/admin");
    });
    return unsub;
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const auth = getAuthInstance();
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.push("/admin");
    } catch (err) {
      const code = (err as AuthError)?.code ?? "";
      setError(
        code === "auth/invalid-credential" ||
          code === "auth/wrong-password" ||
          code === "auth/user-not-found"
          ? "Invalid email or password."
          : code === "auth/invalid-email"
          ? "Please enter a valid email."
          : code === "auth/too-many-requests"
          ? "Too many attempts. Try again later."
          : "Sign in failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="v2-admin-root"
    >
      <FormulaMarks />
      <style>{`
        .v2-admin-root {
          isolation: isolate;
          min-height: 100vh;
          background: var(--color-paper);
          color: var(--color-ink);
          font-family: var(--font-body);
          position: relative;
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
        }


        .v2-admin-left .hl { --hl: oklch(86% 0.18 95 / 0.4); }

        .v2-admin-left {
          position: relative;
          isolation: isolate;
          padding: 56px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 3rem;
          background: var(--color-panel);
          color: var(--color-on-panel);
        }

        .v2-admin-brand {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 1.15rem;
          letter-spacing: -0.03em;
          display: flex;
          align-items: center;
          gap: 0.6rem;
          color: var(--color-on-panel);
        }

        .v2-admin-headline {
          font-family: var(--font-display);
          font-size: clamp(2.6rem, 5.2vw + 1rem, 4.6rem);
          line-height: 1.0;
          letter-spacing: -0.035em;
          font-weight: 600;
          max-width: 13ch;
          color: var(--color-on-panel);
        }

        .v2-admin-foot {
          font-family: var(--font-mono);
          font-size: 0.64rem;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          color: var(--color-panel-dim);
        }

        .v2-admin-right {
          position: relative;
          padding: 64px 56px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .v2-admin-card {
          width: 100%;
          max-width: 420px;
          background: var(--color-paper);
          border: 1px solid var(--color-rule-2);
          border-radius: var(--radius-card);
          box-shadow: var(--shadow-lift);
          position: relative;
          padding: 2.25rem 2rem 1.75rem;
          text-align: left;
        }


        .v2-admin-title {
          font-family: var(--font-display);
          font-size: 26px;
          line-height: 1.2;
          margin: 0 0 6px;
          color: var(--color-ink);
        }

        .v2-admin-desc {
          font-size: 13px;
          color: var(--color-muted);
          margin: 0 0 26px;
          font-family: var(--font-mono);
          letter-spacing: 0.02em;
        }

        .v2-admin-error {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--color-on-accent);
          background: var(--color-danger);
          padding: 10px 14px;
          margin-bottom: 20px;
          letter-spacing: 0.02em;
        }

        .v2-field { margin-bottom: 18px; }
        .v2-field label {
          display: block;
          font-family: var(--font-mono);
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.18em;
          color: var(--color-ink-2);
          margin-bottom: 8px;
        }
        .v2-field input {
          width: 100%;
          background: transparent;
          border: 1px solid var(--color-ink);
          border-radius: var(--radius-input);
          padding: 14px 16px;
          font-family: var(--font-mono);
          font-size: 15px;
          color: var(--color-ink);
          outline: none;
        }
        .v2-field input::placeholder { color: var(--color-faint); }
        .v2-field input:focus { background: var(--color-paper); }

        .v2-password-wrap { position: relative; }
        .v2-password-wrap input { padding-right: 46px; }
        .v2-eye {
          position: absolute;
          top: 50%;
          right: 8px;
          transform: translateY(-50%);
          background: transparent;
          border: 0;
          padding: 8px;
          cursor: pointer;
          color: var(--color-ink-2);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.15s ease, transform 0.2s ease;
        }
        .v2-eye:hover { color: var(--color-accent); }
        .v2-eye:active { transform: translateY(-50%) scale(0.88); }
        .v2-eye svg { width: 18px; height: 18px; display: block; }

        .v2-eye-slash {
          transform-box: fill-box;
          transform-origin: top center;
          transform: scaleY(0);
          transition: transform 0.32s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .v2-eye.show .v2-eye-slash { transform: scaleY(1); }

        @media (prefers-reduced-motion: reduce) {
          .v2-eye-slash { transition: none; }
        }

        .v2-admin-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin: 4px 0 22px;
          font-family: var(--font-mono);
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--color-muted);
        }
        .v2-admin-row a { color: var(--color-accent); text-decoration: none; border-bottom: 1px solid currentColor; }

        .v2-admin-btn {
          width: 100%;
          background: var(--color-accent);
          color: var(--color-on-accent);
          border: 0;
          border-radius: var(--radius-pill);
          padding: 0.9rem;
          font-family: var(--font-display);
          font-weight: 600;
          font-size: 0.95rem;
          letter-spacing: -0.01em;
          cursor: pointer;
          box-shadow: 0 4px 0 0 var(--color-accent-deep), 0 6px 12px -3px var(--color-accent-cast);
          transition: transform var(--dur-micro) var(--ease-press), box-shadow var(--dur-micro) var(--ease-press);
        }
        .v2-admin-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 0 0 var(--color-accent-deep), 0 12px 20px -4px var(--color-accent-cast); }
        .v2-admin-btn:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 1px 0 0 var(--color-accent-deep); }
        .v2-admin-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .v2-admin-back {
          display: block;
          text-align: center;
          margin-top: 18px;
          font-family: var(--font-mono);
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--color-muted);
          text-decoration: none;
        }
        .v2-admin-back:hover { color: var(--color-accent); }

        @media (max-width: 1100px) {
          .v2-admin-headline { font-size: clamp(40px, 8vw, 64px); }
        }

        @media (max-width: 960px) {
          .v2-admin-root { grid-template-columns: 1fr; }
          .v2-admin-left {
            border-right: 0;
            border-bottom: 1px solid var(--color-rule);
            padding: 48px 28px;
            min-height: auto;
          }
          .v2-admin-headline { font-size: clamp(36px, 11vw, 56px); }
          .v2-admin-right { padding: 48px 28px; }
          .v2-admin-card { padding: 36px 24px 28px; }
        }

        @media (max-width: 480px) {
          .v2-admin-left { padding: 36px 20px; }
          .v2-admin-right { padding: 36px 20px; }
          .v2-admin-card { padding: 32px 20px 24px; }
          .v2-admin-headline { font-size: clamp(32px, 12vw, 44px); }
          .v2-field input { font-size: 14px; padding: 12px 14px; }
        }
      `}</style>

      <div className="v2-admin-left">
        <FormulaMarks variant="dark" />
        <div className="v2-admin-brand"><span style={{ width: 12, height: 12, borderRadius: 999, background: "var(--color-accent)", boxShadow: "0 0 0 3px oklch(86% 0.18 95 / 0.22)" }} aria-hidden="true" />World of <span style={{ color: "var(--color-accent)" }}>Physics</span></div>
        <h1 className="v2-admin-headline">
          Your Students, <span className="hl">Our Management</span>
        </h1>
        <div className="v2-admin-foot">
          Admin Console · Authorized faculty only
        </div>
      </div>

      <div className="v2-admin-right">
        <div className="v2-admin-card">
          <h3 className="v2-admin-title">Faculty <span className="hl">login</span></h3>
          <p className="v2-admin-desc">Sign in with your Firebase account.</p>
          {error && (
            <div className="v2-admin-error" role="alert">{error}</div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="v2-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                placeholder="you@examsite.in"
                  autoComplete="email"
                  value={email}
                  disabled={loading}
                  onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="v2-field">
              <label htmlFor="password">Password</label>
              <div className="v2-password-wrap">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  disabled={loading}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className={`v2-eye${showPassword ? " show" : ""}`}
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                    <line className="v2-eye-slash" x1="3" y1="3" x2="21" y2="21" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="v2-admin-row">
              <span>Secure session</span>
            </div>
            <button type="submit" className="v2-admin-btn" disabled={loading}>
              {loading ? "Signing in…" : "Sign in →"}
            </button>
          </form>
          <Link href="/" className="v2-admin-back">← Back to site</Link>
        </div>
      </div>
    </div>
  );
}
