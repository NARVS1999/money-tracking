// Preset icons for category selection — 55 Ionicons.
// Icon name is stored as string in Firestore; rendered via Ionicons in CategoryIcon.
import { Ionicons } from "@expo/vector-icons";

export type IconName = keyof typeof Ionicons.glyphMap;

export const PRESET_ICONS: IconName[] = [
  // Home & Living
  "home", "home-outline", "bed", "shirt", "car", "car-outline",
  // Food & Drink
  "restaurant", "cafe", "wine", "pizza", "fast-food", "nutrition",
  // Money & Shopping
  "wallet", "cash", "card", "cart", "bag", "pricetag",
  // Health & Fitness
  "fitness", "medical", "pulse", "body", "walk", "bicycle",
  // Work & Study
  "briefcase", "laptop", "book", "school", "pencil", "calculator",
  // Entertainment
  "musical-notes", "film", "game-controller", "football", "boat", "airplane",
  // Nature & Animals
  "leaf", "flower", "paw", "fish", "bug", "sunny",
  // Tech & Communication
  "phone-portrait", "mail", "chatbubble", "notifications", "globe", "camera",
  // Misc
  "heart", "star", "flag", "gift", "bookmark", "rocket", "color-palette",
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
