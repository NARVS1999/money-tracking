// IncomeScreen — FlatList of income entries grouped by date with section headers.
// Mirrors ExpensesScreen but filters entries to type === 'income'.
// FAB (+) button positioned above tab bar for adding entries.
import { useMemo } from "react";
import {
  FlatList,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useEntries, type Entry } from "../entries/EntriesProvider";
import EntryRow from "../components/EntryRow";
import DateSectionHeader from "../components/DateSectionHeader";
import { colors, spacing, typography } from "../theme/tokens";

// Group entries by date string
function groupByDate(entries: Entry[]): { date: string; data: Entry[] }[] {
  const map = new Map<string, Entry[]>();
  for (const entry of entries) {
    const list = map.get(entry.date);
    if (list) {
      list.push(entry);
    } else {
      map.set(entry.date, [entry]);
    }
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => (a > b ? -1 : a < b ? 1 : 0))
    .map(([date, data]) => ({ date, data }));
}

export default function IncomeScreen() {
  const { entries, isLoading } = useEntries();

  const incomeEntries = useMemo(
    () => entries.filter((e) => e.type === "income"),
    [entries],
  );

  const sections = useMemo(() => groupByDate(incomeEntries), [incomeEntries]);

  const flatData = useMemo(() => {
    const result: { type: "header" | "entry"; key: string; date?: string; entry?: Entry }[] = [];
    for (const section of sections) {
      result.push({ type: "header", key: `header-${section.date}`, date: section.date });
      for (const entry of section.data) {
        result.push({ type: "entry", key: entry.id, entry });
      }
    }
    return result;
  }, [sections]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (incomeEntries.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>No entries yet</Text>
        <Text style={styles.emptySubtitle}>
          Tap the + button below to log your first income.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={flatData}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => {
          if (item.type === "header" && item.date) {
            return <DateSectionHeader date={item.date} />;
          }
          if (item.entry) {
            return <EntryRow entry={item.entry} />;
          }
          return null;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.body.size,
    fontWeight: typography.body.weight as "400",
    lineHeight: typography.body.lineHeight,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: typography.label.size,
    fontWeight: typography.label.weight as "400",
    lineHeight: typography.label.lineHeight,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
