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
import { AuthProvider, useAuth } from "./src/auth/AuthProvider";
import LoadingScreen from "./src/screens/LoadingScreen";
import SignInScreen from "./src/screens/SignInScreen";
import MainTabs from "./src/screens/MainTabs";

const Stack = createNativeStackNavigator();

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
          <Stack.Screen name="MainTabs" component={MainTabs} />
        ) : (
          <Stack.Screen name="SignIn" component={SignInScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
