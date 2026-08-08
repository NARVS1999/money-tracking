// exportPipeline.ts — export financial data to PDF, Excel, or CSV.
// PDF: HTML → expo-print → cache → saveToFile.
// Excel/CSV: stubs (implemented in Plan 05-03).
import { Entry } from "../entries/EntriesProvider";
import { Category } from "../categories/CategoriesProvider";
import { formatCents } from "./money";
import { saveToFile } from "./files";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function generateFilename(
  start: string,
  end: string,
  ext: string,
): string {
  return `money-tracking-${start}-to-${end}.${ext}`;
}

export function buildPdfHtml(
  entries: Entry[],
  expenseCategories: Category[],
  incomeCategories: Category[],
  fromDate: string,
  toDate: string,
): string {
  const expenseTotal = entries
    .filter((e) => e.type === "expense")
    .reduce((s, e) => s + e.amount, 0);
  const incomeTotal = entries
    .filter((e) => e.type === "income")
    .reduce((s, e) => s + e.amount, 0);

  const categoryMap = new Map<string, string>();
  [...expenseCategories, ...incomeCategories].forEach((c) =>
    categoryMap.set(c.id, c.name),
  );

  const entryRows = entries
    .map(
      (e) => `
    <tr>
      <td>${e.date}</td>
      <td>${e.type}</td>
      <td>${escapeHtml(categoryMap.get(e.categoryId) || "Unknown")}</td>
      <td style="color: ${e.type === "income" ? "#16A34A" : "#DC2626"}">${formatCents(e.amount)}</td>
      <td>${escapeHtml(e.description || "")}</td>
    </tr>`,
    )
    .join("");

  // Per-category breakdown
  const categoryTotals = new Map<string, { name: string; total: number; count: number }>();
  entries.forEach((e) => {
    const name = categoryMap.get(e.categoryId) || "Unknown";
    const existing = categoryTotals.get(e.categoryId);
    if (existing) {
      existing.total += e.amount;
      existing.count += 1;
    } else {
      categoryTotals.set(e.categoryId, { name, total: e.amount, count: 1 });
    }
  });
  const sortedCategories = Array.from(categoryTotals.values()).sort(
    (a, b) => b.total - a.total,
  );
  const categoryBreakdownRows = sortedCategories
    .map(
      (c) => `
    <tr>
      <td>${escapeHtml(c.name)}</td>
      <td style="text-align:right">${c.count}</td>
      <td style="text-align:right; color: #1A1A1A">${formatCents(c.total)}</td>
    </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { size: A4 landscape; margin: 1cm; }
    body { font-family: -apple-system, sans-serif; font-size: 12px; color: #1A1A1A; }
    h1 { font-size: 18px; margin-bottom: 8px; }
    h2 { font-size: 14px; margin-top: 16px; margin-bottom: 8px; }
    .summary { margin-bottom: 16px; }
    .summary span { margin-right: 24px; }
    .expense { color: #DC2626; }
    .income { color: #16A34A; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #E5E7EB; padding: 6px 8px; text-align: left; }
    th { background: #F7F7F8; font-weight: 600; }
  </style>
</head>
<body>
  <h1>Money Tracking — ${fromDate} to ${toDate}</h1>
  <div class="summary">
    <span class="expense">Total Expense: ${formatCents(expenseTotal)}</span>
    <span class="income">Total Income: ${formatCents(incomeTotal)}</span>
  </div>
  ${sortedCategories.length > 0 ? `
  <h2>Category Breakdown</h2>
  <table>
    <thead>
      <tr><th>Category</th><th style="text-align:right">Count</th><th style="text-align:right">Total</th></tr>
    </thead>
    <tbody>
      ${categoryBreakdownRows}
    </tbody>
  </table>
  ` : ""}
  <h2>Entries</h2>
  <table>
    <thead>
      <tr><th>Date</th><th>Type</th><th>Category</th><th>Amount</th><th>Description</th></tr>
    </thead>
    <tbody>
      ${entryRows || '<tr><td colspan="5" style="text-align:center">No entries in this range</td></tr>'}
    </tbody>
  </table>
</body>
</html>`;
}

export function buildExcelData(
  entries: Entry[],
  expenseCategories: Category[],
  incomeCategories: Category[],
  fromDate: string,
  toDate: string,
): string[][] {
  const categoryMap = new Map<string, string>();
  [...expenseCategories, ...incomeCategories].forEach((c) =>
    categoryMap.set(c.id, c.name),
  );

  const expenseTotal = entries
    .filter((e) => e.type === "expense")
    .reduce((s, e) => s + e.amount, 0);
  const incomeTotal = entries
    .filter((e) => e.type === "income")
    .reduce((s, e) => s + e.amount, 0);

  const header = ["Date", "Type", "Category", "Amount", "Description"];
  const rows = entries.map((e) => [
    e.date,
    e.type,
    categoryMap.get(e.categoryId) || "Unknown",
    formatCents(e.amount),
    e.description || "",
  ]);
  const totals = [
    "",
    "",
    "TOTAL",
    `Expense: ${formatCents(expenseTotal)} / Income: ${formatCents(incomeTotal)}`,
    "",
  ];

  return [header, ...rows, totals];
}

export function buildCsvString(
  entries: Entry[],
  expenseCategories: Category[],
  incomeCategories: Category[],
  fromDate: string,
  toDate: string,
): string {
  const data = buildExcelData(
    entries,
    expenseCategories,
    incomeCategories,
    fromDate,
    toDate,
  );
  return data
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
}

export async function exportPDF(
  entries: Entry[],
  expenseCategories: Category[],
  incomeCategories: Category[],
  fromDate: string,
  toDate: string,
): Promise<string> {
  const html = buildPdfHtml(
    entries,
    expenseCategories,
    incomeCategories,
    fromDate,
    toDate,
  );
  const Print = await import("expo-print");
  const { uri } = await Print.printToFileAsync({ html });
  const filename = generateFilename(fromDate, toDate, "pdf");
  const FileSystem = (await import("expo-file-system/legacy")).default;
  const content = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await saveToFile(content, filename, "base64");
  return filename;
}

export async function exportExcel(
  entries: Entry[],
  expenseCategories: Category[],
  incomeCategories: Category[],
  fromDate: string,
  toDate: string,
): Promise<string> {
  const XLSX = await import("xlsx");
  const data = buildExcelData(
    entries,
    expenseCategories,
    incomeCategories,
    fromDate,
    toDate,
  );
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths for readability
  ws["!cols"] = [
    { wch: 12 }, // Date
    { wch: 8 }, // Type
    { wch: 15 }, // Category
    { wch: 15 }, // Amount
    { wch: 30 }, // Description
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Entries");
  const base64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
  const filename = generateFilename(fromDate, toDate, "xlsx");
  await saveToFile(base64, filename, "base64");
  return filename;
}

export async function exportCSV(
  entries: Entry[],
  expenseCategories: Category[],
  incomeCategories: Category[],
  fromDate: string,
  toDate: string,
): Promise<string> {
  const XLSX = await import("xlsx");
  const data = buildExcelData(
    entries,
    expenseCategories,
    incomeCategories,
    fromDate,
    toDate,
  );
  const ws = XLSX.utils.aoa_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const filename = generateFilename(fromDate, toDate, "csv");
  await saveToFile(csv, filename, "utf8");
  return filename;
}
