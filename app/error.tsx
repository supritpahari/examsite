"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadControlFlags } from "@/lib/settings";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [customTitle, setCustomTitle] = useState<string>("");
  const [customMessage, setCustomMessage] = useState<string>("");

  useEffect(() => {
    console.error(error);
    loadControlFlags().then((flags) => {
      setCustomTitle(flags.customErrorTitle || "");
      setCustomMessage(flags.customErrorMessage || "");
    });
  }, [error]);

  const title = customTitle || "Something <em style={{ color: 'oklch(0.52 0.20 25)' }}>went wrong</em>";
  const message =
    customMessage ||
    "The page hit an unexpected error. Your data is safe — try reloading this view.";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
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
        dangerouslySetInnerHTML={{ __html: title }}
      />
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
      {error?.digest && (
        <p
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: "#b8ad96",
            margin: 0,
          }}
        >
          Error ref: {error.digest}
        </p>
      )}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>        <button
          onClick={reset}
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
            cursor: "pointer",
          }}
        >
          Try again
        </button>
        <Link
          href="/"
          style={{
            background: "transparent",
            color: "#3a352c",
            border: "1px solid #d9d1bf",
            padding: "13px 26px",
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
            fontSize: 13,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          Back to site
        </Link>
      </div>
    </div>
  );
}
