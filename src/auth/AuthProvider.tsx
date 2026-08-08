// AuthProvider — single source of truth for auth state (01-RESEARCH.md
// Code Examples lines 417-448). Subscribes onAuthStateChanged once; the FIRST
// emission flips `initializing` to false, which is what prevents flashing the
// Sign In screen over a restored session (AUTH-02). `signIn` wraps
// signInWithEmailAndPassword, `signUp` wraps createUserWithEmailAndPassword
// and writes a users/{uid} doc — both do NOT catch, errors propagate to the
// caller (SignInScreen/SignUpScreen maps them via error functions). No manual
// navigation anywhere: screens render purely from this context.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  deleteUser,
  User,
} from "@firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";
import { auth, db } from "../firebase/app";

type UserProfile = {
  displayName: string;
  email: string;
  isDefault: boolean;
};

type AuthContextValue = {
  user: User | null;
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (displayName: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  userProfile: UserProfile | null;
  isOnline: boolean;
  reauthenticate: (password: string) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
};

// Default null so useAuth() can detect "outside provider" usage.
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Import order is load-bearing: `auth` comes from ../firebase/app, where
    // initializeAuth wired AsyncStorage persistence at module load. Never call
    // getAuth() yourself (AUTH-02 silently fails otherwise).
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Fetch user profile from Firestore
        try {
          const snap = await getDoc(doc(db, "users", u.uid));
          if (snap.exists()) {
            const data = snap.data();
            setUserProfile({
              displayName: typeof data.displayName === "string" ? data.displayName : "",
              email: typeof data.email === "string" ? data.email : (u.email ?? ""),
              isDefault: typeof data.isDefault === "boolean" ? data.isDefault : false,
            });
          } else {
            // Fallback for legacy accounts or race conditions
            setUserProfile({
              displayName: u.displayName ?? "",
              email: u.email ?? "",
              isDefault: false,
            });
          }
        } catch {
          // Doc doesn't exist or network error — use Firebase user defaults
          setUserProfile({
            displayName: u.displayName ?? "",
            email: u.email ?? "",
            isDefault: false,
          });
        }
      } else {
        setUserProfile(null);
      }
      setInitializing(false);
    });
    return unsubscribe;
  }, []);

  // Online status: subscribe to user doc with metadata changes
  useEffect(() => {
    if (!user) {
      setIsOnline(true);
      return;
    }
    const unsubscribe = onSnapshot(
      doc(db, "users", user.uid),
      { includeMetadataChanges: true },
      (snap) => {
        setIsOnline(!snap.metadata.fromCache);
      },
    );
    return () => unsubscribe();
  }, [user]);

  const signIn = useCallback(async (email: string, password: string) => {
    // Throws FirebaseError on failure — caller handles the mapping.
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const signUp = useCallback(async (displayName: string, email: string, password: string) => {
    // Creates the user (signs them in automatically) then writes a users/{uid}
    // doc. Errors propagate — the caller maps them via signUpErrorMessage.
    const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await setDoc(doc(db, "users", userCredential.user.uid), {
      displayName: displayName.trim(),
      email: email.trim().toLowerCase(),
      isDefault: false,
      createdAt: Timestamp.now(),
    });
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    // onAuthStateChanged clears user and userProfile automatically
  }, []);

  const reauthenticate = useCallback(async (password: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("Not signed in");
    const credential = EmailAuthProvider.credential(currentUser.email!, password);
    await reauthenticateWithCredential(currentUser, credential);
  }, []);

  const deleteAccount = useCallback(async (password: string) => {
    if (!user) throw new Error("Not signed in");

    // Step 1: Reauthenticate
    await reauthenticate(password);

    // Step 2: Cascade delete entries (chunked ≤500)
    const BATCH_LIMIT = 500;
    while (true) {
      const snap = await getDocs(
        query(collection(db, "entries"), where("uid", "==", user.uid), limit(BATCH_LIMIT)),
      );
      if (snap.empty) break;
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    }

    // Step 3: Cascade delete expenseCategories (chunked ≤500)
    while (true) {
      const snap = await getDocs(
        query(collection(db, "expenseCategories"), where("uid", "==", user.uid), limit(BATCH_LIMIT)),
      );
      if (snap.empty) break;
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    }

    // Step 4: Cascade delete incomeCategories (chunked ≤500)
    while (true) {
      const snap = await getDocs(
        query(collection(db, "incomeCategories"), where("uid", "==", user.uid), limit(BATCH_LIMIT)),
      );
      if (snap.empty) break;
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    }

    // Step 5: Delete users/{uid} doc
    await deleteDoc(doc(db, "users", user.uid));

    // Step 6: Delete auth account LAST (after all Firestore docs are gone)
    // Use auth.currentUser directly — deleteUser expects User
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("Not signed in");
    await deleteUser(currentUser);
  }, [user, reauthenticate]);

  return (
    <AuthContext.Provider
      value={{
        user,
        initializing,
        signIn,
        signUp,
        signOut,
        userProfile,
        isOnline,
        reauthenticate,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
