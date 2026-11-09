/* Hallmark · genre: playful · theme: Hum · design-system: design.md · designed-as-app
 * Student sign-in before a test starts — Firebase Phone Auth (OTP).
 * Full-viewport, same Hum system as the rest of the site.
 * Indian numbers (+91), invisible reCAPTCHA, one-time-code autofill. */
"use client";

import { useEffect, useRef, useState } from "react";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type Auth,
  type ConfirmationResult,
} from "firebase/auth";
import { getAuthInstance } from "@/lib/firebase/client";
import { saveProfile, fetchProfile } from "@/lib/profile";
import FormulaMarks from "./FormulaMarks";
import Image from "next/image";

type Phase = "phone" | "sending" | "code" | "verifying" | "name";

function friendlyError(code: string): string {
  switch (code) {
    case "auth/invalid-phone-number":
      return "That phone number doesn't look right. Check it and try again.";
    case "auth/missing-phone-number":
      return "Enter your mobile number to get the code.";
    case "auth/too-many-requests":
      return "Too many attempts — wait a few minutes and try again.";
    case "auth/quota-exceeded":
      return "Too many attempts — wait a few minutes and try again.";
    case "auth/invalid-verification-code":
      return "That code doesn't match. Try again or resend.";
    case "auth/code-expired":
      return "That code expired — send a new one.";
    case "auth/invalid-verification-id":
    case "auth/missing-verification-id":
      return "The security check expired. Send the code again.";
    case "auth/network-request-failed":
    case "auth/network-unavailable":
      return "Network issue — check your connection and try again.";
    case "auth/unauthorized-domain":
      return "This domain isn't authorized for sign-in. Tell your teacher.";
    case "auth/operation-not-allowed":
      return "Phone sign-in isn't enabled yet. Tell your teacher.";
    case "auth/invalid-app-credential":
      return "The security check was rejected. Turn off ad-blockers / Brave Shields for this site and try again.";
    case "auth/captcha-check-failed":
      return "The security check was rejected. Turn off ad-blockers / Brave Shields for this site and try again.";
    default:
      return "Something went wrong — try again.";
  }
}

