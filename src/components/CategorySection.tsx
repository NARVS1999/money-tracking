// CategorySection — section header ("Expenses" or "Income"), list of category
// rows with icon placeholders, sorted by amount descending, and section subtotal.
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, typography, radius, shadow } from "../theme/tokens";
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

const ICON_COLORS = [
  "rgba(239,109,64,0.12)",
  "rgba(219,40,28,0.12)",
  "rgba(69,192,207,0.12)",
  "rgba(248,197,25,0.12)",
  "rgba(22,163,74,0.12)",
];

const ICON_TEXT_COLORS = [
  "#EF6D40",
  "#DB281C",
  "#45C0CF",
  "#F8C519",
  "#16A34A",
];

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
        {rows.map((row, index) => {
          const colorIdx = index % ICON_COLORS.length;
          const initial = row.name.charAt(0).toUpperCase();
          return (
            <View
              key={`${title}-${row.name}-${index}`}
              style={[
                styles.row,
                index === rows.length - 1 && styles.rowLast,
              ]}
            >
              <View style={[styles.icon, { backgroundColor: ICON_COLORS[colorIdx] }]}>
                <Text style={[styles.iconText, { color: ICON_TEXT_COLORS[colorIdx] }]}>{initial}</Text>
              </View>
              <View style={styles.rowInfo}>
                <Text style={styles.rowName} numberOfLines={1}>{row.name}</Text>
                <Text style={styles.rowCount}>{rows.length > 0 ? `${index + 1} of ${rows.length}` : ""}</Text>
              </View>
              <Text style={[styles.rowAmount, { color }]} numberOfLines={1}>
                {formatCents(row.cents)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },
  header: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: typography.label.size,
    fontWeight: "600",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: "hidden",
    ...shadow.surface,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.icon,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  iconText: {
    fontSize: 18,
    fontWeight: "700",
  },
  rowInfo: {
    flex: 1,
  },
  rowName: {
    fontSize: typography.body.size,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 2,
  },
  rowCount: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  rowAmount: {
    fontSize: 16,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    minWidth: 44,
    textAlign: "right",
  },
});
