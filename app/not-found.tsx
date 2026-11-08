/* Hallmark · genre: playful · theme: Hum · design-system: design.md · designed-as-app */
"use client";

import ErrorScreen from "./error-screen";

export default function NotFound() {
  return (
    <ErrorScreen
      code="404 · Not found"
      title={<>This page <span className="hl" style={{ "--hl": "oklch(68% 0.24 18 / 0.3)" } as React.CSSProperties}>doesn&apos;t exist</span></>}
      message="The link you followed doesn't match any page on this site. Check the address for typos or head back home."
      showCopy
      captureUrl
    />
  );
}
