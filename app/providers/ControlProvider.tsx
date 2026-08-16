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
          background: "#f4f0e8",
          color: "#14110d",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 13,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "#8a8275",
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