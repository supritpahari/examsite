/* Hallmark · genre: playful · theme: Hum · design-system: design.md · designed-as-app */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getAuthInstance, getFirestoreDb, getStorageInstance, onAuthState } from "@/lib/firebase/client";
import ConfirmDialog from "../../_components/ConfirmDialog";
import { type User } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { uploadPdf, deleteByUrl } from "@/lib/storage";

const CANONICAL_GRADES = [
  "Class 11 (Physics)",
  "Class 12 (Physics)",
  "JEE Main",
  "JEE Advanced",
  "NEET",
] as const;

interface FormulaSheet {
  id: string;
  chapter: string;
  grade: string;
  price: number;
  title: string;
  pdfUrl: string;
  pdfName: string;
  fileSize: number;
  uploadedBy: string;
  createdAt: unknown;
  updatedAt: unknown;
}

function SheetIcon({ name, size = 16 }: { name: "download" | "edit" | "trash"; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  switch (name) {
    case "download":
      return <svg {...common}><path d="M12 3v13" /><path d="M7 11l5 5 5-5" /><path d="M4 20h16" /></svg>;
    case "edit":
      return <svg {...common}><path d="M14.5 5.5l4 4L8 20H4v-4l10.5-10.5z" /><path d="M12.5 7.5l4 4" /></svg>;
    case "trash":
      return <svg {...common}><path d="M4 7h16" /><path d="M9 7V5h6v2" /><path d="M6 7l1.3 14h9.4L18 7" /><path d="M10.5 11v6M13.5 11v6" /></svg>;
  }
}

interface GradeSelectProps {
  labelledBy: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}

/** Custom listbox — WAI-ARIA combobox pattern (button + listbox popup). */
function GradeSelect({ labelledBy, value, onChange, options }: GradeSelectProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const selectedIndex = options.indexOf(value);

  // close on click outside
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // when opening, highlight the current selection (or the first option)
  useEffect(() => {
    if (open) setActive(selectedIndex >= 0 ? selectedIndex : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // keep the keyboard-active option in view
  useEffect(() => {
    if (!open || active < 0) return;
    listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const choose = (i: number) => {
    onChange(options[i]);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
      case "ArrowDown":
        e.preventDefault();
        setActive((a) => Math.min(options.length - 1, a + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((a) => Math.max(0, a - 1));
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (active >= 0 && active < options.length) choose(active);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  return (
    <div className="fs-select" ref={rootRef}>
      <button
        type="button"
        className="fs-select-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={labelledBy}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
      >
        <span className={value ? "" : "fs-select-placeholder"}>{value || "Select a grade…"}</span>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul className="fs-select-menu" role="listbox" aria-labelledby={labelledBy} ref={listRef}>
          {options.map((g, i) => {
            const selected = g === value;
            return (
              <li
                key={g}
                role="option"
                aria-selected={selected}
                data-i={i}
                tabIndex={-1}
                className={`fs-select-opt${selected ? " sel" : ""}${i === active ? " active" : ""}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(i)}
                onKeyDown={onKeyDown}
              >
                <span>{g}</span>
                {selected && (
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 12.5l5 5L20 6.5" />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function FormulaSheetsPage() {
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [sheets, setSheets] = useState<FormulaSheet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  // Add/edit form state
  const [open, setOpen] = useState(false);
  const [upload, setUpload] = useState<null | {
    phase: "uploading" | "done" | "error";
    percent: number;
    title: string;
    gradeLabel: string;
    isEdit: boolean;
    error?: string;
  }>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [chapter, setChapter] = useState("");
  const [grade, setGrade] = useState("");
  const [price, setPrice] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");

  useEffect(() => {
    const unsub = onAuthState((u) => {
      setUser(u);
      setChecking(false);
      if (u) loadSheets();
      else setSheets([]);
    });
    return unsub;
  }, []);

  const loadSheets = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/formula-sheets", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load formula sheets");
      const data = (await res.json()) as { items: FormulaSheet[] };
      setSheets(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load formula sheets.");
    } finally {
      setLoading(false);
    }
  };

  const humanSize = (bytes: number) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Number((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const startUpload = async () => {
    try {
      const auth = getAuthInstance();
      const uid = auth.currentUser?.uid ?? "";
      const db = getFirestoreDb();
      const isEdit = Boolean(editingId);
      let pdfUrl = "";
      let pdfName = fileName || "formula-sheet.pdf";
      let fileSize = 0;

      if (file) {
        const { task, done } = uploadPdf(file);
        task.on(
          "state_changed",
          (snap) => {
            const total = snap.totalBytes || file.size || 0;
            if (total > 0) {
              setUpload((u) =>
                u && u.phase === "uploading"
                  ? { ...u, percent: Math.min(99, Math.round((snap.bytesTransferred / total) * 100)) }
                  : u
              );
            }
          },
          (err) => {
            setUpload((u) =>
              u ? { ...u, phase: "error", error: err?.message ?? "Upload failed. Try again." } : u
            );
          },
          () => {
            /* completion handled by `done` promise below */
          }
        );
        try {
          pdfUrl = await done;
        } catch (err) {
          setUpload((u) =>
            u
              ? { ...u, phase: "error", error: err instanceof Error ? err.message : "Upload failed." }
              : u
          );
          return;
        }
        pdfName = file.name;
        fileSize = file.size;

        // If we're replacing a PDF, delete the old object now that the new one exists
        if (isEdit) {
          const existing = sheets.find((s) => s.id === editingId);
          if (existing?.pdfUrl) {
            try {
              await deleteByUrl(existing.pdfUrl);
            } catch {
              /* orphaned object — not fatal */
            }
          }
        }
      } else if (editingId) {
        const existing = sheets.find((s) => s.id === editingId);
        pdfUrl = existing?.pdfUrl ?? "";
        pdfName = existing?.pdfName ?? pdfName;
        fileSize = existing?.fileSize ?? 0;
      } else {
        setUpload((u) =>
          u ? { ...u, phase: "error", error: "Choose a PDF to upload." } : u
        );
        return;
      }

      const payload: Record<string, unknown> = {
        chapter: chapter.trim(),
        grade: grade.trim(),
        price: Number(price) || 0,
        title: title.trim() || pdfName.replace(/\.pdf$/i, ""),
        pdfUrl,
        pdfName,
        fileSize,
        uploadedBy: uid,
        updatedAt: serverTimestamp(),
      };

      if (isEdit && editingId) {
        await setDoc(doc(db, "formula-sheets", editingId), payload, { merge: true });
      } else {
        await addDoc(collection(db, "formula-sheets"), { ...payload, createdAt: serverTimestamp() });
      }

      setUpload((u) => (u ? { ...u, phase: "done", percent: 100 } : u));
      setSaved(editingId ? "Formula sheet updated." : "Formula sheet uploaded.");
      window.setTimeout(() => setSaved(null), 3000);
      resetForm();
      void loadSheets();
      window.setTimeout(() => setUpload(null), 1600);
    } catch (err) {
      setUpload((u) =>
        u
          ? { ...u, phase: "error", error: err instanceof Error ? err.message : "Could not save the sheet." }
          : u
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!grade.trim()) {
      setError("Select a grade.");
      return;
    }
    setOpen(false);
    setUpload({
      phase: "uploading",
      percent: 0,
      title: title.trim() || fileName || "Formula sheet",
      gradeLabel: grade.trim(),
      isEdit: Boolean(editingId),
    });
    void startUpload();
  };

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const handleDelete = (id: string) => setDeleteId(id);
  const doDelete = async (id: string) => {
    setError(null);
    try {
      const db = getFirestoreDb();
      const target = sheets.find((s) => s.id === id);
      if (target?.pdfUrl) {
        try {
          await deleteByUrl(target.pdfUrl);
        } catch {
          /* object may be gone already — continue */
        }
      }
      await deleteDoc(doc(db, "formula-sheets", id));
      setSheets((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setChapter("");
    setGrade("");
    setPrice("");
    setTitle("");
    setFile(null);
    setFileName("");
  };

  const openEdit = (s: FormulaSheet) => {
    setEditingId(s.id);
    setChapter(s.chapter);
    setGrade(s.grade);
    setPrice(String(s.price));
    setTitle(s.title);
    setFile(null);
    setFileName(s.pdfName);
    setOpen(true);
  };

  const gradeOptions = useMemo(() => {
    const existing = new Set(sheets.map((s) => s.grade).filter(Boolean));
    const merged = [...CANONICAL_GRADES] as string[];
    for (const g of Array.from(existing).sort()) {
      if (!merged.includes(g)) merged.push(g);
    }
    // keep the value being edited selectable even if it matches nothing
    if (grade && !merged.includes(grade)) merged.push(grade);
    return merged;
  }, [sheets, grade]);

  const priceNum = Number(price);
  const validPrice = String(priceNum) === price.trim() || price.trim() === "";

  if (checking || !user) {
    return <div className="ad-empty">Checking session…</div>;
  }

  return (
    <div>
      <div className="ad-head">
        <div>
          <h1 className="ad-title">Formula <span className="hl">Sheets</span></h1>
          <p className="ad-count">
            Upload chapter-wise formula sheets, set grade &amp; price.
          </p>
        </div>
      </div>

      {error && <div className="ad-set-status err">{error}</div>}
      {saved && <div className="ad-set-status ok">{saved}</div>}


      {/* Add / Edit modal */}
      <div className="ad-overlay" onClick={() => setOpen(false)} style={{ display: open ? "flex" : "none" }}>
        <div className="ad-modal" onClick={(e) => e.stopPropagation()}>
          <div className="ad-modal-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
            <h2 className="ad-form-title">
              {editingId ? "Edit" : "Upload"} formula <span className="hl">sheet</span>
            </h2>
            <button className="ad-close" onClick={() => setOpen(false)}>
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="ad-row">
              <div className="ad-field" style={{ flex: 1 }}>
                <label>Chapter</label>
                <input
                  required
                  value={chapter}
                  onChange={(e) => setChapter(e.target.value)}
                  placeholder="e.g. Electrostatics"
                />
              </div>
              <div className="ad-field" style={{ flex: "0 0 auto", width: 170 }}>
                <label id="grade-label">Grade</label>
                <GradeSelect
                  labelledBy="grade-label"
                  value={grade}
                  onChange={setGrade}
                  options={gradeOptions}
                />
              </div>
            </div>
            <div className="ad-row">
              <div className="ad-field" style={{ flex: 1 }}>
                <label>Price (₹)</label>
                <input
                  required
                  type="number"
                  min="0"
                  step="1"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0"
                  disabled={!validPrice}
                />
                {!price.trim() && <p className="ad-hint">Free if left empty.</p>}
                {price.trim() && !validPrice && (
                  <p className="ad-set-status err">Enter a valid number.</p>
                )}
              </div>
              <div className="ad-field" style={{ flex: 1 }}>
                <label>Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Optional display title"
                />
                <p className="ad-hint">Defaults to the PDF file name.</p>
              </div>
            </div>
            <div className="ad-field">
              <label>PDF file</label>
              <label className="ad-file" style={{ display: "block", marginTop: 8 }}>
                <input
                  type="file"
                  accept="application/pdf"
                  required={!editingId || !fileName}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setFile(f);
                    setFileName(f ? f.name : "");
                  }}
                />
                {editingId && fileName ? `Current: ${fileName} (leave blank to keep)` : fileName || "Choose a PDF…"}
              </label>
              {file && <p className="ad-hint">{file.name} · {humanSize(file.size)}</p>}
            </div>

            <div className="ad-form-foot">
              <button type="button" className="ad-set-btn ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="ad-set-btn">
                {editingId ? "Update sheet" : "Upload sheet"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {upload && (
        <div className="ad-overlay" role="dialog" aria-modal="true" aria-labelledby="upload-dialog-title">
          <div
            className="ad-modal upload-card"
            role="document"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 460 }}
          >
            {upload.phase === "uploading" && (
              <>
                <div className="upload-spin" aria-hidden="true" />
                <h2 className="ad-form-title upload-title" id="upload-dialog-title">
                  {upload.isEdit ? "Updating" : "Uploading"} <span className="hl">formula sheet</span>…
                </h2>
                <p className="upload-file">
                  <span className="upload-fname">{upload.title}</span>
                  <span className="upload-gchip">{upload.gradeLabel}</span>
                </p>
                <div
                  className="up-track"
                  role="progressbar"
                  aria-valuenow={upload.percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Upload progress"
                >
                  <div className="up-fill" style={{ transform: `scaleX(${upload.percent / 100})` }} />
                </div>
                <div className="up-pct tnum">{upload.percent}%</div>
                <div className="ad-form-foot">
                  <button type="button" className="ad-set-btn ghost" onClick={() => setUpload(null)}>
                    Hide
                  </button>
                </div>
              </>
            )}

            {upload.phase === "done" && (
              <>
                <div className="upload-ok" aria-hidden="true">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" /></svg>
                </div>
                <h2 className="ad-form-title upload-title" id="upload-dialog-title">
                  {upload.isEdit ? "Sheet" : "Sheet"} <span className="hl">{upload.isEdit ? "updated" : "uploaded"}</span>
                </h2>
                <p className="upload-file">
                  <span className="upload-fname">{upload.title}</span>
                  <span className="upload-gchip">{upload.gradeLabel}</span>
                </p>
                <div className="ad-form-foot">
                  <button type="button" className="btn" onClick={() => setUpload(null)}>
                    Done
                  </button>
                </div>
              </>
            )}

            {upload.phase === "error" && (
              <>
                <div className="upload-err-ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 8v5" />
                    <path d="M12 16.5h.01" />
                    <path d="M10.3 3.9L2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
                  </svg>
                </div>
                <h2 className="ad-form-title upload-title" id="upload-dialog-title">Upload <span className="hl">failed</span></h2>
                <p className="ad-hint upload-error-text">{upload.error}</p>
                <div className="ad-form-foot">
                  <button type="button" className="ad-set-btn ghost" onClick={() => setUpload(null)}>
                    Close
                  </button>
                  <button type="button" className="ad-set-btn" onClick={() => { setUpload({ ...upload, phase: "uploading", percent: 0, error: undefined }); void startUpload(); }}>
                    Try again
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete this formula sheet?"
        description="This cannot be undone."
        confirmLabel="Delete"
        danger
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          const id = deleteId;
          setDeleteId(null);
          if (id) void doDelete(id);
        }}
      />
    </div>
  );
}
