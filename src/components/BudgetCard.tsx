// BudgetCard — shows budget progress on Home screen.
// Displays budget amount, date range, progress bar with color-coded thresholds,
// and remaining amount. Shows "Set new budget" prompt when period expired.
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors, spacing, typography, radius } from "../theme/tokens";
import { formatCents } from "../lib/money";

type BudgetCardProps = {
  budgetAmount: number;
  budgetStartDate: string;
  budgetEndDate: string;
  expenseCents: number;
  onTap: () => void;
};

function formatDateRange(start: string, end: string): string {
  const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const startLabel = `${SHORT_MONTHS[sm - 1]} ${sd}`;
  const endLabel = `${SHORT_MONTHS[em - 1]} ${ed}, ${ey}`;
  return `${startLabel} – ${endLabel}`;
}

function getProgressColor(percent: number): string {
  if (percent < 70) return "#16A34A";
  if (percent <= 90) return "#F8C519";
  return "#DC2626";
}

function isExpired(endDate: string): boolean {
  const today = new Date();
  const [y, m, d] = endDate.split("-").map(Number);
  const end = new Date(y, m - 1, d);
  return today > end;
}

export default function BudgetCard({
  budgetAmount,
  budgetStartDate,
  budgetEndDate,
  expenseCents,
  onTap,
}: BudgetCardProps) {
  const expired = isExpired(budgetEndDate);
  const percent = budgetAmount > 0 ? Math.min((expenseCents / budgetAmount) * 100, 100) : 0;
  const remaining = budgetAmount - expenseCents;
  const barColor = getProgressColor(percent);

  return (
    <TouchableOpacity style={styles.card} onPress={onTap} activeOpacity={0.7}>
      <View style={styles.header}>
        <Text style={styles.label}>Budget</Text>
        <Text style={styles.amount}>{formatCents(budgetAmount)}</Text>
      </View>
      <Text style={styles.dateRange}>{formatDateRange(budgetStartDate, budgetEndDate)}</Text>

      {expired ? (
        <View style={styles.expiredPrompt}>
          <Text style={styles.expiredText}>Budget period ended</Text>
          <Text style={styles.expiredCTA}>Tap to set a new budget</Text>
        </View>
      ) : (
        <>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: barColor }]} />
          </View>
          <Text style={[styles.remaining, { color: remaining >= 0 ? colors.income : colors.expense }]}>
            Remaining: {formatCents(remaining)}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.lg,
    backgroundColor: "rgba(239, 109, 64, 0.06)",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    shadowColor: "#EF6D40",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primaryDark,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  amount: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.primary,
    fontVariant: ["tabular-nums"],
  },
  dateRange: {
    fontSize: 13,
    color: colors.primaryDark,
    marginBottom: spacing.md,
  },
  progressBg: {
    height: 10,
    backgroundColor: "rgba(239,109,64,0.15)",
    borderRadius: 5,
    overflow: "hidden",
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: "100%",
    borderRadius: 5,
  },
  remaining: {
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
  },
  expiredPrompt: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  expiredText: {
    fontSize: typography.body.size,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  expiredCTA: {
    fontSize: typography.label.size,
    fontWeight: "600",
    color: colors.primary,
    marginTop: 4,
  },
});
