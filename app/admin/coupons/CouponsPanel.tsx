/* Coupons admin panel — create, edit, delete discount codes.
 * Edit/Add happens in a dialog opened from the "+ Add Coupon" button
 * or the Edit/Delete row actions. */
"use client";

import { useEffect, useState } from "react";
import {
  fetchCoupons,
  saveCoupon,
  deleteCoupon,
  type Coupon,
} from "@/lib/coupons";
import ConfirmDialog from "../../_components/ConfirmDialog";

export default function CouponsPanel() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [usesLeft, setUsesLeft] = useState("");
  const [active, setActive] = useState(true);
  const [error, setError] = useState("");
  const [pendingConfirm, setPendingConfirm] = useState<{
    id: string;
    code: string;
  } | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  useEffect(() => {
    loadCoupons();
  }, []);

  async function loadCoupons() {
    try {
      setLoading(true);
      const data = await fetchCoupons();
      setCoupons(data);
    } catch {
      setError("Failed to load coupons.");
    } finally {
      setLoading(false);
    }
  }

  function openEdit(c: Coupon) {
    setEditingId(c.id);
    setCode(c.code);
    setDiscountType(c.discountType);
    setDiscountValue(String(c.discountValue));
    setMinAmount(String(c.minAmount ?? ""));
    setMaxDiscount(String(c.maxDiscount ?? ""));
    setUsesLeft(String(c.usesLeft ?? ""));
    setActive(c.active);
    setAddDialogOpen(true);
  }

  function openCreate() {
    setEditingId(null);
    setCode("");
    setDiscountType("percent");
    setDiscountValue("");
    setMinAmount("");
    setMaxDiscount("");
    setUsesLeft("");
    setActive(true);
    setAddDialogOpen(true);
  }

  async function save() {
    setError("");
    if (!code.trim()) {
      setError("Coupon code is required.");
      return;
    }
    const dv = Number(discountValue);
    if (!dv || dv <= 0) {
      setError("Discount value must be greater than 0.");
      return;
    }
    if (discountType === "percent" && dv > 100) {
      setError("Percent discount cannot exceed 100.");
      return;
    }

    try {
      await saveCoupon({
        id: editingId || undefined,
        code: code.trim(),
        discountType,
        discountValue: dv,
        minAmount: minAmount.trim() ? Number(minAmount) : undefined,
        maxDiscount: maxDiscount.trim() ? Number(maxDiscount) : undefined,
        active,
        usesLeft: usesLeft.trim() ? Number(usesLeft) : undefined,
      });
      setEditingId(null);
      setCode("");
      setAddDialogOpen(false);
      await loadCoupons();
    } catch {
      setError("Failed to save coupon.");
    }
  }

  function openDelete(c: Coupon) {
    setPendingConfirm({ id: c.id, code: c.code });
  }

  async function confirmDelete() {
    if (!pendingConfirm) return;
    try {
      await deleteCoupon(pendingConfirm.id);
      setPendingConfirm(null);
      await loadCoupons();
    } catch {
      setError("Failed to delete coupon.");
    }
  }

  function toggleActive(c: Coupon) {
    saveCoupon({
      id: c.id,
      code: c.code,
      discountType: c.discountType,
      discountValue: c.discountValue,
      minAmount: c.minAmount,
      maxDiscount: c.maxDiscount,
      active: !c.active,
      expiresAt: c.expiresAt,
      usesLeft: c.usesLeft,
    }).then(() => {
      loadCoupons();
    });
  }

  if (loading) {
    return (
      <div className="ad-guard">Loading coupons…</div>
    );
  }

  return (
    <div className="ad-main">
      <div className="ad-head">
        <h1 className="ad-title">Coupon <span className="hl">Codes</span></h1>
        <button
          className="btn"
          onClick={openCreate}
        >
          + Add Coupon
        </button>
      </div>

      {error && <div className="ad-error" role="alert">{error}</div>}

      {coupons.length === 0 ? (
        <div className="ad-empty">No coupons yet. Add your first one.</div>
      ) : (
        <div className="ad-coupon-table">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Type</th>
                <th>Value</th>
                <th>Min Order</th>
                <th>Max Discount</th>
                <th>Uses Left</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.code}</strong>
                  </td>
                  <td>{c.discountType}</td>
                  <td>
                    {c.discountType === "percent" ? `${c.discountValue}%` : `₹${c.discountValue}`}
                  </td>
                  <td>{c.minAmount ?? "—"}</td>
                  <td>{c.maxDiscount ?? "—"}</td>
                  <td>{c.usesLeft ?? "∞"}</td>
                  <td>
                    <span
                      className={`status-badge ${c.active ? "active" : "inactive"}`}
                    >
                      {c.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <div className="ad-coupon-actions">
                      <button
                        className="btn btn--soft"
                        onClick={() => openEdit(c)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn--soft"
                        onClick={() => toggleActive(c)}
                      >
                        {c.active ? "Disable" : "Enable"}
                      </button>
                      <button
                        className="btn btn--soft"
                        onClick={() => openDelete(c)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit dialog */}
      {addDialogOpen && (
        <div
          className="ad-overlay"
          onClick={() => setAddDialogOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "oklch(20% 0.012 250 / 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 60,
            padding: "2rem",
          }}
        >
          <div
            className="ad-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="coupon-dialog-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 520,
              background: "var(--color-paper)",
              borderRadius: "var(--radius-card)",
              padding: "2rem 1.75rem 1.5rem",
              boxShadow: "var(--shadow-lift)",
            }}
          >
            <button
              onClick={() => setAddDialogOpen(false)}
              aria-label="Close coupon dialog"
              style={{
                position: "absolute",
                top: "0.8rem",
                right: "0.9rem",
                background: "transparent",
                border: "1.5px solid var(--color-rule-2)",
                borderRadius: "999px",
                width: 34,
                height: 34,
                fontSize: "1.05rem",
                cursor: "pointer",
                color: "var(--color-ink)",
                lineHeight: 1,
                display: "grid",
                placeItems: "center",
              }}
              type="button"
            >
              ✕
            </button>
            <h2 className="ad-form-title" id="coupon-dialog-title">
              {editingId ? "Edit Coupon" : "Add Coupon"}
            </h2>
            {error && <div className="ad-error" role="alert">{error}</div>}
            <div className="ad-coupon-grid">
              <div className="ad-coupon-field">
                <label>Code</label>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SAVE10"
                />
              </div>
              <div className="ad-coupon-field">
                <label>Type</label>
                <select value={discountType} onChange={(e) => setDiscountType(e.target.value as "percent" | "fixed")}>
                  <option value="percent">Percent off</option>
                  <option value="fixed">Fixed ₹ off</option>
                </select>
              </div>
              <div className="ad-coupon-field">
                <label>Value</label>
                <input
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder="e.g. 10 or 50"
                />
              </div>
              <div className="ad-coupon-field">
                <label>Min Order (₹)</label>
                <input
                  type="number"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  placeholder="optional"
                />
              </div>
              <div className="ad-coupon-field">
                <label>Max Discount (₹)</label>
                <input
                  type="number"
                  value={maxDiscount}
                  onChange={(e) => setMaxDiscount(e.target.value)}
                  placeholder="optional"
                />
              </div>
              <div className="ad-coupon-field">
                <label>Uses Left</label>
                <input
                  type="number"
                  value={usesLeft}
                  onChange={(e) => setUsesLeft(e.target.value)}
                  placeholder="optional"
                />
              </div>
              <div className="ad-coupon-field">
                <label>Active</label>
                <select value={active ? "true" : "false"} onChange={(e) => setActive(e.target.value === "true")}>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
              <div className="ad-coupon-actions">
                <button className="btn btn--soft" onClick={() => setAddDialogOpen(false)}>
                  Cancel
                </button>
                <button className="btn" onClick={save} disabled={!code.trim()}>
                  {editingId ? "Update Coupon" : "Create Coupon"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingConfirm}
        title="Delete Coupon?"
        description={`Delete coupon “${pendingConfirm?.code}”? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onCancel={() => setPendingConfirm(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
