// ExportScreen — export financial data to PDF, Excel, or CSV for any date range.
// Date pickers with "This Month" quick-select, format buttons, loading/empty/toast states.
// Also hosts the "Scheduled Entries" section (14-UI-SPEC §3): Expenses/Income
// sub-sections of recurring templates with swipe edit/pause/delete, an
// "Add Scheduled" CTA, a whole-section empty state, and loading/error states.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useEntries } from "../entries/EntriesProvider";
import { useCategories } from "../categories/CategoriesProvider";
import { useScheduledEntries } from "../scheduled/ScheduledEntriesProvider";
import ScheduledEntryRow from "../components/ScheduledEntryRow";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { monthRange, today, compare } from "../lib/dates";
import { colors, spacing, typography, radius, shadow } from "../theme/tokens";
import { exportPDF, exportExcel, exportCSV } from "../lib/exportPipeline";

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

type FormatType = "pdf" | "excel" | "csv";

type ToastState = {
  type: "success" | "error";
  message: string;
  filename?: string;
} | null;

function formatDisplayDate(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return `${SHORT_MONTHS[m - 1]} ${d.toString().padStart(2, "0")}, ${y}`;
}

function toDateObj(yyyyMmDd: string): Date {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export default function ExportScreen() {
  const navigation = useNavigation<NavigationProp<Record<string, object>>>();
  const { entries } = useEntries();
  const { expenseCategories, incomeCategories } = useCategories();
  const {
    scheduledEntries,
    deleteScheduled,
    pauseScheduled,
    resumeScheduled,
    sync: syncScheduled,
    isLoading: scheduledLoading,
    lastError: scheduledError,
  } = useScheduledEntries();

  const initialRange = useMemo(() => monthRange(today()), []);

  const [fromDate, setFromDate] = useState(initialRange.start);
  const [toDate, setToDate] = useState(initialRange.end);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<FormatType | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear toast on new toast
  useEffect(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    if (toast) {
      const delay = toast.type === "success" ? 4000 : 6000;
      toastTimerRef.current = setTimeout(() => setToast(null), delay);
    }
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [toast]);

  // Client-side filter — entries are already cached in EntriesProvider
  const rangeEntries = useMemo(
    () => entries.filter((e) => e.date >= fromDate && e.date <= toDate),
    [entries, fromDate, toDate],
  );

  const isCurrentMonth = useMemo(() => {
    const tr = monthRange(today());
    return fromDate === tr.start && toDate === tr.end;
  }, [fromDate, toDate]);

  const hasValidationError = compare(fromDate, toDate) > 0;
  const isDisabled =
    isExporting || selectedFormat === null || rangeEntries.length === 0 || hasValidationError;

  const handleFromValueChange = useCallback(
    (_event: unknown, date: Date) => {
      setShowFromPicker(false);
      const [y, m, d] = [date.getFullYear(), date.getMonth() + 1, date.getDate()];
      const pad = (n: number) => n.toString().padStart(2, "0");
      setFromDate(`${y}-${pad(m)}-${pad(d)}`);
    },
    [],
  );

  const handleFromDismiss = useCallback(() => {
    setShowFromPicker(false);
  }, []);

  const handleToValueChange = useCallback(
    (_event: unknown, date: Date) => {
      setShowToPicker(false);
      const [y, m, d] = [date.getFullYear(), date.getMonth() + 1, date.getDate()];
      const pad = (n: number) => n.toString().padStart(2, "0");
      setToDate(`${y}-${pad(m)}-${pad(d)}`);
    },
    [],
  );

  const handleToDismiss = useCallback(() => {
    setShowToPicker(false);
  }, []);

  const handleThisMonth = useCallback(() => {
    const range = monthRange(today());
    setFromDate(range.start);
    setToDate(range.end);
  }, []);

  const handleExport = useCallback(async (formatOverride?: FormatType) => {
    const fmt = formatOverride || selectedFormat;
    if (!fmt || rangeEntries.length === 0 || hasValidationError) return;
    setIsExporting(true);
    try {
      const fn =
        fmt === "pdf"
          ? exportPDF
          : fmt === "excel"
            ? exportExcel
            : exportCSV;
      const filename = await fn(
        rangeEntries,
        expenseCategories,
        incomeCategories,
        fromDate,
        toDate,
      );
      setToast({ type: "success", message: "Saved", filename });
    } catch (e) {
      setToast({
        type: "error",
        message: e instanceof Error ? e.message : "Export failed",
      });
    } finally {
      setIsExporting(false);
    }
  }, [
    selectedFormat,
    rangeEntries,
    expenseCategories,
    incomeCategories,
    fromDate,
    toDate,
    hasValidationError,
  ]);

  const handleRetry = useCallback(() => {
    setToast(null);
    handleExport();
  }, [handleExport]);

  // ── Scheduled entries section ──────────────────────────────────────
  // Fixed order: Expenses, then Income (app-wide expenses-first convention).
  const expenseScheduled = useMemo(
    () => scheduledEntries.filter((s) => s.type === "expense"),
    [scheduledEntries],
  );
  const incomeScheduled = useMemo(
    () => scheduledEntries.filter((s) => s.type === "income"),
    [scheduledEntries],
  );

  // "Add Scheduled" gets its type from the sub-section context — expenses
  // first by convention, income when only income templates exist.
  const addType: "expense" | "income" =
    expenseScheduled.length === 0 && incomeScheduled.length > 0
      ? "income"
      : "expense";

  const openAdd = useCallback(() => {
    navigation.navigate("ScheduledEntryForm", { mode: "add", type: addType });
  }, [navigation, addType]);

  const openEdit = useCallback(
    (id: string, type: "expense" | "income") => {
      // CR-02: pass the row's type through — the EntryForm edit navigation
      // pattern (ExpensesScreen/IncomeScreen pass entry.type). The form
      // also derives the type from the stored entry, so both the category
      // list and the save payload are correct regardless of the caller.
      navigation.navigate("ScheduledEntryForm", { mode: "edit", id, type });
    },
    [navigation],
  );

  // Provider failures surface through lastError (auto-clears after 5s) — the
  // section shows the inline load-error block; never an unhandled rejection.
  const handleDeleteScheduled = useCallback(
    async (id: string) => {
      try {
        await deleteScheduled(id);
      } catch {
        // Surfaced via scheduledError.
      }
    },
    [deleteScheduled],
  );

  const handleTogglePause = useCallback(
    async (entry: {
      id: string;
      isActive: boolean;
    }) => {
      try {
        if (entry.isActive) {
          await pauseScheduled(entry.id);
        } else {
          await resumeScheduled(entry.id);
        }
      } catch {
        // Surfaced via scheduledError.
      }
    },
    [pauseScheduled, resumeScheduled],
  );

  const handleScheduledRetry = useCallback(() => {
    syncScheduled().catch(() => {
      // Surfaced via scheduledError.
    });
  }, [syncScheduled]);

  const fromMaxDate = useMemo(() => {
    const toD = toDateObj(toDate);
    const now = new Date();
    return toD < now ? toD : now;
  }, [toDate]);

  const toMinDate = useMemo(() => toDateObj(fromDate), [fromDate]);

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
      >
        <Text style={styles.heading}>Export</Text>

        {/* From date picker card */}
        <TouchableOpacity
          style={styles.dateCard}
          onPress={() => setShowFromPicker(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.dateLabel}>From</Text>
          <Text style={styles.dateValue}>{formatDisplayDate(fromDate)}</Text>
        </TouchableOpacity>
        {showFromPicker && (
          <DateTimePicker
            value={toDateObj(fromDate)}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            maximumDate={fromMaxDate}
            onValueChange={handleFromValueChange}
            onDismiss={handleFromDismiss}
          />
        )}

        {/* To date picker card */}
        <TouchableOpacity
          style={styles.dateCard}
          onPress={() => setShowToPicker(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.dateLabel}>To</Text>
          <Text style={styles.dateValue}>{formatDisplayDate(toDate)}</Text>
        </TouchableOpacity>
        {showToPicker && (
          <DateTimePicker
            value={toDateObj(toDate)}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            minimumDate={toMinDate}
            maximumDate={new Date()}
            onValueChange={handleToValueChange}
            onDismiss={handleToDismiss}
          />
        )}

        {/* Date validation error */}
        {hasValidationError && (
          <Text style={styles.validationError}>
            End date must be after start date
          </Text>
        )}

        {/* This Month button */}
        <TouchableOpacity
          style={[
            styles.thisMonthBtn,
            isCurrentMonth && styles.thisMonthBtnActive,
          ]}
          onPress={handleThisMonth}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.thisMonthText,
              isCurrentMonth && styles.thisMonthTextActive,
            ]}
          >
            This Month
          </Text>
        </TouchableOpacity>

        {/* Separator */}
        <View style={styles.separator} />

        {/* Format buttons */}
        <View style={styles.formatRow}>
          {(["pdf", "excel", "csv"] as FormatType[]).map((fmt) => {
            const isActive = selectedFormat === fmt;
            return (
              <TouchableOpacity
                key={fmt}
                style={[
                  styles.formatBtn,
                  isActive && styles.formatBtnActive,
                  isExporting && styles.formatBtnDisabled,
                ]}
                onPress={() => {
                  setSelectedFormat(fmt);
                  // Trigger export immediately on tap with the selected format
                  handleExport(fmt);
                }}
                disabled={isExporting || hasValidationError || rangeEntries.length === 0}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.formatText,
                    isActive && styles.formatTextActive,
                  ]}
                >
                  {fmt === "pdf" ? "PDF" : fmt === "excel" ? "Excel" : "CSV"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Loading state */}
        {isExporting && (
          <Text style={styles.loadingText}>Generating…</Text>
        )}

        {/* Empty state */}
        {!isExporting && rangeEntries.length === 0 && (
          <Text style={styles.emptyText}>No entries in this range</Text>
        )}

        {/* ── Scheduled Entries section (14-UI-SPEC §3) ─────────────── */}
        <View style={styles.separator} />
        <View style={styles.scheduledHeader}>
          <Text style={styles.scheduledTitle}>Scheduled Entries</Text>
          <TouchableOpacity
            style={styles.addScheduledBtn}
            onPress={openAdd}
            activeOpacity={0.7}
          >
            <Text style={styles.addScheduledText}>Add Scheduled</Text>
          </TouchableOpacity>
        </View>

        {scheduledLoading ? (
          <LoadingSkeleton />
        ) : scheduledError ? (
          <View style={styles.scheduledErrorBlock}>
            <Text style={styles.scheduledErrorText}>
              {"Couldn't load scheduled entries."}
            </Text>
            <TouchableOpacity onPress={handleScheduledRetry}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : expenseScheduled.length === 0 && incomeScheduled.length === 0 ? (
          <View style={styles.scheduledEmpty}>
            <Text style={styles.scheduledEmptyHeading}>
              No scheduled entries yet
            </Text>
            <Text style={styles.scheduledEmptyBody}>
              Add one to auto-generate recurring expenses or income.
            </Text>
          </View>
        ) : (
          <>
            {expenseScheduled.length > 0 && (
              <View style={styles.scheduledGroup}>
                <Text style={styles.subHeading}>Expenses</Text>
                <View style={styles.scheduledCard}>
                  {expenseScheduled.map((s, index) => (
                    <ScheduledEntryRow
                      key={s.id}
                      entry={s}
                      isLast={index === expenseScheduled.length - 1}
                      onEdit={() => openEdit(s.id, s.type)}
                      onDelete={handleDeleteScheduled}
                      onTogglePause={handleTogglePause}
                    />
                  ))}
                </View>
              </View>
            )}
            {incomeScheduled.length > 0 && (
              <View style={styles.scheduledGroup}>
                <Text style={styles.subHeading}>Income</Text>
                <View style={styles.scheduledCard}>
                  {incomeScheduled.map((s, index) => (
                    <ScheduledEntryRow
                      key={s.id}
                      entry={s}
                      isLast={index === incomeScheduled.length - 1}
                      onEdit={() => openEdit(s.id, s.type)}
                      onDelete={handleDeleteScheduled}
                      onTogglePause={handleTogglePause}
                    />
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Toast overlay */}
      {toast && (
        <View style={styles.toastOverlay}>
          <View style={styles.toast}>
            <Text style={toast.type === "success" ? styles.toastIconSuccess : styles.toastIconError}>
              {toast.type === "success" ? "✓" : "✕"}
            </Text>
            <View style={styles.toastContent}>
              <Text style={styles.toastHeading}>
                {toast.type === "success" ? "Saved" : toast.message}
              </Text>
              <Text style={styles.toastBody}>
                {toast.type === "success"
                  ? toast.filename || ""
                  : "Couldn't generate the file. Check your date range and try again."}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.toastAction}
              onPress={() => {
                if (toast.type === "success") {
                  setToast(null);
                } else {
                  handleRetry();
                }
              }}
            >
              <Text style={styles.toastActionText}>
                {toast.type === "success" ? "Dismiss" : "Retry"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  heading: {
    fontSize: typography.heading.size,
    fontWeight: typography.heading.weight as "700",
    lineHeight: typography.heading.lineHeight,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  // Date picker cards
  dateCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  dateLabel: {
    fontSize: typography.label.size,
    fontWeight: typography.label.weight as "400",
    lineHeight: typography.label.lineHeight,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  dateValue: {
    fontSize: typography.body.size,
    fontWeight: typography.body.weight as "400",
    lineHeight: typography.body.lineHeight,
    color: colors.textPrimary,
  },
  // Validation error
  validationError: {
    fontSize: typography.label.size,
    fontWeight: typography.label.weight as "400",
    lineHeight: typography.label.lineHeight,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  // This Month button
  thisMonthBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
    justifyContent: "center",
    alignSelf: "flex-start",
    marginBottom: spacing.md,
  },
  thisMonthBtnActive: {
    borderColor: colors.accent,
  },
  thisMonthText: {
    fontSize: typography.body.size,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  thisMonthTextActive: {
    color: colors.accent,
  },
  // Separator
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  // Format buttons
  formatRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  formatBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  formatBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  formatBtnDisabled: {
    opacity: 0.5,
  },
  formatText: {
    fontSize: typography.body.size,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  formatTextActive: {
    color: colors.onAccent,
  },
  // Loading
  loadingText: {
    fontSize: typography.label.size,
    fontWeight: typography.label.weight as "400",
    lineHeight: typography.label.lineHeight,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.md,
  },
  // Empty state
  emptyText: {
    fontSize: typography.label.size,
    fontWeight: typography.label.weight as "400",
    lineHeight: typography.label.lineHeight,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.md,
  },
  // ── Scheduled Entries section ─────────────────────────────────────
  scheduledHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  scheduledTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  addScheduledBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    minHeight: 44,
    justifyContent: "center",
  },
  addScheduledText: {
    fontSize: typography.body.size,
    fontWeight: "700",
    color: colors.onAccent,
  },
  scheduledGroup: {
    marginBottom: spacing.md,
  },
  subHeading: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },
  scheduledCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: "hidden",
    ...shadow.surface,
  },
  scheduledErrorBlock: {
    alignItems: "flex-start",
    paddingVertical: spacing.md,
  },
  scheduledErrorText: {
    fontSize: typography.label.size,
    fontWeight: typography.label.weight as "400",
    lineHeight: typography.label.lineHeight,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  retryText: {
    fontSize: typography.body.size,
    fontWeight: "700",
    color: colors.accent,
  },
  // Whole-section empty state (both types zero) — centered block; the header
  // Add Scheduled button is the CTA.
  scheduledEmpty: {
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },
  scheduledEmptyHeading: {
    fontSize: typography.heading.size,
    fontWeight: typography.heading.weight as "700",
    lineHeight: typography.heading.lineHeight,
    color: colors.textPrimary,
    textAlign: "center",
  },
  scheduledEmptyBody: {
    fontSize: typography.label.size,
    fontWeight: typography.label.weight as "400",
    lineHeight: typography.label.lineHeight,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  // Toast
  toastOverlay: {
    position: "absolute",
    top: spacing.xl,
    left: spacing.md,
    right: spacing.md,
    zIndex: 1000,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  toastIconSuccess: {
    fontSize: 20,
    color: colors.income,
    marginRight: spacing.sm,
    fontWeight: "700",
  },
  toastIconError: {
    fontSize: 20,
    color: colors.danger,
    marginRight: spacing.sm,
    fontWeight: "700",
  },
  toastContent: {
    flex: 1,
  },
  toastHeading: {
    fontSize: typography.body.size,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  toastBody: {
    fontSize: typography.label.size,
    fontWeight: typography.label.weight as "400",
    lineHeight: typography.label.lineHeight,
    color: colors.textSecondary,
    marginTop: 2,
  },
  toastAction: {
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  toastActionText: {
    fontSize: typography.body.size,
    fontWeight: "600",
    color: colors.accent,
  },
});
