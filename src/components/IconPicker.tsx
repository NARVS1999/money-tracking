// IconPicker — bottom sheet modal for selecting a category icon.
// Shows a 4-column grid of preset emoji icons with a "Skip" option.
import { View, Text, TouchableOpacity, FlatList, Modal, StyleSheet } from "react-native";
import { colors, spacing, typography, radius } from "../theme/tokens";
import { PRESET_ICONS } from "./categoryIcons";

type IconPickerProps = {
  visible: boolean;
  onSelect: (icon: string) => void;
  onSkip: () => void;
  onClose: () => void;
};

export default function IconPicker({ visible, onSelect, onSkip, onClose }: IconPickerProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Choose an Icon</Text>
          <FlatList
            data={PRESET_ICONS}
            keyExtractor={(item) => item}
            numColumns={4}
            contentContainerStyle={styles.grid}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => onSelect(item)}
              >
                <Text style={styles.iconEmoji}>{item}</Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity style={styles.skipBtn} onPress={onSkip}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingBottom: spacing.xl,
    maxHeight: "60%",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.heading.size,
    fontWeight: typography.heading.weight as "700",
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  grid: {
    paddingHorizontal: spacing.md,
  },
  iconBtn: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: "25%",
    justifyContent: "center",
    alignItems: "center",
    margin: 4,
    backgroundColor: colors.background,
    borderRadius: radius.md,
  },
  iconEmoji: {
    fontSize: 28,
  },
  skipBtn: {
    marginTop: spacing.md,
    marginHorizontal: spacing.md,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  skipText: {
    fontSize: typography.body.size,
    fontWeight: "600",
    color: colors.textSecondary,
  },
});
