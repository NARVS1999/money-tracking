// EntryRow — single entry row with category name, amount, and date+description.
// Used in ExpensesScreen and IncomeScreen FlatLists.
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, typography } from "../theme/tokens";
import { formatCents } from "../lib/money";
import { useCategories } from "../categories/CategoriesProvider";
import type { Entry } from "../entries/EntriesProvider";

type EntryRowProps = {
  entry: Entry;
};

export default function EntryRow({ entry }: EntryRowProps) {
  const { expenseCategories, incomeCategories } = useCategories();

  const categories =
    entry.type === "expense" ? expenseCategories : incomeCategories;
  const category = categories.find((c) => c.id === entry.categoryId);
  const categoryName = category?.name ?? "Unknown";

  const amountColor = entry.type === "income" ? colors.income : colors.expense;

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <Text style={styles.categoryName} numberOfLines={1}>
          {categoryName}
        </Text>
        <Text style={styles.dateDescription} numberOfLines={1}>
          {entry.date}
          {entry.description ? ` · ${entry.description}` : ""}
        </Text>
      </View>
      <Text style={[styles.amount, { color: amountColor }]}>
        {formatCents(entry.amount)}
      </Text>
    </View>
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
});
