// In-memory expo-sqlite mock for jest (phase 11 add-tests).
// Real SQLite native module is unavailable under jest-expo in Node, so this
// mock emulates the small SQL surface the src/db modules use:
//   - execAsync: no-op (schema DDL)
//   - runAsync: INSERT / UPDATE / DELETE with "col = ?" predicates
//   - getAllAsync / getFirstAsync: SELECT with WHERE (AND "col = ?") and
//     ORDER BY key[, key] [DESC]
//   - withTransactionAsync: snapshot/restore rollback on error
// The store is shared across connections (like a real database file), so
// openDatabaseAsync() returns a fresh handle to the same tables. Call
// resetSqliteMock() in beforeEach to clear tables + mock history.
//
// Fidelity notes:
//   - PRIMARY KEY conflicts throw "PRIMARY KEY constraint failed: <table>"
//     (the seed tolerates exactly this error shape).
//   - syncQueue.id is AUTOINCREMENT (1-based, monotonic).
//   - Binding `undefined` throws, matching expo-sqlite's SQLiteBindValue
//     rejection (see IN-04 in 11-REVIEW.md).
import type { SQLiteDatabase } from "expo-sqlite";

type Row = Record<string, unknown>;

type Table = { autoincrement: boolean; rows: Row[] };

const tables: Record<string, Table> = {
  entries: { autoincrement: false, rows: [] },
  categories: { autoincrement: false, rows: [] },
  scheduledEntries: { autoincrement: false, rows: [] },
  syncQueue: { autoincrement: true, rows: [] },
  syncMeta: { autoincrement: false, rows: [] },
};

function nextAutoincrement(table: Table): number {
  const max = table.rows.reduce((m, r) => Math.max(m, (r.id as number) ?? 0), 0);
  return max + 1;
}

function pkConflict(table: string): Error {
  return new Error(`SQLITE_CONSTRAINT: PRIMARY KEY constraint failed: ${table}`);
}

function bindError(value: unknown): Error {
  return new Error(`SQLiteBindValue: ${String(value)} is not a valid bind value`);
}

// Parses the value side of a SET/WHERE clause: "?" (bind param consumed in
// order) or a literal (number, 'string', null — used by markSynced's
// `synced = 1`).
function parseValue(
  sql: string,
  params: unknown[],
  index: number,
): { value: unknown; consumed: number } {
  if (sql === "?") {
    const value = params[index];
    if (value === undefined) throw bindError(value);
    return { value, consumed: 1 };
  }
  if (/^-?\d+(\.\d+)?$/.test(sql)) return { value: Number(sql), consumed: 0 };
  if (/^'(.*)'$/.test(sql)) return { value: sql.slice(1, -1), consumed: 0 };
  if (sql === "null") return { value: null, consumed: 0 };
  throw new Error(`sqlite-mock: unsupported value "${sql}"`);
}

// Queue of execAsync failures for the NEXT call — lets tests simulate a
// schema-execution failure on first open (database.ts failure-reset path).
const execAsyncFailures: Error[] = [];

export function failNextExecAsync(error: Error): void {
  execAsyncFailures.push(error);
}

type Predicate = { column: string; value: unknown };

// Materializes WHERE predicates ("col = ?" or "col = <literal>") against the
// params array, consuming bind values in order of appearance.
function parseWhere(whereSql: string, params: unknown[], start: number): Predicate[] {
  const preds: Predicate[] = [];
  for (const pred of whereSql.split(/\s+AND\s+/i)) {
    const s = pred.trim();
    if (!s) continue;
    const m = /^(\w+)\s*=\s*(.+)$/.exec(s);
    if (!m) throw new Error(`sqlite-mock: unsupported WHERE predicate "${s}"`);
    const { value, consumed } = parseValue(m[2], params, start);
    start += consumed;
    preds.push({ column: m[1], value });
  }
  return preds;
}

function matches(row: Row, preds: Predicate[]): boolean {
  return preds.every((p) => row[p.column] === p.value);
}

function orderRows(sql: string, rows: Row[]): Row[] {
  const m = /ORDER BY (.+)$/i.exec(sql);
  if (!m) return rows;
  const keys = m[1]
    .split(",")
    .map((s) => s.trim().split(/\s+/))
    .map((parts) => ({ key: parts[0], desc: /^desc$/i.test(parts[1] ?? "") }));
  const sorted = [...rows];
  sorted.sort((a, b) => {
    for (const { key, desc } of keys) {
      const av = a[key] ?? "";
      const bv = b[key] ?? "";
      let cmp = av < bv ? -1 : av > bv ? 1 : 0;
      if (desc) cmp = -cmp;
      if (cmp !== 0) return cmp;
    }
    return 0;
  });
  return sorted;
}

