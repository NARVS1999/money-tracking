---
slug: export-pdf-failed-alert
status: resolved
trigger: |
  on export tab, the only problem was when i click the PDF, show Export failed alert
created: 2026-08-09
updated: 2026-08-09
---

# Debug Session: export-pdf-failed-alert

## Symptoms

- Expected: Tapping Export PDF on the Export tab generates the PDF and offers to save/share it.
- Actual: Only an "Export failed" alert appears — nothing is generated.
- Error: Alert message: "couldn't generate the file, check your date range and try again" (no other detail reported).
- Timeline: It never worked — PDF export has never succeeded.
- Reproduction: Fails every time, on any tap of Export PDF (not date-range or data-size dependent).

## Current Focus

- hypothesis: CONFIRMED — exportPDF uses `.default` on dynamic import of `expo-file-system/legacy` which has no default export → `FileSystem` is `undefined` → TypeError when calling `readAsStringAsync`
- test: GREEN — 3 new tests for exportPDF pass; 130/130 total tests pass
- expecting: (passed)
- next_action: complete session — fix applied and verified

## Resolution

- root_cause: |
  `exportPipeline.ts:207` — `(await import("expo-file-system/legacy")).default` resolved to `undefined`
  because `expo-file-system/legacy` only exports named functions (no default export). `FileSystem`
  was `undefined`, causing `TypeError: Cannot read properties of undefined` when calling
  `FileSystem.readAsStringAsync()`. The error was caught by ExportScreen but the toast never
  displayed the actual error message — the body text was hardcoded.
- fix: |
  1. Changed `exportPDF` from dynamic imports to static namespace imports:
     `import * as Print from "expo-print"` and `import * as FileSystem from "expo-file-system/legacy"`.
     This mirrors the pattern already used in `files.ts` and avoids the `.default` accessor.
  2. Fixed ExportScreen toast heading to display `toast.message` instead of hardcoded "Export failed",
     so users can see the actual error if one occurs.
- status: fixed
- tdd: |
  Wrote 3 new tests in `exportPipeline-test.ts` for `exportPDF` (mock setup, HTML content assertion,
  base64 encoding assertion). Test suite: 20/20 in exportPipeline, 130/130 project-wide — all green.
- prevention: |
  why not caught: unit tests for async export functions (exportPDF, exportExcel, exportCSV) did not
  exist — only sync functions were tested. The `.default` bug was in the async path.
  guard: added `exportPDF` unit tests with mocked dependencies that verify the import path
  and data flow (printToFileAsync → readAsStringAsync → saveToFile).

## Evidence

- timestamp: 2026-08-09T00:00:00Z
  source: code-review
  type: code analysis
  finding: |
    **Primary bug** — `exportPipeline.ts` line 207:
    ```ts
    const FileSystem = (await import("expo-file-system/legacy")).default;
    ```
    `expo-file-system/legacy` has NO default export (confirmed by `files.ts` using `import * as FileSystem from "expo-file-system/legacy"` — namespace import pattern). `.default` resolves to `undefined`, so `FileSystem.readAsStringAsync()` throws `TypeError: Cannot read properties of undefined`.

    **Secondary bug** — `ExportScreen.tsx` lines 295-303: toast rendering never uses `toast.message`. The error body is hardcoded `"Couldn't generate the file. Check your date range and try again."` instead of displaying the actual `catch` error. Users can't see the real error message.

- timestamp: 2026-08-09T00:00:00Z
  source: stack-doc
  type: confirmation
  finding: |
    STACK.md confirms `expo-file-system/legacy` is the correct import path for legacy methods (SAF, writeAsStringAsync) in Expo SDK 57. Imports from main `expo-file-system` throw at runtime. The import path is correct — just the `.default` access is wrong.

- timestamp: 2026-08-09T00:00:00Z
  source: test-fix
  type: verification
  finding: |
    TDD cycle complete:
    1. RED: Wrote 3 failing tests for `exportPDF` (mocked expo-print + expo-file-system/legacy)
    2. GREEN: Fixed `exportPipeline.ts:207` — changed from `(await import("expo-file-system/legacy")).default` to static `import * as FileSystem from "expo-file-system/legacy"` + removed `.default`. Also fixed `ExportScreen.tsx:295` toast heading from hardcoded `"Export failed"` to `toast.message` so real errors surface.
    3. REFACTOR: None needed — static imports are cleaner than dynamic imports for these small Expo SDK packages.
    4. Full suite: 130/130 tests pass, 17/17 suites green.

## Eliminated
