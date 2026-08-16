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

export interface SiteInfo {
  siteName: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  tagline: string;
}

const SITE_DOC = "site";
const SITE_LS = "examsite-site-info";

export const DEFAULT_SITE_INFO: SiteInfo = {
  siteName: "World of Physics",
  contactName: "Mr. Biman Dhawa",
  phone: "+91 00000 00000",
  email: "hello@examsite.in",
  address: "Belda, IN",
  tagline: "The exam before the exam.",
};

export async function loadSiteInfo(): Promise<SiteInfo> {
  try {
    const db: Firestore = getFirestoreDb();
    const snap = await getDoc(doc(db, COLLECTION, SITE_DOC));
    if (snap.exists()) {
      return { ...DEFAULT_SITE_INFO, ...(snap.data() as Partial<SiteInfo>) };
    }
  } catch {
    /* fall through to local */
  }
  try {
    const raw = localStorage.getItem(SITE_LS);
    if (raw) return { ...DEFAULT_SITE_INFO, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return DEFAULT_SITE_INFO;
}

export async function saveSiteInfo(info: SiteInfo): Promise<void> {
  try {
    localStorage.setItem(SITE_LS, JSON.stringify(info));
  } catch {
    /* ignore */
  }
  try {
    const db: Firestore = getFirestoreDb();
    await setDoc(doc(db, COLLECTION, SITE_DOC), info);
  } catch {
    /* local only */
  }
}
