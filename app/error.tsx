/* Hallmark · genre: playful · theme: Hum · design-system: design.md · designed-as-app */
"use client";

import { useEffect, useState } from "react";
import { loadControlFlags } from "@/lib/settings";
import ErrorScreen from "./error-screen";

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

  const title =
    customTitle || (
      <>
        Something{" "}
        <span className="hl" style={{ "--hl": "oklch(68% 0.24 18 / 0.3)" } as React.CSSProperties}>
          went wrong
        </span>
      </>
    );
  const message =
    customMessage ||
    "The page hit an unexpected error. Your data is safe — try reloading this view.";
  const detail = `Error: ${error?.message || "Unknown error"}${
    error?.digest ? `\nDigest: ${error.digest}` : ""
  }`;

  return (
    <ErrorScreen
      code="500 · Error"
      title={title}
      message={message}
      detail={detail}
      digest={error?.digest}
      showCopy
      onRetry={reset}
      retryLabel="Try again"
    />
  );
}