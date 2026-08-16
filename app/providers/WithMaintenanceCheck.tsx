"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { loadControlFlags, type SiteControlFlags } from "@/lib/settings";

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

  // Show maintenance page if website is disabled and not on allowed paths
  if (flags && !flags.websiteEnabled && !isAllowedPath) {
    return <MaintenancePage flags={flags} />;
  }

  return <>{children}</>;
}

function MaintenancePage({ flags }: { flags: SiteControlFlags }) {
  const title = flags.customErrorTitle || "Site Temporarily Unavailable";
  const message = flags.customErrorMessage || "We're performing scheduled maintenance. Please check back soon.";

  return (
    <html lang="en">
      <head>
        <title>{title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Instrument+Serif&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#f4f0e8",
          color: "#14110d",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
          padding: 24,
          textAlign: "center",
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        <div
          style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: 34,
            lineHeight: 1.1,
          }}
        >
          {title}
        </div>
        <p
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "#8a8275",
            maxWidth: 460,
            lineHeight: 1.8,
            margin: 0,
          }}
        >
          {message}
        </p>
      </body>
    </html>
  );
}