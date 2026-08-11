// SyncButton — header button that triggers the full push+pull sync cycle
// (via the providers' sync(), which delegates to syncService.fullSync) and
// shows sync status (OFFL-09): a pending-changes badge with the syncQueue
// length and the last successful sync time. Never auto-triggers: it syncs
// only on explicit press (auto-sync on foreground is AutoSync's job).
// Surfaces failures via Alert (never silently swallowed — the providers set
// lastError but only this button surfaces it to the user).
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../auth/AuthProvider";
import { useEntries } from "../entries/EntriesProvider";
import { useCategories } from "../categories/CategoriesProvider";
import { getQueue } from "../db/syncQueue";
import { getLastSync } from "../sync/syncMetadata";
import { colors, spacing } from "../theme/tokens";

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export default function SyncButton() {
  const { user } = useAuth();
  const { sync: entriesSync, isSyncing: entriesSyncing } = useEntries();
  const { sync: categoriesSync, isSyncing: categoriesSyncing } = useCategories();
  const [pending, setPending] = useState(0);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const syncing = entriesSyncing || categoriesSyncing;

  const refreshStatus = useCallback(() => {
    if (!user) {
      setPending(0);
      setLastSync(null);
      return;
    }
    getQueue(user.uid)
      .then((q) => setPending(q.length))
      .catch(() => {});
    getLastSync(user.uid).then(setLastSync).catch(() => {});
  }, [user]);

  // Refresh on mount and whenever a sync run starts/finishes.
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus, syncing]);

  const onPress = async () => {
    if (syncing || !user) return;
    const results = await Promise.allSettled([
      entriesSync(),
      categoriesSync(),
    ]);
    refreshStatus();
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
    <View style={styles.wrap}>
      <TouchableOpacity
        style={styles.button}
        onPress={onPress}
        disabled={syncing}
        accessibilityLabel={
          pending > 0 ? `Sync data (${pending} pending changes)` : "Sync data"
        }
        accessibilityRole="button"
      >
        {syncing ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons name="refresh" size={22} color={colors.primary} />
        )}
        {pending > 0 && !syncing && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{pending > 99 ? "99+" : pending}</Text>
          </View>
        )}
      </TouchableOpacity>
      <Text style={styles.statusText} numberOfLines={1}>
        {pending > 0
          ? `${pending} pending`
          : lastSync
            ? `synced ${timeAgo(lastSync)}`
            : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginRight: spacing.md,
    alignItems: "center",
  },
  button: {
    width: 44,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: "#DB281C",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  statusText: {
    fontSize: 10,
    color: colors.textSecondary,
    maxWidth: 88,
  },
});
