// AccountScreen — displays user profile (display name, email, Default badge),
// sign out button, and delete account flow for non-default accounts.
// AUTH-05: default account never shows delete option.
// AUTH-06: delete reauthenticates, cascade-deletes all data, then auth account.
// AUTH-07: sign out returns to SignInScreen.
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthProvider";
import { colors, radius, spacing, typography } from "../theme/tokens";
import { formatCents, parsePesoInput } from "../lib/money";

export default function AccountScreen() {
  const { userProfile, signOut, deleteAccount, isOnline, updateBudget, clearBudget } = useAuth();

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Budget state
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [budgetAmountInput, setBudgetAmountInput] = useState("");
  const [budgetStartDate, setBudgetStartDate] = useState(new Date());
  const [budgetEndDate, setBudgetEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [budgetSaving, setBudgetSaving] = useState(false);

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

  // Budget helpers
  const hasBudget = !!userProfile?.budgetAmount && !!userProfile?.budgetStartDate && !!userProfile?.budgetEndDate;

  const openBudgetForm = () => {
    if (hasBudget) {
      setBudgetAmountInput(userProfile!.budgetAmount!.toString());
      const [sy, sm, sd] = userProfile!.budgetStartDate!.split("-").map(Number);
      const [ey, em, ed] = userProfile!.budgetEndDate!.split("-").map(Number);
      setBudgetStartDate(new Date(sy, sm - 1, sd));
      setBudgetEndDate(new Date(ey, em - 1, ed));
    } else {
      setBudgetAmountInput("");
      setBudgetStartDate(new Date());
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(0); // last day of current month
      setBudgetEndDate(nextMonth);
    }
    setShowBudgetForm(true);
  };

  const handleSaveBudget = async () => {
    const amountCents = parsePesoInput(budgetAmountInput);
    if (!amountCents || amountCents <= 0 || budgetSaving) return;
    const startStr = formatDateObj(budgetStartDate);
    const endStr = formatDateObj(budgetEndDate);
    if (startStr > endStr) return;
    setBudgetSaving(true);
    try {
      await updateBudget(amountCents, startStr, endStr);
      setShowBudgetForm(false);
    } catch {
      // Silently handle — budget save is non-critical
    } finally {
      setBudgetSaving(false);
    }
  };

  const handleRemoveBudget = async () => {
    if (budgetSaving) return;
    setBudgetSaving(true);
    try {
      await clearBudget();
      setShowBudgetForm(false);
    } catch {
      // Silently handle
    } finally {
      setBudgetSaving(false);
    }
  };

  const formatDateObj = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const formatDisplayDate = (d: Date): string => {
    const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  };

  const onStartChange = (event: DateTimePickerEvent, selected?: Date) => {
    setShowStartPicker(Platform.OS === "ios");
    if (selected) setBudgetStartDate(selected);
  };

  const onEndChange = (event: DateTimePickerEvent, selected?: Date) => {
    setShowEndPicker(Platform.OS === "ios");
    if (selected) setBudgetEndDate(selected);
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

        {/* Budget section */}
        <View style={styles.budgetSection}>
          <Text style={styles.sectionTitle}>Budget</Text>
          {hasBudget ? (
            <>
              <View style={styles.budgetInfo}>
                <Text style={styles.budgetAmount}>{formatCents(userProfile!.budgetAmount!)}</Text>
                <Text style={styles.budgetDate}>
                  {formatDisplayDate(new Date(userProfile!.budgetStartDate! + "T00:00:00"))} –{" "}
                  {formatDisplayDate(new Date(userProfile!.budgetEndDate! + "T00:00:00"))}
                </Text>
              </View>
              <View style={styles.budgetActions}>
                <Pressable style={styles.budgetEditBtn} onPress={openBudgetForm}>
                  <Text style={styles.budgetEditBtnText}>Edit</Text>
                </Pressable>
                <Pressable style={styles.budgetRemoveBtn} onPress={handleRemoveBudget}>
                  <Text style={styles.budgetRemoveBtnText}>Remove</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Pressable style={styles.budgetSetBtn} onPress={openBudgetForm}>
              <Text style={styles.budgetSetBtnText}>Set Budget</Text>
            </Pressable>
          )}
        </View>

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

      {/* Budget form modal */}
      <Modal
        visible={showBudgetForm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBudgetForm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Set Budget</Text>

            <Text style={styles.label}>Amount (₱)</Text>
            <TextInput
              style={styles.input}
              value={budgetAmountInput}
              onChangeText={setBudgetAmountInput}
              placeholder="0.00"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
              editable={!budgetSaving}
            />

            <Text style={styles.label}>Start Date</Text>
            <Pressable style={styles.dateBtn} onPress={() => setShowStartPicker(true)}>
              <Text style={styles.dateBtnText}>{formatDisplayDate(budgetStartDate)}</Text>
            </Pressable>
            {showStartPicker && (
              <DateTimePicker
                value={budgetStartDate}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={onStartChange}
                maximumDate={new Date()}
              />
            )}

            <Text style={styles.label}>End Date</Text>
            <Pressable style={styles.dateBtn} onPress={() => setShowEndPicker(true)}>
              <Text style={styles.dateBtnText}>{formatDisplayDate(budgetEndDate)}</Text>
            </Pressable>
            {showEndPicker && (
              <DateTimePicker
                value={budgetEndDate}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={onEndChange}
              />
            )}

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => setShowBudgetForm(false)}
                disabled={budgetSaving}
              >
                <Text style={styles.cancelButtonLabel}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.button, (!budgetAmountInput || budgetSaving) && styles.buttonDisabled]}
                onPress={handleSaveBudget}
                disabled={!budgetAmountInput || budgetSaving}
              >
                <Text style={styles.buttonLabel}>
                  {budgetSaving ? "Saving..." : "Save"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

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
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
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
    backgroundColor: "rgba(239,109,64,0.1)",
    borderRadius: 20,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    fontSize: typography.label.size,
    lineHeight: typography.label.lineHeight,
    color: colors.primary,
  },
  email: {
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  button: {
    height: 48,
    borderRadius: radius.md,
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
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
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
  // Budget styles
  budgetSection: {
    marginTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  budgetInfo: {
    marginBottom: spacing.md,
  },
  budgetAmount: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  budgetDate: {
    fontSize: typography.label.size,
    color: colors.textSecondary,
    marginTop: 4,
  },
  budgetActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  budgetEditBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  budgetEditBtnText: {
    fontSize: typography.body.size,
    fontWeight: "600",
    color: colors.primary,
  },
  budgetRemoveBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  budgetRemoveBtnText: {
    fontSize: typography.body.size,
    fontWeight: "600",
    color: colors.danger,
  },
  budgetSetBtn: {
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  budgetSetBtnText: {
    fontSize: typography.body.size,
    fontWeight: "600",
    color: colors.onAccent,
  },
  dateBtn: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  dateBtnText: {
    fontSize: typography.body.size,
    color: colors.textPrimary,
  },
});
