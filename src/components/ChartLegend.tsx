// ChartLegend — colored dots with category name and percentage.
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, typography } from "../theme/tokens";

type ChartLegendProps = {
  items: { name: string; percent: number; color: string }[];
};

export default function ChartLegend({ items }: ChartLegendProps) {
  return (
    <View style={styles.container}>
      {items.map((item, i) => (
        <View key={`${item.name}-${i}`} style={styles.row}>
          <View style={[styles.dot, { backgroundColor: item.color }]} />
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.percent}>{item.percent}%</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xs,
    gap: spacing.xs,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  name: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  percent: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
});
