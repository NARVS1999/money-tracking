# Tech Design — React Native + Expo + Firestore

## Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | **Expo** (latest SDK, Expo Go workflow) | QR-code testing on the user's phone; no custom native code |
| UI | React Native core components | No UI library needed for 5 simple screens |
| Navigation | `@react-navigation/bottom-tabs` + `@react-navigation/native-stack` | 4 tabs + full-screen forms |
| Database | **Firebase JS SDK** (`firebase` npm package, v10/11) | Firestore with offline persistence |
| Offline cache | `@react-native-async-storage/async-storage` | Required by Firebase JS SDK persistence |
| Auth | Firebase Email/Password (`signInWithEmailAndPassword`, `createUserWithEmailAndPassword`, `deleteUser`) | Accounts with a protected default (ADR-0005) |
| PDF | `expo-print` (HTML → `printToFileAsync`) | Works in Expo Go; no native modules |
| Excel | `xlsx` (SheetJS) | Pure JS, generates .xlsx in Expo Go |
| File output | `expo-file-system` (StorageAccessFramework) + `expo-sharing` | Write to Downloads (Android), share sheet fallback |
| State | React Context + hooks | Two contexts, no Redux/Zustand needed |

> **Critical constraint:** use the **Firebase JS SDK** (`firebase`), NOT `@react-native-firebase/*`. The native Firebase modules require a development build and don't run in Expo Go. The JS SDK runs in Expo Go with AsyncStorage-backed persistence.

## Project structure

```
money-tracking/
├── App.js                     # Auth gate + navigation shell
├── src/
│   ├── firebase/
│   │   └── config.js          # Firebase init
│   ├── auth/
│   │   └── AuthProvider.js    # sign-in state, signIn/signUp/signOut,
│   │                          #   deleteAccount (cascade), reauth
│   ├── context/
│   │   ├── EntriesProvider.js # entries CRUD + local state
│   │   └── CategoriesProvider.js
│   ├── screens/
│   │   ├── SignInScreen.js
│   │   ├── HomeScreen.js
│   │   ├── ExpensesScreen.js
│   │   ├── IncomeScreen.js
│   │   ├── CategoriesScreen.js
│   │   ├── AccountScreen.js
│   │   ├── EntryFormScreen.js # add / edit / copy
│   │   └── ExportScreen.js
│   ├── components/
│   │   ├── EntryRow.js
│   │   ├── CategoryPicker.js
│   │   └── AmountInput.js
│   ├── utils/
│   │   ├── money.js           # cents ⇄ "₱ 1,234.50"
│   │   ├── dates.js           # "YYYY-MM-DD" helpers, month range
│   │   └── export.js          # PDF + Excel builders
│   └── theme.js               # colors, spacing, type scale
```

## Key technical decisions

### Money as integer cents
`amountCents` integer everywhere (₱24.50 → `2450`). Formatting only in `money.js` (`toPeso()` / `parsePeso()`). Never store or compute with floats. See ADR-0003.

### Dates as `"YYYY-MM-DD"` strings
Local calendar date, stored as string. Range queries (`>= start && <= end`) become lexicographic string compares — no timezone conversion bugs, no midnight-offset bugs. `dates.js` exposes `today()`, `monthRange()`, `isFuture()`.

### Auth gate (email/password)
`AuthProvider` subscribes to `onAuthStateChanged`. App renders **SignInScreen** until a user is present, then the tab navigator. Sessions persist across restarts.

- **Sign in:** `signInWithEmailAndPassword`
- **Create account:** `createUserWithEmailAndPassword` → write `users/{uid}` with `displayName`, `isDefault: false` → sign into the new account
- **Sign out:** `signOut()` → Sign In screen
- **Delete account (cascade):** block if `isDefault` → `reauthenticateWithCredential(EmailAuthProvider, password)` → batch-delete own entries + categories → delete own `users` doc → `deleteUser()` → Sign In screen
- **Default account:** identified by `isDefault: true` on `users/{uid}`; Account tab hides the delete action for it

### Firestore offline persistence
```js
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager } from "firebase/firestore";
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() }),
});
```
Enable at startup; all queries use normal Firestore listeners (`onSnapshot`) so the UI updates on sync automatically. Note: offline persistence works in Expo Go with the JS SDK + AsyncStorage (free-tier-compatible).

### Data access pattern
Providers subscribe with `onSnapshot` (live updates) and expose `addEntry`, `updateEntry`, `deleteEntry`, `copyEntry` (same as add, new doc). Optimistic UI via listeners — no manual local cache management.

### Category delete guard
`deleteCategory(id)` first queries `entries where categoryId == id, limit 1`. Non-empty → throw a user-visible "in use" error; empty → delete.

### Export pipeline
1. Query `entries` in range (single `date` range query)
2. Group by category, compute totals
3. **PDF:** build HTML table → `Print.printToFileAsync({ html })` → move file from cache to Downloads via `StorageAccessFramework` (Android) or `Sharing.shareAsync` (iOS)
4. **Excel:** `XLSX.utils.json_to_sheet(rows)` → `writeFile` → same output path
5. Filename pattern: `expenses-2026-08-01_31.pdf` / `.xlsx`

## Firebase setup (manual, one-time)

1. Create project in Firebase console (free Spark plan)
2. Enable **Email/Password** sign-in in Authentication → Sign-in method
3. Create Firestore database (production mode)
4. Deploy the security rules from `backend-schema.md`
5. Create the composite index `entries: type ASC, date DESC`
6. Register the Expo app in the console, add config to `src/firebase/config.js` (JS SDK v9+ compat: `firebase.initializeApp` works with Expo Go)
7. **Seed the default account** (one-time, admin-side): add an auth user in Authentication → Users (choose the owner's email + password), then create its `users/{uid}` doc with `displayName` and `isDefault: true` (allowed via admin SDK/console — rules reject this from the app)

## Build & test loop

- `npx expo start` → scan QR with Expo Go → iterate on the phone
- No native build needed for any chosen library (all Expo Go compatible)
