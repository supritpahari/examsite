"use client";

import { useEffect, useState } from "react";
import { loadControlFlags } from "@/lib/settings";

export default function GlobalError({
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
    "The application hit an unexpected error. Please try again.";

  return (
    <html lang="en">
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
        <button
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
      </body>
    </html>
  );
}