export default function PhoneAuth({
  dialog,
  onClose,
}: { dialog?: boolean; onClose?: () => void } = {}) {
  const [phase, setPhase] = useState<Phase>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [saving, setSaving] = useState(false);
  const [hasSavedName, setHasSavedName] = useState<boolean | null>(null);

  // Firebase is client-only here — never initialize it during render/SSR.
  const authRef = useRef<Auth | null>(null);
  const getAuth = (): Auth => {
    if (!authRef.current) authRef.current = getAuthInstance();
    return authRef.current;
  };
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const otpInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Tokens are single-use — tear down and recreate around every attempt
  // instead of reusing a stale verifier after a failed send.
  const resetRecaptcha = async () => {
    if (recaptchaRef.current) {
      try {
        await recaptchaRef.current.clear();
      } catch {
        /* best effort */
      }
      recaptchaRef.current = null;
    }
    const el = document.getElementById("recaptcha-phone-login");
    if (el) el.innerHTML = "";
  };

  // 30-second resend cooldown
  useEffect(() => {
    if (resendIn <= 0) return;
    const id = window.setInterval(() => {
      setResendIn((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [resendIn]);

  useEffect(() => {
    if (phase === "code") otpInputRef.current?.focus();
  }, [phase]);

  useEffect(() => {
    if (phase === "name") nameInputRef.current?.focus();
  }, [phase]);

  // WebOTP — auto-capture 6-digit OTP from incoming SMS (Chrome/Android).
  // Falls back gracefully on browsers that don't support it.
  useEffect(() => {
    if (phase !== "code" || !confirmationRef.current) return;

    const tryWebOTP = async () => {
      if (
        typeof navigator !== "undefined" &&
        navigator.credentials &&
        "OTPCredential" in window
      ) {
        try {
          const credential: any = await (navigator.credentials as any).get({
            otp: { transport: ["sms"] },
          });
          const code = credential?.code;
          if (code) {
            setOtp(code);
            await verifyCode(); // auto-verify once captured
          }
        } catch {
          // WebOTP not supported or no SMS received — user types manually.
        }
      }
    };

    void tryWebOTP();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    return () => {
      void resetRecaptcha();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const normalizedPhone = (): string | null => {
    const digits = phone.replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(digits)) return null;
    return `+91${digits}`;
  };

  const sendCode = async () => {
    setError(null);
    const number = normalizedPhone();
    if (!number) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }
    await resetRecaptcha();
    setPhase("sending");
    try {
      const auth = getAuth();
      const verifier = new RecaptchaVerifier(auth, "recaptcha-phone-login", {
        size: "invisible",
      });
      recaptchaRef.current = verifier;
      confirmationRef.current = await signInWithPhoneNumber(auth, number, verifier);
      setOtp("");
      setResendIn(30);
      setPhase("code");
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      setError(friendlyError(code));
      setPhase("phone");
      await resetRecaptcha();
    }
  };

  const verifyCode = async () => {
    setError(null);
    if (!confirmationRef.current) {
      setError("Request a new code first.");
      setPhase("phone");
      return;
    }
    const code = otp.replace(/\D/g, "");
    if (code.length < 6) {
      setError("Enter the 6-digit code.");
      return;
    }
    setPhase("verifying");
    try {
      await confirmationRef.current.confirm(code);
      // OTP verified — check if the user already has a saved name.
      const auth = getAuth();
      const uid = auth.currentUser?.uid;
      if (uid) {
        try {
          const profile = await fetchProfile(uid);
          if (profile?.name) {
            // Name already saved — skip the name phase entirely.
            onClose?.();
            return;
          }
        } catch {
          /* profile read failed — fall through to asking for the name */
        }
      }
      setPhase("name");
    } catch (err) {
      const codeId = (err as { code?: string })?.code ?? "";
      setError(friendlyError(codeId));
      setPhase("code");
    }
  };

  const changeNumber = () => {
    setPhase("phone");
    setOtp("");
    setError(null);
    confirmationRef.current = null;
    setHasSavedName(null);
  };

  const saveName = async () => {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter your name.");
      return;
    }
    const auth = getAuth();
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setError("Session lost — verify again.");
      setPhase("phone");
      return;
    }
    setSaving(true);
    try {
      await saveProfile(uid, trimmed);
      setHasSavedName(true);
      onClose?.();
    } catch {
      setError("Couldn't save your name — try again.");
    } finally {
      setSaving(false);
    }
  };

  const styleTag = (
    <style>{`
        .lp-auth { min-height: 100vh; min-height: 100dvh; background: var(--color-paper); color: var(--color-ink); display: grid; place-items: center; padding: 2.5rem 1.25rem; position: relative; overflow-x: clip; }
        .lp-auth-card { position: relative; width: 100%; max-width: 430px; background: var(--color-paper); border: 1px solid var(--color-rule); border-radius: var(--radius-card); box-shadow: var(--shadow-lift); padding: 2rem 1.75rem 1.5rem; z-index: 1; }
        .lp-auth-brand { display: flex; align-items: center; gap: 0.65rem; text-decoration: none; margin-bottom: 1.4rem; }
        .lp-auth-wordmark { font-family: var(--font-display); font-weight: 700; font-size: 1.15rem; letter-spacing: -0.03em; color: var(--color-ink); display: inline-flex; align-items: center; gap: 0.5rem; }
        .lp-auth-dot { width: 11px; height: 11px; border-radius: 999px; background: var(--color-accent); }
        .lp-auth-kicker { font-family: var(--font-mono); font-size: 0.62rem; font-weight: 500; letter-spacing: 0.2em; text-transform: uppercase; color: var(--color-muted); margin-bottom: 0.5rem; }
        .lp-auth-title { font-family: var(--font-display); font-weight: 600; letter-spacing: -0.03em; line-height: 1.1; font-size: 1.9rem; margin: 0 0 0.4rem; }
        .lp-auth-sub { font-size: 0.9rem; line-height: 1.55; color: var(--color-ink-2); margin: 0 0 1.25rem; }
        .lp-phone-row { display: flex; gap: 0.5rem; align-items: stretch; }
        .lp-cc { display: flex; align-items: center; padding: 0 0.9rem; background: var(--color-paper-2); border: 1.5px solid transparent; border-radius: var(--radius-input); font-family: var(--font-mono); font-size: 0.95rem; color: var(--color-ink); flex: 0 0 auto; }
        .lp-phone-row input, .lp-otp {
          flex: 1; width: 100%; min-width: 0; box-sizing: border-box; background: var(--color-paper-2); border: 1.5px solid transparent; border-radius: var(--radius-input);
          padding: 0.75rem 0.9rem; font-family: var(--font-mono); font-size: 1rem; color: var(--color-ink); outline: none;
          letter-spacing: 0.06em; transition: border-color var(--dur-micro), background var(--dur-micro);
        }
        .lp-phone-row input:focus, .lp-otp:focus { border-color: var(--color-accent-2); background: var(--color-paper); }
        .lp-otp { font-size: 1.35rem; letter-spacing: 0.35em; text-align: center; }
        .lp-cta { width: 100%; margin-top: 0.85rem; }
        .lp-error { font-size: 0.85rem; color: var(--color-danger); background: var(--color-danger-soft); border-radius: var(--radius-sm); padding: 0.55rem 0.75rem; margin: 0 0 0.75rem; line-height: 1.5; }
        .lp-row-links { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-top: 0.85rem; flex-wrap: wrap; }
        .lp-link { font-family: var(--font-body); font-size: 0.8rem; font-weight: 600; color: var(--color-accent-2-deep); background: transparent; border: 0; cursor: pointer; text-decoration: underline; text-underline-offset: 2px; padding: 0.25rem 0; }
        .lp-link:disabled { color: var(--color-muted); text-decoration: none; cursor: default; }
        .lp-note { font-family: var(--font-mono); font-size: 0.6rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-muted); margin-top: 1.1rem; text-align: center; line-height: 1.7; }
        .lp-code-hint { font-size: 0.84rem; color: var(--color-muted); margin: 0.1rem 0 0.9rem; line-height: 1.5; }
        .lp-code-hint strong { color: var(--color-ink); font-weight: 600; }

        {/* Dialog mode overrides */}
        .lp-auth-dialog-container { min-height: auto; padding: 0; display: block; background: transparent; box-shadow: none; border: none; }
        .lp-auth-dialog-card { max-width: 420px; width: 100%; background: var(--color-paper); border: 1px solid var(--color-rule); border-radius: var(--radius-card); box-shadow: var(--shadow-lift); padding: 2.25rem 2rem 2rem; position: relative; isolation: isolate; }
        .lp-auth-dialog-close { position: absolute; top: 1.1rem; right: 1.1rem; background: transparent; border: none; font-size: 1.25rem; cursor: pointer; color: var(--color-ink-2); line-height: 1; padding: 0.3rem; border-radius: 999px; }
        .lp-auth-dialog-close:hover { color: var(--color-ink); background: var(--color-paper-2); }
        .lp-auth-overlay { position: fixed; inset: 0; background: oklch(20% 0.012 250 / 0.55); display: flex; align-items: center; justify-content: center; z-index: 60; padding: 2rem; }

        /* Dialog-specific refinements — single card, clear hierarchy */
        .lp-auth-dialog-card .lp-auth-brand { margin-bottom: 0.35rem; padding-bottom: 1rem; border-bottom: 1px solid var(--color-rule-2); }
        .lp-auth-dialog-card .lp-auth-kicker { font-size: 0.6rem; letter-spacing: 0.22em; margin-bottom: 0.6rem; color: var(--color-accent-2-deep); font-weight: 700; text-transform: uppercase; }
        .lp-auth-dialog-card .lp-auth-title { font-size: 1.75rem; letter-spacing: -0.02em; margin: 0 0 0.5rem; line-height: 1.12; }
        .lp-auth-dialog-card .lp-auth-sub { font-size: 0.88rem; line-height: 1.6; color: var(--color-ink-2); margin: 0 0 1.5rem; max-width: 34ch; }
        .lp-auth-dialog-card .lp-note { font-size: 0.58rem; letter-spacing: 0.14em; margin-top: 1rem; color: var(--color-muted); }

        .lp-auth-dialog-card .lp-cta { width: 100%; margin-top: 1.25rem; padding: 0.9rem 1rem; font-family: var(--font-display); font-weight: 600; font-size: 1rem; letter-spacing: -0.01em; background: var(--color-accent); color: var(--color-on-accent); border: none; border-radius: var(--radius-pill); cursor: pointer; transition: background var(--dur-micro), transform var(--dur-micro), box-shadow var(--dur-micro); box-shadow: 0 4px 0 var(--color-accent-deep); text-transform: none; }
        .lp-auth-dialog-card .lp-cta:disabled { background: var(--color-muted); box-shadow: 0 4px 0 var(--color-faint); color: oklch(85% 0 0 / 0.6); cursor: not-allowed; }
        .lp-auth-dialog-card .lp-cta:not(:disabled):hover { background: var(--color-accent-deep); transform: translateY(-1px); box-shadow: 0 8px 0 var(--color-accent-deep); }
        .lp-auth-dialog-card .lp-cta:not(:disabled):active { transform: translateY(0); box-shadow: 0 2px 0 var(--color-accent-deep); }

        .lp-auth-dialog-card .lp-phone-row { gap: 0.5rem; margin-bottom: 0; }
        .lp-auth-dialog-card .lp-cc { padding: 0 0.85rem; background: var(--color-paper-2); border-color: var(--color-rule-2); border-width: 1.5px; font-size: 0.9rem; font-weight: 600; }
        .lp-auth-dialog-card .lp-phone-row input { font-size: 1rem; padding: 0.85rem 1rem; }
        .lp-auth-dialog-card .lp-error { font-size: 0.8rem; padding: 0.6rem 0.8rem; margin-bottom: 0.9rem; border-left: 3px solid var(--color-danger); }
        .lp-auth-dialog-card .lp-row-links { margin-top: 1rem; gap: 0.9rem; }
        .lp-auth-dialog-card .lp-link { font-size: 0.78rem; font-weight: 600; color: var(--color-accent-2-deep); padding: 0.2rem 0; }
        .lp-auth-dialog-card .lp-auth-card { padding: 0; box-shadow: none; border: none; background: transparent; }
      `}</style>
  );

  if (!mounted) {
    return (
      <div className="lp-auth">
        <FormulaMarks />
        {styleTag}
        <main className="lp-auth-card" role="status" aria-label="Loading sign-in">
          <p className="lp-auth-kicker">Student sign-in</p>
          <h1 className="lp-auth-title">Loading…</h1>
        </main>
      </div>
    );
  }

  return (
    dialog ? (
      <div className="lp-auth-overlay" onClick={() => onClose?.()}>
        <div className="lp-auth-dialog-card" onClick={(e) => e.stopPropagation()}>
          <button className="lp-auth-dialog-close" onClick={() => onClose?.()} aria-label="Close sign-in">
            ✕
          </button>
          <div className="lp-auth-dialog-container">
            <FormulaMarks />
            {styleTag}
            <main className="lp-auth-card">
              <a className="lp-auth-brand" href="/" aria-label="World of Physics — home">
                <Image src="/logo.png" alt="" width={34} height={34} style={{ borderRadius: 8, border: "1px solid var(--color-rule-2)" }} priority />
                <span className="lp-auth-wordmark"><span className="lp-auth-dot" aria-hidden="true" />World of Physics</span>
              </a>

              {error && <div className="lp-error" role="alert">{error}</div>}

              {phase === "phone" || phase === "sending" ? (
                <>
                  <p className="lp-auth-kicker">Student sign-in</p>
                  <h1 className="lp-auth-title">Enter your mobile number</h1>
                  <p className="lp-auth-sub">We&apos;ll send a one-time code — verify it, and your test starts.</p>
                  <form onSubmit={(e) => { e.preventDefault(); void sendCode(); }}>
                    <label className="visually-hidden" htmlFor="phone-number">Mobile number</label>
                    <div className="lp-phone-row">
                      <span className="lp-cc" aria-hidden="true">+91</span>
                      <input
                        id="phone-number"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        maxLength={10}
                        placeholder="98765 43210"
                        value={phone}
                        disabled={phase === "sending"}
                        onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 10)); if (error) setError(null); }}
                        aria-label="10-digit mobile number"
                      />
                    </div>
                    <button type="submit" className="btn lp-cta" disabled={phase === "sending" || phone.length !== 10}>
                      {phase === "sending" ? "Sending…" : "Send OTP"}
                    </button>
                  </form>
                  <p className="lp-note">India only · One number, one identity · Free to use</p>
                </>
              ) : phase === "name" ? (
                <>
                  <p className="lp-auth-kicker">Almost done</p>
                  <h1 className="lp-auth-title">What&apos;s your name?</h1>
                  <p className="lp-auth-sub">This pre-fills when you take a test — saved to your account.</p>
                  <form onSubmit={(e) => { e.preventDefault(); void saveName(); }}>
                    <label className="visually-hidden" htmlFor="profile-name">Name</label>
                    <input
                      ref={nameInputRef}
                      id="profile-name"
                      type="text"
                      autoComplete="name"
                      maxLength={80}
                      placeholder="e.g. Riya Sharma"
                      value={name}
                      disabled={saving}
                      onChange={(e) => { setName(e.target.value.slice(0, 80)); if (error) setError(null); }}
                      aria-label="Your name"
                    />
                    <button type="submit" className="btn lp-cta" disabled={saving || !name.trim()}>
                      {saving ? "Saving…" : "Save & continue"}
                    </button>
                  </form>
                  {error && <div className="lp-error" role="alert">{error}</div>}
                </>
              ) : (
                <>
                  <p className="lp-auth-kicker">Check your phone</p>
                  <h1 className="lp-auth-title">Enter the 6-digit code</h1>
                  <p className="lp-code-hint">Sent to <strong>+91 {phone}</strong></p>
                  <form onSubmit={(e) => { e.preventDefault(); void verifyCode(); }}>
                    <label className="visually-hidden" htmlFor="otp-code">6-digit code</label>
                    <input
                      ref={otpInputRef}
                      id="otp-code"
                      className="lp-otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      placeholder="——————"
                      value={otp}
                      disabled={phase === "verifying"}
                      onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); if (error) setError(null); }}
                    />
                    <button type="submit" className="btn lp-cta" disabled={phase === "verifying" || otp.length !== 6}>
                      {phase === "verifying" ? "Verifying…" : "Verify & continue"}
                    </button>
                  </form>
                  <div className="lp-row-links">
                    <button className="lp-link" onClick={changeNumber}>Change number</button>
                    <button className="lp-link" onClick={() => void sendCode()} disabled={resendIn > 0}>
                      {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
                    </button>
                  </div>
                </>
              )}
            </main>
          </div>

          {/* invisible reCAPTCHA mount point */}
          <div id="recaptcha-phone-login" />
        </div>
      </div>
    ) : (
      <div className="lp-auth">
        <FormulaMarks />
        {styleTag}
        <main className="lp-auth-card">
          <a className="lp-auth-brand" href="/" aria-label="World of Physics — home">
            <Image src="/logo.png" alt="" width={34} height={34} style={{ borderRadius: 8, border: "1px solid var(--color-rule-2)" }} priority />
            <span className="lp-auth-wordmark"><span className="lp-auth-dot" aria-hidden="true" />World of Physics</span>
          </a>

          {error && <div className="lp-error" role="alert">{error}</div>}

          {phase === "phone" || phase === "sending" ? (
            <>
              <p className="lp-auth-kicker">Student sign-in</p>
              <h1 className="lp-auth-title">Enter your mobile number</h1>
              <p className="lp-auth-sub">We&apos;ll send a one-time code — verify it, and your test starts.</p>
              <form onSubmit={(e) => { e.preventDefault(); void sendCode(); }}>
                <label className="visually-hidden" htmlFor="phone-number">Mobile number</label>
                <div className="lp-phone-row">
                  <span className="lp-cc" aria-hidden="true">+91</span>
                  <input
                    id="phone-number"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    maxLength={10}
                    placeholder="98765 43210"
                    value={phone}
                    disabled={phase === "sending"}
                    onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 10)); if (error) setError(null); }}
                    aria-label="10-digit mobile number"
                  />
                </div>
                <button type="submit" className="btn lp-cta" disabled={phase === "sending" || phone.length !== 10}>
                  {phase === "sending" ? "Sending…" : "Send OTP"}
                </button>
              </form>
              <p className="lp-note">India only · One number, one identity · Free to use</p>
            </>
          ) : phase === "name" ? (
            <>
              <p className="lp-auth-kicker">Almost done</p>
              <h1 className="lp-auth-title">What&apos;s your name?</h1>
              <p className="lp-auth-sub">This pre-fills when you take a test — saved to your account.</p>
              <form onSubmit={(e) => { e.preventDefault(); void saveName(); }}>
                <label className="visually-hidden" htmlFor="profile-name">Name</label>
                <input
                  ref={nameInputRef}
                  id="profile-name"
                  type="text"
                  autoComplete="name"
                  maxLength={80}
                  placeholder="e.g. Riya Sharma"
                  value={name}
                  disabled={saving}
                  onChange={(e) => { setName(e.target.value.slice(0, 80)); if (error) setError(null); }}
                  aria-label="Your name"
                />
                <button type="submit" className="btn lp-cta" disabled={saving || !name.trim()}>
                  {saving ? "Saving…" : "Save & continue"}
                </button>
              </form>
              {error && <div className="lp-error" role="alert">{error}</div>}
            </>
          ) : (
            <>
              <p className="lp-auth-kicker">Check your phone</p>
              <h1 className="lp-auth-title">Enter the 6-digit code</h1>
              <p className="lp-code-hint">Sent to <strong>+91 {phone}</strong></p>
              <form onSubmit={(e) => { e.preventDefault(); void verifyCode(); }}>
                <label className="visually-hidden" htmlFor="otp-code">6-digit code</label>
                <input
                  ref={otpInputRef}
                  id="otp-code"
                  className="lp-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="——————"
                  value={otp}
                  disabled={phase === "verifying"}
                  onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); if (error) setError(null); }}
                />
                <button type="submit" className="btn lp-cta" disabled={phase === "verifying" || otp.length !== 6}>
                  {phase === "verifying" ? "Verifying…" : "Verify & continue"}
                </button>
              </form>
              <div className="lp-row-links">
                <button className="lp-link" onClick={changeNumber}>Change number</button>
                <button className="lp-link" onClick={() => void sendCode()} disabled={resendIn > 0}>
                  {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
                </button>
              </div>
            </>
          )}
        </main>

        {/* invisible reCAPTCHA mount point */}
        <div id="recaptcha-phone-login" />
      </div>
    )
  );
}
