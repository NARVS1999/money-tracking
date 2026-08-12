// HomeScreen — derived summary screen. Shows gradient summary card, quick-action
// buttons, upcoming scheduled-entry sections, and per-category breakdown
// sections. Data derived from all cached entries + the scheduled templates.
import { useCallback, useMemo } from "react";
import { ScrollView, Text, View, StyleSheet, TouchableOpacity } from "react-native";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useEntries } from "../entries/EntriesProvider";
import { useCategories } from "../categories/CategoriesProvider";
import { useAuth } from "../auth/AuthProvider";
import { useScheduledEntries, type ScheduledEntry } from "../scheduled/ScheduledEntriesProvider";
import { getUpcomingOccurrence } from "../lib/frequency";
import { compare, today } from "../lib/dates";
import { colors, spacing, radius } from "../theme/tokens";
import SummaryCard from "../components/SummaryCard";
import BudgetCard from "../components/BudgetCard";
import DonutChart from "../components/DonutChart";
import ChartLegend from "../components/ChartLegend";
import CategorySection from "../components/CategorySection";
import UpcomingSection from "../components/UpcomingSection";
import LoadingSkeleton from "../components/LoadingSkeleton";
import EmptyState from "../components/EmptyState";
import { CHART_COLORS } from "../components/chartColors";

// Upcoming-row ordering (15-UI-SPEC §2, design decision): next occurrence
// date ascending (soonest first, via the engine's getNextOccurrence clamped
// to today — getUpcomingOccurrence, WR-01 — so the sort key matches the
// displayed "Next:" date; UI code never re-implements date math); entries
// with no next occurrence (future once templates) sort last, start date
// ascending. Stable for equal dates — Array.prototype.sort is stable in
// Hermes (ES2019+).
function sortUpcoming(entries: ScheduledEntry[]): ScheduledEntry[] {
  return [...entries].sort((a, b) => {
    const nextA = getUpcomingOccurrence(
      a.date,
      a.frequency,
      a.lastGenerated,
      a.endDate,
    );
    const nextB = getUpcomingOccurrence(
      b.date,
      b.frequency,
      b.lastGenerated,
      b.endDate,
    );
    if (nextA !== null && nextB !== null) {
      // YYYY-MM-DD strings compare chronologically.
      return nextA < nextB ? -1 : nextA > nextB ? 1 : 0;
    }
    if (nextA !== null) return -1;
    if (nextB !== null) return 1;
    return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
  });
}

