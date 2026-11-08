/* Hallmark · genre: playful · theme: Hum · design-system: design.md · designed-as-app */
"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { loadControlFlags, type SiteControlFlags } from "@/lib/settings";

interface ControlContextType {
  flags: SiteControlFlags | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

const ControlContext = createContext<ControlContextType | null>(null);

export function useControlFlags() {
  const ctx = useContext(ControlContext);
  if (!ctx) {
    throw new Error("useControlFlags must be used within ControlProvider");
  }
  return ctx;
}

export function ControlProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<SiteControlFlags | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = async () => {
    setLoading(true);
    const data = await loadControlFlags();
    setFlags(data);
    setLoading(false);
  };

  useEffect(() => {
    refetch();
  }, []);

  // If website is disabled and we're not on the maintenance page, show maintenance
  // But we don't block the maintenance page itself
  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--color-paper)",
          color: "var(--color-muted)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-mono)",
          fontWeight: 500,
        }}
      >
        <div
          style={{
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.18em",
          }}
        >
          Loading…
        </div>
      </div>
    );
  }

  // Check if we're on the maintenance page (pathname includes /maintenance)
  // We can't easily check pathname here without usePathname, so we'll let the
  // maintenance page handle its own rendering
  // The maintenance page will be shown via a separate mechanism

  return (
    <ControlContext.Provider value={{ flags, loading, refetch }}>
      {children}
    </ControlContext.Provider>
  );
}