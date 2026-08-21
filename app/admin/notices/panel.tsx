"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadNotice, type Notice, NOTICE_TAB_TARGETS, hasContent } from "@/lib/notices";
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
          Notices <em>{hasNotice ? "· Active" : "· Nothing posted"}</em>
        </h1>
        <span className="ad-count">
          {notice?.publishedAt ? "Published" : "Draft"}
        </span>
      </div>

      {!hasNotice ? (
        <div className="ad-empty">
          No active notice. An admin with Zen access can publish one from{" "}
          <Link href="/admin/zen/control" style={{ color: "var(--accent)" }}>
            /admin/zen/control
          </Link>
          .
        </div>
      ) : (
        <div
          style={{
            background: "#fffdf8",
            border: "1px solid var(--ink)",
            padding: "30px 34px",
            position: "relative",
            maxWidth: 780,
            boxShadow: "6px 6px 0 var(--rule)",
          }}
        >
          <style>{`
            .n-prev-math { padding: 0 1px; }
          `}</style>
          <div
            style={{
              position: "absolute",
              top: -1,
              left: -1,
              width: 12,
              height: 12,
              background: "var(--ink)",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: -1,
              right: -1,
              width: 12,
              height: 12,
              background: "var(--ink)",
            }}
          />
          {notice.title.trim() && (
            <h2
              style={{
                fontFamily: "'Instrument Serif', serif",
                fontSize: 32,
                margin: "0 0 8px",
                lineHeight: 1.15,
              }}
            >
              {notice.title.trim()}
            </h2>
          )}
          {notice.publishedBy && (
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                color: "var(--dim)",
                marginBottom: 18,
              }}
            >
              Posted by {notice.publishedBy}
            </div>
          )}
          <NoticeBlocksView blocks={notice.blocks} onTabJump={onNavigateTab} />
          <div
            style={{
              marginTop: 22,
              paddingTop: 14,
              borderTop: "1px dashed var(--rule)",
              fontSize: 11,
              color: "var(--dim)",
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <span>
              Tab-jump targets:{" "}
              {NOTICE_TAB_TARGETS.map((t, i) => (
                <span key={t.value}>
                  {i > 0 && " · "}
                  <span style={{ color: "var(--ink-2)" }}>{t.label}</span>
                </span>
              ))}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
