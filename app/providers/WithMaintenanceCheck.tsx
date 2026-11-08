/* Hallmark · genre: playful · theme: Hum · design-system: design.md · designed-as-app */
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { loadControlFlags, type SiteControlFlags } from "@/lib/settings";
import FormulaMarks from "../_components/FormulaMarks";

export function WithMaintenanceCheck({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<SiteControlFlags | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    loadControlFlags().then((data) => {
      setFlags(data);
      setLoading(false);
    });
  }, []);

  // Don't block maintenance page or admin/zen/control (secret control panel)
  const isAllowedPath = pathname?.startsWith("/maintenance") || pathname?.startsWith("/admin/zen/control");

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--color-paper)",
          color: "var(--color-ink-2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          isolation: "isolate",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: "0.16em",
        }}
        role="status"
      >
        <FormulaMarks />
        Loading…
      </div>
    );
  }

  // Show maintenance page if website is disabled and not on allowed paths
  if (flags && !flags.websiteEnabled && !isAllowedPath) {
    return <MaintenancePage flags={flags} />;
  }

  return <>{children}</>;
}

/**
 * Rendered inside the root layout — must NOT include <html>/<body>.
 * customTitle/customMessage are admin-controlled plain text, rendered as text.
 */
function MaintenancePage({ flags }: { flags: SiteControlFlags }) {
  const title = flags.customErrorTitle || "Site temporarily unavailable";
  const message = flags.customErrorMessage || "We're performing scheduled maintenance. Please check back soon.";

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
        position: "relative",
        isolation: "isolate",
        fontFamily: "var(--font-body)",
      }}
    >
      <FormulaMarks />
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "oklch(56% 0.22 18)",
          border: "1px solid var(--color-rule-2)",
          borderRadius: "var(--radius-pill)",
          padding: "6px 16px",
        }}
      >
        Maintenance
      </span>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: "clamp(1.75rem, 4vw + 0.9rem, 3rem)",
          lineHeight: 1.08,
          letterSpacing: "-0.03em",
          maxWidth: 640,
          margin: 0,
        }}
      >
        {title}
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
        {message}
      </p>
    </div>
  );
}
