import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAnalytics, type Analytics } from "firebase/analytics";
import {
  getAuth,
  onAuthStateChanged,
  type Auth,
  type User,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCmpBbUxyPr0S5Nx6NnPbJI3vmRRuAiz74",
  authDomain: "examsiteindia.firebaseapp.com",
  projectId: "examsiteindia",
  storageBucket: "examsiteindia.firebasestorage.app",
  messagingSenderId: "748695324650",
  appId: "1:748695324650:web:191d1430288d57dacdd493",
  measurementId: "G-VDJZYZZ08C",
};

let app: FirebaseApp | null = null;
let analytics: Analytics | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

export function getFirestoreDb(): Firestore {
  const firebaseApp = getFirebaseApp();
  if (!db) {
    db = getFirestore(firebaseApp);
  }
  return db;
}

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = initializeApp(firebaseConfig);
  }
  return app;
}

export function getStorageInstance(): FirebaseStorage {
  const firebaseApp = getFirebaseApp();
  if (!storage) {
    storage = getStorage(firebaseApp);
  }
  return storage;
}

/**
 * NOTE: keep getAuth() — do NOT switch to initializeAuth with an explicit
 * persistence. IndexedDB-blocked browsers make initializeAuth throw, and the
 * fallback getAuth() returns a half-initialized instance whose onAuthState
 * never fires (admin gate stuck on "Loading…" forever). getAuth() defaults
 * to browser-local persistence on web and degrades gracefully.
 */
export function getAuthInstance(): Auth {
  const firebaseApp = getFirebaseApp();
  if (!auth) {
    auth = getAuth(firebaseApp);
  }
  return auth;
}

export function onAuthState(
  cb: (user: User | null) => void
): () => void {
  const auth = getAuthInstance();
  return onAuthStateChanged(auth, cb);
}

export function getAnalyticsInstance(): Analytics | null {
  if (typeof window === "undefined") return null;
  const firebaseApp = getFirebaseApp();
  if (!analytics) {
    analytics = getAnalytics(firebaseApp);
  }
  return analytics;
}
