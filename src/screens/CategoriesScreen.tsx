// CategoriesScreen — full Categories tab with icon picker on add and edit.
// SectionList with two grouped sections, sticky headers with inline add,
// swipe actions (Edit + Delete/In use), and edit modal with name + icon.
import { useState } from "react";
import {
  SectionList,
  TextInput,
  TouchableOpacity,
  Text,
  View,
  Modal,
  StyleSheet,
  Alert,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { colors, spacing, typography, radius } from "../theme/tokens";
import {
  useCategories,
  type Category,
  type CategoryKind,
} from "../categories/CategoriesProvider";
import CategoryIcon from "../components/CategoryIcon";
import IconPicker from "../components/IconPicker";

type SectionData = {
  title: string;
  kind: CategoryKind;
  data: Category[];
};

export default function CategoriesScreen() {
  const {
    expenseCategories,
    incomeCategories,
    usageMap,
    addCategory,
    updateCategory,
    deleteCategory,
  } = useCategories();

  const [expenseInput, setExpenseInput] = useState("");
  const [incomeInput, setIncomeInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<CategoryKind | null>(null);
  const [focusedInput, setFocusedInput] = useState<CategoryKind | null>(null);

  // Icon picker state (for add)
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [pendingAdd, setPendingAdd] = useState<{ kind: CategoryKind; name: string; setInput: (s: string) => void } | null>(null);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{ kind: CategoryKind; category: Category } | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState<string | undefined>();
  const [showEditIconPicker, setShowEditIconPicker] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  // ── Add handlers ──────────────────────────────────────────────
  const handleAdd = async (kind: CategoryKind, input: string, setInput: (s: string) => void) => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setPendingAdd({ kind, name: trimmed, setInput });
    setShowIconPicker(true);
  };

  const handleIconSelect = async (icon: string) => {
    setShowIconPicker(false);
    if (!pendingAdd) return;
    const { kind, name, setInput } = pendingAdd;
    try {
      await addCategory(kind, name, icon);
      setInput("");
      setError(null);
      setErrorKind(null);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Couldn't add category. Try again.";
      setError(message);
      setErrorKind(kind);
    }
    setPendingAdd(null);
  };

  const handleIconSkip = async () => {
    setShowIconPicker(false);
    if (!pendingAdd) return;
    const { kind, name, setInput } = pendingAdd;
    try {
      await addCategory(kind, name);
      setInput("");
      setError(null);
      setErrorKind(null);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Couldn't add category. Try again.";
      setError(message);
      setErrorKind(kind);
    }
    setPendingAdd(null);
  };

  const handleIconClose = () => {
    setShowIconPicker(false);
    setPendingAdd(null);
  };

  // ── Edit handlers ─────────────────────────────────────────────
  const openEdit = (kind: CategoryKind, category: Category) => {
    setEditingCategory({ kind, category });
    setEditName(category.name);
    setEditIcon(category.icon);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingCategory || editSaving) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      Alert.alert("Error", "Category name cannot be empty.");
      return;
    }
    setEditSaving(true);
    try {
      await updateCategory(editingCategory.kind, editingCategory.category.id, {
        name: trimmed,
        icon: editIcon,
      });
      setShowEditModal(false);
      setEditingCategory(null);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Couldn't update. Try again.";
      Alert.alert("Error", message);
    } finally {
      setEditSaving(false);
    }
  };

  const handleChangeText = (kind: CategoryKind, setter: (s: string) => void) => (text: string) => {
    setter(text);
    setError(null);
    setErrorKind(null);
  };

  const sections: SectionData[] = [
    { title: "Expense Categories", kind: "expenseCategories", data: expenseCategories },
    { title: "Income Categories", kind: "incomeCategories", data: incomeCategories },
  ];

  // ── Swipe actions: Edit + Delete/In use ───────────────────────
  const renderRightActions = (kind: CategoryKind, item: Category, count: number) => {
    return function SwipeActions() {
      return (
        <>
          <TouchableOpacity
            style={[styles.swipeAction, { backgroundColor: "#3B82F6" }]}
            onPress={() => openEdit(kind, item)}
          >
            <Text style={[styles.swipeActionText, { color: "#FFFFFF" }]}>Edit</Text>
          </TouchableOpacity>
          {count > 0 ? (
            <View style={[styles.swipeAction, { backgroundColor: "#E5E7EB" }]}>
              <Text style={[styles.swipeActionText, { color: "#6B7280" }]}>In use</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.swipeAction, { backgroundColor: colors.danger }]}
              onPress={() => {
                Alert.alert(`Delete ${item.name}?`, "This cannot be undone.", [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => {
                      deleteCategory(kind, item.id).catch(() =>
                        Alert.alert("Error", "Couldn't delete category. Try again."),
                      );
                    },
                  },
                ]);
              }}
            >
              <Text style={[styles.swipeActionText, { color: "#FFFFFF" }]}>Delete</Text>
            </TouchableOpacity>
          )}
        </>
      );
    };
  };

  return (
    <>
      <SectionList
        sections={sections}
        stickySectionHeadersEnabled={true}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderSectionHeader={({ section }) => {
          const isFocused = focusedInput === section.kind;
          const inputValue = section.kind === "expenseCategories" ? expenseInput : incomeInput;
          const setInput = section.kind === "expenseCategories" ? setExpenseInput : setIncomeInput;
          const groupLabel = section.kind === "expenseCategories" ? "expense" : "income";

          return (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle} accessibilityRole="header">{section.title}</Text>
              {error && errorKind === section.kind ? (
                <Text style={styles.errorText} accessibilityRole="alert">{error}</Text>
              ) : null}
              <View style={styles.inlineAdd}>
                <TextInput
                  style={[styles.input, isFocused && styles.inputFocused, { flex: 1 }]}
                  placeholder="New category"
                  placeholderTextColor={colors.textSecondary}
                  value={inputValue}
                  onChangeText={handleChangeText(section.kind, setInput)}
                  onFocus={() => setFocusedInput(section.kind)}
                  onBlur={() => setFocusedInput(null)}
                  returnKeyType="done"
                  onSubmitEditing={() => handleAdd(section.kind, inputValue, setInput)}
                  accessibilityLabel={`New ${groupLabel} category`}
                  keyboardType="default"
                  autoCapitalize="sentences"
                />
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => handleAdd(section.kind, inputValue, setInput)}
                  accessibilityLabel={`Add ${groupLabel} category`}
                >
                  <Text style={styles.addButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        renderItem={({ item, section }) => {
          const count = usageMap.get(item.id) || 0;
          const countLabel = usageMap.size === 0 ? 0 : `${count} ${count === 1 ? "entry" : "entries"}`;

          return (
            <Swipeable renderRightActions={renderRightActions(section.kind, item, count)}>
              <View style={styles.row}>
                <CategoryIcon icon={item.icon} name={item.name} size={36} />
                <Text style={styles.categoryName} numberOfLines={1}>{item.name}</Text>
                <View style={styles.rowRight}>
                  <Text style={styles.swipeHint}>←</Text>
                  <Text style={styles.usageCount}>{countLabel}</Text>
                </View>
              </View>
            </Swipeable>
          );
        }}
        renderSectionFooter={({ section }) => {
          if (section.data.length > 0) return null;
          return (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                No {section.kind === "expenseCategories" ? "expense" : "income"} categories yet
              </Text>
            </View>
          );
        }}
      />

      {/* Add icon picker */}
      <IconPicker
        visible={showIconPicker}
        onSelect={handleIconSelect}
        onSkip={handleIconSkip}
        onClose={handleIconClose}
      />

      {/* Edit modal */}
      <Modal visible={showEditModal} transparent animationType="fade" onRequestClose={() => setShowEditModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Category</Text>

            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Category name"
              placeholderTextColor={colors.textSecondary}
              editable={!editSaving}
            />

            <Text style={styles.label}>Icon</Text>
            <TouchableOpacity
              style={styles.iconPreview}
              onPress={() => setShowEditIconPicker(true)}
            >
              <CategoryIcon icon={editIcon} name={editName || "A"} size={40} />
              <Text style={styles.iconPreviewText}>Tap to change</Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowEditModal(false)}
                disabled={editSaving}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, editSaving && styles.saveBtnDisabled]}
                onPress={handleSaveEdit}
                disabled={editSaving}
              >
                <Text style={styles.saveBtnText}>{editSaving ? "Saving..." : "Save"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit icon picker */}
      <IconPicker
        visible={showEditIconPicker}
        selectedIcon={editIcon}
        onSelect={(icon) => { setEditIcon(icon); setShowEditIconPicker(false); }}
        onSkip={() => { setEditIcon(undefined); setShowEditIconPicker(false); }}
        onClose={() => setShowEditIconPicker(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  separator: { height: 1, backgroundColor: colors.border },
  sectionHeader: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 48,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: typography.heading.weight as "700",
    lineHeight: typography.heading.lineHeight,
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  errorText: {
    fontSize: typography.label.size,
    fontWeight: typography.label.weight as "400",
    lineHeight: typography.label.lineHeight,
    color: colors.danger,
    paddingTop: spacing.xs,
  },
  inlineAdd: { flexDirection: "row", alignItems: "center", marginTop: spacing.sm },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    fontSize: typography.body.size,
    fontWeight: typography.body.weight as "400",
    lineHeight: typography.body.lineHeight,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  inputFocused: { borderColor: colors.accent },
  addButton: { marginLeft: spacing.sm, minWidth: 44, height: 48, justifyContent: "center", alignItems: "center" },
  addButtonText: {
    fontSize: typography.body.size,
    fontWeight: typography.heading.weight as "700",
    lineHeight: typography.body.lineHeight,
    color: colors.accent,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  categoryName: {
    flex: 1,
    fontSize: typography.body.size,
    fontWeight: typography.body.weight as "400",
    lineHeight: typography.body.lineHeight,
    color: colors.textPrimary,
  },
  rowRight: { flexDirection: "row", alignItems: "center" },
  usageCount: {
    fontSize: typography.label.size,
    fontWeight: typography.label.weight as "400",
    lineHeight: typography.label.lineHeight,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  swipeHint: { fontSize: 14, color: colors.textSecondary, marginLeft: spacing.xs },
  swipeAction: { width: 72, justifyContent: "center", alignItems: "center" },
  swipeActionText: {
    fontSize: typography.label.size,
    fontWeight: "600",
    lineHeight: typography.label.lineHeight,
  },
  emptyContainer: { paddingVertical: spacing.xl, alignItems: "center" },
  emptyText: {
    fontSize: typography.body.size,
    fontWeight: typography.body.weight as "400",
    lineHeight: typography.body.lineHeight,
    color: colors.textSecondary,
    textAlign: "center",
  },
  // Edit modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalTitle: {
    fontSize: typography.heading.size,
    fontWeight: typography.heading.weight as "700",
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.label.size,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  iconPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  iconPreviewText: {
    fontSize: typography.label.size,
    color: colors.primary,
    fontWeight: "600",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  cancelBtn: {
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  cancelBtnText: {
    fontSize: typography.body.size,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  saveBtn: {
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: {
    fontSize: typography.body.size,
    fontWeight: "600",
    color: colors.onAccent,
  },
});
