// EntryForm — full-screen modal form for adding, editing, or copying entries.
// Amount input live-previews with ₱ formatting. Category picker filters by tab type.
// Date picker defaults to today, blocks future dates. KeyboardAwareScrollView wraps content.
import { useState, useRef, useEffect, useMemo } from "react";
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
import { today } from "../lib/dates";
import { useEntries, type Entry, type EntryInput } from "../entries/EntriesProvider";
import { useCategories } from "../categories/CategoriesProvider";

type RouteParams = {
  mode: "add" | "edit" | "copy";
  type: "expense" | "income";
  entryId?: string;
  prefill?: Partial<EntryInput>;
};

export default function EntryForm() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = route.params as RouteParams;

  const { entries, addEntry, updateEntry } = useEntries();
  const { expenseCategories, incomeCategories } = useCategories();

  const { mode, type, entryId, prefill } = params;
  const categories = type === "expense" ? expenseCategories : incomeCategories;

  // Find existing entry for edit/copy modes
  const existingEntry = useMemo(() => {
    if (!entryId) return null;
    return entries.find((e) => e.id === entryId) ?? null;
  }, [entries, entryId]);

  // Guard: if entry was deleted while form is open, alert and go back
  const { isLoading } = useEntries();
  useEffect(() => {
    if ((mode === "edit" || mode === "copy") && entryId && !existingEntry && !isLoading) {
      Alert.alert("Entry not found", "This entry may have been deleted.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    }
  }, [mode, entryId, existingEntry, isLoading, navigation]);

  // Form state
  const [rawAmount, setRawAmount] = useState(() => {
    if (mode === "edit" && existingEntry) {
      // Convert cents back to peso display
      const cents = existingEntry.amount;
      const whole = Math.floor(cents / 100);
      const frac = cents % 100;
      return frac === 0 ? `${whole}` : `${whole}.${frac.toString().padStart(2, "0")}`;
    }
    if (mode === "copy" && prefill?.amount) {
      const cents = prefill.amount;
      const whole = Math.floor(cents / 100);
      const frac = cents % 100;
      return frac === 0 ? `${whole}` : `${whole}.${frac.toString().padStart(2, "0")}`;
    }
    return "";
  });

  const [selectedCategoryId, setSelectedCategoryId] = useState(() => {
    if (mode === "edit" && existingEntry) return existingEntry.categoryId;
    if (mode === "copy" && prefill?.categoryId) return prefill.categoryId;
    return "";
  });

  const [dateValue, setDateValue] = useState(() => {
    if (mode === "edit" && existingEntry) {
      const [y, m, d] = existingEntry.date.split("-").map(Number);
      return new Date(y, m - 1, d);
    }
    // Add and Copy modes default to today (ENTR-08)
    const [y, m, d] = today().split("-").map(Number);
    return new Date(y, m - 1, d);
  });

  const [description, setDescription] = useState(() => {
    if (mode === "edit" && existingEntry) return existingEntry.description;
    if (mode === "copy" && prefill?.description) return prefill.description;
    return "";
  });

  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const amountInputRef = useRef<TextInput>(null);

  // Auto-focus amount input on mount
  useEffect(() => {
    const timer = setTimeout(() => amountInputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, []);

  // Parse amount to cents
  const cents = parsePesoInput(rawAmount) ?? 0;
  const displayAmount = formatCents(cents);
  const canSave = cents > 0 && selectedCategoryId.length > 0 && !isSaving;

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  const handleSave = async () => {
    if (!canSave) return;
    setIsSaving(true);

    try {
      const dateStr = `${dateValue.getFullYear()}-${(dateValue.getMonth() + 1).toString().padStart(2, "0")}-${dateValue.getDate().toString().padStart(2, "0")}`;

      const input: EntryInput = {
        type,
        amount: cents,
        categoryId: selectedCategoryId,
        date: dateStr,
        description: description.trim(),
      };

      if (mode === "edit" && entryId) {
        await updateEntry(entryId, input);
      } else {
        await addEntry(input);
      }

      navigation.goBack();
    } catch (e) {
      // Error handled by EntriesProvider (lastError state)
      Alert.alert("Error", "Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const title =
    mode === "add"
      ? "Add Entry"
      : mode === "edit"
        ? "Edit Entry"
        : "Copy Entry";

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

        {/* Date Picker */}
        <Text style={styles.label}>Date</Text>
        <TouchableOpacity
          style={styles.pickerRow}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={styles.pickerText}>
            {dateValue.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

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

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={dateValue}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={(event: unknown, selectedDate: Date | undefined) => {
            setShowDatePicker(false);
            if (selectedDate) {
              setDateValue(selectedDate);
            }
          }}
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
