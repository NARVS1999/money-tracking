import { StyleSheet, Text, View } from "react-native";
import { colors, typography } from "../theme/tokens";

// Static placeholder for tab shells not yet built (filled in Phases 2-4).
// Full-screen background token, centered secondary "Coming soon" copy,
// no headers (01-UI-SPEC Visual contract line 50).
export default function PlaceholderScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.copy}>Coming soon</Text>
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
  copy: {
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    fontWeight: typography.body.weight,
    color: colors.textSecondary,
  },
});
