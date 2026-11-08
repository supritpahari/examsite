/* Hallmark · genre: playful · theme: Hum · design-system: design.md · designed-as-app */
"use client";

import { useEffect, useState } from "react";
import { loadControlFlags } from "@/lib/settings";
import FormulaMarks from "./_components/FormulaMarks";
import { copyText } from "@/lib/clipboard";

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
  const [failed, setFailed] = useState(false);

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
    const ok = await copyText(detail);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } else {
      setFailed(true);
      setTimeout(() => setFailed(false), 1600);
    }
  };

  // customTitle is admin-controlled plain text — rendered as text, never as HTML.
  const message =
    customMessage ||
    "The application hit an unexpected error. Please try again.";

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "oklch(97% 0.012 95)",
          color: "oklch(20% 0.012 250)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          padding: 24,
          textAlign: "center",
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          position: "relative",
          isolation: "isolate",
        }}
      >
        <FormulaMarks />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "oklch(56% 0.22 18)",
            border: "1px solid oklch(80% 0.016 95)",
            borderRadius: 999,
            padding: "6px 16px",
          }}
        >
          500 · Error
        </span>
        <div
          style={{
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            fontWeight: 600,
            fontSize: "clamp(1.75rem, 4vw + 0.9rem, 3rem)",
            lineHeight: 1.08,
            letterSpacing: "-0.03em",
            maxWidth: 640,
          }}
        >
          {customTitle || <>Something <span style={{ backgroundImage: "linear-gradient(oklch(68% 0.24 18 / 0.3) 0 0)", backgroundRepeat: "no-repeat", backgroundSize: "100% 0.32em", backgroundPosition: "0 84%" }}>went wrong</span></>}
        </div>
        <p
          style={{
            color: "oklch(38% 0.010 250)",
            fontSize: "1rem",
            lineHeight: 1.6,
            maxWidth: "46ch",
            margin: 0,
          }}
        >
          {message}
        </p>
        <div
          style={{
            width: "100%",
            maxWidth: 560,
            border: "1px solid oklch(80% 0.016 95)",
            background: "oklch(94% 0.016 95)",
            borderRadius: 12,
            textAlign: "left",
            margin: "4px 0 0",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.62rem",
              fontWeight: 500,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "oklch(52% 0.010 250)",
              padding: "0.65rem 0.9rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              borderBottom: "1px dashed oklch(80% 0.016 95)",
            }}
          >
            <span>Error details</span>
            <button
              onClick={copy}
              style={{
                background: "transparent",
                border: "1px solid oklch(80% 0.016 95)",
                color: "oklch(38% 0.010 250)",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.62rem",
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                padding: "0.4rem 0.75rem",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              {copied ? "Copied" : failed ? "Copy failed" : "Copy"}
            </button>
          </div>
          <pre
            style={{
              margin: 0,
              padding: "0.9rem",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.75rem",
              color: "oklch(38% 0.010 250)",
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
            background: "oklch(86% 0.18 95)",
            color: "oklch(20% 0.012 250)",
            border: 0,
            borderRadius: 999,
            padding: "0.85rem 1.6rem",
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            fontWeight: 600,
            fontSize: "0.95rem",
            cursor: "pointer",
            boxShadow: "0 4px 0 0 oklch(74% 0.19 85), 0 6px 12px -3px oklch(76% 0.20 95 / 0.45)",
            marginTop: 8,
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
