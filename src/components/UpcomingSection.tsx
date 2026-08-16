// UpcomingSection — home-screen "Upcoming Expenses" / "Upcoming Income" card
// (15-UI-SPEC §1). Lists active scheduled-entry templates of ONE type using
// the category-breakdown row contract (CategorySection row): category name +
// "{n} of {count}" count line + right-aligned themed amount. Tap-only
// (edit/pause/delete management stays in the Export tab swipe actions).
// Yellow-tinted card (theme.bg/border tokens) with a type accent on the
// amount — expense red #DC2626 / income teal #45C0CF (HOME-UP-01/02). Returns
// null at zero items — absence IS the empty state (HOME-UP-05). No CTA, no
// subtotal badge: informational indicator only.
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors, spacing, typography, radius, shadow } from "../theme/tokens";
import { formatCents } from "../lib/money";
import { formatFrequency, getUpcomingOccurrence, formatNextDate } from "../lib/frequency";
import { useCategories } from "../categories/CategoriesProvider";
import type { ScheduledEntry } from "../scheduled/ScheduledEntriesProvider";
import CategoryIcon from "./CategoryIcon";

export type UpcomingSectionTheme = {
  bg: string;
  border: string;
  accent: string;
};

type UpcomingSectionProps = {
  title: string;
  items: ScheduledEntry[]; // pre-filtered active entries of ONE type
  theme: UpcomingSectionTheme;
  onTapItem: (entry: ScheduledEntry) => void;
};

export default function UpcomingSection({
  title,
  items,
  theme,
  onTapItem,
}: UpcomingSectionProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header} numberOfLines={1}>
        {title}
      </Text>
      <View
        style={[
          styles.card,
          { backgroundColor: "#000", borderColor: theme.border },
        ]}
      >
        {items.map((entry, index) => (
          <UpcomingRow
            key={entry.id}
            entry={entry}
            accent={theme.accent}
            isLast={index === items.length - 1}
            index={index}
            count={items.length}
            onPress={() => onTapItem(entry)}
          />
        ))}
      </View>
    </View>
  );
}

// Themed row — matches the category-breakdown row visual contract
// (CategorySection row, same screen): category icon + category name +
// "{n} of {count}" count line + right-aligned amount in the section accent.
// The row is a plain tap target (no Swipeable — HOME-UP-06 promises only
// edit navigation).
function UpcomingRow({
  entry,
  accent,
  isLast,
  index,
  count,
  onPress,
}: {
  entry: ScheduledEntry;
  accent: string;
  isLast: boolean;
  index: number;
  count: number;
  onPress: () => void;
}) {
  const { expenseCategories, incomeCategories } = useCategories();

  const categories =
    entry.type === "expense" ? expenseCategories : incomeCategories;
  const category = categories.find((c) => c.id === entry.categoryId);
  const categoryName = category?.name ?? "Unknown";

  const frequencyLabel = formatFrequency(entry.frequency);
  const nextDate = getUpcomingOccurrence(
    entry.date,
    entry.frequency,
    entry.lastGenerated,
    entry.endDate,
  );
  const secondaryDate = nextDate ?? entry.date;
  const secondaryLine = nextDate
    ? `${frequencyLabel} · ${formatNextDate(secondaryDate)}`
    : `${frequencyLabel} · ${formatNextDate(secondaryDate)}`;

  return (
    <TouchableOpacity
      style={[styles.row, isLast && styles.rowLast]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <CategoryIcon icon={category?.icon} name={categoryName} size={44} />
      <View style={styles.middle}>
        <Text style={styles.primary} numberOfLines={1}>
          {entry.description || categoryName}
        </Text>
        <Text style={styles.secondary} numberOfLines={1}>
          {secondaryLine}
        </Text>
      </View>
      <Text style={[styles.amount, { color: accent }]}>
        {formatCents(entry.amount)}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.md, marginBottom: spacing.lg },
  header: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
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
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
    gap: spacing.sm,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  middle: {
    flex: 1,
    marginRight: spacing.sm,
  },
  primary: {
    fontSize: typography.body.size,
    fontWeight: "600",
    lineHeight: typography.body.lineHeight,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  secondary: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  amount: {
    fontSize: 16,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    minWidth: 44,
    textAlign: "right",
  },
});
