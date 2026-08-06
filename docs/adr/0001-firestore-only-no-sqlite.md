# Firestore only — no local SQLite

The app stores all data in Firebase Firestore with offline persistence enabled; there is no separate local database and no hand-written sync layer.

The user wants data to work offline on the phone while still syncing between devices. Two viable shapes existed: a local SQLite store plus a Firestore mirror with custom sync logic, or Firestore alone. Firestore's built-in offline persistence provides exactly the local-first behavior required — reads and writes work offline and reconcile in the background — with zero custom sync code and one source of truth. The per-account scale (tens of writes per day) is far below free-tier limits, so no local-store advantage in latency or quota applies.

**Status:** accepted

**Consequences:** offline persistence relies on the Firebase JS SDK + AsyncStorage (Expo Go compatible); a future multi-device power user would hit free-tier read limits before storage limits.
