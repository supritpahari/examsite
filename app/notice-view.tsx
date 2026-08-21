"use client";

import type { NoticeBlock, NoticeBlockStyle } from "@/lib/notices";
import { MathPreview } from "./admin/shared";

// Tiny renderer for our "rich text" strings. We intentionally keep this simple:
//   **bold**  *italic*  __underline__  [label](url)  `$x^2$` for inline math.
// This matches what our editor produces.
function renderRich(text: string) {
  if (!text) return null;
  // Split on the supported inline patterns, preserving matches.
  const parts = text.split(
    /(\*\*[^*]+\*\*|\*[^*]+\*|__[^_]+__|\[[^\]]+\]\([^)]+\)|\$[^$]+\$)/g
  );
  return parts.map((seg, i) => {
    if (!seg) return null;
    if (seg.startsWith("**") && seg.endsWith("**")) {
      return <strong key={i}>{renderRich(seg.slice(2, -2))}</strong>;
    }
    if (seg.startsWith("*") && seg.endsWith("*") && seg.length >= 2) {
      return <em key={i}>{renderRich(seg.slice(1, -1))}</em>;
    }
    if (seg.startsWith("__") && seg.endsWith("__") && seg.length >= 4) {
      return <u key={i}>{renderRich(seg.slice(2, -2))}</u>;
    }
    const m = seg.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (m) {
      return (
        <a
          key={i}
          href={m[2]}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "oklch(0.52 0.20 25)", textDecoration: "underline" }}
        >
          {m[1]}
        </a>
      );
    }
    if (seg.startsWith("$") && seg.endsWith("$") && seg.length >= 2) {
      return (
        <span key={i} className="n-prev-math" style={{ fontFamily: "Georgia, serif" }}>
          <MathPreview text={seg.slice(1, -1)} compact />
        </span>
      );
    }
    return <span key={i}>{seg}</span>;
  });
}

function textStyle(s?: NoticeBlockStyle): React.CSSProperties {
  const out: React.CSSProperties = {};
  if (s?.bold) out.fontWeight = 700;
  if (s?.italic) out.fontStyle = "italic";
  if (s?.underline) out.textDecoration = "underline";
  if (s?.align) out.textAlign = s.align;
  if (s?.color) out.color = s.color;
  if (s?.bgColor) {
    out.backgroundColor = s.bgColor;
    out.padding = "8px 12px";
    out.borderRadius = 2;
  }
  const sizeMap: Record<string, string> = {
    sm: "14px",
    base: "16px",
    lg: "18px",
    xl: "22px",
    "2xl": "28px",
    "3xl": "36px",
  };
  if (s?.fontSize) out.fontSize = sizeMap[s.fontSize] ?? "16px";
  out.lineHeight = 1.55;
  out.fontFamily = "'Inter', 'Georgia', serif";
  out.margin = 0;
  out.wordBreak = "break-word";
  return out;
}

function blockWrapStyle(s?: NoticeBlockStyle): React.CSSProperties {
  const out: React.CSSProperties = { marginBottom: 14 };
  if (s?.align === "center") {
    out.display = "flex";
    out.justifyContent = "center";
  } else if (s?.align === "right") {
    out.display = "flex";
    out.justifyContent = "flex-end";
  }
  return out;
}

