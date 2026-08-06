// AuthProvider — single source of truth for auth state (01-RESEARCH.md
// Code Examples lines 417-448). Subscribes onAuthStateChanged once; the FIRST
// emission flips `initializing` to false, which is what prevents flashing the
// Sign In screen over a restored session (AUTH-02). `signIn` wraps
// signInWithEmailAndPassword and does NOT catch — errors propagate to the
// caller (SignInScreen maps them via authErrorMessage). No manual navigation
// anywhere: screens render purely from this context.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  User,
} from "@firebase/auth";
import { auth } from "../firebase/app";

type AuthContextValue = {
  user: User | null;
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<void>;
};

// Default null so useAuth() can detect "outside provider" usage.
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    // Import order is load-bearing: `auth` comes from ../firebase/app, where
    // initializeAuth wired AsyncStorage persistence at module load. Never call
    // getAuth() yourself (AUTH-02 silently fails otherwise).
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setInitializing(false);
    });
    return unsubscribe;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    // Throws FirebaseError on failure — caller handles the mapping.
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  return (
    <AuthContext.Provider value={{ user, initializing, signIn }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
