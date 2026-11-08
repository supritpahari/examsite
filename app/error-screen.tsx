/* Hallmark · genre: playful · theme: Hum · design-system: design.md · designed-as-app */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import FormulaMarks from "./_components/FormulaMarks";
import { copyText as copyTextValue } from "@/lib/clipboard";

interface ErrorScreenProps {
  code: string;
  title: React.ReactNode;
  message: string;
  detail?: string;
  digest?: string;
  showCopy?: boolean;
  captureUrl?: boolean;
  onRetry?: () => void;
  retryLabel?: string;
}

export default function ErrorScreen({
  code,
  title,
  message,
  detail,
  digest,
  showCopy = false,
  captureUrl = false,
  onRetry,
  retryLabel = "Try again",
}: ErrorScreenProps) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const [url, setUrl] = useState<string>("");

  useEffect(() => {
    if (captureUrl && typeof window !== "undefined") {
      setUrl(window.location.href);
    }
  }, [captureUrl]);

  const copy = async () => {
    const text = detail ?? url;
    if (!text) return;
    const ok = await copyTextValue(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } else {
      setFailed(true);
      setTimeout(() => setFailed(false), 1600);
    }
  };

  const copyText = detail ?? url;

  return (
    <div
      style={{
isolation: "isolate",
                  position: "fixed",
        inset: 0,
        zIndex: "var(--z-modal)",
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
      }}
    >
      <FormulaMarks />
      <span
        className="mono-label"
        style={{
          border: "1px solid var(--color-rule-2)",
          borderRadius: "var(--radius-pill)",
          padding: "6px 16px",
          color: "var(--color-accent-3-deep)",
        }}
      >
        {code}
      </span>

      <div
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: "clamp(1.75rem, 4vw + 0.9rem, 3rem)",
          lineHeight: 1.08,
          letterSpacing: "-0.03em",
          maxWidth: 640,
        }}
      >
        {title}
      </div>

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

      {showCopy && copyText && (
        <div
          style={{
            width: "100%",
            maxWidth: 560,
            border: "1px solid var(--color-rule-2)",
            background: "var(--color-paper-2)",
            borderRadius: "var(--radius-input)",
            textAlign: "left",
            margin: "4px 0 0",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.62rem",
              fontWeight: 500,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--color-muted)",
              padding: "0.65rem 0.9rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              borderBottom: "1px dashed var(--color-rule-2)",
            }}
          >
            <span>{captureUrl ? "Requested URL" : "Error details"}</span>
            <button
              onClick={copy}
              style={{
                background: "transparent",
                border: "1px solid var(--color-rule-2)",
                color: "var(--color-ink-2)",
                fontFamily: "var(--font-mono)",
                fontSize: "0.62rem",
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                padding: "0.4rem 0.75rem",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {copied ? "Copied" : failed ? "Copy failed" : "Copy"}
            </button>
          </div>
          <pre
            style={{
              margin: 0,
              padding: "0.9rem",
              fontFamily: "var(--font-mono)",
              fontSize: "0.75rem",
              color: "var(--color-ink-2)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              lineHeight: 1.6,
              maxHeight: 180,
              overflow: "auto",
            }}
          >
            {copyText}
          </pre>
        </div>
      )}

      {digest && (
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.66rem",
            color: "var(--color-muted)",
            margin: 0,
          }}
        >
          Error ref: {digest}
        </p>
      )}

      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          justifyContent: "center",
          marginTop: 8,
        }}
      >
        {onRetry && (
          <button onClick={onRetry} className="btn">
            {retryLabel}
          </button>
        )}
        <Link href="/" className="btn btn--soft">
          Back to site
        </Link>
      </div>
    </div>
  );
}
