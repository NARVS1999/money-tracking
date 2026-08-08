// CategorySection — section header ("Expenses" or "Income"), list of category
// rows sorted by amount descending, and section subtotal.
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, typography } from "../theme/tokens";
import { formatCents } from "../lib/money";

type CategoryRow = {
  name: string;
  cents: number;
};

type CategorySectionProps = {
  title: string;
  rows: CategoryRow[];
  color: string;
  subtotalCents: number;
};

export default function CategorySection({
  title,
  rows,
  color,
  subtotalCents,
}: CategorySectionProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>{title}</Text>
      {rows.map((row, index) => (
        <View
          key={`${title}-${row.name}-${index}`}
          style={[
            styles.row,
            index === rows.length - 1 && styles.rowLast,
          ]}
        >
          <Text style={styles.rowName} numberOfLines={1}>
            {row.name}
          </Text>
          <Text style={[styles.rowAmount, { color }]} numberOfLines={1}>
            {formatCents(row.cents)}
          </Text>
        </View>
      ))}
      <Text style={styles.subtotal}>{formatCents(subtotalCents)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
  },
  header: {
    fontSize: typography.heading.size,
    fontWeight: typography.heading.weight as "700",
    lineHeight: typography.heading.lineHeight,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    marginLeft: -spacing.md,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 44,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowName: {
    fontSize: typography.body.size,
    fontWeight: typography.body.weight as "400",
    lineHeight: typography.body.lineHeight,
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  rowAmount: {
    fontSize: typography.body.size,
    fontWeight: typography.body.weight as "400",
    fontVariant: ["tabular-nums"],
  },
  subtotal: {
    fontSize: typography.label.size,
    fontWeight: typography.label.weight as "400",
    lineHeight: typography.label.lineHeight,
    color: colors.textSecondary,
    textAlign: "right",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
});
