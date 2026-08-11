// ScheduledEntryForm — full-screen modal form for adding or editing a
// recurring-entry template (14-UI-SPEC §2, mirrors EntryForm 1:1 for shared
// fields). Amount live-previews with ₱ formatting; category bottom-sheet
// filtered by type; Start Date picker blocks PAST dates (SCHD-UI-09 —
// inverted from EntryForm which blocks future); 5-segment frequency picker
// (Once/Daily/Weekly/Monthly/Yearly); End Date row appears only when the
// frequency repeats (SCHD-UI-08) with minimumDate = start + 1 day.
import { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Alert,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useNavigation, useRoute } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, typography, radius } from "../theme/tokens";
import { formatCents, parsePesoInput } from "../lib/money";
import { addDays, toDateString, today } from "../lib/dates";
import { FREQUENCIES, formatFrequency, type Frequency } from "../lib/frequency";
import CategoryIcon from "../components/CategoryIcon";
import { useScheduledEntries, type ScheduledEntry } from "./ScheduledEntriesProvider";
import { useCategories } from "../categories/CategoriesProvider";

type RouteParams = {
  mode: "add" | "edit";
  type: "expense" | "income";
  id?: string;
};

export default function ScheduledEntryForm() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = route.params as RouteParams;

  const { scheduledEntries, addScheduled, updateScheduled } =
    useScheduledEntries();
  const { expenseCategories, incomeCategories } = useCategories();

  const { mode, type, id } = params;
  const categories = type === "expense" ? expenseCategories : incomeCategories;

  // Existing template for edit mode (read synchronously from provider state).
  const existingEntry = useMemo<ScheduledEntry | null>(() => {
    if (!id) return null;
    return scheduledEntries.find((s) => s.id === id) ?? null;
  }, [scheduledEntries, id]);

  // Guard: entry deleted while the form is open (or stale route) → alert and
  // go back (EntryForm guard pattern).
  const [guardShown, setGuardShown] = useState(false);
  if (mode === "edit" && id && !existingEntry && !guardShown) {
    setGuardShown(true);
    Alert.alert("Entry not found", "This scheduled entry may have been deleted.", [
      { text: "OK", onPress: () => navigation.goBack() },
    ]);
  }

  const dateToInput = (d: Date | string) => {
    const [y, m, day] = (typeof d === "string" ? d : toDateString(d))
      .split("-")
      .map(Number);
    return new Date(y, m - 1, day);
  };

  // Form state
  const [rawAmount, setRawAmount] = useState(() => {
    if (existingEntry) {
      const cents = existingEntry.amount;
      const whole = Math.floor(cents / 100);
      const frac = cents % 100;
      return frac === 0 ? `${whole}` : `${whole}.${frac.toString().padStart(2, "0")}`;
    }
    return "";
  });

  const [selectedCategoryId, setSelectedCategoryId] = useState(
    () => existingEntry?.categoryId ?? "",
  );

  const [startDate, setStartDate] = useState(() => {
    if (existingEntry) {
      const [y, m, d] = existingEntry.date.split("-").map(Number);
      return new Date(y, m - 1, d);
    }
    const [y, m, d] = today().split("-").map(Number);
    return new Date(y, m - 1, d);
  });

  const [frequency, setFrequency] = useState<Frequency>(
    () => existingEntry?.frequency ?? "daily",
  );

  const [endDate, setEndDate] = useState<Date | null>(() => {
    if (existingEntry?.endDate) {
      const [y, m, d] = existingEntry.endDate.split("-").map(Number);
      return new Date(y, m - 1, d);
    }
    return null;
  });

  const [description, setDescription] = useState(
    () => existingEntry?.description ?? "",
  );

  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const amountInputRef = useRef<TextInput>(null);

  const cents = parsePesoInput(rawAmount) ?? 0;
  const displayAmount = formatCents(cents);

  const startStr = toDateString(startDate);
  // SCHD-UI-09: start date must not be in the past (picker blocks it too —
  // this is the defensive check for pre-filled values).
  const startInPast = startStr < today();
  // End date must come strictly after the start date.
  const endDateInvalid =
    endDate !== null && toDateString(endDate) <= startStr;

  const canSave =
    cents > 0 &&
    selectedCategoryId.length > 0 &&
    !startInPast &&
    !endDateInvalid &&
    !isSaving;

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  const handleSave = async () => {
    if (!canSave) return;
    setIsSaving(true);

    try {
      const input = {
        type,
        amount: cents,
        categoryId: selectedCategoryId,
        date: startStr,
        description: description.trim(),
        frequency,
        endDate: endDate ? toDateString(endDate) : null,
      };

      if (mode === "edit" && id) {
        await updateScheduled(id, input);
      } else {
        await addScheduled(input);
      }

      navigation.goBack();
    } catch (e) {
      // Error handled by ScheduledEntriesProvider (lastError state)
      Alert.alert("Error", "Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const title = mode === "add" ? "Add Scheduled Entry" : "Edit Scheduled Entry";

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.titleText}>{title}</Text>
        <TouchableOpacity onPress={handleSave} disabled={!canSave}>
          <Text style={[styles.saveText, !canSave && styles.saveDisabled]}>
            Save
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView style={styles.form} contentContainerStyle={styles.formContent}>
        {/* Amount Display — tappable to re-focus the hidden input */}
        <TouchableOpacity
          style={styles.amountContainer}
          activeOpacity={0.6}
          onPress={() => amountInputRef.current?.focus()}
        >
          <Text style={styles.amountDisplay}>{displayAmount}</Text>
        </TouchableOpacity>

        {/* Hidden amount input */}
        <TextInput
          ref={amountInputRef}
          style={styles.hiddenInput}
          keyboardType="decimal-pad"
          value={rawAmount}
          onChangeText={setRawAmount}
          placeholder="0.00"
          placeholderTextColor={colors.textSecondary}
        />

        {/* Category Picker */}
        <Text style={styles.label}>Category</Text>
        <TouchableOpacity
          style={styles.pickerRow}
          onPress={() => setShowCategoryPicker(true)}
        >
          <Text
            style={[
              styles.pickerText,
              !selectedCategory && styles.placeholderText,
            ]}
          >
            {selectedCategory?.name ?? "Select category"}
          </Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        {/* Start Date — minimumDate today blocks past dates (SCHD-UI-09) */}
        <Text style={styles.label}>Start Date</Text>
        <TouchableOpacity
          style={styles.pickerRow}
          onPress={() => setShowStartPicker(true)}
        >
          <Text style={styles.pickerText}>
            {startDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        {/* Frequency — 5 segments in one horizontal row */}
        <Text style={styles.label}>Repeats</Text>
        <View style={styles.frequencyRow}>
          {FREQUENCIES.map((f) => {
            const isSelected = f === frequency;
            return (
              <TouchableOpacity
                key={f}
                style={[
                  styles.frequencySegment,
                  isSelected && styles.frequencySegmentActive,
                ]}
                onPress={() => setFrequency(f)}
                activeOpacity={0.7}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.frequencySegmentText,
                    isSelected && styles.frequencySegmentTextActive,
                  ]}
                >
                  {formatFrequency(f)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* End Date — only when the frequency repeats (SCHD-UI-08) */}
        {frequency !== "once" && (
          <>
            <Text style={styles.label}>End Date (optional)</Text>
            <TouchableOpacity
              style={styles.pickerRow}
              onPress={() => setShowEndPicker(true)}
            >
              <Text
                style={[styles.pickerText, !endDate && styles.placeholderText]}
              >
                {endDate
                  ? endDate.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "No end date"}
              </Text>
              {endDate ? (
                <TouchableOpacity onPress={() => setEndDate(null)}>
                  <Text style={styles.clearText}>Clear</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.chevron}>›</Text>
              )}
            </TouchableOpacity>
            {endDateInvalid && (
              <Text style={styles.validationError}>
                End date must be after the start date.
              </Text>
            )}
          </>
        )}

        {/* Description */}
        <Text style={styles.label}>Description (optional)</Text>
        <TextInput
          style={styles.descriptionInput}
          value={description}
          onChangeText={setDescription}
          placeholder="What was this for?"
          placeholderTextColor={colors.textSecondary}
          maxLength={200}
        />
      </KeyboardAwareScrollView>

      {/* Category Bottom Sheet Modal */}
      <Modal visible={showCategoryPicker} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCategoryPicker(false)}
        >
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Select Category</Text>
            <FlatList
              data={categories}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.categoryOption,
                    item.id === selectedCategoryId && styles.categorySelected,
                  ]}
                  onPress={() => {
                    setSelectedCategoryId(item.id);
                    setShowCategoryPicker(false);
                  }}
                >
                  <CategoryIcon icon={item.icon} name={item.name} size={32} />
                  <Text
                    style={[
                      styles.categoryOptionText,
                      item.id === selectedCategoryId && styles.categoryOptionSelected,
                    ]}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyCategories}>
                  No {type} categories yet
                </Text>
              }
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Start Date Picker — past dates blocked */}
      {showStartPicker && (
        <DateTimePicker
          value={dateToInput(startDate)}
          mode="date"
          display="default"
          minimumDate={dateToInput(new Date())}
          onValueChange={(_event: unknown, selectedDate: Date) => {
            setShowStartPicker(false);
            setStartDate(selectedDate);
          }}
          onDismiss={() => setShowStartPicker(false)}
        />
      )}

      {/* End Date Picker — minimum = start + 1 day */}
      {showEndPicker && (
        <DateTimePicker
          value={dateToInput(endDate ?? addDays(startStr, 1))}
          mode="date"
          display="default"
          minimumDate={dateToInput(addDays(startStr, 1))}
          onValueChange={(_event: unknown, selectedDate: Date) => {
            setShowEndPicker(false);
            setEndDate(selectedDate);
          }}
          onDismiss={() => setShowEndPicker(false)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancelText: {
    fontSize: typography.body.size,
    fontWeight: typography.body.weight as "400",
    color: colors.textSecondary,
  },
  titleText: {
    fontSize: typography.heading.size,
    fontWeight: typography.heading.weight as "700",
    color: colors.textPrimary,
  },
  saveText: {
    fontSize: typography.body.size,
    fontWeight: "700",
    color: colors.accent,
  },
  saveDisabled: {
    color: colors.textSecondary,
  },
  form: {
    flex: 1,
  },
  formContent: {
    padding: spacing.md,
  },
  amountContainer: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  amountDisplay: {
    fontSize: 44,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    color: colors.textPrimary,
  },
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    // Non-zero size: Android cannot re-focus a 0x0 input after the keyboard
    // is dismissed a couple of times ("tap works twice, then stops").
    height: 1,
    width: 1,
  },
  label: {
    fontSize: typography.label.size,
    fontWeight: "700",
    lineHeight: typography.label.lineHeight,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  pickerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerText: {
    fontSize: typography.body.size,
    fontWeight: typography.body.weight as "400",
    color: colors.textPrimary,
  },
  placeholderText: {
    color: colors.textSecondary,
  },
  chevron: {
    fontSize: 24,
    color: colors.textSecondary,
  },
  clearText: {
    fontSize: typography.body.size,
    fontWeight: "600",
    color: colors.accent,
  },
  // Frequency picker — 5 segments, one horizontal row (14-UI-SPEC §2.4)
  frequencyRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  frequencySegment: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xs,
  },
  frequencySegmentActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  frequencySegmentText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
  },
  frequencySegmentTextActive: {
    color: colors.onAccent,
  },
  validationError: {
    fontSize: typography.label.size,
    fontWeight: typography.label.weight as "400",
    lineHeight: typography.label.lineHeight,
    color: colors.danger,
    marginTop: spacing.sm,
  },
  descriptionInput: {
    fontSize: typography.body.size,
    fontWeight: typography.body.weight as "400",
    lineHeight: typography.body.lineHeight,
    color: colors.textPrimary,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  bottomSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: "60%",
    paddingBottom: spacing.xl,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  sheetTitle: {
    fontSize: typography.heading.size,
    fontWeight: typography.heading.weight as "700",
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  categoryOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categorySelected: {
    backgroundColor: colors.background,
  },
  categoryOptionText: {
    fontSize: typography.body.size,
    fontWeight: typography.body.weight as "400",
    color: colors.textPrimary,
  },
  categoryOptionSelected: {
    fontWeight: "700",
    color: colors.accent,
  },
  emptyCategories: {
    fontSize: typography.body.size,
    color: colors.textSecondary,
    textAlign: "center",
    padding: spacing.xl,
  },
});
