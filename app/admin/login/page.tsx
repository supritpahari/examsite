"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAnalyticsInstance, getAuthInstance, onAuthState } from "@/lib/firebase/client";
import {
  signInWithEmailAndPassword,
  type AuthError,
} from "firebase/auth";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  useEffect(() => {
    getAnalyticsInstance();
    const unsub = onAuthState((user) => {
      if (user) router.replace("/admin");
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
      <style>{`
        .v2-admin-root {
          min-height: 100vh;
          background: var(--paper);
          color: var(--ink);
          font-family: 'Inter', sans-serif;
          position: relative;
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
        }

        .v2-admin-root::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image: radial-gradient(rgba(20,17,13,0.04) 1px, transparent 1px);
          background-size: 4px 4px;
          opacity: 0.6;
        }

        .v2-admin-root .serif { font-family: 'Instrument Serif', 'Times New Roman', serif; font-weight: 400; }
        .v2-admin-root .mono { font-family: 'JetBrains Mono', monospace; }

        .v2-admin-left {
          position: relative;
          padding: 64px 56px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          border-right: 1px solid var(--rule);
        }

        .v2-admin-brand {
          font-family: 'Instrument Serif', serif;
          font-size: 22px;
          letter-spacing: -0.01em;
          display: flex;
          align-items: baseline;
          gap: 6px;
        }
        .v2-admin-brand em { font-style: italic; color: var(--accent); }

        .v2-admin-headline {
          font-family: 'Instrument Serif', serif;
          font-size: clamp(48px, 5.5vw, 92px);
          line-height: 0.98;
          letter-spacing: -0.025em;
          font-weight: 400;
          max-width: 14ch;
          color: var(--ink);
        }
        .v2-admin-headline em { font-style: italic; color: var(--accent); }

        .v2-admin-foot {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--dim);
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
          background: var(--paper);
          border: 1px solid var(--ink);
          position: relative;
          padding: 40px 36px 32px;
          text-align: left;
        }
        .v2-admin-card::before, .v2-admin-card::after {
          content: "";
          position: absolute;
          width: 12px;
          height: 12px;
          background: var(--ink);
        }
        .v2-admin-card::before { top: -1px; left: -1px; }
        .v2-admin-card::after { bottom: -1px; right: -1px; }

        .v2-admin-num {
          position: absolute;
          top: -14px;
          left: 24px;
          background: var(--paper);
          padding: 0 10px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          color: var(--ink);
        }

        .v2-admin-title {
          font-family: 'Instrument Serif', serif;
          font-size: 26px;
          line-height: 1.2;
          margin: 0 0 6px;
          color: var(--ink);
        }
        .v2-admin-title em { font-style: italic; color: var(--accent); }

        .v2-admin-desc {
          font-size: 13px;
          color: var(--dim);
          margin: 0 0 26px;
          font-family: 'JetBrains Mono', monospace;
          letter-spacing: 0.02em;
        }

        .v2-admin-error {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          color: #fff;
          background: #b3261e;
          padding: 10px 14px;
          margin-bottom: 20px;
          letter-spacing: 0.02em;
        }

        .v2-field { margin-bottom: 18px; }
        .v2-field label {
          display: block;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.18em;
          color: var(--ink-2);
          margin-bottom: 8px;
        }
        .v2-field input {
          width: 100%;
          background: transparent;
          border: 1px solid var(--ink);
          border-radius: 0;
          padding: 14px 16px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 15px;
          color: var(--ink);
          outline: none;
        }
        .v2-field input::placeholder { color: #b8ad96; }
        .v2-field input:focus { background: #fff; }

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
          color: var(--ink-2);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.15s ease, transform 0.2s ease;
        }
        .v2-eye:hover { color: var(--accent); }
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
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--dim);
        }
        .v2-admin-row a { color: var(--accent); text-decoration: none; border-bottom: 1px solid currentColor; }

        .v2-admin-btn {
          width: 100%;
          background: var(--accent);
          color: #fff;
          border: 1px solid var(--accent);
          padding: 15px;
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 14px;
          letter-spacing: 0.04em;
          cursor: pointer;
          text-transform: uppercase;
          transition: background 0.15s ease;
        }
        .v2-admin-btn:hover { background: var(--accent-2); border-color: var(--accent-2); }
        .v2-admin-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .v2-admin-back {
          display: block;
          text-align: center;
          margin-top: 18px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--dim);
          text-decoration: none;
        }
        .v2-admin-back:hover { color: var(--accent); }

        @media (max-width: 1100px) {
          .v2-admin-headline { font-size: clamp(40px, 8vw, 64px); }
        }

        @media (max-width: 960px) {
          .v2-admin-root { grid-template-columns: 1fr; }
          .v2-admin-left {
            border-right: 0;
            border-bottom: 1px solid var(--rule);
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
        <div className="v2-admin-brand">Exam<em>Site</em></div>
        <h1 className="v2-admin-headline">
          Your Students, <em>Our Management</em>
        </h1>
        <div className="v2-admin-foot">
          Admin Console · Authorized faculty only
        </div>
      </div>

      <div className="v2-admin-right">
        <div className="v2-admin-card">
          <h3 className="v2-admin-title">Faculty <em>login</em></h3>
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
              <a href="#">Forgot password?</a>
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
