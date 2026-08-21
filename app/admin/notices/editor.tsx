"use client";

import { useEffect, useRef, useState } from "react";
import {
  loadNotice,
  saveNotice,
  clearNotice,
  newBlock,
  hasContent,
  type Notice,
  type NoticeBlock,
  type NoticeBlockStyle,
  type NoticeBlockType,
  type TextAlign,
  type NoticeTabTarget,
  NOTICE_TAB_TARGETS,
} from "@/lib/notices";
import { NoticeBlocksView } from "@/app/notice-view";

const IMBB_ENDPOINT = "https://api.imgbb.com/1/upload?key=4125525efeb9a21fe49db324919cdeaf";
const MAX_IMG_BYTES = 5 * 1024 * 1024;

// --- Color palette ---
const COLOR_SWATCHES = [
  { label: "Ink", value: "#14110d" },
  { label: "Accent", value: "oklch(0.52 0.20 25)" },
  { label: "Dim", value: "#8a8275" },
  { label: "White", value: "#ffffff" },
  { label: "Cream", value: "#f4f0e8" },
  { label: "Blue", value: "#1d4ed8" },
  { label: "Green", value: "#0f7a3d" },
  { label: "Red", value: "#b3261e" },
  { label: "Gold", value: "#b8860b" },
];

const BG_SWATCHES = [
  { label: "None", value: "" },
  { label: "Paper", value: "#f4f0e8" },
  { label: "Cream-2", value: "#ebe6da" },
  { label: "Accent tint", value: "rgba(220,60,40,0.08)" },
  { label: "Yellow", value: "#fff7cc" },
  { label: "Blue", value: "#cfe2f3" },
  { label: "Green", value: "#d9ead3" },
  { label: "Red", value: "#fce8e6" },
];

// Colors that need a dark (ink) checkmark for contrast
const LIGHT_COLORS = new Set([
  "#ffffff",
  "#f4f0e8",
  "#ebe6da",
  "rgba(220,60,40,0.08)",
  "#fff7cc",
  "#cfe2f3",
  "#d9ead3",
  "#fce8e6",
  "",
]);

interface Props {
  publishedBy?: string;
}

