"use client";

import { useEffect, useState } from "react";
import { getAuthInstance, onAuthState } from "@/lib/firebase/client";
import { signInWithPopup, GoogleAuthProvider, signOut, type User } from "firebase/auth";
import { loadControlFlags, saveControlFlags, type SiteControlFlags } from "@/lib/settings";
import NoticeEditor from "../../notices/editor";

const ALLOWED_EMAIL = "obliqllc@gmail.com";

export default function ZenControl() {
  const [flags, setFlags] = useState<SiteControlFlags>({
    adminPanelEnabled: true,
    websiteEnabled: true,
    customErrorMessage: "",
    customErrorTitle: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    const unsub = onAuthState((u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    loadControlFlags().then((data) => {
      setFlags(data);
      setLoading(false);
    });
  }, []);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      const auth = getAuthInstance();
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      const e = err as { code?: string; message?: string };
      const code = e?.code ?? "";
      if (code === "auth/popup-closed-by-user") {
        setAuthError("Sign in was cancelled.");
      } else if (code === "auth/popup-blocked") {
        setAuthError("Popup was blocked. Allow popups for this site and try again.");
      } else if (code === "auth/unauthorized-domain") {
        setAuthError("This domain is not authorized for Google sign-in.");
      } else if (code === "auth/operation-not-allowed") {
        setAuthError("Google sign-in is not enabled in the Firebase console.");
      } else {
        console.error("Google sign-in error:", err);
        setAuthError(`Google sign in failed (${code || "unknown"}). ${e?.message || ""}`);
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const auth = getAuthInstance();
      await signOut(auth);
    } catch {
      /* ignore */
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveControlFlags(flags);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f4f0e8",
          color: "#14110d",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 13,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "#8a8275",
          }}
        >
          Loading…
        </div>
      </div>
    );
  }

  const isAllowed = user?.email?.toLowerCase() === ALLOWED_EMAIL;

  if (!user || !isAllowed) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f4f0e8",
          color: "#14110d",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Inter', sans-serif",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
          <div
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: 34,
              lineHeight: 1.1,
            }}
          >
            <em style={{ color: "oklch(0.52 0.20 25)" }}>Zen</em> Control
          </div>
          <p
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "#8a8275",
              margin: "14px 0 28px",
            }}
          >
            Restricted access · Sign in with Google
          </p>

          {authError && (
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                color: "#fff",
                background: "#b3261e",
                padding: "10px 14px",
                marginBottom: 20,
                textAlign: "left",
              }}
            >
              {authError}
            </div>
          )}

          {user && !isAllowed && (
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                color: "#14110d",
                background: "#fff0ed",
                border: "1px solid #f5c6b8",
                padding: "12px 14px",
                marginBottom: 20,
                textAlign: "left",
              }}
            >
              Signed in as {user.email}, but this account is not authorized for
              this panel.
            </div>
          )}

          <button
            onClick={handleGoogleSignIn}
            disabled={signingIn}
            style={{
              width: "100%",
              background: "oklch(0.52 0.20 25)",
              color: "#fff",
              border: "1px solid oklch(0.52 0.20 25)",
              padding: "15px",
              fontFamily: "'Inter', sans-serif",
              fontWeight: 600,
              fontSize: 14,
              letterSpacing: "0.04em",
              cursor: "pointer",
              textTransform: "uppercase",
            }}
          >
            {signingIn ? "Signing in…" : "Continue with Google"}
          </button>

          {user && (
            <button
              onClick={handleSignOut}
              style={{
                marginTop: 12,
                width: "100%",
                background: "transparent",
                color: "#8a8275",
                border: "1px solid #d9d1bf",
                padding: "12px",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    );
  }

  const handleChange = (key: keyof SiteControlFlags, value: boolean | string) => {
    setFlags((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f4f0e8",
        color: "#14110d",
        fontFamily: "'Inter', sans-serif",
        padding: "48px 24px",
      }}
    >
      <style>{`
        .zen-root { max-width: 720px; margin: 0 auto; }
        .zen-brand { font-family: 'Instrument Serif', serif; font-size: 22px; letter-spacing: -0.01em; display: flex; align-items: baseline; gap: 6px; margin-bottom: 8px; }
        .zen-brand em { font-style: italic; color: oklch(0.52 0.20 25); }
        .zen-headline { font-family: 'Instrument Serif', serif; font-size: clamp(36px, 5vw, 56px); line-height: 1.05; letter-spacing: -0.02em; font-weight: 400; margin: 0 0 4px; color: #14110d; }
        .zen-headline em { font-style: italic; color: oklch(0.52 0.20 25); }
        .zen-sub { font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: #8a8275; margin-bottom: 32px; }
        .zen-card { background: #fff; border: 1px solid #14110d; position: relative; padding: 32px; margin-bottom: 24px; }
        .zen-card::before, .zen-card::after { content: ""; position: absolute; width: 10px; height: 10px; background: #14110d; }
        .zen-card::before { top: -1px; left: -1px; }
        .zen-card::after { bottom: -1px; right: -1px; }
        .zen-card-title { font-family: 'Instrument Serif', serif; font-size: 22px; line-height: 1.2; margin: 0 0 4px; color: #14110d; }
        .zen-card-title em { font-style: italic; color: oklch(0.52 0.20 25); }
        .zen-card-desc { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #8a8275; margin: 0 0 20px; text-transform: uppercase; letter-spacing: 0.06em; }
        .zen-field { margin-bottom: 20px; }
        .zen-field-label { display: block; font-family: 'JetBrains Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.18em; color: #3a352c; margin-bottom: 8px; }
        .zen-field-label em { font-style: italic; color: #8a8275; font-weight: 400; }
        .zen-toggle { display: flex; align-items: center; gap: 12px; }
        .zen-toggle-input { appearance: none; width: 52px; height: 28px; background: #d9d1bf; border: 1px solid #14110d; border-radius: 0; position: relative; cursor: pointer; transition: background 0.15s ease; }
        .zen-toggle-input::before { content: ""; position: absolute; top: 1px; left: 1px; width: 22px; height: 22px; background: #14110d; transition: transform 0.15s ease; }
        .zen-toggle-input:checked { background: oklch(0.52 0.20 25); border-color: oklch(0.52 0.20 25); }
        .zen-toggle-input:checked::before { transform: translateX(24px); background: #fff; }
        .zen-toggle-input:focus { outline: 2px solid oklch(0.52 0.20 25); outline-offset: 2px; }
        .zen-toggle-text { font-family: 'JetBrains Mono', monospace; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #14110d; }
        .zen-textarea { width: 100%; background: transparent; border: 1px solid #14110d; padding: 14px 16px; font-family: 'JetBrains Mono', monospace; font-size: 13px; color: #14110d; resize: vertical; min-height: 80px; outline: none; }
        .zen-textarea::placeholder { color: #b8ad96; }
        .zen-textarea:focus { background: #fff; }
        .zen-hint { font-family: 'JetBrains Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #8a8275; margin-top: 6px; }
        .zen-error { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #fff; background: #b3261e; padding: 10px 14px; margin-bottom: 20px; letter-spacing: 0.02em; }
        .zen-success { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #fff; background: #2d7d32; padding: 10px 14px; margin-bottom: 20px; letter-spacing: 0.02em; }
        .zen-btn { background: oklch(0.52 0.20 25); color: #fff; border: 1px solid oklch(0.52 0.20 25); padding: 14px 28px; font-family: 'Inter', sans-serif; font-weight: 600; font-size: 13px; letter-spacing: 0.04em; text-transform: uppercase; cursor: pointer; transition: background 0.15s ease; }
        .zen-btn:hover { background: oklch(0.42 0.22 25); border-color: oklch(0.42 0.22 25); }
        .zen-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .zen-warning { font-family: 'JetBrains Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #b3261e; margin-top: 8px; padding: 8px 12px; background: #fff0ed; border: 1px solid #f5c6b8; }
        @media (max-width: 600px) { .zen-card { padding: 24px 20px; } .zen-headline { font-size: clamp(28px, 8vw, 44px); } }
      `}</style>

      <div className="zen-root">
        <div className="zen-brand">World of <em>Physics</em></div>
        <h1 className="zen-headline"><em>Zen</em> Control</h1>
        <p className="zen-sub">Site-wide feature flags · Admin only</p>

        {error && <div className="zen-error" role="alert">{error}</div>}
        {saved && <div className="zen-success" role="status">Settings saved</div>}

        <div className="zen-card">
          <h2 className="zen-card-title">Admin <em>Panel</em></h2>
          <p className="zen-card-desc">Enable or disable the entire admin console</p>
          <div className="zen-field">
            <label className="zen-field-label">Admin Panel <em>enabled</em></label>
            <div className="zen-toggle">
              <input
                type="checkbox"
                className="zen-toggle-input"
                checked={flags.adminPanelEnabled}
                onChange={(e) => handleChange("adminPanelEnabled", e.target.checked)}
              />
              <span className="zen-toggle-text">
                {flags.adminPanelEnabled ? "ACTIVE" : "DISABLED"}
              </span>
            </div>
          </div>
          {!flags.adminPanelEnabled && (
            <div className="zen-warning">
              ⚠ Admin panel is disabled. Access /admin will be blocked. Re-enable here to restore.
            </div>
          )}
        </div>

        <div className="zen-card">
          <h2 className="zen-card-title">Website <em>Status</em></h2>
          <p className="zen-card-desc">Take the entire site offline with a custom message</p>
          <div className="zen-field">
            <label className="zen-field-label">Website <em>enabled</em></label>
            <div className="zen-toggle">
              <input
                type="checkbox"
                className="zen-toggle-input"
                checked={flags.websiteEnabled}
                onChange={(e) => handleChange("websiteEnabled", e.target.checked)}
              />
              <span className="zen-toggle-text">
                {flags.websiteEnabled ? "ONLINE" : "OFFLINE"}
              </span>
            </div>
          </div>
          {!flags.websiteEnabled && (
            <div className="zen-warning">
              ⚠ Website is disabled. All public pages will show the maintenance message below.
            </div>
          )}
        </div>

        <div className="zen-card">
          <h2 className="zen-card-title">Custom <em>Error</em> Message</h2>
          <p className="zen-card-desc">Shown when website is disabled or on critical errors</p>
          <div className="zen-field">
            <label className="zen-field-label">Error <em>Title</em></label>
            <input
              type="text"
              className="zen-textarea"
              style={{ minHeight: "auto", height: "48px", fontSize: 15, fontFamily: "'Instrument Serif', serif" }}
              placeholder="Site Temporarily Unavailable"
              value={flags.customErrorTitle}
              onChange={(e) => handleChange("customErrorTitle", e.target.value)}
            />
          </div>
          <div className="zen-field">
            <label className="zen-field-label">Error <em>Message</em></label>
            <textarea
              className="zen-textarea"
              placeholder="We're performing scheduled maintenance. Please check back soon."
              value={flags.customErrorMessage}
              onChange={(e) => handleChange("customErrorMessage", e.target.value)}
            />
          </div>
          <p className="zen-hint">Leave blank to use default messages. Supports plain text only.</p>
        </div>

        <div className="zen-card">
          <h2 className="zen-card-title">Current <em>State</em></h2>
          <p className="zen-card-desc">Live preview of active flags</p>
          <div style={{ display: "grid", gap: 12, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", background: "#faf8f5", border: "1px solid #d9d1bf" }}>
              <span style={{ color: "#8a8275" }}>Admin Panel</span>
              <span style={{ color: flags.adminPanelEnabled ? "#2d7d32" : "#b3261e", fontWeight: 600 }}>
                {flags.adminPanelEnabled ? "ENABLED" : "DISABLED"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", background: "#faf8f5", border: "1px solid #d9d1bf" }}>
              <span style={{ color: "#8a8275" }}>Website</span>
              <span style={{ color: flags.websiteEnabled ? "#2d7d32" : "#b3261e", fontWeight: 600 }}>
                {flags.websiteEnabled ? "ONLINE" : "OFFLINE"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", background: "#faf8f5", border: "1px solid #d9d1bf" }}>
              <span style={{ color: "#8a8275" }}>Custom Error</span>
              <span style={{ color: flags.customErrorTitle || flags.customErrorMessage ? "#14110d" : "#8a8275" }}>
                {flags.customErrorTitle || flags.customErrorMessage ? "CONFIGURED" : "DEFAULT"}
              </span>
            </div>
          </div>
        </div>

        <button className="zen-btn" onClick={handleSave} disabled={saving} style={{ width: "100%", marginTop: 8 }}>
          {saving ? "Saving…" : "Save Changes"}
        </button>

        <div className="zen-card" style={{ marginTop: 28 }}>
          <h2 className="zen-card-title">Admin <em>Notice</em></h2>
          <p className="zen-card-desc">
            Build a notice from blocks (text, images, buttons). Publish it and every admin will
            see it the next time they open /admin — it becomes the default landing tab.
          </p>
          <NoticeEditor publishedBy={user?.email ?? undefined} />
        </div>

        <p style={{ marginTop: 24, textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8a8275" }}>
          Access this page at <code style={{ background: "#ebe6da", padding: "2px 6px", fontSize: 11 }}>/admin/zen/control</code>
        </p>
      </div>
    </div>
  );
}