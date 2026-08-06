// Firebase module-load singletons (01-RESEARCH.md Pattern 1, expo.fyi pattern).
// Init order is load-bearing:
//   1. initializeAuth with AsyncStorage persistence MUST be the FIRST auth call —
//      getAuth() before it creates a default instance without RN persistence
//      (AUTH-02 silently fails).
//   2. initializeFirestore with the DEFAULT memory cache only — never
//      persistentLocalCache (IndexedDB-only, throws in Expo Go).
// Never call initializeAuth/initializeFirestore inside components or effects
// (Fast Refresh re-runs them). Import these singletons everywhere.
import { initializeApp } from "firebase/app";
// Note: auth APIs import from @firebase/auth, NOT the umbrella firebase/auth —
// firebase 12.17.1's umbrella "./auth" export map dropped the "react-native"
// condition, so getReactNativePersistence is absent from firebase/auth while
// @firebase/auth (its implementation package) still ships the RN build at the
// "react-native" condition (dist/rn/index.js) + top-level "react-native" field.
import { initializeAuth, getReactNativePersistence } from "@firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeFirestore } from "firebase/firestore";
import { firebaseConfig } from "./config";

export const app = initializeApp(firebaseConfig);
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
// firebase 12 made settings a required arg; empty settings = default memory
// cache (Expo Go safe) — never persistentLocalCache here.
export const db = initializeFirestore(app, {});
