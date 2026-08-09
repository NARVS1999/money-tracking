// Preset icons for category selection and shared icon utilities.

export const PRESET_ICONS = [
  "🏠", "🍔", "🚗", "💰", "🛒",
  "💊", "📚", "🎭", "🎵", "💻",
  "🏋️", "🐾", "✈️", "🎂", "💇",
  "🏥", "📱", "🎯", "🌿", "☕",
];

export const ICON_COLORS = [
  "rgba(239,109,64,0.12)",
  "rgba(219,40,28,0.12)",
  "rgba(69,192,207,0.12)",
  "rgba(248,197,25,0.12)",
  "rgba(22,163,74,0.12)",
  "rgba(139,92,246,0.12)",
  "rgba(236,72,153,0.12)",
  "rgba(20,184,166,0.12)",
];

export const ICON_TEXT_COLORS = [
  "#EF6D40",
  "#DB281C",
  "#45C0CF",
  "#F8C519",
  "#16A34A",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
];

export function getIconColor(index: number): string {
  return ICON_COLORS[index % ICON_COLORS.length];
}

export function getIconTextColor(index: number): string {
  return ICON_TEXT_COLORS[index % ICON_TEXT_COLORS.length];
}
