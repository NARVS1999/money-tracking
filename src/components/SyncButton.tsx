// SyncButton — header button that pulls the latest entries + categories from
// Firestore on demand. Never auto-triggers: it syncs only on explicit press.
// Shows an in-flight spinner while either provider is syncing and surfaces
// failures via Alert (never silently swallowed — the providers set lastError
// but only this button surfaces it to the user).
import { ActivityIndicator, Alert, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useEntries } from "../entries/EntriesProvider";
import { useCategories } from "../categories/CategoriesProvider";
import { colors, spacing } from "../theme/tokens";

export default function SyncButton() {
  const { sync: entriesSync, isSyncing: entriesSyncing } = useEntries();
  const { sync: categoriesSync, isSyncing: categoriesSyncing } = useCategories();
  const syncing = entriesSyncing || categoriesSyncing;

  const onPress = async () => {
    if (syncing) return;
    const results = await Promise.allSettled([
      entriesSync(),
      categoriesSync(),
    ]);
    const failed = results.find((r) => r.status === "rejected");
    if (failed) {
      const reason = (failed as PromiseRejectedResult).reason;
      Alert.alert(
        "Sync failed",
        reason instanceof Error
          ? reason.message
          : "Could not reach Firestore. Try again.",
      );
    }
  };

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={onPress}
      disabled={syncing}
      accessibilityLabel="Sync data"
      accessibilityRole="button"
    >
      {syncing ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Ionicons name="refresh" size={22} color={colors.primary} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    marginRight: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
