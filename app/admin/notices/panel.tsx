/* Hallmark · genre: playful · theme: Hum · design-system: design.md · designed-as-app */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadNotice, type Notice, hasContent } from "@/lib/notices";
import { NoticeBlocksView } from "@/app/notice-view";

interface Props {
  onNavigateTab?: (tab: string) => void;
}

export default function NoticesPanel({ onNavigateTab }: Props) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [ts, setTs] = useState(() => Date.now());

  useEffect(() => {
    let mounted = true;
    loadNotice()
      .then((n) => {
        if (mounted) setNotice(n);
      })
      .catch(() => mounted && setNotice({ title: "", blocks: [] }))
      .finally(() => mounted && setLoading(false));
    // Re-fetch when the window is refocused (catches publish from zen/control
    // in another tab without a full reload).
    const onVis = () => {
      if (document.visibilityState === "visible") setTs(Date.now());
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ts]);

  if (loading) {
    return <div className="ad-empty">Loading notice…</div>;
  }

  const hasNotice = notice && hasContent(notice);

  return (
    <>
      <div className="ad-head">
        <h1 className="ad-title">
          Notices <span className="hl">{hasNotice ? "· Active" : "· Nothing posted"}</span>
        </h1>
      </div>

      {!hasNotice ? (
        <div className="ad-empty">
          No active notice. An admin with Zen access can publish one from{" "}
          <Link href="/admin/zen/control" style={{ color: "var(--color-accent-2-deep)" }}>
            /admin/zen/control
          </Link>
          .
        </div>
      ) : (
        <div
          style={{
            background: "var(--color-paper)",
            border: "1px solid var(--color-rule)",
            borderRadius: "var(--radius-card)",
            padding: "1.75rem 2rem",
            maxWidth: 780,
            boxShadow: "var(--shadow-card)",
          }}
        >
          {notice.title.trim() && (
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                letterSpacing: "-0.025em",
                fontSize: "1.75rem",
                margin: "0 0 0.5rem",
                lineHeight: 1.15,
              }}
            >
              {notice.title.trim()}
            </h2>
          )}
          <NoticeBlocksView blocks={notice.blocks} onTabJump={onNavigateTab} />
        </div>
      )}
    </>
  );
}
