// SummaryCard — gradient card showing balance, expense, and income totals.
// Orange/red gradient background with white text and stat sub-cards.
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { spacing, typography, radius } from "../theme/tokens";
import { formatCents } from "../lib/money";

type SummaryCardProps = {
  balanceCents: number;
  expenseCents: number;
  incomeCents: number;
};

export default function SummaryCard({
  balanceCents,
  expenseCents,
  incomeCents,
}: SummaryCardProps) {
  return (
    <LinearGradient
      colors={["#EF6D40", "#DB281C"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <Text style={styles.label}>Total Balance</Text>
      <Text style={styles.balance}>{formatCents(balanceCents)}</Text>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Spent</Text>
          <Text style={styles.statValue}>{formatCents(expenseCents)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Earned</Text>
          <Text style={styles.statValue}>{formatCents(incomeCents)}</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  label: {
    fontSize: typography.label.size,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  balance: {
    fontSize: 48,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    color: "#FFFFFF",
    lineHeight: 52,
    letterSpacing: -1,
    marginBottom: spacing.lg,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: radius.md,
    padding: spacing.md,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    color: "#FFFFFF",
  },
});
