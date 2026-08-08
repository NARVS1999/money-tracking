// exportPipeline-test.ts — unit tests for export pipeline functions.
import {
  generateFilename,
  buildPdfHtml,
  buildExcelData,
  buildCsvString,
} from "../exportPipeline";
import { Entry } from "../../entries/EntriesProvider";
import { Category } from "../../categories/CategoriesProvider";

const makeEntry = (overrides: Partial<Entry> = {}): Entry => ({
  id: "e1",
  uid: "u1",
  type: "expense",
  amount: 150000, // ₱ 1,500.00
  categoryId: "cat1",
  date: "2026-08-15",
  description: "Groceries",
  createdAt: { seconds: 0, nanoseconds: 0, toDate: () => new Date() } as any,
  ...overrides,
});

const expenseCategories: Category[] = [
  { id: "cat1", name: "Food", createdAt: { seconds: 0, nanoseconds: 0, toDate: () => new Date() } as any },
  { id: "cat2", name: "Transport", createdAt: { seconds: 0, nanoseconds: 0, toDate: () => new Date() } as any },
];

const incomeCategories: Category[] = [
  { id: "cat3", name: "Salary", createdAt: { seconds: 0, nanoseconds: 0, toDate: () => new Date() } as any },
];

describe("generateFilename", () => {
  it("generates PDF filename", () => {
    expect(generateFilename("2026-08-01", "2026-08-31", "pdf")).toBe(
      "money-tracking-2026-08-01-to-2026-08-31.pdf",
    );
  });

  it("generates Excel filename", () => {
    expect(generateFilename("2026-01-01", "2026-01-31", "xlsx")).toBe(
      "money-tracking-2026-01-01-to-2026-01-31.xlsx",
    );
  });

  it("generates CSV filename", () => {
    expect(generateFilename("2026-03-15", "2026-03-20", "csv")).toBe(
      "money-tracking-2026-03-15-to-2026-03-20.csv",
    );
  });
});

describe("buildPdfHtml", () => {
  it("contains title with date range", () => {
    const html = buildPdfHtml([], [], [], "2026-08-01", "2026-08-31");
    expect(html).toContain("Money Tracking — 2026-08-01 to 2026-08-31");
  });

  it("contains expense and income totals", () => {
    const entries = [
      makeEntry({ type: "expense", amount: 50000 }),
      makeEntry({ id: "e2", type: "income", amount: 100000, categoryId: "cat3" }),
    ];
    const html = buildPdfHtml(entries, expenseCategories, incomeCategories, "2026-08-01", "2026-08-31");
    expect(html).toContain("Total Expense:");
    expect(html).toContain("Total Income:");
    expect(html).toContain("₱ 500.00");
    expect(html).toContain("₱ 1,000.00");
  });

  it("contains entry rows in tbody", () => {
    const entries = [
      makeEntry({ type: "expense", amount: 50000 }),
      makeEntry({ id: "e2", type: "expense", amount: 30000, categoryId: "cat2" }),
      makeEntry({ id: "e3", type: "income", amount: 100000, categoryId: "cat3" }),
    ];
    const html = buildPdfHtml(entries, expenseCategories, incomeCategories, "2026-08-01", "2026-08-31");
    const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
    expect(tbodyMatch).toBeTruthy();
    const tbody = tbodyMatch![1];
    const rowMatches = tbody.match(/<tr>/g);
    expect(rowMatches!.length).toBeGreaterThanOrEqual(3);
  });

  it("contains category names from categoryMap", () => {
    const entries = [
      makeEntry({ categoryId: "cat1" }),
      makeEntry({ id: "e2", categoryId: "cat3", type: "income", amount: 100000 }),
    ];
    const html = buildPdfHtml(entries, expenseCategories, incomeCategories, "2026-08-01", "2026-08-31");
    expect(html).toContain("Food");
    expect(html).toContain("Salary");
  });

  it("shows no-entries message for empty array", () => {
    const html = buildPdfHtml([], [], [], "2026-08-01", "2026-08-31");
    expect(html).toContain("No entries in this range");
  });

  it("contains per-category breakdown with category names and totals", () => {
    const entries = [
      makeEntry({ type: "expense", amount: 50000, categoryId: "cat1" }),
      makeEntry({ id: "e2", type: "expense", amount: 30000, categoryId: "cat1" }),
      makeEntry({ id: "e3", type: "expense", amount: 20000, categoryId: "cat2" }),
    ];
    const html = buildPdfHtml(entries, expenseCategories, incomeCategories, "2026-08-01", "2026-08-31");
    expect(html).toContain("Category Breakdown");
    expect(html).toContain("Food");
    expect(html).toContain("Transport");
    // Food total: 50000 + 30000 = 80000 = ₱ 800.00
    expect(html).toContain("₱ 800.00");
    // Transport total: 20000 = ₱ 200.00
    expect(html).toContain("₱ 200.00");
  });

  it("does not show category breakdown for empty entries", () => {
    const html = buildPdfHtml([], [], [], "2026-08-01", "2026-08-31");
    expect(html).not.toContain("Category Breakdown");
  });

  it("contains entries from multiple categories with correct category names", () => {
    const entries = [
      makeEntry({ categoryId: "cat1", type: "expense", amount: 10000 }),
      makeEntry({ id: "e2", categoryId: "cat2", type: "expense", amount: 20000 }),
      makeEntry({ id: "e3", categoryId: "cat3", type: "income", amount: 100000 }),
    ];
    const html = buildPdfHtml(entries, expenseCategories, incomeCategories, "2026-08-01", "2026-08-31");
    expect(html).toContain("Food");
    expect(html).toContain("Transport");
    expect(html).toContain("Salary");
  });
});

