"use client";

import ErrorScreen from "./error-screen";

export default function NotFound() {
  return (
    <ErrorScreen
      code="404 · Not Found"
      title={<>Page <em style={{ color: "oklch(0.52 0.20 25)" }}>not found</em></>}
      message="The link you followed doesn't match any page on this site. Check the address for typos or return home."
      showCopy
      captureUrl
    />
  );
}