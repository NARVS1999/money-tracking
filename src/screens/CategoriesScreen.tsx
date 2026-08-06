// CategoriesScreen — full Categories tab (02-02 Task 1 tracer).
// Replaces the Phase 1 placeholder. SectionList with two grouped
// sections (Expense / Income Categories), sticky headers with
// per-group inline add inputs, Swipeable rows with in-use guard
// (grey 'In use') and delete action (red 'Delete' -> Alert.alert),
// and live right-aligned usage counts from CategoriesProvider.
import { useState } from "react";
import {
  SectionList,
  TextInput,
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  Alert,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { colors, spacing, typography, radius } from "../theme/tokens";
import {
  useCategories,
  type Category,
  type CategoryKind,
} from "../categories/CategoriesProvider";

// ── Types ───────────────────────────────────────────────────────────
type SectionData = {
  title: string;
  kind: CategoryKind;
  data: Category[];
};

// ── Component ───────────────────────────────────────────────────────
export default function CategoriesScreen() {
  const {
    expenseCategories,
    incomeCategories,
    usageMap,
    addCategory,
    deleteCategory,
  } = useCategories();

  const [expenseInput, setExpenseInput] = useState("");
  const [incomeInput, setIncomeInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<CategoryKind | null>(null);
  const [focusedInput, setFocusedInput] = useState<
    CategoryKind | null
  >(null);

  // ── Helpers ────────────────────────────────────────────────────
  const handleAdd = async (
    kind: CategoryKind,
    input: string,
    setInput: (s: string) => void,
  ) => {
    const trimmed = input.trim();
    // Blank/whitespace-only: silent no-op
    if (!trimmed) return;

    try {
      await addCategory(kind, trimmed);
      setInput("");
      setError(null);
      setErrorKind(null);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Couldn't add category. Try again.";
      setError(message);
      setErrorKind(kind);
    }
  };

  const handleChangeText =
    (kind: CategoryKind, setter: (s: string) => void) =>
    (text: string) => {
      setter(text);
      setError(null);
      setErrorKind(null);
    };

  // ── SectionList data ───────────────────────────────────────────
  const sections: SectionData[] = [
    {
      title: "Expense Categories",
      kind: "expenseCategories",
      data: expenseCategories,
    },
    {
      title: "Income Categories",
      kind: "incomeCategories",
      data: incomeCategories,
    },
  ];

  // ── Swipe right actions ────────────────────────────────────────
  const renderRightActions =
    (kind: CategoryKind, item: Category, count: number) => {
      if (count > 0) {
        return function SwipeInUseAction() {
          return (
            <View
              style={[
                styles.swipeAction,
                { backgroundColor: "#E5E7EB" },
              ]}
            >
              <Text
                style={[
                  styles.swipeActionText,
                  { color: "#6B7280" },
                ]}
              >
                In use
              </Text>
            </View>
          );
        };
      }

      return function SwipeDeleteAction() {
        return (
          <TouchableOpacity
            style={[
              styles.swipeAction,
              { backgroundColor: colors.danger },
            ]}
            onPress={() => {
              Alert.alert(
                `Delete ${item.name}?`,
                "This cannot be undone.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => {
                      deleteCategory(kind, item.id).catch(() =>
                        Alert.alert(
                          "Error",
                          "Couldn't delete category. Try again.",
                        ),
                      );
                    },
                  },
                ],
              );
            }}
          >
            <Text
              style={[styles.swipeActionText, { color: "#FFFFFF" }]}
            >
              Delete
            </Text>
          </TouchableOpacity>
        );
      };
    };

  // ── Render ─────────────────────────────────────────────────────
  return (
    <SectionList
      sections={sections}
      stickySectionHeadersEnabled={true}
      keyExtractor={(item) => item.id}
      ItemSeparatorComponent={() => (
        <View style={styles.separator} />
      )}
      renderSectionHeader={({ section }) => {
        const isFocused = focusedInput === section.kind;
        const inputValue =
          section.kind === "expenseCategories"
            ? expenseInput
            : incomeInput;
        const setInput =
          section.kind === "expenseCategories"
            ? setExpenseInput
            : setIncomeInput;
        const groupLabel =
          section.kind === "expenseCategories"
            ? "expense"
            : "income";

        return (
          <View style={styles.sectionHeader}>
            <Text
              style={styles.sectionTitle}
              accessibilityRole="header"
            >
              {section.title}
            </Text>

            {error && errorKind === section.kind ? (
              <Text
                style={styles.errorText}
                accessibilityRole="alert"
              >
                {error}
              </Text>
            ) : null}

            <View style={styles.inlineAdd}>
              <TextInput
                style={[
                  styles.input,
                  isFocused && styles.inputFocused,
                ]}
                placeholder="New category"
                placeholderTextColor={colors.textSecondary}
                value={inputValue}
                onChangeText={handleChangeText(section.kind, setInput)}
                onFocus={() => setFocusedInput(section.kind)}
                onBlur={() => setFocusedInput(null)}
                returnKeyType="done"
                onSubmitEditing={() =>
                  handleAdd(section.kind, inputValue, setInput)
                }
                accessibilityLabel={`New ${groupLabel} category`}
                keyboardType="default"
                autoCapitalize="sentences"
              />
              <TouchableOpacity
                style={styles.addButton}
                onPress={() =>
                  handleAdd(section.kind, inputValue, setInput)
                }
                accessibilityLabel={`Add ${groupLabel} category`}
              >
                <Text style={styles.addButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }}
      renderItem={({ item, section }) => {
        const count = usageMap.get(item.id) || 0;
        const countLabel =
          usageMap.size === 0
            ? 0
            : `${count} ${count === 1 ? "entry" : "entries"}`;

        return (
          <Swipeable
            renderRightActions={renderRightActions(
              section.kind,
              item,
              count,
            )}
          >
            <View style={styles.row}>
              <Text
                style={styles.categoryName}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <View style={styles.rowRight}>
                <Text style={styles.swipeHint}>←</Text>
                <Text style={styles.usageCount}>
                  {countLabel}
                </Text>
              </View>
            </View>
          </Swipeable>
        );
      }}
      renderSectionFooter={({ section }) => {
        if (section.data.length > 0) return null;
        return (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No{" "}
              {section.kind === "expenseCategories"
                ? "expense"
                : "income"}{" "}
              categories yet
            </Text>
          </View>
        );
      }}
    />
  );
}

// ── Styles ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  separator: {
    height: 1,
    backgroundColor: colors.border,
  },
  sectionHeader: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 48,
  },
  sectionTitle: {
    fontSize: typography.heading.size,
    fontWeight: typography.heading.weight as "700",
    lineHeight: typography.heading.lineHeight,
    color: colors.accent,
  },
  errorText: {
    fontSize: typography.label.size,
    fontWeight: typography.label.weight as "400",
    lineHeight: typography.label.lineHeight,
    color: colors.danger,
    paddingTop: spacing.xs,
  },
  inlineAdd: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    fontSize: typography.body.size,
    fontWeight: typography.body.weight as "400",
    lineHeight: typography.body.lineHeight,
    color: colors.textPrimary,
  },
  inputFocused: {
    borderColor: colors.accent,
  },
  addButton: {
    marginLeft: spacing.sm,
    minWidth: 44,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonText: {
    fontSize: typography.body.size,
    fontWeight: typography.heading.weight as "700",
    lineHeight: typography.body.lineHeight,
    color: colors.accent,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    minHeight: 44,
    backgroundColor: colors.background,
  },
  categoryName: {
    flex: 1,
    fontSize: typography.body.size,
    fontWeight: typography.body.weight as "400",
    lineHeight: typography.body.lineHeight,
    color: colors.textPrimary,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  usageCount: {
    fontSize: typography.label.size,
    fontWeight: typography.label.weight as "400",
    lineHeight: typography.label.lineHeight,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  swipeHint: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  swipeAction: {
    width: 80,
    justifyContent: "center",
    alignItems: "center",
  },
  swipeActionText: {
    fontSize: typography.label.size,
    fontWeight: typography.label.weight as "400",
    lineHeight: typography.label.lineHeight,
  },
  emptyContainer: {
    paddingVertical: spacing.xl,
    alignItems: "center",
  },
  emptyText: {
    fontSize: typography.body.size,
    fontWeight: typography.body.weight as "400",
    lineHeight: typography.body.lineHeight,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
