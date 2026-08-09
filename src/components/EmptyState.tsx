// EmptyState — centered empty state with heading, body text, and CTA button.
// Shown when no entries exist for the current month.
import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, spacing, typography, radius } from "../theme/tokens";

type EmptyStateProps = {
  onAddPress: () => void;
};

export default function EmptyState({ onAddPress }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Nothing logged this month</Text>
      <Text style={styles.body}>Start tracking to see your summary here.</Text>
      <Pressable style={styles.cta} onPress={onAddPress}>
        <Text style={styles.ctaText}>Add an entry</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  heading: {
    fontSize: typography.heading.size,
    fontWeight: typography.heading.weight as "700",
    lineHeight: typography.heading.lineHeight,
    color: colors.textPrimary,
    textAlign: "center",
  },
  body: {
    fontSize: typography.label.size,
    fontWeight: typography.label.weight as "400",
    lineHeight: typography.label.lineHeight,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  cta: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.md,
  },
  ctaText: {
    fontSize: typography.body.size,
    fontWeight: typography.body.weight as "400",
    color: colors.onAccent,
    textAlign: "center",
  },
});
