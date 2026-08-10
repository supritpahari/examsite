import { getFirestoreDb } from "./firebase/client";
import {
  doc,
  getDoc,
  setDoc,
  type Firestore,
} from "firebase/firestore";

const COLLECTION = "settings";
const DOC = "zen";
const LS_KEY = "examsite-zen-settings";

export interface ZenSettings {
  apiKey: string;
  model: string;
}

function cacheKey(key: string) {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const obj = raw ? (JSON.parse(raw) as Partial<ZenSettings>) : {};
    return { ...obj, apiKey: key } as ZenSettings;
  } catch {
    return { apiKey: key, model: "" };
  }
}

function persistLocal(s: ZenSettings) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export async function loadSettings(): Promise<ZenSettings> {
  try {
    const db: Firestore = getFirestoreDb();
    const snap = await getDoc(doc(db, COLLECTION, DOC));
    if (snap.exists()) {
      const data = snap.data() as Partial<ZenSettings>;
      const merged: ZenSettings = { apiKey: data.apiKey ?? "", model: data.model ?? "" };
      persistLocal(merged);
      return merged;
    }
  } catch {
    /* fall through to local */
  }
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as ZenSettings;
  } catch {
    /* ignore */
  }
  return { apiKey: "", model: "" };
}

export async function saveSettings(s: ZenSettings): Promise<void> {
  persistLocal(s);
  try {
    const db: Firestore = getFirestoreDb();
    await setDoc(doc(db, COLLECTION, DOC), s);
  } catch {
    /* local only */
  }
}

const ZEN_BASE = "https://opencode.ai/zen/v1";

export interface ZenModel {
  id: string;
  owned_by?: string;
}

export async function fetchZenModels(apiKey: string): Promise<ZenModel[]> {
  const res = await fetch(`${ZEN_BASE}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to load models (${res.status})`);
  }
  const json = (await res.json()) as { data?: ZenModel[] };
  return (json.data ?? []).sort((a, b) => a.id.localeCompare(b.id));
}
