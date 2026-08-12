// ScheduledEntryRow — single scheduled-entry template row with category icon,
// description (or category name), frequency + next-occurrence secondary line,
// right-aligned colored amount, and swipeable Edit / Pause-Resume / Delete
// actions (EntryRow pattern, 14-UI-SPEC §1). Used in ExportScreen's
// "Scheduled Entries" section. Paused templates show a grey "Paused" badge
// instead of a next date — generation is halted, a next occurrence would
// mislead.
import { View, Text, TouchableOpacity, Alert, StyleSheet } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { colors, spacing, typography, radius } from "../theme/tokens";
import { formatCents } from "../lib/money";
import {
  formatFrequency,
  formatNextDate,
  getUpcomingOccurrence,
} from "../lib/frequency";
import { useCategories } from "../categories/CategoriesProvider";
import type { ScheduledEntry } from "../scheduled/ScheduledEntriesProvider";
import CategoryIcon from "./CategoryIcon";

type ScheduledEntryRowProps = {
  entry: ScheduledEntry;
  onEdit: (entry: ScheduledEntry) => void;
  onDelete: (id: string) => void;
  onTogglePause: (entry: ScheduledEntry) => void;
  // Last row inside a card drops its hairline separator (CategorySection
  // rowLast pattern).
  isLast?: boolean;
};

export default function ScheduledEntryRow({
  entry,
  onEdit,
  onDelete,
  onTogglePause,
  isLast = false,
}: ScheduledEntryRowProps) {
  const { expenseCategories, incomeCategories } = useCategories();

  const categories =
    entry.type === "expense" ? expenseCategories : incomeCategories;
  const category = categories.find((c) => c.id === entry.categoryId);
  const categoryName = category?.name ?? "Unknown";

  const amountColor = entry.type === "income" ? colors.income : colors.expense;
  const frequencyLabel = formatFrequency(entry.frequency);

  // Next occurrence for display: the engine's getNextOccurrence clamped to
  // today (getUpcomingOccurrence, WR-01) so a long-lived session never shows
  // a past date as "Next:". "once" has no next occurrence — the row shows
  // the start date without a "Next:" prefix. The template's endDate caps the
  // pattern: when the next occurrence would land after it the engine will
  // never generate it, so the row shows no "Next:" either (WR-01).
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

  const renderRightActions = () => {
    return (
      <>
        <TouchableOpacity
          style={[styles.swipeAction, { backgroundColor: colors.teal }]}
          onPress={() => onEdit(entry)}
        >
          <Text style={[styles.swipeActionText, { color: "#FFFFFF" }]}>
            Edit
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.swipeAction, { backgroundColor: colors.border }]}
          onPress={() => onTogglePause(entry)}
        >
          <Text
            style={[styles.swipeActionText, { color: colors.textPrimary }]}
          >
            {entry.isActive ? "Pause" : "Resume"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.swipeAction, { backgroundColor: colors.danger }]}
          onPress={() => {
            Alert.alert(
              "Delete this scheduled entry?",
              "This scheduled entry will be permanently removed.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => onDelete(entry.id),
                },
              ],
            );
          }}
        >
          <Text style={[styles.swipeActionText, { color: "#FFFFFF" }]}>
            Delete
          </Text>
        </TouchableOpacity>
      </>
    );
  };

  return (
    <Swipeable renderRightActions={renderRightActions}>
      <TouchableOpacity
        style={[styles.container, isLast && styles.containerLast]}
        activeOpacity={0.7}
        onPress={() => onEdit(entry)}
      >
        <CategoryIcon icon={category?.icon} name={categoryName} size={44} />
        <View style={styles.middle}>
          <Text style={styles.primary} numberOfLines={1}>
            {entry.description || categoryName}
          </Text>
          {entry.isActive ? (
            <Text style={styles.secondary} numberOfLines={1}>
              {secondaryLine}
            </Text>
          ) : (
            <View style={styles.pausedLine}>
              <View style={styles.pausedBadge}>
                <Text style={styles.pausedBadgeText}>Paused</Text>
              </View>
              <Text style={styles.secondary} numberOfLines={1}>
                {frequencyLabel}
              </Text>
            </View>
          )}
        </View>
        <Text style={[styles.amount, { color: amountColor }]}>
          {formatCents(entry.amount)}
        </Text>
      </TouchableOpacity>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    minHeight: 44,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  containerLast: {
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
  // Paused state: grey pill badge replaces the next-date segment. No next
  // date while paused (generation is halted — showing one would mislead).
  pausedLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: 2,
  },
  pausedBadge: {
    backgroundColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pausedBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  amount: {
    fontSize: 16,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    minWidth: 44,
    textAlign: "right",
  },
  swipeAction: {
    width: 80,
    justifyContent: "center",
    alignItems: "center",
  },
  swipeActionText: {
    fontSize: typography.label.size,
    fontWeight: typography.label.weight as "400",
    lineHeight: typography.label.lineHeight,
  },
});
