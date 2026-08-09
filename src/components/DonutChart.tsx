// DonutChart — SVG donut chart for expense/income breakdowns.
// Groups slices <5% into "Other". Shows total in center.
import { View, Text, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors } from "../theme/tokens";

type DonutChartProps = {
  data: { name: string; value: number }[];
  size?: number;
  colors: string[];
};

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

export default function DonutChart({ data, size = 120, colors: chartColors }: DonutChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 2;
  const innerR = outerR * 0.6;
  const strokeWidth = outerR - innerR;
  const strokeR = (outerR + innerR) / 2;

  // Group small slices into "Other"
  const THRESHOLD = 0.05;
  const mainSlices: { name: string; value: number; color: string }[] = [];
  let otherValue = 0;

  data.forEach((d, i) => {
    const pct = d.value / total;
    if (pct < THRESHOLD) {
      otherValue += d.value;
    } else {
      mainSlices.push({ name: d.name, value: d.value, color: chartColors[i % chartColors.length] });
    }
  });

  if (otherValue > 0) {
    mainSlices.push({ name: "Other", value: otherValue, color: "#94A3B8" });
  }

  // Build arcs
  let currentAngle = 0;
  const arcs = mainSlices.map((slice) => {
    const angle = (slice.value / total) * 360;
    const start = currentAngle;
    currentAngle += angle;
    return { ...slice, startAngle: start, endAngle: currentAngle, angle };
  });

  return (
    <View style={styles.container}>
      <Svg width={size} height={size}>
        {arcs.map((arc, i) => {
          if (arc.angle < 0.5) return null;
          const path = describeArc(cx, cy, strokeR, arc.startAngle, arc.endAngle - 0.5);
          return (
            <Path
              key={`arc-${i}`}
              d={path}
              stroke={arc.color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="round"
            />
          );
        })}
      </Svg>
      <View style={[styles.center, { width: innerR * 2, height: innerR * 2, borderRadius: innerR }]}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>₱{(total / 100).toLocaleString()}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    position: "absolute",
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  totalValue: {
    fontSize: 14,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    color: colors.textPrimary,
  },
});
