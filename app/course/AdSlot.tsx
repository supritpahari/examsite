/* Hallmark · genre: playful · theme: Hum · design-system: design.md · designed-as-app */
"use client";

import { useEffect, useRef, useState } from "react";

/**
 * AdSense ad slot. Renders only on the page that imports it (the course page).
 *
 * Setup:
 * 1. Add to .env.local:
 *    NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-xxxxxxxxxxxxxxxx
 *    NEXT_PUBLIC_ADSENSE_SLOT_COURSE_TOP=1234567890
 * 2. Add public/ads.txt with your AdSense publisher ID.
 * 3. Swap the test slot IDs below for real ones after AdSense approval.
 *
 * Until then, uses Google's test ad units so nothing breaks and no invalid
 * traffic is sent to a real account.
 */

interface AdSlotProps {
  slotId?: string;
  style?: { display: string; width: string; height: string };
}

const TEST_CLIENT = "ca-pub-3940256099942544"; // Google's official test publisher
const TEST_SLOT = "1234567890"; // responsive test slot

export function AdSlot({ slotId, style }: AdSlotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  const clientId =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID
      ? process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID
      : TEST_CLIENT;
  const adSlot = slotId
    ? slotId
    : typeof process !== "undefined" &&
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_COURSE_TOP
    ? process.env.NEXT_PUBLIC_ADSENSE_SLOT_COURSE_TOP
    : TEST_SLOT;

  useEffect(() => {
    // Load the AdSense script once.
    const existing = document.querySelector('script[src*="adsbygoogle.js"]');
    if (!existing) {
      const script = document.createElement("script");
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
        clientId
      )}`;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.onload = () => setLoaded(true);
      document.head.appendChild(script);
    } else {
      setLoaded(true);
    }
    return () => {
      // Intentionally leave the script loaded; removing it mid-page can break ads.
    };
  }, [clientId]);

  useEffect(() => {
    // Tell AdSense to render into this container once the script is ready.
    if (!loaded || !containerRef.current || typeof window === "undefined") return;
    const win = window as unknown as { adsbygoogle?: unknown };
    if (win.adsbygoogle) {
      (win.adsbygoogle as { push: (arg: unknown) => void }).push({});
    }
  }, [loaded]);

  return (
    <div ref={containerRef} style={{ margin: "24px 0", textAlign: "center" }}>
      <ins
        className="adsbygoogle"
        style={style ?? { display: "block", width: "100%", height: "280px" }}
        data-ad-client={clientId}
        data-ad-slot={adSlot}
      ></ins>
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.62rem",
          fontWeight: 500,
          color: "var(--color-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          marginTop: 6,
        }}
      >
        Advertisement
      </p>
    </div>
  );
}
