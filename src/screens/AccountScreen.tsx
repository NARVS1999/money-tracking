// AccountScreen — displays user profile (display name, email, Default badge),
// sign out button, and delete account flow for non-default accounts.
// AUTH-05: default account never shows delete option.
// AUTH-06: delete reauthenticates, cascade-deletes all data, then auth account.
// AUTH-07: sign out returns to SignInScreen.
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "../auth/AuthProvider";
import { colors, radius, spacing, typography } from "../theme/tokens";

export default function AccountScreen() {
  const { userProfile, signOut, deleteAccount, isOnline } = useAuth();

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Loading state while userProfile fetches
  if (!userProfile) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const handleDelete = async () => {
    if (!password || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await deleteAccount(password);
      // Success: onAuthStateChanged fires and auth gate swaps to SignInScreen
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("wrong-password") || msg.includes("invalid-credential") || msg.includes("wrong password")) {
        setError("Password is incorrect");
      } else if (msg.includes("network") || msg.includes("offline")) {
        setError("Check your connection and try again");
      } else {
        setError("Something went wrong. Try again.");
      }
      setSubmitting(false);
    }
  };

  const openDeleteModal = () => {
    setPassword("");
    setError(null);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setPassword("");
    setError(null);
    setSubmitting(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        {/* Header section */}
        <View style={styles.header}>
          <Text style={styles.displayName}>{userProfile.displayName}</Text>
          {userProfile.isDefault && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Default</Text>
            </View>
          )}
        </View>
        <Text style={styles.email}>{userProfile.email}</Text>

        {/* Sign out button */}
        <Pressable style={styles.button} onPress={signOut} accessibilityRole="button">
          <Text style={styles.buttonLabel}>Sign out</Text>
        </Pressable>

        {/* Delete account section — only for non-default accounts */}
        {!userProfile.isDefault && (
          <View style={styles.deleteSection}>
            <Pressable
              style={[
                styles.button,
                styles.deleteButton,
                (!isOnline || submitting) && styles.buttonDisabled,
              ]}
              onPress={openDeleteModal}
              disabled={!isOnline || submitting}
              accessibilityRole="button"
            >
              <Text style={styles.buttonLabel}>Delete account</Text>
            </Pressable>
            {isOnline ? (
              <Text style={styles.helperText}>
                This will permanently delete all your data.
              </Text>
            ) : (
              <Text style={styles.helperText}>
                Delete unavailable offline
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Delete confirmation modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={closeDeleteModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete account</Text>
            <Text style={styles.modalCopy}>
              Type your password to confirm. This cannot be undone.
            </Text>

            <Text nativeID="delete-password-label" style={styles.label}>
              Password
            </Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              textContentType="password"
              autoComplete="current-password"
              editable={!submitting}
              accessibilityLabel="Password"
              accessibilityLabelledBy={["delete-password-label"]}
            />

            {error ? (
              <Text style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelButton}
                onPress={closeDeleteModal}
                disabled={submitting}
                accessibilityRole="button"
              >
                <Text style={styles.cancelButtonLabel}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.button,
                  styles.deleteButton,
                  (!password || submitting) && styles.buttonDisabled,
                ]}
                onPress={handleDelete}
                disabled={!password || submitting}
                accessibilityRole="button"
                accessibilityState={{ disabled: !password || submitting }}
              >
                <Text style={styles.buttonLabel}>
                  {submitting ? "Deleting..." : "Delete"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  displayName: {
    fontSize: typography.heading.size,
    lineHeight: typography.heading.lineHeight,
    fontWeight: typography.heading.weight,
    color: colors.textPrimary,
  },
  badge: {
    marginLeft: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    fontSize: typography.label.size,
    lineHeight: typography.label.lineHeight,
    color: colors.onAccent,
  },
  email: {
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  button: {
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonLabel: {
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    fontWeight: typography.body.weight,
    color: colors.onAccent,
  },
  deleteSection: {
    marginTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.lg,
  },
  deleteButton: {
    backgroundColor: colors.danger,
  },
  helperText: {
    fontSize: typography.label.size,
    lineHeight: typography.label.lineHeight,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.lg,
    width: "100%",
  },
  modalTitle: {
    fontSize: typography.heading.size,
    lineHeight: typography.heading.lineHeight,
    fontWeight: typography.heading.weight,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  modalCopy: {
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.label.size,
    lineHeight: typography.label.lineHeight,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: colors.textPrimary,
  },
  error: {
    fontSize: typography.label.size,
    lineHeight: typography.label.lineHeight,
    color: colors.danger,
    marginTop: spacing.sm,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  cancelButton: {
    height: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  cancelButtonLabel: {
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: colors.textSecondary,
  },
});
