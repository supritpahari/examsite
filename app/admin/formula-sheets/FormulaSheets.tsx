"use client";

import { useEffect, useState } from "react";
import { getAuthInstance, onAuthState } from "@/lib/firebase/client";
import { getIdToken, type User } from "firebase/auth";

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

export default function FormulaSheetsPage() {
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [sheets, setSheets] = useState<FormulaSheet[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  // Add/edit form state
  const [open, setOpen] = useState(false);
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

  const getToken = async (): Promise<string> => {
    const auth = getAuthInstance();
    const u = auth.currentUser;
    if (!u) throw new Error("Not signed in");
    return u.getIdToken();
  };

  const loadSheets = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/formula-sheets", {
        headers: { Authorization: `Bearer ${token}` },
      });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const token = await getToken();
      const form = new FormData();
      form.append("chapter", chapter.trim());
      form.append("grade", grade.trim());
      form.append("price", price);
      form.append("title", title.trim());
      if (file) form.append("file", file);

      const url = editingId
        ? `/api/formula-sheets?id=${encodeURIComponent(editingId)}`
        : "/api/formula-sheets";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) {
        const detail = (await res.json().catch(() => ({})) as { error?: string }).error;
        throw new Error(detail || "Save failed.");
      }
      setSaved(editingId ? "Formula sheet updated." : "Formula sheet uploaded.");
      setTimeout(() => setSaved(null), 3000);
      resetForm();
      setOpen(false);
      await loadSheets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this formula sheet? This cannot be undone.")) return;
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`/api/formula-sheets?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Delete failed.");
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

  const priceNum = Number(price);
  const validPrice = String(priceNum) === price.trim() || price.trim() === "";

  if (checking || !user) {
    return <div className="ad-empty">Checking session…</div>;
  }

  return (
    <div>
      <div className="ad-head">
        <div>
          <h1 className="ad-title">Formula <em>Sheets</em></h1>
          <p className="ad-count">
            Upload chapter-wise formula sheets, set grade &amp; price.
          </p>
        </div>
        <button className="ad-submit" onClick={() => setOpen(true)}>
          + Add formula sheet
        </button>
      </div>

      {error && <div className="ad-set-status err">{error}</div>}
      {saved && <div className="ad-set-status ok">{saved}</div>}

      <div className="ad-set-card">
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 13,
          }}
        >
          <thead>
            <tr
              style={{
                textAlign: "left",
                borderBottom: "2px solid #14110d",
                color: "#8a8275",
                textTransform: "uppercase",
                fontSize: 11,
                letterSpacing: "0.1em",
              }}
            >
              <th style={{ padding: "12px 14px" }}>Chapter</th>
              <th style={{ padding: "12px 14px" }}>Grade</th>
              <th style={{ padding: "12px 14px" }}>Price</th>
              <th style={{ padding: "12px 14px" }}>File</th>
              <th style={{ padding: "12px 14px", textAlign: "right" }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sheets.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: "28px 0", textAlign: "center", color: "#8a8275" }}>
                  No formula sheets yet. Add one above.
                </td>
              </tr>
            ) : (
              sheets.map((s) => (
                <tr
                  key={s.id}
                  style={{ borderBottom: "1px solid #d9d1bf", background: "#f4f0e8" }}
                >
                  <td style={{ padding: "12px 14px", color: "#14110d" }}>{s.chapter}</td>
                  <td style={{ padding: "12px 14px", color: "#14110d" }}>{s.grade}</td>
                  <td style={{ padding: "12px 14px", color: "#14110d" }}>
                    ₹{s.price}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <a
                        href={s.pdfUrl}
                        target="_blank"
                        rel="noopener"
                        className="ad-code-link"
                        style={{ textDecoration: "underline" }}
                      >
                        {s.pdfName}
                      </a>
                      <span style={{ fontSize: 10, color: "#8a8275" }}>
                        {humanSize(s.fileSize)}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "right" }}>
                    <button
                      className="ad-exam-btn ghost"
                      onClick={() => openEdit(s)}
                      style={{ marginRight: 6 }}
                    >
                      Edit
                    </button>
                    <button
                      className="ad-exam-btn danger"
                      onClick={() => handleDelete(s.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit modal */}
      <div className="ad-overlay" onClick={() => setOpen(false)} style={{ display: open ? "flex" : "none" }}>
        <div className="ad-modal" onClick={(e) => e.stopPropagation()}>
          <div className="ad-modal-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
            <h2 className="ad-form-title">
              {editingId ? "Edit" : "Upload"} formula <em>sheet</em>
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
                <label>Grade</label>
                <input
                  required
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  placeholder="e.g. 12 / JEE"
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

            <div style={{ marginTop: 22, display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" className="ad-set-btn ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="ad-submit" disabled={saving}>
                {saving ? "Saving…" : editingId ? "Update sheet" : "Upload sheet"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
