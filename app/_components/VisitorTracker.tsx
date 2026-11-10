/* VisitorTracker — client component that registers the current visitor and
 * sends periodic heartbeats so the admin panel can show live stats.
 * Meant to be included once in the root layout. */
"use client";

import { useEffect } from "react";
import { getOrCreateVisitorId, registerVisitor, startHeartbeat } from "@/lib/stats";

export function VisitorTracker() {
  useEffect(() => {
    const visitorId = getOrCreateVisitorId();
    registerVisitor(visitorId);
    const stop = startHeartbeat(visitorId);
    return stop;
  }, []);

  return null;
}
