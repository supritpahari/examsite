/* Hallmark · genre: playful · theme: Hum · design-system: design.md · designed-as-app */
"use client";

import { useEffect, useState } from "react";
import { getAuthInstance, onAuthState } from "@/lib/firebase/client";
import { signInWithPopup, GoogleAuthProvider, signOut, type User } from "firebase/auth";
import { loadControlFlags, saveControlFlags, type SiteControlFlags } from "@/lib/settings";
import NoticeEditor from "../../notices/editor";
import { subscribeToLogs, type AppLog } from "@/lib/logs";

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
  const [logs, setLogs] = useState<AppLog[]>([]);

  useEffect(() => {
    try {
      if (!user?.email) return;
      if (user.email.toLowerCase() !== ALLOWED_EMAIL) return;
      return subscribeToLogs(setLogs);
    } catch {
      /* logging is optional — never block the control panel */
    }
  }, [user]);

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
    } catch {
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
          background: "var(--color-paper)",
          color: "var(--color-ink)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-body)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "var(--color-muted)",
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
          background: "var(--color-paper)",
          color: "var(--color-ink)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-body)",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
          <div
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: 34,
              lineHeight: 1.1,
            }}
          >
            <em style={{ color: "var(--color-accent)" }}>Zen</em> Control
          </div>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--color-muted)",
              margin: "14px 0 28px",
            }}
          >
            Restricted access · Sign in with Google
          </p>

          {authError && (
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--color-on-panel)",
                background: "var(--color-danger)",
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
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--color-ink)",
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
              background: "var(--color-accent)",
              color: "var(--color-on-panel)",
              border: "1px solid var(--color-accent)",
              padding: "15px",
              fontFamily: "var(--font-body)",
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
                color: "var(--color-muted)",
                border: "1px solid var(--color-rule)",
                padding: "12px",
                fontFamily: "var(--font-mono)",
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
        background: "var(--color-paper)",
        color: "var(--color-ink)",
        fontFamily: "var(--font-body)",
        padding: "48px 24px",
      }}
    >
      <style>{`
        .zen-root { max-width: 720px; margin: 0 auto; }
        .zen-brand { font-family: var(--font-display); font-size: 22px; letter-spacing: -0.01em; display: flex; align-items: baseline; gap: 6px; margin-bottom: 8px; }
        .zen-headline { font-family: var(--font-display); font-size: clamp(36px, 5vw, 56px); line-height: 1.05; letter-spacing: -0.02em; font-weight: 400; margin: 0 0 4px; color: var(--color-ink); }
        .zen-sub { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--color-muted); margin-bottom: 32px; }
        .zen-card { background: var(--color-paper); border: 1px solid var(--color-rule); border-radius: var(--radius-card); box-shadow: var(--shadow-card); position: relative; padding: 1.75rem; margin-bottom: 1.5rem; }
        .zen-card-title { font-family: var(--font-display); font-size: 22px; line-height: 1.2; margin: 0 0 4px; color: var(--color-ink); }
        .zen-card-desc { font-family: var(--font-mono); font-size: 11px; color: var(--color-muted); margin: 0 0 20px; text-transform: uppercase; letter-spacing: 0.06em; }
        .zen-field { margin-bottom: 20px; }
        .zen-field-label { display: block; font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.18em; color: var(--color-ink-2); margin-bottom: 8px; }
        .zen-toggle { display: flex; align-items: center; gap: 12px; }
        .zen-toggle-input { appearance: none; width: 52px; height: 28px; background: var(--color-rule); border: 0; border-radius: var(--radius-pill); position: relative; cursor: pointer; transition: background 0.15s ease; }
        .zen-toggle-input::before { content: ""; position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; background: var(--color-ink); border-radius: var(--radius-pill); transition: transform 0.18s var(--ease-out), background 0.18s; }
        .zen-toggle-input:checked { background: var(--color-accent); border-color: var(--color-accent); }
        .zen-toggle-input:checked::before { transform: translateX(22px); background: var(--color-ink); }
        .zen-toggle-input:focus-visible { outline: 3px solid var(--color-focus); outline-offset: 2px; }
        .zen-toggle-text { font-family: var(--font-mono); font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-ink); }
        .zen-textarea { width: 100%; background: var(--color-paper-2); border: 1.5px solid transparent; border-radius: var(--radius-input); padding: 0.8rem 0.9rem; outline: none; font-family: var(--font-mono); font-size: 13px; color: var(--color-ink); resize: vertical; min-height: 80px; outline: none; }
        .zen-textarea::placeholder { color: var(--color-faint); }
        .zen-textarea:focus { background: var(--color-paper); border-color: var(--color-accent-2); outline: none; }
        .zen-hint { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-muted); margin-top: 6px; }
        .zen-error { font-family: var(--font-mono); font-size: 11px; color: var(--color-on-panel); background: var(--color-danger); padding: 10px 14px; margin-bottom: 20px; letter-spacing: 0.02em; border-radius: var(--radius-sm); }
        .zen-success { font-family: var(--font-mono); font-size: 11px; color: var(--color-on-panel); background: var(--color-mint-deep); padding: 10px 14px; margin-bottom: 20px; letter-spacing: 0.02em; border-radius: var(--radius-sm); }
        .zen-btn { background: var(--color-accent); color: var(--color-on-accent); border: 0; border-radius: var(--radius-pill); padding: 0.85rem 1.5rem; font-family: var(--font-display); font-weight: 600; font-size: 0.9rem; letter-spacing: -0.01em; cursor: pointer; box-shadow: 0 4px 0 0 var(--color-accent-deep); transition: transform var(--dur-micro) var(--ease-press), box-shadow var(--dur-micro) var(--ease-press); }
        .zen-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 0 0 var(--color-accent-deep); }
        .zen-btn:active { transform: translateY(2px); box-shadow: 0 1px 0 0 var(--color-accent-deep); }
        .zen-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .zen-warning { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-danger); margin-top: 8px; padding: 8px 12px; background: var(--color-paper); border: 1px solid #f5c6b8; }
        .zen-log-list { max-height: 520px; overflow-y: auto; border-top: 1px solid var(--color-rule); }
        .zen-log { padding: 14px 0; border-bottom: 1px solid var(--color-rule); }
        .zen-log-topline { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 7px; font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; }
        .zen-log-level { padding: 3px 7px; color: var(--color-on-accent); font-weight: 600; }
        .zen-log-debug { background: #7b6f5c; }
        .zen-log-info { background: #326b8c; }
        .zen-log-warn { background: #a66b16; }
        .zen-log-error { background: var(--color-danger); }
        .zen-log-time, .zen-log-meta { color: var(--color-muted); }
        .zen-log-message { font-family: var(--font-mono); font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
        .zen-log-meta { margin-top: 6px; font-family: var(--font-mono); font-size: 10px; overflow-wrap: anywhere; }
        .zen-log-details { margin: 8px 0 0; padding: 8px; background: #faf8f5; color: #5e5548; font: 10px/1.45 var(--font-mono); white-space: pre-wrap; overflow-wrap: anywhere; }
        .zen-log-empty { padding: 18px 0; color: var(--color-muted); font: 11px var(--font-mono); text-transform: uppercase; letter-spacing: 0.06em; }
        @media (max-width: 600px) { .zen-card { padding: 24px 20px; } .zen-headline { font-size: clamp(28px, 8vw, 44px); } }
      `}</style>

      <div className="zen-root">
        <div className="zen-brand">World of <span className="hl">Physics</span></div>
        <h1 className="zen-headline"><span className="hl">Zen</span> Control</h1>
        <p className="zen-sub">Site-wide feature flags · Admin only</p>

        {error && <div className="zen-error" role="alert">{error}</div>}
        {saved && <div className="zen-success" role="status">Settings saved</div>}

        <div className="zen-card">
          <h2 className="zen-card-title">Admin <span className="hl">Panel</span></h2>
          <p className="zen-card-desc">Enable or disable the entire admin console</p>
          <div className="zen-field">
            <label className="zen-field-label">Admin Panel <span className="hl">enabled</span></label>
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
          <h2 className="zen-card-title">Website <span className="hl">Status</span></h2>
          <p className="zen-card-desc">Take the entire site offline with a custom message</p>
          <div className="zen-field">
            <label className="zen-field-label">Website <span className="hl">enabled</span></label>
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
          <h2 className="zen-card-title">Custom <span className="hl">Error</span> Message</h2>
          <p className="zen-card-desc">Shown when website is disabled or on critical errors</p>
          <div className="zen-field">
            <label className="zen-field-label">Error <span className="hl">Title</span></label>
            <input
              type="text"
              className="zen-textarea"
              style={{ minHeight: "auto", height: "48px", fontSize: 15, fontFamily: "var(--font-display)" }}
              placeholder="Site Temporarily Unavailable"
              value={flags.customErrorTitle}
              onChange={(e) => handleChange("customErrorTitle", e.target.value)}
            />
          </div>
          <div className="zen-field">
            <label className="zen-field-label">Error <span className="hl">Message</span></label>
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
          <h2 className="zen-card-title">Current <span className="hl">State</span></h2>
          <p className="zen-card-desc">Live preview of active flags</p>
          <div style={{ display: "grid", gap: 12, fontFamily: "var(--font-mono)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", background: "#faf8f5", border: "1px solid var(--color-rule)" }}>
              <span style={{ color: "var(--color-muted)" }}>Admin Panel</span>
              <span style={{ color: flags.adminPanelEnabled ? "var(--color-mint-deep)" : "var(--color-danger)", fontWeight: 600 }}>
                {flags.adminPanelEnabled ? "ENABLED" : "DISABLED"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", background: "#faf8f5", border: "1px solid var(--color-rule)" }}>
              <span style={{ color: "var(--color-muted)" }}>Website</span>
              <span style={{ color: flags.websiteEnabled ? "var(--color-mint-deep)" : "var(--color-danger)", fontWeight: 600 }}>
                {flags.websiteEnabled ? "ONLINE" : "OFFLINE"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", background: "#faf8f5", border: "1px solid var(--color-rule)" }}>
              <span style={{ color: "var(--color-muted)" }}>Custom Error</span>
              <span style={{ color: flags.customErrorTitle || flags.customErrorMessage ? "var(--color-ink)" : "var(--color-muted)" }}>
                {flags.customErrorTitle || flags.customErrorMessage ? "CONFIGURED" : "DEFAULT"}
              </span>
            </div>
          </div>
        </div>

        <button className="zen-btn" onClick={handleSave} disabled={saving} style={{ width: "100%", marginTop: 8 }}>
          {saving ? "Saving…" : "Save Changes"}
        </button>

        <div className="zen-card">
          <h2 className="zen-card-title">System <span className="hl">Logs</span></h2>
          <p className="zen-card-desc">Live application events · newest first · last 200 entries</p>
          {logs.length === 0 ? (
            <div className="zen-log-empty">No logs have been recorded yet.</div>
          ) : (
            <div className="zen-log-list">
              {logs.map((log) => {
                const timestamp = log.createdAt && "toDate" in log.createdAt && typeof log.createdAt.toDate === "function"
                  ? log.createdAt.toDate().toLocaleString()
                  : "Pending…";
                return (
                  <div className="zen-log" key={log.id}>
                    <div className="zen-log-topline">
                      <span className={`zen-log-level zen-log-${log.level}`}>{log.level}</span>
                      <span className="zen-log-time">{timestamp}</span>
                    </div>
                    <div className="zen-log-message">{log.message}</div>
                    {(log.path || log.userEmail) && (
                      <div className="zen-log-meta">{log.path ?? ""}{log.userEmail ? ` · ${log.userEmail}` : ""}</div>
                    )}
                    {log.details && <pre className="zen-log-details">{log.details}</pre>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="zen-card" style={{ marginTop: 28 }}>
          <h2 className="zen-card-title">Admin <span className="hl">Notice</span></h2>
          <p className="zen-card-desc">
            Build a notice from blocks (text, images, buttons). Publish it and every admin will
            see it the next time they open /admin — it becomes the default landing tab.
          </p>
          <NoticeEditor publishedBy={user?.email ?? undefined} />
        </div>

        <p style={{ marginTop: 24, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--color-muted)" }}>
          Access this page at <code style={{ background: "var(--color-paper-2)", padding: "2px 6px", fontSize: 11 }}>/admin/zen/control</code>
        </p>
      </div>
    </div>
  );
}