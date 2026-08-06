import { ActivityIndicator, StyleSheet, View } from "react-native";
import { colors } from "../theme/tokens";

// Shown while onAuthStateChanged resolves (auth restore). Centered spinner on
// the background token, no text, no branding (01-UI-SPEC Visual contract
// line 48). Single state — the listener resolves to null -> Sign In, never
// throws.
export default function LoadingScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
});