function runSql(sql: string, rawParams: unknown[]): { lastInsertRowId: number; changes: number } {
  // The CRUD update functions pass params as a single array argument.
  const params =
    rawParams.length === 1 && Array.isArray(rawParams[0]) ? (rawParams[0] as unknown[]) : rawParams;

  const insert = /INSERT INTO (\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]*)\)/i.exec(sql);
  if (insert) {
    const table = tables[insert[1]];
    if (!table) throw new Error(`sqlite-mock: unknown table ${insert[1]}`);
    const cols = insert[2]
      .split(",")
      .map((s) => s.trim());
    const placeholders = insert[3]
      .split(",")
      .map((s) => s.trim());
    if (placeholders.some((p) => p !== "?")) {
      throw new Error(`sqlite-mock: only literal "?" VALUES are supported`);
    }
    const row: Row = {};
    let autoId = 0;
    cols.forEach((col, i) => {
      const value = params[i];
      if (value === undefined) throw bindError(value);
      if (col === "id" && table.autoincrement && value === null) {
        // not used by src/db; keep simple
      }
      row[col] = value;
    });
    if (!("id" in row)) {
      if (!table.autoincrement) {
        throw new Error(`sqlite-mock: ${insert[1]} requires an id column`);
      }
      autoId = nextAutoincrement(table);
      row.id = autoId;
    } else if (table.rows.some((r) => r.id === row.id)) {
      throw pkConflict(insert[1]);
    }
    table.rows.push(row);
    return { lastInsertRowId: autoId || (row.id as number), changes: 1 };
  }

  const update = /UPDATE (\w+) SET (.+?)(?:\s+WHERE (.+))?$/i.exec(sql);
  if (update) {
    const table = tables[update[1]];
    if (!table) throw new Error(`sqlite-mock: unknown table ${update[1]}`);
    let index = 0;
    const setValues = update[2].split(",").map((s) => {
      const m = /^(\w+)\s*=\s*(.+)$/.exec(s.trim());
      if (!m) throw new Error(`sqlite-mock: unsupported SET clause "${s.trim()}"`);
      const { value, consumed } = parseValue(m[2], params, index);
      index += consumed;
      return { col: m[1], value };
    });
    const wherePreds = update[3] ? parseWhere(update[3], params, index) : [];
    for (const row of table.rows) {
      if (matches(row, wherePreds)) {
        for (const { col, value } of setValues) row[col] = value;
      }
    }
    return { lastInsertRowId: 0, changes: 0 };
  }

  const del = /DELETE FROM (\w+)(?:\s+WHERE (.+))?$/i.exec(sql);
  if (del) {
    const table = tables[del[1]];
    if (!table) throw new Error(`sqlite-mock: unknown table ${del[1]}`);
    const wherePreds = del[2] ? parseWhere(del[2], params, 0) : [];
    const before = table.rows.length;
    table.rows = table.rows.filter((row) => !matches(row, wherePreds));
    return { lastInsertRowId: 0, changes: before - table.rows.length };
  }

  throw new Error(`sqlite-mock: unsupported SQL "${sql.slice(0, 80)}..."`);
}

function selectSql(sql: string, params: unknown[], firstOnly: boolean): unknown {
  // database.ts migration queries (schema v2). The mock pretends the store is
  // always at v1 with no updatedAt columns, so every fresh connection runs
  // the ALTER path — which execAsync no-ops — exercising the migration code.
  if (/^PRAGMA user_version/i.test(sql)) {
    return firstOnly ? { user_version: 0 } : [{ user_version: 0 }];
  }
  if (/^PRAGMA table_info\((\w+)\)/i.test(sql)) {
    return firstOnly ? { name: "id" } : [{ name: "id" }];
  }
  const m =
    /SELECT (COUNT\(\*\) AS \w+|\*|[\w.]+) FROM (\w+)(?:\s+WHERE (.+?))?(?:\s+ORDER BY (.+))?$/i.exec(
      sql,
    );
  if (!m) throw new Error(`sqlite-mock: unsupported SELECT "${sql.slice(0, 80)}..."`);
  const table = tables[m[2]];
  if (!table) throw new Error(`sqlite-mock: unknown table ${m[2]}`);
  const wherePreds = m[3] ? parseWhere(m[3], params, 0) : [];
  const filtered = table.rows.filter((row) => matches(row, wherePreds));
  if (/^COUNT\(\*\)/i.test(m[1].trim())) {
    return firstOnly ? { c: filtered.length } : [{ c: filtered.length }];
  }
  const ordered = orderRows(sql, filtered).map((row) => ({ ...row }));
  return firstOnly ? ordered[0] ?? null : ordered;
}

function openDatabaseAsyncImpl(name: string): Promise<SQLiteDatabase> {
  const db = {
    execAsync: jest.fn(async (_sql: string) => {
      const failure = execAsyncFailures.shift();
      if (failure) throw failure;
      // Schema DDL — tables already exist in the mock store; nothing to do.
      return undefined;
    }),
    runAsync: jest.fn(async (sql: string, ...args: unknown[]) => runSql(sql, args)),
    getAllAsync: jest.fn(async (sql: string, ...args: unknown[]) =>
      selectSql(sql, args, false),
    ) as unknown as SQLiteDatabase["getAllAsync"],
    getFirstAsync: jest.fn(async (sql: string, ...args: unknown[]) =>
      selectSql(sql, args, true),
    ) as unknown as SQLiteDatabase["getFirstAsync"],
    withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => {
      const snapshot = JSON.stringify(tables);
      try {
        await fn();
      } catch (e) {
        for (const key of Object.keys(tables)) {
          tables[key].rows = [];
        }
        const restored = JSON.parse(snapshot) as Record<string, Row[]>;
        for (const key of Object.keys(restored)) {
          if (tables[key]) tables[key].rows = restored[key];
          else tables[key] = { autoincrement: key === "syncQueue", rows: restored[key] };
        }
        throw e;
      }
    }),
  };
  return Promise.resolve(db as unknown as SQLiteDatabase);
}

export const openDatabaseAsync = jest.fn().mockImplementation((name: string) =>
  openDatabaseAsyncImpl(name),
);

// Clear all tables and restore the default openDatabaseAsync implementation.
export function resetSqliteMock(): void {
  for (const table of Object.values(tables)) table.rows = [];
  execAsyncFailures.length = 0;
  openDatabaseAsync.mockReset();
  openDatabaseAsync.mockImplementation((name: string) => openDatabaseAsyncImpl(name));
}

export { tables as sqliteMockTables };
