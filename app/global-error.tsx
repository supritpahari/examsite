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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    console.error(error);
    loadControlFlags().then((flags) => {
      setCustomTitle(flags.customErrorTitle || "");
      setCustomMessage(flags.customErrorMessage || "");
    });
  }, [error]);

  const detail = `Error: ${error?.message || "Unknown error"}${
    error?.digest ? `\nDigest: ${error.digest}` : ""
  }`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(detail);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

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
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "oklch(0.52 0.20 25)",
            border: "1px solid #d9d1bf",
            padding: "6px 14px",
          }}
        >
          500 · Error
        </div>
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
        <div
          style={{
            width: "100%",
            maxWidth: 560,
            border: "1px solid #14110d",
            background: "#fffdf8",
            textAlign: "left",
            margin: "6px 0 0",
          }}
        >
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#8a8275",
              background: "#ebe6da",
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <span>Error details</span>
            <button
              onClick={copy}
              style={{
                background: "transparent",
                border: "1px solid #d9d1bf",
                color: "#3a352c",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                padding: "6px 12px",
                cursor: "pointer",
              }}
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
          <pre
            style={{
              margin: 0,
              padding: "14px",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              color: "#3a352c",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              lineHeight: 1.6,
              maxHeight: 180,
              overflow: "auto",
            }}
          >
            {detail}
          </pre>
        </div>
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
            marginTop: 6,
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
