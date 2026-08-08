// SummaryTotals — two large 44px tabular-nums totals for expense and income.
// Expense displays in colors.expense when > 0, colors.textSecondary when 0.
// Income displays in colors.income when > 0, colors.textSecondary when 0.
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing } from "../theme/tokens";
import { formatCents } from "../lib/money";

type SummaryTotalsProps = {
  expenseCents: number;
  incomeCents: number;
};

export default function SummaryTotals({
  expenseCents,
  incomeCents,
}: SummaryTotalsProps) {
  return (
    <View style={styles.container}>
      <Text
        style={[
          styles.total,
          {
            color: expenseCents > 0 ? colors.expense : colors.textSecondary,
          },
        ]}
      >
        {formatCents(expenseCents)}
      </Text>
      <Text
        style={[
          styles.total,
          {
            color: incomeCents > 0 ? colors.income : colors.textSecondary,
          },
        ]}
      >
        {formatCents(incomeCents)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  total: {
    fontSize: 44,
    fontWeight: "700",
    lineHeight: 52,
    fontVariant: ["tabular-nums"],
  },
});
