// EntryRow — single entry row with category name, amount, date+description,
// and swipeable Edit/Copy/Delete actions. Used in ExpensesScreen and IncomeScreen FlatLists.
import { View, Text, TouchableOpacity, Alert, StyleSheet } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { colors, spacing, typography } from "../theme/tokens";
import { formatCents } from "../lib/money";
import { useCategories } from "../categories/CategoriesProvider";
import type { Entry } from "../entries/EntriesProvider";

type EntryRowProps = {
  entry: Entry;
  onEdit: (entry: Entry) => void;
  onCopy: (entry: Entry) => void;
  onDelete: (id: string) => void;
};

export default function EntryRow({ entry, onEdit, onCopy, onDelete }: EntryRowProps) {
  const { expenseCategories, incomeCategories } = useCategories();

  const categories =
    entry.type === "expense" ? expenseCategories : incomeCategories;
  const category = categories.find((c) => c.id === entry.categoryId);
  const categoryName = category?.name ?? "Unknown";

  const amountColor = entry.type === "income" ? colors.income : colors.expense;

  const renderRightActions = () => {
    return (
      <>
        <TouchableOpacity
          style={[styles.swipeAction, { backgroundColor: "#E5E7EB" }]}
          onPress={() => onEdit(entry)}
        >
          <Text style={[styles.swipeActionText, { color: colors.textPrimary }]}>
            Edit
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.swipeAction, { backgroundColor: "#E5E7EB" }]}
          onPress={() => onCopy(entry)}
        >
          <Text style={[styles.swipeActionText, { color: colors.textPrimary }]}>
            Copy
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.swipeAction, { backgroundColor: colors.danger }]}
          onPress={() => {
            Alert.alert(
              "Delete this entry?",
              "This entry will be permanently removed.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => onDelete(entry.id),
                },
              ],
            );
          }}
        >
          <Text style={[styles.swipeActionText, { color: "#FFFFFF" }]}>
            Delete
          </Text>
        </TouchableOpacity>
      </>
    );
  };

  return (
    <Swipeable renderRightActions={renderRightActions}>
      <View style={styles.container}>
        <View style={styles.left}>
          <Text style={styles.categoryName} numberOfLines={1}>
            {categoryName}
          </Text>
          <Text style={styles.dateDescription} numberOfLines={1}>
            {entry.date}
            {entry.description ? ` · ${entry.description}` : ""}
          </Text>
          {entry.hasPendingWrites && (
            <View style={styles.syncIndicator}>
              <View style={styles.syncDot} />
              <Text style={styles.syncText}>Syncing…</Text>
            </View>
          )}
        </View>
        <Text style={[styles.amount, { color: amountColor }]}>
          {formatCents(entry.amount)}
        </Text>
      </View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    minHeight: 44,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  left: {
    flex: 1,
    marginRight: spacing.sm,
  },
  categoryName: {
    fontSize: typography.body.size,
    fontWeight: typography.body.weight as "400",
    lineHeight: typography.body.lineHeight,
    color: colors.textPrimary,
  },
  dateDescription: {
    fontSize: typography.label.size,
    fontWeight: typography.label.weight as "400",
    lineHeight: typography.label.lineHeight,
    color: colors.textSecondary,
    marginTop: 2,
  },
  amount: {
    fontSize: 16,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    minWidth: 44,
    textAlign: "right",
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
  syncIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  syncDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.expense,
    marginRight: spacing.xs,
  },
  syncText: {
    fontSize: typography.label.size,
    fontWeight: typography.label.weight as "400",
    lineHeight: typography.label.lineHeight,
    color: colors.textSecondary,
  },
});
