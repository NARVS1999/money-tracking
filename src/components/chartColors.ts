// Chart color palette — 8 distinct colors for pie/donut chart segments.

export const CHART_COLORS = [
  "#EF6D40", // orange
  "#DB281C", // red
  "#45C0CF", // teal
  "#F8C519", // yellow
  "#16A34A", // green
  "#8B5CF6", // purple
  "#EC4899", // pink
  "#14B8A6", // cyan
];

export function getChartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}
