// UpcomingSection — home-screen "Upcoming Expenses" / "Upcoming Income" card
// (15-UI-SPEC §1). Lists active scheduled-entry templates of ONE type with
// their next occurrence, tap-only (edit/pause/delete management stays in the
// Export tab swipe actions). Yellow-tinted card (theme.bg/border tokens) with
// a type accent on the amount — expense red #DC2626 / income teal #45C0CF
// (HOME-UP-01/02). Returns null at zero items — absence IS the empty state
// (HOME-UP-05). No CTA, no subtotal badge: informational indicator only.
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors, spacing, typography, radius, shadow } from "../theme/tokens";
import { formatCents } from "../lib/money";
import {
  formatFrequency,
  formatNextDate,
  getUpcomingOccurrence,
} from "../lib/frequency";
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
          { backgroundColor: theme.bg, borderColor: theme.border },
        ]}
      >
        {items.map((entry, index) => (
          <UpcomingRow
            key={entry.id}
            entry={entry}
            accent={theme.accent}
            isLast={index === items.length - 1}
            onPress={() => onTapItem(entry)}
          />
        ))}
      </View>
    </View>
  );
}

// Themed row — ScheduledEntryRow visual contract (14-UI-SPEC §1) with two
// locked deltas: amount color comes from the section theme (income is teal
// #45C0CF on Home, NOT the Export tab's green #16A34A) and the row is a
// plain tap target (no Swipeable — HOME-UP-06 promises only edit navigation).
function UpcomingRow({
  entry,
  accent,
  isLast,
  onPress,
}: {
  entry: ScheduledEntry;
  accent: string;
  isLast: boolean;
  onPress: () => void;
}) {
  const { expenseCategories, incomeCategories } = useCategories();

  const categories =
    entry.type === "expense" ? expenseCategories : incomeCategories;
  const category = categories.find((c) => c.id === entry.categoryId);
  const categoryName = category?.name ?? "Unknown";

  const frequencyLabel = formatFrequency(entry.frequency);

  // Next occurrence for display: the engine's getNextOccurrence clamped to
  // today (getUpcomingOccurrence, WR-01) so a session spanning a date
  // boundary never shows a past date as "Next:". "once" has no next
  // occurrence, and an endDate-capped template whose next occurrence lands
  // after endDate is finished — both show the start date without a "Next:"
  // prefix (shared with ScheduledEntryRow via the lib helper).
  const nextDate = getUpcomingOccurrence(
    entry.date,
    entry.frequency,
    entry.lastGenerated,
    entry.endDate,
  );
  const secondaryDate = nextDate ?? entry.date;
  const secondaryLine = nextDate
    ? `${frequencyLabel} · Next: ${formatNextDate(secondaryDate)}`
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
  // CategorySection container pattern: section padded, card list inside.
  container: { paddingHorizontal: spacing.md, marginBottom: spacing.lg },
  // CategorySection header pattern — the upcoming sections read at the same
  // hierarchy level as the Expenses/Income breakdown sections below them.
  header: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
    ...shadow.surface,
  },
  // ScheduledEntryRow container verbatim (minHeight 44 = touch-target floor).
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    minHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    fontWeight: typography.body.weight as "400",
    lineHeight: typography.body.lineHeight,
    color: colors.textPrimary,
  },
  secondary: {
    fontSize: typography.label.size,
    fontWeight: typography.label.weight as "400",
    lineHeight: typography.label.lineHeight,
    color: colors.textSecondary,
    marginTop: 2,
  },
  amount: {
    fontSize: 16,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    minWidth: 44,
    textAlign: "right",
  },
});
