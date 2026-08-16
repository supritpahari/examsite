"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { loadControlFlags, type SiteControlFlags } from "@/lib/settings";
import Link from "next/link";

export function AdminGate({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<SiteControlFlags | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    loadControlFlags().then((data) => {
      setFlags(data);
      setLoading(false);
    });
  }, []);

  // Allow access to admin login, admin/zen/control, and signout
  const isAllowedPath =
    pathname === "/admin/login" ||
    pathname?.startsWith("/admin/zen/control") ||
    pathname === "/admin";

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

  // If admin panel is disabled and not on allowed paths, redirect to home
  if (flags && !flags.adminPanelEnabled && !isAllowedPath) {
    // Use router.replace to avoid history entries
    router.replace("/");
    return null;
  }

  // If admin panel is disabled and user tries to access admin dashboard directly
  // show a friendly message with link to login
  if (flags && !flags.adminPanelEnabled && pathname === "/admin") {
    return (
      <div
        style={{
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
          Admin Panel <em style={{ color: "oklch(0.52 0.20 25)" }}>Disabled</em>
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
          The admin console has been disabled by the administrator.
        </p>
        <Link
          href="/"
          style={{
            background: "oklch(0.52 0.20 25)",
            color: "#fff",
            border: "1px solid oklch(0.52 0.20 25)",
            padding: "13px 26px",
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
            fontSize: 13,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            textDecoration: "none",
            cursor: "pointer",
          }}
        >
          Back to Site
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}