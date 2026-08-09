// HomeScreen — derived summary screen. Shows month header, expense/income
// totals, per-category breakdown sections, and loading skeleton.
// Data is derived from cached entries via monthRange() — no aggregation queries.
import { useMemo } from "react";
import { ScrollView, Text, View, StyleSheet } from "react-native";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useEntries } from "../entries/EntriesProvider";
import { useCategories } from "../categories/CategoriesProvider";
import { monthRange, today } from "../lib/dates";
import { colors, spacing, typography } from "../theme/tokens";
import { formatCents } from "../lib/money";
import SummaryTotals from "../components/SummaryTotals";
import CategorySection from "../components/CategorySection";
import LoadingSkeleton from "../components/LoadingSkeleton";
import EmptyState from "../components/EmptyState";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp<Record<string, object>>>();
  const { entries, isLoading } = useEntries();
  const { expenseCategories, incomeCategories } = useCategories();

  // Current month range + label — single memo ensures they always stay in sync.
  // Empty deps[] is correct: `today()` is deterministic within a render pass;
  // when the month changes (midnight crossing) the user must restart the app
  // (Expo Go limitation — no background refresh).
  const { start, end, monthLabel } = useMemo(() => {
    const todayStr = today();
    const { start, end } = monthRange(todayStr);
    const parts = todayStr.split("-");
    const monthIndex = parseInt(parts[1], 10) - 1;
    const monthLabel = `${MONTH_NAMES[monthIndex]} ${parts[0]}`;
    return { start, end, monthLabel };
  }, []);

  // Filter entries to current month
  const monthEntries = useMemo(
    () => entries.filter((e) => e.date >= start && e.date <= end),
    [entries, start, end],
  );

  // Expense total
  const expenseTotal = useMemo(
    () =>
      monthEntries
        .filter((e) => e.type === "expense")
        .reduce((sum, e) => sum + e.amount, 0),
    [monthEntries],
  );

  // Income total
  const incomeTotal = useMemo(
    () =>
      monthEntries
        .filter((e) => e.type === "income")
        .reduce((sum, e) => sum + e.amount, 0),
    [monthEntries],
  );

  // Balance = income - expenses
  const balance = incomeTotal - expenseTotal;

  // Expense breakdown: group by categoryId, sum, sort descending
  const expenseBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    monthEntries
      .filter((e) => e.type === "expense")
      .forEach((e) => {
        map.set(e.categoryId, (map.get(e.categoryId) || 0) + e.amount);
      });
    return Array.from(map.entries())
      .map(([categoryId, cents]) => ({
        name:
          expenseCategories.find((c) => c.id === categoryId)?.name ||
          "Unknown",
        cents,
      }))
      .sort((a, b) => b.cents - a.cents);
  }, [monthEntries, expenseCategories]);

  // Income breakdown: group by categoryId, sum, sort descending
  const incomeBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    monthEntries
      .filter((e) => e.type === "income")
      .forEach((e) => {
        map.set(e.categoryId, (map.get(e.categoryId) || 0) + e.amount);
      });
    return Array.from(map.entries())
      .map(([categoryId, cents]) => ({
        name:
          incomeCategories.find((c) => c.id === categoryId)?.name || "Unknown",
        cents,
      }))
      .sort((a, b) => b.cents - a.cents);
  }, [monthEntries, incomeCategories]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (monthEntries.length === 0) {
    return (
      <EmptyState
        onAddPress={() =>
          navigation.navigate("EntryForm", { mode: "add", type: "expense" })
        }
      />
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.contentContainer}
    >
      <Text style={styles.monthHeader}>{monthLabel}</Text>
      <SummaryTotals expenseCents={expenseTotal} incomeCents={incomeTotal} />
      <Text
        style={[
          styles.balance,
          { color: balance > 0 ? colors.income : balance < 0 ? colors.expense : colors.textSecondary },
        ]}
      >
        Balance: {formatCents(balance)}
      </Text>
      <View style={styles.divider} />
      {expenseBreakdown.length > 0 && (
        <CategorySection
          title="Expenses"
          rows={expenseBreakdown}
          color={colors.expense}
          subtotalCents={expenseTotal}
        />
      )}
      {incomeBreakdown.length > 0 && (
        <CategorySection
          title="Income"
          rows={incomeBreakdown}
          color={colors.income}
          subtotalCents={incomeTotal}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    flexGrow: 1,
    backgroundColor: colors.background,
  },
  monthHeader: {
    fontSize: typography.heading.size,
    fontWeight: typography.heading.weight as "700",
    lineHeight: typography.heading.lineHeight,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  balance: {
    fontSize: 20,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
});
