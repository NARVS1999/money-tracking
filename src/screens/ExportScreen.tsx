// ExportScreen — export financial data to PDF, Excel, or CSV for any date range.
// Date pickers with "This Month" quick-select, format buttons, loading/empty/toast states.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useEntries } from "../entries/EntriesProvider";
import { useCategories } from "../categories/CategoriesProvider";
import { monthRange, today, compare } from "../lib/dates";
import { colors, spacing, typography, radius } from "../theme/tokens";
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
  const { entries } = useEntries();
  const { expenseCategories, incomeCategories } = useCategories();

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

  const handleFromChange = useCallback(
    (_event: DateTimePickerEvent, date?: Date) => {
      setShowFromPicker(false);
      if (date) {
        const [y, m, d] = [date.getFullYear(), date.getMonth() + 1, date.getDate()];
        const pad = (n: number) => n.toString().padStart(2, "0");
        setFromDate(`${y}-${pad(m)}-${pad(d)}`);
      }
    },
    [],
  );

  const handleToChange = useCallback(
    (_event: DateTimePickerEvent, date?: Date) => {
      setShowToPicker(false);
      if (date) {
        const [y, m, d] = [date.getFullYear(), date.getMonth() + 1, date.getDate()];
        const pad = (n: number) => n.toString().padStart(2, "0");
        setToDate(`${y}-${pad(m)}-${pad(d)}`);
      }
    },
    [],
  );

  const handleThisMonth = useCallback(() => {
    const range = monthRange(today());
    setFromDate(range.start);
    setToDate(range.end);
  }, []);

  const handleExport = useCallback(async () => {
    if (!selectedFormat || rangeEntries.length === 0 || hasValidationError) return;
    setIsExporting(true);
    try {
      const fn =
        selectedFormat === "pdf"
          ? exportPDF
          : selectedFormat === "excel"
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
            onChange={handleFromChange}
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
            onChange={handleToChange}
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
                  // Trigger export immediately on tap
                  if (!isExporting && !hasValidationError && rangeEntries.length > 0) {
                    setSelectedFormat(fmt);
                    setIsExporting(true);
                    const fn =
                      fmt === "pdf"
                        ? exportPDF
                        : fmt === "excel"
                          ? exportExcel
                          : exportCSV;
                    fn(rangeEntries, expenseCategories, incomeCategories, fromDate, toDate)
                      .then((filename) =>
                        setToast({ type: "success", message: "Saved", filename }),
                      )
                      .catch((e) =>
                        setToast({
                          type: "error",
                          message: e instanceof Error ? e.message : "Export failed",
                        }),
                      )
                      .finally(() => setIsExporting(false));
                  }
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
                {toast.type === "success" ? "Saved" : "Export failed"}
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
                  // Open action — placeholder for now
                  setToast(null);
                } else {
                  handleRetry();
                }
              }}
            >
              <Text style={styles.toastActionText}>
                {toast.type === "success" ? "Open" : "Retry"}
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
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
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
    borderRadius: radius.sm,
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
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
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
