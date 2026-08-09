// CategorySection — section header, list of category rows with icons,
// sorted by amount descending, and section subtotal.
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, typography, radius, shadow } from "../theme/tokens";
import { formatCents } from "../lib/money";
import CategoryIcon from "./CategoryIcon";

type CategoryRow = {
  name: string;
  cents: number;
  icon?: string;
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
      <View style={styles.headerRow}>
        <Text style={styles.header}>{title}</Text>
        <View style={[styles.badge, { backgroundColor: `${color}15` }]}>
          <Text style={[styles.badgeText, { color }]}>{formatCents(subtotalCents)}</Text>
        </View>
      </View>
      <View style={styles.card}>
        {rows.map((row, index) => (
          <View
            key={`${title}-${row.name}-${index}`}
            style={[styles.row, index === rows.length - 1 && styles.rowLast]}
          >
            <CategoryIcon icon={row.icon} name={row.name} size={44} />
            <View style={styles.rowInfo}>
              <Text style={styles.rowName} numberOfLines={1}>{row.name}</Text>
              <Text style={styles.rowCount}>{rows.length > 0 ? `${index + 1} of ${rows.length}` : ""}</Text>
            </View>
            <Text style={[styles.rowAmount, { color }]} numberOfLines={1}>
              {formatCents(row.cents)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.md, marginBottom: spacing.lg },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },
  header: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: typography.label.size, fontWeight: "600" },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: "hidden", ...shadow.surface },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  rowLast: { borderBottomWidth: 0 },
  rowInfo: { flex: 1 },
  rowName: { fontSize: typography.body.size, fontWeight: "600", color: colors.textPrimary, marginBottom: 2 },
  rowCount: { fontSize: 13, color: colors.textSecondary },
  rowAmount: { fontSize: 16, fontWeight: "700", fontVariant: ["tabular-nums"], minWidth: 44, textAlign: "right" },
});
