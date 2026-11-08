/* Hallmark · genre: playful · theme: Hum · design-system: design.md · designed-as-app */
"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { loadControlFlags, type SiteControlFlags } from "@/lib/settings";
import { onAuthState } from "@/lib/firebase/client";
import Link from "next/link";
import FormulaMarks from "../_components/FormulaMarks";

type AuthState = "loading" | "in" | "out";

export function AdminGate({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<SiteControlFlags | null>(null);
  const [flagsLoading, setFlagsLoading] = useState(true);
  const [auth, setAuth] = useState<AuthState>("loading");
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsub = onAuthState((user) => {
      // Admin console is for staff (password sign-in) only — student phone-OTP
      // sessions must NOT unlock it.
      const isStaff = Boolean(
        user && user.providerData?.some((p) => p.providerId === "password")
      );
      setAuth(isStaff ? "in" : "out");
    });
    return unsub;
  }, []);

  useEffect(() => {
    loadControlFlags().then((data) => {
      setFlags(data);
      setFlagsLoading(false);
    });
  }, []);

  const isLoginPath =
    pathname === "/admin/login" || pathname?.startsWith("/admin/login");

  const isAllowedPath =
    pathname?.startsWith("/admin/zen/control") || pathname === "/admin";
  const panelDisabled = Boolean(flags && !flags.adminPanelEnabled);

  // Redirects are side effects — never call router.* during render.
  const sendToLogin = !isLoginPath && auth === "out";
  const sendHome =
    !isLoginPath && !sendToLogin && panelDisabled && !isAllowedPath;

  useEffect(() => {
    if (sendToLogin) router.replace("/admin/login");
    else if (sendHome) router.replace("/");
  }, [sendToLogin, sendHome, router]);

  // The login page is reachable signed-out; everything else under /admin needs auth.
  if (isLoginPath) {
    return <>{children}</>;
  }

  if (auth === "loading" || flagsLoading) {
    return <WaitScreen />;
  }

  // Signed-out → redirected to /admin/login by effect above.
  // No admin content is rendered meanwhile.
  if (sendToLogin) {
    return <WaitScreen />;
  }

  // Admin panel disabled and not on an allowed path → redirected home by effect.
  if (sendHome) {
    return <WaitScreen />;
  }

  // If admin panel is disabled and user tries to access admin dashboard directly
  // show a friendly message with link to login
  if (flags && !flags.adminPanelEnabled && pathname === "/admin") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--color-paper)",
          color: "var(--color-ink)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          padding: 24,
          textAlign: "center",
          fontFamily: "var(--font-body)",
          position: "relative",
          isolation: "isolate",
        }}
      >
        <FormulaMarks />
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.66rem",
            fontWeight: 500,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "oklch(56% 0.22 18)",
            border: "1px solid var(--color-rule-2)",
            borderRadius: "var(--radius-pill)",
            padding: "6px 16px",
          }}
        >
          Admin console
        </span>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            letterSpacing: "-0.03em",
            fontSize: "clamp(1.75rem, 4vw + 0.9rem, 2.75rem)",
            lineHeight: 1.08,
            margin: 0,
          }}
        >
          Admin panel <span className="hl">disabled</span>
        </h1>
        <p
          style={{
            color: "var(--color-ink-2)",
            fontSize: "1rem",
            lineHeight: 1.6,
            maxWidth: "46ch",
            margin: 0,
          }}
        >
          The admin console has been disabled by the administrator.
        </p>
        <Link href="/" className="btn">
          Back to site
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}

/* Full-viewport wait state — shown while auth/flags resolve or a redirect is in flight. */
function WaitScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-paper)",
        color: "var(--color-ink-2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        fontWeight: 500,
        textTransform: "uppercase",
        letterSpacing: "0.18em",
        position: "relative",
        isolation: "isolate",
      }}
      role="status"
    >
      <FormulaMarks />
      Loading…
    </div>
  );
}
