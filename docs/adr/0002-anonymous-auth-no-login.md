# Anonymous auth — no login screen

**Status: superseded by ADR-0005**

The app signs itself in with Firebase Anonymous Auth at first launch; there is no registration, login screen, or account UI.

Firestore security rules require an authenticated identity to scope data, even for a single user. The alternatives were an email/password or Google sign-in UI — real accounts with real friction for zero benefit in a personal app — or no auth, which would leave rules unable to scope data to a user. Anonymous auth provides a stable `uid` scoped to the device, all rules key on it, and the user never sees anything. The only cost is that the identity is per-device/install, which is irrelevant since the data belongs to the device owner.

**Status:** accepted

**Consequences:** data is recoverable only through Firebase console; if the app is ever multi-user, email auth can be added without schema changes.