export function NoticeBlocksView({
  blocks,
  onTabJump,
}: {
  blocks: NoticeBlock[];
  onTabJump?: (tab: string) => void;
}) {
  if (!blocks.length) {
    return (
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 12,
          color: "#8a8275",
          padding: 16,
          border: "1px dashed #d9d1bf",
          textAlign: "center",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        No notice published yet.
      </div>
    );
  }
  return (
    <div className="nv-math">
      <style>{`
        .nv-math .nq-frac { display: inline-flex; flex-direction: column; vertical-align: middle; text-align: center; margin: 0 2px; font-size: 0.78em; line-height: 1.1; }
        .nv-math .nq-frac-num { border-bottom: 1px solid currentColor; padding: 0 5px 1px; }
        .nv-math .nq-frac-den { padding: 1px 5px 0; }
        .nv-math .nq-vec { position: relative; display: inline-block; }
        .nv-math .nq-vec-arrow { position: absolute; top: -0.55em; left: 50%; transform: translateX(-50%); font-size: 0.8em; line-height: 1; letter-spacing: -0.05em; pointer-events: none; }
        .nv-math .nq-vec-body { padding: 0 1px; }
        .nv-math .nq-hat { position: relative; display: inline-block; }
        .nv-math .nq-hat-cap { position: absolute; top: -0.55em; left: 50%; transform: translateX(-55%) scaleX(1.1); font-size: 0.85em; line-height: 1; pointer-events: none; }
        .nv-math .nq-hat-body { padding: 0 1px; }
        .nv-math .nq-sqrt { border-top: 1px solid currentColor; padding: 0 2px; }
        .nv-math .nq-sqrt-body { border-top: 1px solid currentColor; padding: 0 2px; }
        .nv-math sup, .nv-math sub { font-size: 0.72em; line-height: 0; }
      `}</style>
      {blocks.map((b) => (
        <BlockView key={b.id} block={b} onTabJump={onTabJump} />
      ))}
    </div>
  );
}

function BlockView({
  block,
  onTabJump,
}: {
  block: NoticeBlock;
  onTabJump?: (tab: string) => void;
}) {
  const s = block.style;
  switch (block.type) {
    case "heading":
    case "text": {
      const Tag = block.type === "heading" ? "h2" : "p";
      const sz = s?.fontSize ?? (block.type === "heading" ? "2xl" : "base");
      const baseStyle = textStyle({ ...s, fontSize: sz });
      if (block.type === "heading") {
        baseStyle.fontFamily = "'Instrument Serif', serif";
        baseStyle.lineHeight = 1.2;
      }
      return (
        <div style={blockWrapStyle(s)}>
          <Tag style={baseStyle}>
            {renderRich(block.content || "")}
          </Tag>
        </div>
      );
    }
    case "image": {
      if (!block.imageUrl) return null;
      const alignMap = { left: "flex-start", center: "center", right: "flex-end" } as const;
      const justifyContent = alignMap[s?.imgAlign ?? "center"];
      return (
        <div style={{ display: "flex", justifyContent, marginBottom: 14 }}>
          <img
            src={block.imageUrl}
            alt={block.imageAlt || ""}
            style={{
              maxHeight: s?.imgMaxH ?? 240,
              maxWidth: "100%",
              border: "1px solid #d9d1bf",
              objectFit: "contain",
              display: "block",
            }}
          />
        </div>
      );
    }
    case "button": {
      const act = block.action;
      const alignMap = { left: "flex-start", center: "center", right: "flex-end" } as const;
      const justifyContent = alignMap[s?.btnAlign ?? "left"];
      const btnBg = s?.btnBg || "oklch(0.52 0.20 25)";
      const style: React.CSSProperties = {
        background: btnBg,
        color: s?.btnColor || "#fff",
        border: `1px solid ${btnBg}`,
        padding: "10px 20px",
        fontFamily: "'Inter', sans-serif",
        fontWeight: 600,
        fontSize: 13,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        cursor: "pointer",
      };
      const content = block.btnLabel || "Button";
      return (
        <div style={{ display: "flex", justifyContent, marginBottom: 14 }}>
          {act?.kind === "tab" ? (
            <button type="button" style={style} onClick={() => onTabJump?.(act.tab)}>
              {content}
            </button>
          ) : act?.kind === "link" ? (
            <a
              href={act.url}
              target={act.newTab === false ? "_self" : "_blank"}
              rel="noopener noreferrer"
              style={{ ...style, textDecoration: "none", display: "inline-block" }}
            >
              {content}
            </a>
          ) : (
            <button type="button" style={style} disabled>
              {content}
            </button>
          )}
        </div>
      );
    }
    case "divider":
      return (
        <hr
          style={{
            border: "none",
            borderTop: "1px solid #d9d1bf",
            margin: "18px 0",
          }}
        />
      );
    case "spacer":
      return <div style={{ height: s?.spacerH ?? 24 }} />;
  }
}