export default function NoticeEditor({ publishedBy }: Props) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedMsg, setSavedMsg] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploadsInFlight, setUploadsInFlight] = useState(0);
  const [imgUploadingFor, setImgUploadingFor] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const imgForBlock = useRef<string | null>(null);

  // Load once
  useEffect(() => {
    loadNotice()
      .then((n) => {
        setNotice(n);
        if (hasContent(n) && n.blocks[0]) setSelectedId(n.blocks[0].id);
      })
      .catch(() => setNotice({ title: "", blocks: [] }))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !notice) {
    return (
      <div
        style={{
          padding: 24,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 12,
          color: "#8a8275",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        Loading notice editor…
      </div>
    );
  }

  const selected = notice.blocks.find((b) => b.id === selectedId) ?? null;

  function setBlocks(updater: (prev: NoticeBlock[]) => NoticeBlock[]) {
    setNotice((n) => (n ? { ...n, blocks: updater(n.blocks) } : n));
  }

  function setBlock(id: string, patch: Partial<NoticeBlock>) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function setBlockStyle(id: string, patch: Partial<NoticeBlockStyle>) {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, style: { ...(b.style ?? {}), ...patch } } : b
      )
    );
  }

  function addBlock(type: NoticeBlockType) {
    const b = newBlock(type);
    setBlocks((prev) => [...prev, b]);
    setSelectedId(b.id);
  }

  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function moveBlock(id: string, dir: -1 | 1) {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  // ---- Drag & drop reorder ----
  function onDragStart(id: string, e: React.DragEvent) {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
  }
  function onDragOver(id: string, e: React.DragEvent) {
    e.preventDefault();
    if (dragId && dragId !== id) setDragOverId(id);
  }
  function onDrop(id: string, e: React.DragEvent) {
    e.preventDefault();
    if (!dragId || dragId === id) {
      setDragId(null);
      setDragOverId(null);
      return;
    }
    setBlocks((prev) => {
      const from = prev.findIndex((b) => b.id === dragId);
      const to = prev.findIndex((b) => b.id === id);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDragId(null);
    setDragOverId(null);
  }
  function onDragEnd() {
    setDragId(null);
    setDragOverId(null);
  }
  function onDragLeave(id: string, e: React.DragEvent) {
    // Only clear if leaving the block entirely (not entering a child)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const { clientX, clientY } = e;
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      setDragOverId((cur) => (cur === id ? null : cur));
    }
  }
  function removeImageFromBlock(id: string) {
    setBlock(id, { imageUrl: "", imageAlt: "" });
  }

  // ---- Image upload ----
  function pickImageFor(blockId: string) {
    imgForBlock.current = blockId;
    imgInputRef.current?.click();
  }

  async function onImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    const blockId = imgForBlock.current;
    imgForBlock.current = null;
    if (!f || !blockId) return;
    if (!f.type.startsWith("image/")) {
      setError("Only image files are accepted.");
      return;
    }
    if (f.size > MAX_IMG_BYTES) {
      setError(
        `Image too large (${(f.size / 1024 / 1024).toFixed(1)} MB). Max ${Math.round(
          MAX_IMG_BYTES / 1024 / 1024
        )} MB.`
      );
      return;
    }
    setError("");
    setImgUploadingFor(blockId);
    setUploadsInFlight((n) => n + 1);
    const existingAlt = notice?.blocks.find((b) => b.id === blockId)?.imageAlt;
    try {
      const form = new FormData();
      form.append("image", f);
      const res = await fetch(IMBB_ENDPOINT, { method: "POST", body: form });
      const data = (await res.json()) as {
        success?: boolean;
        data?: { url?: string; display_url?: string };
      };
      const url = data.data?.display_url || data.data?.url;
      if (!data.success || !url) throw new Error("ImgBB upload failed");
      setBlock(blockId, { imageUrl: url, imageAlt: existingAlt && existingAlt !== "" ? existingAlt : f.name });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Image upload failed. Please try again."
      );
    } finally {
      setImgUploadingFor(null);
      setUploadsInFlight((n) => Math.max(0, n - 1));
    }
  }

  // ---- Publish / Clear ----
  async function publish() {
    if (!notice) return;
    setSaving(true);
    setError("");
    setSavedMsg("");
    try {
      const toSave: Notice = {
        title: notice.title.trim() || "Notice",
        blocks: notice.blocks,
      };
      await saveNotice({ ...toSave, publishedBy });
      setNotice(toSave);
      setSavedMsg("Notice published ✓ — all admins will see it on their next visit.");
      setTimeout(() => setSavedMsg(""), 3500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish notice.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm("Remove the currently published notice? This cannot be undone.")) return;
    setSaving(true);
    setError("");
    try {
      await clearNotice();
      setNotice({ title: "", blocks: [] });
      setSelectedId(null);
      setSavedMsg("Notice cleared.");
      setTimeout(() => setSavedMsg(""), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear notice.");
    } finally {
      setSaving(false);
    }
  }

  const hasAny = hasContent(notice);

  return (
    <div className="ne-root">
      <style>{`
        .ne-root { color: #14110d; font-family: 'Inter', sans-serif; }
        .ne-grid { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 24px; }
        @media (max-width: 1000px) { .ne-grid { grid-template-columns: 1fr; } }
        .ne-title-row { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; }
        .ne-title {
          flex: 1; background: transparent; border: 1px solid #14110d; padding: 14px 16px;
          font-family: 'Instrument Serif', serif; font-size: 22px; color: #14110d; outline: none;
        }
        .ne-title:focus { background: #fff; }
        .ne-add-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 18px; }
        .ne-add {
          background: transparent; border: 1px solid #d9d1bf; color: #3a352c;
          padding: 8px 14px; font-family: 'JetBrains Mono', monospace; font-size: 11px;
          text-transform: uppercase; letter-spacing: 0.08em; cursor: pointer;
        }
        .ne-add:hover { border-color: #14110d; color: #14110d; }

        .ne-canvas {
          background: #fffdf8; border: 1px solid #14110d; padding: 28px 30px; position: relative;
          min-height: 240px;
        }
        .ne-canvas::before, .ne-canvas::after {
          content: ""; position: absolute; width: 12px; height: 12px; background: #14110d;
        }
        .ne-canvas::before { top: -1px; left: -1px; }
        .ne-canvas::after { bottom: -1px; right: -1px; }
        .ne-empty {
          padding: 40px 20px; text-align: center; font-family: 'JetBrains Mono', monospace;
          font-size: 11px; color: #8a8275; text-transform: uppercase; letter-spacing: 0.1em;
          border: 1px dashed #d9d1bf;
        }

        .ne-block {
          position: relative; padding: 6px 8px 6px 40px; border: 2px solid transparent;
          border-radius: 2px; margin-bottom: 4px; cursor: text; transition: border-color 0.12s ease;
        }
        .ne-block:hover { border-color: rgba(20,17,13,0.15); }
        .ne-block.selected { border-color: oklch(0.52 0.20 25); background: rgba(220,60,40,0.04); }
        .ne-block.drag-over { border-top: 2px solid oklch(0.52 0.20 25) !important; }
        .ne-block.dragging { opacity: 0.4; }
        .ne-handle {
          position: absolute; left: 6px; top: 8px; width: 24px; height: 24px; cursor: grab;
          display: grid; place-items: center; color: #8a8275; font-size: 14px;
          font-family: 'JetBrains Mono', monospace; user-select: none;
        }
        .ne-handle:active { cursor: grabbing; }
        .ne-block-actions {
          position: absolute; right: 6px; top: 6px; display: none; gap: 4px;
        }
        .ne-block.selected .ne-block-actions, .ne-block:hover .ne-block-actions { display: flex; }
        .ne-ba {
          background: transparent; border: 1px solid #d9d1bf; color: #3a352c;
          width: 24px; height: 24px; cursor: pointer; font-size: 11px; padding: 0;
          font-family: 'JetBrains Mono', monospace; display: grid; place-items: center;
        }
        .ne-ba:hover { border-color: #14110d; color: #14110d; }
        .ne-ba.danger:hover { color: #b3261e; border-color: #b3261e; }
        .ne-textarea {
          width: 100%; border: none; background: transparent; outline: none; resize: vertical;
          font-family: inherit; color: inherit; padding: 4px 2px; min-height: 1.5em;
        }
        .ne-img-slot {
          display: inline-block; padding: 14px; border: 1px dashed #d9d1bf; color: #8a8275;
          cursor: pointer; font-family: 'JetBrains Mono', monospace; font-size: 11px;
          text-transform: uppercase; letter-spacing: 0.08em;
        }
        .ne-img-slot:hover { border-color: #14110d; color: #14110d; }
        .ne-btn-preview {
          display: inline-block; padding: 10px 20px; font-family: 'Inter', sans-serif;
          font-weight: 600; font-size: 13px; letter-spacing: 0.04em; text-transform: uppercase;
          cursor: default; border-style: solid; border-width: 1px;
        }

        .ne-panel {
          background: #f4f0e8; border: 1px solid #14110d; padding: 18px; height: fit-content;
          position: sticky; top: 24px;
        }
        .ne-panel h4 {
          font-family: 'JetBrains Mono', monospace; font-size: 10px; text-transform: uppercase;
          letter-spacing: 0.16em; color: #14110d; margin: 0 0 10px;
        }
        .ne-panel h4:not(:first-child) { margin-top: 18px; }
        .ne-tb { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 10px; }
        .ne-tb button {
          background: #fffdf8; border: 1px solid #d9d1bf; color: #14110d;
          min-width: 30px; height: 28px; padding: 0 8px; cursor: pointer; font-size: 13px;
          font-family: 'JetBrains Mono', monospace;
        }
        .ne-tb button.on { background: oklch(0.52 0.20 25); color: #fff; border-color: oklch(0.52 0.20 25); }
        .ne-tb button:hover { border-color: #14110d; }
        .ne-tb button:disabled { opacity: 0.4; cursor: not-allowed; }
        .ne-swatches { display: flex; flex-wrap: wrap; gap: 4px; }
        .ne-sw {
          width: 24px; height: 24px; border: 1px solid #14110d; cursor: pointer; padding: 0;
          position: relative;
        }
        .ne-sw.on::after {
          content: "✓"; position: absolute; inset: 0; display: grid; place-items: center;
          color: #fff; font-size: 12px; text-shadow: 0 0 2px #000;
        }
        .ne-sw.on[data-light="true"]::after { color: #14110d; text-shadow: none; }
        .ne-field { margin-bottom: 10px; }
        .ne-field label {
          display: block; font-family: 'JetBrains Mono', monospace; font-size: 9px;
          text-transform: uppercase; letter-spacing: 0.14em; color: #3a352c; margin-bottom: 5px;
        }
        .ne-field input, .ne-field select {
          width: 100%; background: #fffdf8; border: 1px solid #14110d; padding: 8px 10px;
          font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #14110d; outline: none;
        }
        .ne-seg { display: flex; border: 1px solid #14110d; }
        .ne-seg button {
          flex: 1; background: transparent; border: 0; border-right: 1px solid #d9d1bf;
          padding: 6px 4px; font-family: 'JetBrains Mono', monospace; font-size: 10px;
          text-transform: uppercase; letter-spacing: 0.08em; color: #3a352c; cursor: pointer;
        }
        .ne-seg button:last-child { border-right: 0; }
        .ne-seg button.on { background: oklch(0.52 0.20 25); color: #fff; }

        .ne-footer { display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap; align-items: center; }
        .ne-pub {
          background: oklch(0.52 0.20 25); color: #fff; border: 1px solid oklch(0.52 0.20 25);
          padding: 12px 24px; font-family: 'Inter', sans-serif; font-weight: 600; font-size: 13px;
          letter-spacing: 0.04em; text-transform: uppercase; cursor: pointer;
        }
        .ne-pub:hover { background: oklch(0.42 0.22 25); border-color: oklch(0.42 0.22 25); }
        .ne-pub:disabled { opacity: 0.6; cursor: not-allowed; }
        .ne-clear {
          background: transparent; color: #b3261e; border: 1px solid #f0c2bb; padding: 12px 20px;
          font-family: 'Inter', sans-serif; font-weight: 600; font-size: 12px; letter-spacing: 0.04em;
          text-transform: uppercase; cursor: pointer;
        }
        .ne-clear:hover { background: #fce8e6; }
        .ne-status {
          font-family: 'JetBrains Mono', monospace; font-size: 11px;
          letter-spacing: 0.04em;
        }
        .ne-status.ok { color: #0f7a3d; }
        .ne-status.err { color: #b3261e; padding: 10px 12px; border: 1px solid #f0c2bb; background: #fce8e6; }
      `}</style>

      <div className="ne-title-row">
        <input
          className="ne-title"
          placeholder="Notice title (shown as heading)…"
          value={notice.title}
          onChange={(e) => setNotice((n) => (n ? { ...n, title: e.target.value } : n))}
        />
      </div>

      <div className="ne-grid">
        <div>
          <div className="ne-add-row">
            <button className="ne-add" onClick={() => addBlock("heading")}>+ Heading</button>
            <button className="ne-add" onClick={() => addBlock("text")}>+ Text</button>
            <button className="ne-add" onClick={() => addBlock("image")}>+ Image</button>
            <button className="ne-add" onClick={() => addBlock("button")}>+ Button</button>
            <button className="ne-add" onClick={() => addBlock("divider")}>— Divider</button>
            <button className="ne-add" onClick={() => addBlock("spacer")}>↕ Spacer</button>
          </div>

          <div className="ne-canvas" onClick={() => setSelectedId(null)}>
            {notice.blocks.length === 0 ? (
              <div className="ne-empty">Add blocks above to build your notice</div>
            ) : (
              notice.blocks.map((b) => (
                <BlockInEditor
                  key={b.id}
                  block={b}
                  selected={selectedId === b.id}
                  dragging={dragId === b.id}
                  dragOver={dragOverId === b.id}
                  imgUploading={imgUploadingFor === b.id}
                  onSelect={() => setSelectedId(b.id)}
                  onChange={(patch) => setBlock(b.id, patch)}
                  onStyle={(patch) => setBlockStyle(b.id, patch)}
                  onRemove={() => removeBlock(b.id)}
                  onMove={(d) => moveBlock(b.id, d)}
                  onPickImage={() => pickImageFor(b.id)}
                  onRemoveImage={() => removeImageFromBlock(b.id)}
                  onDragStart={(e) => onDragStart(b.id, e)}
                  onDragOver={(e) => onDragOver(b.id, e)}
                  onDrop={(e) => onDrop(b.id, e)}
                  onDragEnd={onDragEnd}
                  onDragLeave={(e) => onDragLeave(b.id, e)}
                />
              ))
            )}
          </div>

          <input
            ref={imgInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={onImageFile}
          />

          <div className="ne-footer">
            <button
              className="ne-pub"
              onClick={publish}
              disabled={saving || !hasAny || uploadsInFlight > 0}
            >
              {saving
                ? "Publishing…"
                : uploadsInFlight > 0
                ? `Waiting for ${uploadsInFlight} upload${uploadsInFlight === 1 ? "" : "s"}…`
                : hasAny
                ? "Publish Notice"
                : "Add content to publish"}
            </button>
            {hasAny && (
              <button className="ne-clear" onClick={remove} disabled={saving || uploadsInFlight > 0}>
                Remove notice
              </button>
            )}
            {savedMsg && <span className="ne-status ok">{savedMsg}</span>}
            {error && <span className="ne-status err">{error}</span>}
          </div>

          <div style={{ marginTop: 28 }}>
            <h3
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                color: "#8a8275",
                margin: "0 0 10px",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              Live preview
            </h3>
            <div className="ne-canvas">
              {notice.title.trim() && (
                <h2
                  style={{
                    fontFamily: "'Instrument Serif', serif",
                    fontSize: 28,
                    margin: "0 0 14px",
                    lineHeight: 1.2,
                  }}
                >
                  {notice.title.trim()}
                </h2>
              )}
              <NoticeBlocksView blocks={notice.blocks} />
            </div>
          </div>
        </div>

        <aside className="ne-panel">
          {selected ? (
            <BlockInspector
              block={selected}
              onChange={(patch) => setBlock(selected.id, patch)}
              onStyle={(patch) => setBlockStyle(selected.id, patch)}
            />
          ) : (
            <>
              <h4>Notice</h4>
              <p
                style={{
                  fontSize: 12,
                  lineHeight: 1.6,
                  color: "#3a352c",
                  margin: "0 0 12px",
                }}
              >
                Build your notice using blocks. Click any block to edit its content and style
                here. Drag the ⋮⋮ handle to reorder.
              </p>
              <p
                style={{
                  fontSize: 11,
                  color: "#8a8275",
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: "0.04em",
                  lineHeight: 1.7,
                }}
              >
                Formatting tips: wrap text in <code>**bold**</code>, <code>*italic*</code>,{" "}
                <code>__underline__</code>. Use <code>$x^2$</code> for inline math. Links use{" "}
                <code>[label](https://…)</code>.
              </p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

// ---- Per-block rendering inside the editor canvas ----
function BlockInEditor({
  block,
  selected,
  dragging,
  dragOver,
  imgUploading,
  onSelect,
  onChange,
  onStyle,
  onRemove,
  onMove,
  onPickImage,
  onRemoveImage,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onDragLeave,
}: {
  block: NoticeBlock;
  selected: boolean;
  dragging: boolean;
  dragOver: boolean;
  imgUploading: boolean;
  onSelect: () => void;
  onChange: (p: Partial<NoticeBlock>) => void;
  onStyle: (p: Partial<NoticeBlockStyle>) => void;
  onRemove: () => void;
  onMove: (d: -1 | 1) => void;
  onPickImage: () => void;
  onRemoveImage: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragLeave: (e: React.DragEvent) => void;
}) {
  const s = block.style ?? {};
  const cls = [
    "ne-block",
    selected ? "selected" : "",
    dragging ? "dragging" : "",
    dragOver ? "drag-over" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={cls}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onDragLeave={onDragLeave}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <span className="ne-handle" title="Drag to reorder">⋮⋮</span>
      <div className="ne-block-actions" onClick={(e) => e.stopPropagation()}>
        <button className="ne-ba" title="Move up" onClick={() => onMove(-1)}>↑</button>
        <button className="ne-ba" title="Move down" onClick={() => onMove(1)}>↓</button>
        <button className="ne-ba danger" title="Delete block" onClick={onRemove}>×</button>
      </div>

      {block.type === "heading" || block.type === "text" ? (
        <>
          <EditableText
            value={block.content ?? ""}
            placeholder={block.type === "heading" ? "Heading…" : "Type your text… **bold** *italic* __underline__ $x^2$"}
            onChange={(v) => onChange({ content: v })}
            style={textCss(s, block.type === "heading")}
            autoFocus={selected}
          />
        </>
      ) : null}

      {block.type === "image" && (
        <div style={{ textAlign: s.imgAlign ?? "center" as TextAlign }}>
          {block.imageUrl ? (
            <div style={{ display: "inline-block", position: "relative" }}>
              <img
                src={block.imageUrl}
                alt={block.imageAlt || ""}
                style={{
                  maxHeight: s.imgMaxH ?? 240,
                  maxWidth: "100%",
                  border: "1px solid #d9d1bf",
                  objectFit: "contain",
                  display: "block",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: 6,
                  right: 6,
                  display: "flex",
                  gap: 4,
                }}
              >
                <button
                  className="ne-ba"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPickImage();
                  }}
                  title="Replace image"
                >
                  ↻
                </button>
                <button
                  className="ne-ba danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveImage();
                  }}
                  title="Remove image"
                >
                  ×
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="ne-img-slot"
              onClick={(e) => {
                e.stopPropagation();
                onPickImage();
              }}
              disabled={imgUploading}
              style={imgUploading ? { opacity: 0.6, cursor: "wait" } : undefined}
            >
              {imgUploading ? "Uploading…" : "+ Click to upload image"}
            </button>
          )}
        </div>
      )}

      {block.type === "button" && (
        <div style={{ textAlign: s.btnAlign ?? "left" }}>
          <input
            type="text"
            value={block.btnLabel ?? ""}
            onChange={(e) => onChange({ btnLabel: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            placeholder="Button label"
            className="ne-btn-preview"
            style={{
              background: s.btnBg || "oklch(0.52 0.20 25)",
              color: s.btnColor || "#fff",
              borderColor: s.btnBg || "oklch(0.52 0.20 25)",
              border: "1px solid",
              padding: "8px 16px",
            }}
          />
        </div>
      )}

      {block.type === "divider" && (
        <hr style={{ border: "none", borderTop: "1px solid #d9d1bf", margin: "10px 0" }} />
      )}
      {block.type === "spacer" && (
        <div style={{ height: s.spacerH ?? 24, background: "repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(20,17,13,0.04) 6px, rgba(20,17,13,0.04) 12px)" }} />
      )}
    </div>
  );
}

function textCss(s: NoticeBlockStyle, isHeading: boolean): React.CSSProperties {
  const out: React.CSSProperties = { width: "100%" };
  out.fontWeight = (s.bold ?? isHeading) ? 700 : 400;
  out.fontStyle = s.italic ? "italic" : "normal";
  out.textDecoration = s.underline ? "underline" : "none";
  out.textAlign = s.align ?? "left";
  out.color = s.color || "#14110d";
  if (s.bgColor) {
    out.background = s.bgColor;
    out.padding = "6px 10px";
  }
  const sizeMap: Record<string, string> = {
    sm: "14px",
    base: "16px",
    lg: "18px",
    xl: "22px",
    "2xl": "28px",
    "3xl": "36px",
  };
  out.fontSize = sizeMap[s.fontSize ?? (isHeading ? "2xl" : "base")];
  out.fontFamily = isHeading ? "'Instrument Serif', serif" : "'Inter', 'Georgia', serif";
  out.lineHeight = isHeading ? 1.2 : 1.55;
  return out;
}

function EditableText({
  value,
  onChange,
  placeholder,
  style,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // Auto-grow
  const autoSize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };
  return (
    <textarea
      ref={ref}
      className="ne-textarea"
      value={value}
      placeholder={placeholder}
      onChange={(e) => {
        onChange(e.target.value);
        setTimeout(autoSize, 0);
      }}
      style={style}
      autoFocus={autoFocus}
      onFocus={autoSize}
      rows={1}
    />
  );
}

// ---- Side inspector panel ----
function BlockInspector({
  block,
  onChange,
  onStyle,
}: {
  block: NoticeBlock;
  onChange: (p: Partial<NoticeBlock>) => void;
  onStyle: (p: Partial<NoticeBlockStyle>) => void;
}) {
  const s = block.style ?? {};
  const toggle = (key: "bold" | "italic" | "underline") =>
    onStyle({ [key]: !s[key] });
  const setAlign = (a: TextAlign) => onStyle({ align: a });
  const setFontSize = (v: NoticeBlockStyle["fontSize"]) => onStyle({ fontSize: v });
  const setBtnAlign = (a: TextAlign) => onStyle({ btnAlign: a });
  const setImgAlign = (a: TextAlign) => onStyle({ imgAlign: a });

  return (
    <>
      <h4>{block.type} block</h4>

      {(block.type === "text" || block.type === "heading") && (
        <>
          <div className="ne-tb">
            <button className={s.bold ? "on" : ""} onClick={() => toggle("bold")} title="Bold"><b>B</b></button>
            <button className={s.italic ? "on" : ""} onClick={() => toggle("italic")} title="Italic"><i>I</i></button>
            <button className={s.underline ? "on" : ""} onClick={() => toggle("underline")} title="Underline"><u>U</u></button>
          </div>
          <div className="ne-field">
            <label>Alignment</label>
            <div className="ne-seg">
              {(["left", "center", "right"] as TextAlign[]).map((a) => (
                <button
                  key={a}
                  className={(s.align ?? "left") === a ? "on" : ""}
                  onClick={() => setAlign(a)}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div className="ne-field">
            <label>Size</label>
            <select
              value={s.fontSize ?? (block.type === "heading" ? "2xl" : "base")}
              onChange={(e) => setFontSize(e.target.value as NoticeBlockStyle["fontSize"])}
            >
              <option value="sm">Small</option>
              <option value="base">Normal</option>
              <option value="lg">Large</option>
              <option value="xl">XL</option>
              <option value="2xl">2XL</option>
              <option value="3xl">3XL</option>
            </select>
          </div>
          <h4>Text color</h4>
          <div className="ne-swatches">
            {COLOR_SWATCHES.map((c) => (
              <button
                key={c.value}
                className={"ne-sw" + ((s.color || "#14110d") === c.value ? " on" : "")}
                data-light={LIGHT_COLORS.has(c.value) ? "true" : "false"}
                style={{ background: c.value }}
                title={c.label}
                onClick={() => onStyle({ color: c.value })}
              />
            ))}
          </div>
          <h4>Background</h4>
          <div className="ne-swatches">
            {BG_SWATCHES.map((c) => (
              <button
                key={c.value || "__none"}
                className={"ne-sw" + ((s.bgColor || "") === c.value ? " on" : "")}
                data-light={c.value === "" || LIGHT_COLORS.has(c.value) ? "true" : "false"}
                style={{
                  background: c.value ||
                    "repeating-linear-gradient(45deg,#fff,#fff 4px,#ebe6da 4px,#ebe6da 8px)",
                }}
                title={c.label}
                onClick={() => onStyle({ bgColor: c.value || undefined })}
              />
            ))}
          </div>
        </>
      )}

      {block.type === "image" && (
        <>
          <div className="ne-field">
            <label>Max height (px)</label>
            <input
              type="number"
              min={40}
              max={800}
              value={s.imgMaxH ?? 240}
              onChange={(e) =>
                onStyle({ imgMaxH: Math.max(40, Math.min(800, Number(e.target.value) || 240)) })
              }
            />
          </div>
          <div className="ne-field">
            <label>Alignment</label>
            <div className="ne-seg">
              {(["left", "center", "right"] as TextAlign[]).map((a) => (
                <button
                  key={a}
                  className={(s.imgAlign ?? "center") === a ? "on" : ""}
                  onClick={() => setImgAlign(a)}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div className="ne-field">
            <label>Alt text</label>
            <input
              type="text"
              value={block.imageAlt ?? ""}
              onChange={(e) => onChange({ imageAlt: e.target.value })}
              placeholder="Describe the image"
            />
          </div>
        </>
      )}

      {block.type === "button" && (
        <>
          <div className="ne-field">
            <label>Label</label>
            <input
              type="text"
              value={block.btnLabel ?? ""}
              onChange={(e) => onChange({ btnLabel: e.target.value })}
              placeholder="Button text"
            />
          </div>
          <div className="ne-field">
            <label>Action type</label>
            <select
              value={block.action?.kind ?? "link"}
              onChange={(e) => {
                const kind = e.target.value as "link" | "tab";
                if (kind === "link") {
                  onChange({
                    action: {
                      kind: "link",
                      url: (block.action?.kind === "link" && block.action.url) || "#",
                      newTab: true,
                    },
                  });
                } else {
                  onChange({
                    action: {
                      kind: "tab",
                      tab: (block.action?.kind === "tab" && block.action.tab) || "questions",
                    },
                  });
                }
              }}
            >
              <option value="link">Open link</option>
              <option value="tab">Jump to admin tab</option>
            </select>
          </div>
          {(() => {
            const act = block.action;
            if (!act) return null;
            if (act.kind === "link") {
              return (
                <>
                  <div className="ne-field">
                    <label>URL</label>
                    <input
                      type="url"
                      value={act.url}
                      onChange={(e) =>
                        onChange({
                          action: { kind: "link", url: e.target.value, newTab: act.newTab },
                        })
                      }
                      placeholder="https://…"
                    />
                  </div>
                  <div className="ne-field">
                    <label>
                      <input
                        type="checkbox"
                        checked={act.newTab !== false}
                        onChange={(e) =>
                          onChange({
                            action: { kind: "link", url: act.url, newTab: e.target.checked },
                          })
                        }
                        style={{ marginRight: 6 }}
                      />
                      Open in new tab
                    </label>
                  </div>
                </>
              );
            }
            if (act.kind === "tab") {
              return (
                <div className="ne-field">
                  <label>Tab</label>
                  <select
                    value={act.tab}
                    onChange={(e) =>
                      onChange({
                        action: { kind: "tab", tab: e.target.value as NoticeTabTarget },
                      })
                    }
                  >
                    {NOTICE_TAB_TARGETS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              );
            }
            return null;
          })()}
          <div className="ne-field">
            <label>Alignment</label>
            <div className="ne-seg">
              {(["left", "center", "right"] as TextAlign[]).map((a) => (
                <button
                  key={a}
                  className={(s.btnAlign ?? "left") === a ? "on" : ""}
                  onClick={() => setBtnAlign(a)}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          <h4>Button color</h4>
          <div className="ne-swatches">
            {COLOR_SWATCHES.map((c) => (
              <button
                key={c.value + "bg"}
                className={"ne-sw" + ((s.btnBg || "oklch(0.52 0.20 25)") === c.value ? " on" : "")}
                data-light={LIGHT_COLORS.has(c.value) ? "true" : "false"}
                style={{ background: c.value }}
                title={c.label}
                onClick={() => onStyle({ btnBg: c.value })}
              />
            ))}
          </div>
          <h4>Label color</h4>
          <div className="ne-swatches">
            {COLOR_SWATCHES.map((c) => (
              <button
                key={c.value + "fg"}
                className={"ne-sw" + ((s.btnColor || "#ffffff") === c.value ? " on" : "")}
                data-light={LIGHT_COLORS.has(c.value) ? "true" : "false"}
                style={{ background: c.value }}
                title={c.label}
                onClick={() => onStyle({ btnColor: c.value })}
              />
            ))}
          </div>
        </>
      )}

      {block.type === "spacer" && (
        <div className="ne-field">
          <label>Height (px)</label>
          <input
            type="number"
            min={4}
            max={200}
            value={s.spacerH ?? 24}
            onChange={(e) => onStyle({ spacerH: Math.max(4, Number(e.target.value) || 24) })}
          />
        </div>
      )}
    </>
  );
}
