/* Coupon management — admin creates codes, students apply at checkout.
 * Stored in Firestore coupons collection.
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getFirestoreDb } from "./firebase/client";

const COLLECTION = "coupons";

export interface Coupon {
  id: string;
  code: string; // e.g. "SAVE10", "WELCOME20"
  discountType: "percent" | "fixed"; // percent off or fixed rupees off
  discountValue: number; // percent (0-100) or fixed rupees
  minAmount?: number; // minimum cart value to apply
  maxDiscount?: number; // max discount cap (for percent)
  active: boolean;
  expiresAt?: unknown; // optional expiry timestamp
  usesLeft?: number; // optional usage limit
  createdAt: unknown;
}

function fromDoc(snap: QueryDocumentSnapshot): Coupon {
  const data = snap.data();
  return {
    id: snap.id,
    code: data.code ?? "",
    discountType: data.discountType ?? "percent",
    discountValue: data.discountValue ?? 0,
    minAmount: data.minAmount ?? undefined,
    maxDiscount: data.maxDiscount ?? undefined,
    active: data.active ?? true,
    expiresAt: data.expiresAt,
    usesLeft: data.usesLeft ?? undefined,
    createdAt: data.createdAt,
  };
}

/** Fetch all coupons (admin lists them). */
export async function fetchCoupons(): Promise<Coupon[]> {
  try {
    const db = getFirestoreDb();
    const q = query(collection(db, COLLECTION));
    const snap = await getDocs(q);
    return snap.docs.map(fromDoc).sort((a, b) => {
      const aTime = a.createdAt && typeof (a.createdAt as { toDate?: () => Date }).toDate === "function"
        ? (a.createdAt as { toDate: () => Date }).toDate().getTime() : 0;
      const bTime = b.createdAt && typeof (b.createdAt as { toDate?: () => Date }).toDate === "function"
        ? (b.createdAt as { toDate: () => Date }).toDate().getTime() : 0;
      return bTime - aTime;
    });
  } catch {
    return [];
  }
}

/** Fetch a single coupon by code (used at checkout validation). */
export async function fetchCouponByCode(code: string): Promise<Coupon | null> {
  try {
    const db = getFirestoreDb();
    const q = query(collection(db, COLLECTION), where("code", "==", code.toUpperCase().trim()));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return fromDoc(snap.docs[0]);
  } catch {
    return null;
  }
}

/** Create or update a coupon. */
export async function saveCoupon(data: Omit<Coupon, "id" | "createdAt"> & { id?: string }): Promise<string> {
  const db = getFirestoreDb();
  const payload: Record<string, unknown> = {
    code: data.code.toUpperCase().trim(),
    discountType: data.discountType,
    discountValue: data.discountValue,
    minAmount: data.minAmount ?? null,
    maxDiscount: data.maxDiscount ?? null,
    active: data.active ?? true,
    expiresAt: data.expiresAt ?? null,
    usesLeft: data.usesLeft ?? null,
    updatedAt: serverTimestamp(),
  };
  if (data.id) {
    await setDoc(doc(db, COLLECTION, data.id), payload, { merge: true });
    return data.id;
  }
  payload.createdAt = serverTimestamp();
  const ref = await addDoc(collection(db, COLLECTION), payload);
  return ref.id;
}

/** Delete a coupon. */
export async function deleteCoupon(id: string): Promise<void> {
  const db = getFirestoreDb();
  await deleteDoc(doc(db, COLLECTION, id));
}

/** Validate a coupon for a given cart amount. Returns discount amount or null. */
export async function validateCoupon(code: string, cartAmount: number): Promise<{
  valid: boolean;
  coupon?: Coupon;
  discountAmount?: number;
  message?: string;
}> {
  const coupon = await fetchCouponByCode(code);
  if (!coupon) return { valid: false, message: "Invalid coupon code." };
  if (!coupon.active) return { valid: false, message: "This coupon is no longer active." };
  if (coupon.expiresAt) {
    const exp = coupon.expiresAt as { toDate?: () => Date };
    const expMs = exp && typeof exp.toDate === "function" ? exp.toDate().getTime() : 0;
    if (expMs && Date.now() > expMs) return { valid: false, message: "This coupon has expired." };
  }
  if (coupon.minAmount !== undefined && cartAmount < coupon.minAmount) {
    return { valid: false, message: `Minimum cart value of ₹${coupon.minAmount} required.` };
  }
  if (coupon.usesLeft !== undefined && coupon.usesLeft <= 0) {
    return { valid: false, message: "This coupon has reached its usage limit." };
  }

  let discount = 0;
  if (coupon.discountType === "percent") {
    discount = (cartAmount * coupon.discountValue) / 100;
    if (coupon.maxDiscount !== undefined && discount > coupon.maxDiscount) {
      discount = coupon.maxDiscount;
    }
  } else {
    discount = coupon.discountValue;
  }
  if (discount > cartAmount) discount = cartAmount;

  return {
    valid: true,
    coupon,
    discountAmount: Math.round(discount),
  };
}