// Exhausted templates do not belong in an "Upcoming" list (WR-02): a once
// template whose start date has passed is finished (already generated, or
// impossible to generate anymore), and a repeating template with no future
// occurrence (clamped next beyond endDate) can never generate again. A once
// template whose start date is today or ahead stays — its occurrence is
// genuinely upcoming. Applied alongside the isActive filter so both sections
// share it; a section with only exhausted templates hides (HOME-UP-05).
function hasUpcomingOccurrence(entry: ScheduledEntry): boolean {
  if (entry.frequency === "once") {
    return compare(entry.date, today()) >= 0;
  }
  return (
    getUpcomingOccurrence(
      entry.date,
      entry.frequency,
      entry.lastGenerated,
      entry.endDate,
    ) !== null
  );
}

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp<Record<string, object>>>();
  const { entries, isLoading } = useEntries();
  const { expenseCategories, incomeCategories } = useCategories();
  const { userProfile } = useAuth();
  const { scheduledEntries } = useScheduledEntries();

  const expenseTotal = useMemo(
    () => entries.filter((e) => e.type === "expense").reduce((sum, e) => sum + e.amount, 0),
    [entries],
  );

  const incomeTotal = useMemo(
    () => entries.filter((e) => e.type === "income").reduce((sum, e) => sum + e.amount, 0),
    [entries],
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
    entries.filter((e) => e.type === "expense").forEach((e) => {
      map.set(e.categoryId, (map.get(e.categoryId) || 0) + e.amount);
    });
    return Array.from(map.entries())
      .map(([categoryId, cents]) => {
        const cat = expenseCategories.find((c) => c.id === categoryId);
        return { name: cat?.name || "Unknown", cents, icon: cat?.icon };
      })
      .sort((a, b) => b.cents - a.cents);
  }, [entries, expenseCategories]);

  const incomeBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    entries.filter((e) => e.type === "income").forEach((e) => {
      map.set(e.categoryId, (map.get(e.categoryId) || 0) + e.amount);
    });
    return Array.from(map.entries())
      .map(([categoryId, cents]) => {
        const cat = incomeCategories.find((c) => c.id === categoryId);
        return { name: cat?.name || "Unknown", cents, icon: cat?.icon };
      })
      .sort((a, b) => b.cents - a.cents);
  }, [entries, incomeCategories]);

  // Chart data: group small slices into "Other" to match DonutChart behavior
  const expenseChartData = useMemo(() => {
    const total = expenseBreakdown.reduce((s, r) => s + r.cents, 0);
    if (total === 0) return [];
    const THRESHOLD = 0.05;
    const main: { name: string; value: number; percent: number; color: string }[] = [];
    let otherValue = 0;
    expenseBreakdown.forEach((r, i) => {
      if (r.cents / total < THRESHOLD) {
        otherValue += r.cents;
      } else {
        main.push({ name: r.name, value: r.cents, percent: Math.round((r.cents / total) * 100), color: CHART_COLORS[main.length % CHART_COLORS.length] });
      }
    });
    if (otherValue > 0) main.push({ name: "Other", value: otherValue, percent: Math.round((otherValue / total) * 100), color: "#94A3B8" });
    return main;
  }, [expenseBreakdown]);

  const incomeChartData = useMemo(() => {
    const total = incomeBreakdown.reduce((s, r) => s + r.cents, 0);
    if (total === 0) return [];
    const THRESHOLD = 0.05;
    const main: { name: string; value: number; percent: number; color: string }[] = [];
    let otherValue = 0;
    incomeBreakdown.forEach((r, i) => {
      if (r.cents / total < THRESHOLD) {
        otherValue += r.cents;
      } else {
        main.push({ name: r.name, value: r.cents, percent: Math.round((r.cents / total) * 100), color: CHART_COLORS[main.length % CHART_COLORS.length] });
      }
    });
    if (otherValue > 0) main.push({ name: "Other", value: otherValue, percent: Math.round((otherValue / total) * 100), color: "#94A3B8" });
    return main;
  }, [incomeBreakdown]);

  // Upcoming sections (HOME-UP-01..03): ALL active templates of each type —
  // no 7-day horizon — filtered to those still having a future occurrence
  // (WR-02: exhausted once/ended templates are clutter, not "upcoming"),
  // ordered next-occurrence ascending, null-next last.
  const upcomingExpenses = useMemo(
    () =>
      sortUpcoming(
        scheduledEntries.filter(
          (s) => s.isActive && s.type === "expense" && hasUpcomingOccurrence(s),
        ),
      ),
    [scheduledEntries],
  );
  const upcomingIncome = useMemo(
    () =>
      sortUpcoming(
        scheduledEntries.filter(
          (s) => s.isActive && s.type === "income" && hasUpcomingOccurrence(s),
        ),
      ),
    [scheduledEntries],
  );

  // Row tap → ScheduledEntryForm edit mode (HOME-UP-06). CR-02 (phase 14):
  // pass the type through so the form's category filter is correct.
  const openScheduledEdit = useCallback(
    (entry: ScheduledEntry) => {
      navigation.navigate("ScheduledEntryForm", {
        mode: "edit",
        id: entry.id,
        type: entry.type,
      });
    },
    [navigation],
  );

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (entries.length === 0) {
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
          <Text style={styles.monthHeader}>All Time</Text>
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

      {/* Upcoming scheduled-entry indicators (HOME-UP-07): between the
          quick-action buttons and the chart sections, expenses first —
          yellow-red then yellow-blue. Hidden at zero entries of the type. */}
      <UpcomingSection
        title="Upcoming Expenses"
        items={upcomingExpenses}
        theme={{
          bg: colors.upcomingExpenseBg,
          border: colors.upcomingExpenseBorder,
          accent: colors.expense,
        }}
        onTapItem={openScheduledEdit}
      />
      <UpcomingSection
        title="Upcoming Income"
        items={upcomingIncome}
        theme={{
          bg: colors.upcomingIncomeBg,
          border: colors.upcomingIncomeBorder,
          accent: colors.teal,
        }}
        onTapItem={openScheduledEdit}
      />

      {expenseChartData.length > 0 && (
        <View style={styles.chartSection}>
          <Text style={styles.chartTitle}>Expenses by Category</Text>
          <View style={styles.chartRow}>
            <DonutChart
              data={expenseChartData}
              size={120}
              colors={CHART_COLORS}
            />
            <ChartLegend items={expenseChartData} />
          </View>
        </View>
      )}

      {incomeChartData.length > 0 && (
        <View style={styles.chartSection}>
          <Text style={styles.chartTitle}>Income by Category</Text>
          <View style={styles.chartRow}>
            <DonutChart
              data={incomeChartData}
              size={120}
              colors={CHART_COLORS}
            />
            <ChartLegend items={incomeChartData} />
          </View>
        </View>
      )}

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
  chartSection: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  chartRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
});
