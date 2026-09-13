import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { getAuthInstance, getFirestoreDb } from "./firebase/client";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface AppLog {
  id: string;
  level: LogLevel;
  message: string;
  details?: string;
  path?: string;
  userEmail?: string;
  createdAt?: { toDate?: () => Date } | Date | null;
}

const COLLECTION = "logs";
const MAX_LOGS = 200;

function stringifyDetails(values: unknown[]): string | undefined {
  if (!values.length) return undefined;
  try {
    const result = values.map((value) => {
      if (typeof value === "string") return value;
      if (value instanceof Error) return `${value.name}: ${value.message}`;
      return JSON.stringify(value);
    }).join(" ");
    return result || undefined;
  } catch {
    return "[unserializable log details]";
  }
}

/** Persist one application event without allowing logging to break the caller. */
export async function recordLog(
  level: LogLevel,
  message: string,
  values: unknown[] = []
): Promise<void> {
  try {
    const auth = getAuthInstance();
    const data: Record<string, unknown> = {
      level,
      message: message.slice(0, 2000),
      createdAt: serverTimestamp(),
    };
    const details = stringifyDetails(values);
    if (details) data.details = details.slice(0, 6000);
    if (typeof window !== "undefined") data.path = window.location.pathname;
    if (auth.currentUser?.email) data.userEmail = auth.currentUser.email;
    await addDoc(collection(getFirestoreDb(), COLLECTION), data);
  } catch {
    // Logging must never cause an application action to fail.
  }
}

function fromSnapshot(snapshot: { id: string; data: () => Record<string, unknown> }): AppLog {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    level: data.level === "error" || data.level === "warn" || data.level === "debug" ? data.level : "info",
    message: typeof data.message === "string" ? data.message : "Unknown event",
    details: typeof data.details === "string" ? data.details : undefined,
    path: typeof data.path === "string" ? data.path : undefined,
    userEmail: typeof data.userEmail === "string" ? data.userEmail : undefined,
    createdAt: (data.createdAt as AppLog["createdAt"]) ?? null,
  };
}

export function subscribeToLogs(onChange: (logs: AppLog[]) => void): Unsubscribe {
  const logsQuery = query(
    collection(getFirestoreDb(), COLLECTION),
    orderBy("createdAt", "desc"),
    limit(MAX_LOGS)
  );
  return onSnapshot(logsQuery, (snapshot) => {
    onChange(snapshot.docs.map(fromSnapshot));
  });
}
