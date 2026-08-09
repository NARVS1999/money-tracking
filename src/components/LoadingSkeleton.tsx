// LoadingSkeleton — animated loading skeleton for the summary screen.
// Shows two gray 44px rectangles for totals and 3 gray rows for categories.
import { useEffect, useState } from "react";
import { View, Animated, StyleSheet } from "react-native";
import { colors, spacing, radius } from "../theme/tokens";

export default function LoadingSkeleton() {
  const [pulseAnim] = useState(() => new Animated.Value(0.4));

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [pulseAnim]);

  return (
    <View style={styles.container}>
      {/* Two gray rectangles for totals */}
      <View style={styles.totalsContainer}>
        <Animated.View style={[styles.skeletonRect, { opacity: pulseAnim }]} />
        <Animated.View style={[styles.skeletonRect, { opacity: pulseAnim }]} />
      </View>
      {/* Divider */}
      <View style={styles.divider} />
      {/* Three gray rows for categories */}
      <View style={styles.rowsContainer}>
        <Animated.View style={[styles.skeletonRow, { opacity: pulseAnim }]} />
        <View style={styles.rowGap} />
        <Animated.View style={[styles.skeletonRow, { opacity: pulseAnim }]} />
        <View style={styles.rowGap} />
        <Animated.View style={[styles.skeletonRow, { opacity: pulseAnim }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: spacing.lg,
  },
  totalsContainer: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  skeletonRect: {
    width: "100%",
    height: 44,
    backgroundColor: colors.border,
    borderRadius: radius.md,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
    marginVertical: spacing.md,
  },
  rowsContainer: {
    paddingHorizontal: spacing.md,
  },
  skeletonRow: {
    width: "100%",
    height: 44,
    backgroundColor: colors.border,
    borderRadius: radius.md,
  },
  rowGap: {
    height: 1,
  },
});
