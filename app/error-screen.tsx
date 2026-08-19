"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
  const [url, setUrl] = useState<string>("");

  useEffect(() => {
    if (captureUrl && typeof window !== "undefined") {
      setUrl(window.location.href);
    }
  }, [captureUrl]);

  const copy = async () => {
    const text = detail ?? url;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  const copyText = detail ?? url;

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
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "oklch(0.52 0.20 25)",
          border: "1px solid #d9d1bf",
          padding: "6px 14px",
        }}
      >
        {code}
      </div>

      <div
        style={{
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontSize: 34,
          lineHeight: 1.1,
          maxWidth: 620,
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

      {showCopy && copyText && (
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
            <span>{captureUrl ? "Requested URL" : "Error details"}</span>
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
            {copyText}
          </pre>
        </div>
      )}

      {digest && (
        <p
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: "#b8ad96",
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
          marginTop: 6,
        }}
      >
        {onRetry && (
          <button
            onClick={onRetry}
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
            {retryLabel}
          </button>
        )}
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