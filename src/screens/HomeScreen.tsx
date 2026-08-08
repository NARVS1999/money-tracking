// HomeScreen — derived summary screen. Shows month header, expense/income
// totals, per-category breakdown sections, and loading skeleton.
// Data is derived from cached entries via monthRange() — no aggregation queries.
import { useMemo } from "react";
import { ScrollView, Text, View, StyleSheet } from "react-native";
import { useEntries } from "../entries/EntriesProvider";
import { useCategories } from "../categories/CategoriesProvider";
import { monthRange, today } from "../lib/dates";
import { colors, spacing, typography } from "../theme/tokens";
import SummaryTotals from "../components/SummaryTotals";
import CategorySection from "../components/CategorySection";
import LoadingSkeleton from "../components/LoadingSkeleton";

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
  const { entries, isLoading } = useEntries();
  const { expenseCategories, incomeCategories } = useCategories();

  // Current month range
  const { start, end } = useMemo(() => monthRange(today()), []);

  // Month label: "August 2026"
  const monthLabel = useMemo(() => {
    const parts = today().split("-");
    const monthIndex = parseInt(parts[1], 10) - 1;
    return `${MONTH_NAMES[monthIndex]} ${parts[0]}`;
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

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.contentContainer}
    >
      <Text style={styles.monthHeader}>{monthLabel}</Text>
      <SummaryTotals expenseCents={expenseTotal} incomeCents={incomeTotal} />
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
});
