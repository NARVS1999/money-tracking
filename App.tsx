import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './src/firebase/app';
import { colors } from './src/theme/tokens';

// Auth gate skeleton (01-01 tracer): proves the Firebase wiring end-to-end.
// The gate structure and firebase wiring are production code; the two leaf
// views below are placeholders — 01-02 replaces them with SignInScreen /
// MainTabs without architectural change.
export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setInitializing(false);
    });
    return unsubscribe;
  }, []);

  if (initializing) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Text style={styles.leaf}>{user ? 'Signed in' : 'Signed out'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaf: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
  },
});
