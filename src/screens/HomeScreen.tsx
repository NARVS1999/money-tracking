// HomeScreen — derived summary screen. Shows gradient summary card, quick-action
// buttons, and per-category breakdown sections. Data derived from cached entries
// via monthRange() — no aggregation queries.
import { useMemo } from "react";
import { ScrollView, Text, View, StyleSheet, TouchableOpacity } from "react-native";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useEntries } from "../entries/EntriesProvider";
import { useCategories } from "../categories/CategoriesProvider";
import { useAuth } from "../auth/AuthProvider";
import { monthRange, today } from "../lib/dates";
import { colors, spacing, typography, radius } from "../theme/tokens";
import SummaryCard from "../components/SummaryCard";
import BudgetCard from "../components/BudgetCard";
import CategorySection from "../components/CategorySection";
import LoadingSkeleton from "../components/LoadingSkeleton";
import EmptyState from "../components/EmptyState";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp<Record<string, object>>>();
  const { entries, isLoading } = useEntries();
  const { expenseCategories, incomeCategories } = useCategories();
  const { userProfile } = useAuth();

  const { start, end, monthLabel } = useMemo(() => {
    const todayStr = today();
    const { start, end } = monthRange(todayStr);
    const parts = todayStr.split("-");
    const monthIndex = parseInt(parts[1], 10) - 1;
    const monthLabel = `${MONTH_NAMES[monthIndex]} ${parts[0]}`;
    return { start, end, monthLabel };
  }, []);

  const monthEntries = useMemo(
    () => entries.filter((e) => e.date >= start && e.date <= end),
    [entries, start, end],
  );

  const expenseTotal = useMemo(
    () => monthEntries.filter((e) => e.type === "expense").reduce((sum, e) => sum + e.amount, 0),
    [monthEntries],
  );

  const incomeTotal = useMemo(
    () => monthEntries.filter((e) => e.type === "income").reduce((sum, e) => sum + e.amount, 0),
    [monthEntries],
  );

  const balance = incomeTotal - expenseTotal;

  // Budget: expense total within budget date range (may differ from current month)
  const budgetExpense = useMemo(() => {
    if (!userProfile?.budgetAmount || !userProfile?.budgetStartDate || !userProfile?.budgetEndDate) return 0;
    return entries
      .filter(
        (e) =>
          e.type === "expense" &&
          e.date >= userProfile.budgetStartDate! &&
          e.date <= userProfile.budgetEndDate!,
      )
      .reduce((sum, e) => sum + e.amount, 0);
  }, [entries, userProfile]);

  const expenseBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    monthEntries.filter((e) => e.type === "expense").forEach((e) => {
      map.set(e.categoryId, (map.get(e.categoryId) || 0) + e.amount);
    });
    return Array.from(map.entries())
      .map(([categoryId, cents]) => ({
        name: expenseCategories.find((c) => c.id === categoryId)?.name || "Unknown",
        cents,
      }))
      .sort((a, b) => b.cents - a.cents);
  }, [monthEntries, expenseCategories]);

  const incomeBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    monthEntries.filter((e) => e.type === "income").forEach((e) => {
      map.set(e.categoryId, (map.get(e.categoryId) || 0) + e.amount);
    });
    return Array.from(map.entries())
      .map(([categoryId, cents]) => ({
        name: incomeCategories.find((c) => c.id === categoryId)?.name || "Unknown",
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
      <View style={styles.header}>
        <View>
          <Text style={styles.monthHeader}>{monthLabel.split(" ")[0]}</Text>
          <Text style={styles.monthSub}>{monthLabel.split(" ")[1]}</Text>
        </View>
      </View>

      <SummaryCard
        balanceCents={balance}
        expenseCents={expenseTotal}
        incomeCents={incomeTotal}
      />

      {userProfile?.budgetAmount && userProfile?.budgetStartDate && userProfile?.budgetEndDate && (
        <BudgetCard
          budgetAmount={userProfile.budgetAmount}
          budgetStartDate={userProfile.budgetStartDate}
          budgetEndDate={userProfile.budgetEndDate}
          expenseCents={budgetExpense}
          onTap={() => navigation.navigate("Account" as never)}
        />
      )}

      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.quickBtnExpense}
          onPress={() => navigation.navigate("EntryForm", { mode: "add", type: "expense" })}
        >
          <Text style={styles.quickBtnExpenseText}>- Expense</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickBtnIncome}
          onPress={() => navigation.navigate("EntryForm", { mode: "add", type: "income" })}
        >
          <Text style={styles.quickBtnIncomeText}>+ Income</Text>
        </TouchableOpacity>
      </View>

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
    paddingBottom: spacing.xl,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  monthHeader: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  monthSub: {
    fontSize: typography.label.size,
    color: colors.textSecondary,
    fontWeight: "500",
    marginTop: 2,
  },
  quickActions: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    marginTop: spacing.md,
  },
  quickBtnExpense: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: "rgba(219,40,28,0.08)",
    borderWidth: 1,
    borderColor: "rgba(219,40,28,0.15)",
    alignItems: "center",
  },
  quickBtnExpenseText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.expense,
  },
  quickBtnIncome: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: "rgba(69,192,207,0.08)",
    borderWidth: 1,
    borderColor: "rgba(69,192,207,0.15)",
    alignItems: "center",
  },
  quickBtnIncomeText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.teal,
  },
});
