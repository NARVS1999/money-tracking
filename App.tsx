// App shell — SafeAreaProvider > AuthProvider > RootNavigator.
// Root conditional stack (01-RESEARCH.md Pattern 2): restoring ->
// LoadingScreen (outside NavigationContainer); signedOut -> SignIn;
// signedIn -> MainTabs. The gate renders purely from AuthProvider context
// (onAuthStateChanged) — no manual navigation on sign-in success, no back
// path from MainTabs to SignIn.
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "./src/auth/AuthProvider";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { CategoriesProvider } from "./src/categories/CategoriesProvider";
import { EntriesProvider } from "./src/entries/EntriesProvider";
import { ScheduledEntriesProvider } from "./src/scheduled/ScheduledEntriesProvider";
import { seedFromFirestore } from "./src/db/seed";
import AutoSync from "./src/sync/AutoSync";
import LoadingScreen from "./src/screens/LoadingScreen";
import SignInScreen from "./src/screens/SignInScreen";
import SignUpScreen from "./src/screens/SignUpScreen";
import MainTabs from "./src/screens/MainTabs";
import EntryForm from "./src/components/EntryForm";
import ScheduledEntryForm from "./src/scheduled/ScheduledEntryForm";

const Stack = createNativeStackNavigator();

// SQLite bootstrap (OFFL-01): on every sign-in, make sure the local ledger
// exists. seedFromFirestore is idempotent — it checks whether SQLite already
// holds this uid's data and skips when populated (offline-ready). Failures
// are swallowed on purpose: first-run offline means providers still read
// from Firestore, and the seed retries on the next sign-in.
function SeedOnSignIn() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    seedFromFirestore(user.uid)
      .then((result) => {
        if (!cancelled && result.seeded) {
          console.log(`[sqlite] seeded ${result.entries} entries, ${result.categories} categories`);
        }
      })
      .catch(() => {
        // Offline or transient error — providers fall back to Firestore
        // reads; seed runs again on the next sign-in.
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return null;
}

function RootNavigator() {
  const { user, initializing } = useAuth();

  if (initializing) {
    // Centered ActivityIndicator on the background token — never a branded
    // splash, never a Sign In flash over a restored session (AUTH-02).
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen
              name="EntryForm"
              component={EntryForm}
              options={{ presentation: "modal", headerShown: false }}
            />
            <Stack.Screen
              name="ScheduledEntryForm"
              component={ScheduledEntryForm}
              options={{ presentation: "modal", headerShown: false }}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="SignIn" component={SignInScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardProvider>
          <AuthProvider>
            <SeedOnSignIn />
            <EntriesProvider>
              <ScheduledEntriesProvider>
                <CategoriesProvider>
                  <AutoSync />
                  <StatusBar style="dark" />
                  <RootNavigator />
                </CategoriesProvider>
              </ScheduledEntriesProvider>
            </EntriesProvider>
          </AuthProvider>
        </KeyboardProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