describe("buildExcelData", () => {
  it("returns header row and totals row", () => {
    const data = buildExcelData([], [], [], "2026-08-01", "2026-08-31");
    expect(data[0]).toEqual(["Date", "Type", "Category", "Amount", "Description"]);
    expect(data[data.length - 1][2]).toBe("TOTAL");
  });

  it("includes entry rows between header and totals", () => {
    const entries = [
      makeEntry({ type: "expense", amount: 50000 }),
      makeEntry({ id: "e2", type: "income", amount: 100000, categoryId: "cat3" }),
    ];
    const data = buildExcelData(entries, expenseCategories, incomeCategories, "2026-08-01", "2026-08-31");
    expect(data.length).toBe(4); // header + 2 entries + totals
    expect(data[1][0]).toBe("2026-08-15");
    expect(data[1][1]).toBe("expense");
    expect(data[1][2]).toBe("Food");
  });

  it("formats amounts with formatCents", () => {
    const entries = [makeEntry({ amount: 123456 })];
    const data = buildExcelData(entries, expenseCategories, incomeCategories, "2026-08-01", "2026-08-31");
    expect(data[1][3]).toBe("₱ 1,234.56");
  });
});

describe("buildCsvString", () => {
  it("returns comma-separated values with header", () => {
    const csv = buildCsvString([], [], [], "2026-08-01", "2026-08-31");
    const lines = csv.split("\n");
    expect(lines[0]).toContain("Date");
    expect(lines[0]).toContain("Type");
    expect(lines[0]).toContain("Category");
    expect(lines[0]).toContain("Amount");
    expect(lines[0]).toContain("Description");
  });

  it("includes entry rows and totals", () => {
    const entries = [makeEntry({ type: "expense", amount: 50000 })];
    const csv = buildCsvString(entries, expenseCategories, incomeCategories, "2026-08-01", "2026-08-31");
    const lines = csv.split("\n");
    expect(lines.length).toBe(3); // header + 1 entry + totals
    expect(lines[1]).toContain("2026-08-15");
    expect(lines[2]).toContain("TOTAL");
  });

  it("properly quotes cells with commas", () => {
    const entries = [makeEntry({ description: "Coffee, snacks" })];
    const csv = buildCsvString(entries, expenseCategories, incomeCategories, "2026-08-01", "2026-08-31");
    expect(csv).toContain('"Coffee, snacks"');
  });
});
