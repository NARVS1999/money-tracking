// DateSectionHeader — sticky section header for date groups in entry lists.
// Shows "Today", "Yesterday", or "Mon DD" format.
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, typography } from "../theme/tokens";
import { today, addDays } from "../lib/dates";

type DateSectionHeaderProps = {
  date: string; // YYYY-MM-DD
};

function formatDateLabel(dateStr: string): string {
  const todayStr = today();
  const yesterdayStr = addDays(todayStr, -1);

  if (dateStr === todayStr) return "Today";
  if (dateStr === yesterdayStr) return "Yesterday";

  // Format as "Mon DD" (e.g., "Aug 7")
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const month = date.toLocaleString("en-US", { month: "short" });
  return `${month} ${d}`;
}

export default function DateSectionHeader({ date }: DateSectionHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label} accessibilityRole="header">
        {formatDateLabel(date)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
  },
  label: {
    fontSize: typography.label.size,
    fontWeight: typography.label.weight as "700",
    lineHeight: typography.label.lineHeight,
    color: colors.textSecondary,
  },
});
