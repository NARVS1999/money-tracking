# Email/password accounts with a protected default account

The app uses Firebase Email/Password auth: a Sign In screen at first launch, in-app account creation, account deletion (cascade), and a seeded **default account** that can never be deleted in-app. This supersedes ADR-0002 (anonymous auth, no login).

The user's model changed from "just me" to needing a login identity with a protected default and the ability to create/delete other accounts. Anonymous auth cannot support real login or per-account data ownership across devices. Alternatives considered: email/password only (chosen — Firebase-native, no OAuth setup), and local profiles with PINs (rejected — no real login, no cross-device ledger). The default account is seeded once via the console with `isDefault: true` (rules forbid in-app creation of default-flagged accounts), and app logic hides deletion for it — a deliberate, honest boundary: the console can always delete anything.

**Status:** accepted; supersedes ADR-0002

**Consequences:** account deletion requires password reauthentication and a cascade routine (entries → categories → `users` doc → auth account); first sign-in needs network; forgotten passwords are reset via the Firebase console, not in-app.
