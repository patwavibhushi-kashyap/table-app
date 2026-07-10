import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Firebase must never initialise during server-side rendering or build-time
// static generation — only in the browser, where `NEXT_PUBLIC_*` env vars are
// guaranteed to be inlined and a real `window` exists. Every consumer of `db`
// only calls it from inside event handlers/effects (never at module scope or
// during render), so it's always defined by the time it's actually used.
export const db = (
  typeof window !== "undefined"
    ? getDatabase(getApps().length ? getApp() : initializeApp(firebaseConfig))
    : undefined
) as Database;
