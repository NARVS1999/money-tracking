// CategoryIcon — renders either a preset Ionicon or initial letter fallback.
// Consistent icon rendering across Home, Categories, and EntryForm screens.
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius } from "../theme/tokens";
import { getIconColor, getIconTextColor, type IconName } from "./categoryIcons";

type CategoryIconProps = {
  icon?: string;
  name: string;
  size?: number;
};

export default function CategoryIcon({ icon, name, size = 44 }: CategoryIconProps) {
  const colorIndex = name.charCodeAt(0) % 8;

  if (icon) {
    return (
      <View
        style={[
          styles.container,
          {
            width: size,
            height: size,
            borderRadius: radius.icon,
            backgroundColor: getIconColor(colorIndex),
          },
        ]}
      >
        <Ionicons
          name={icon as IconName}
          size={size * 0.5}
          color={getIconTextColor(colorIndex)}
        />
      </View>
    );
  }

  const initial = name.charAt(0).toUpperCase();
  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: radius.icon,
          backgroundColor: getIconColor(colorIndex),
        },
      ]}
    >
      <Text style={[styles.initial, { color: getIconTextColor(colorIndex), fontSize: size * 0.4 }]}>
        {initial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
  },
  initial: {
    fontWeight: "700",
  },
});
