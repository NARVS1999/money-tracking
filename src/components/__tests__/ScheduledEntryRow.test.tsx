// ScheduledEntryRow component tests (phase 14, SCHD-UI-01/03/04). Covers the
// row content contract (description || category name primary line, frequency
// + next-date secondary, "once" without a "Next:" prefix, colored tabular
// amount), the paused state (grey "Paused" badge, no next date), the swipe
// action labels (Edit teal / Pause-Resume neutral / Delete danger), and the
// interaction wiring (tap -> onEdit, Pause/Resume immediate, Delete behind an
// Alert confirmation).
import React from "react";
import { Alert, Text, TouchableOpacity } from "react-native";
import renderer, { act } from "react-test-renderer";

// ── Mock: @expo/vector-icons (CategoryIcon renders through it) ────────────
jest.mock("@expo/vector-icons", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactMod = require("react");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RN = require("react-native");
  return {
    Ionicons: (props: any) => ReactMod.createElement(RN.Text, props, "icon"),
  };
});

// ── Mock: CategoriesProvider (category lookup for the row) ─────────────────
let mockCategories: any = {};

jest.mock("../../categories/CategoriesProvider", () => ({
  useCategories: () => mockCategories,
}));

// ── Subject under test ─────────────────────────────────────────────────────
import ScheduledEntryRow from "../ScheduledEntryRow";
import type { ScheduledEntry } from "../../scheduled/ScheduledEntriesProvider";
import { Timestamp } from "firebase/firestore";

const ts = new Timestamp(1_700_000_000, 0);

function makeEntry(overrides: Partial<ScheduledEntry> = {}): ScheduledEntry {
  return {
    id: "s1",
    uid: "user-1",
    type: "expense",
    amount: 12345,
    categoryId: "cat-1",
    date: "2026-08-12",
    description: "Rent",
    frequency: "weekly",
    endDate: null,
    lastGenerated: null,
    isActive: true,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

function texts(root: any): string[] {
  return root.root
    .findAllByType(Text)
    .map((t: any) => t.props.children)
    .filter(
      (c: unknown) =>
        typeof c === "string" && c !== "icon" && c.trim().length > 0,
    );
}

// The TouchableOpacity whose subtree contains the given label text.
function pressableWithText(root: any, label: string): any {
  return root.root
    .findAllByType(TouchableOpacity)
    .find((t: any) => {
      const inner = textsFromInstance(t);
      return inner.includes(label);
    });
}

function textsFromInstance(instance: any): string[] {
  const found: string[] = [];
  const walk = (node: any) => {
    if (node.props?.children !== undefined && typeof node.props.children === "string") {
      found.push(node.props.children);
    }
    if (node.children) node.children.forEach(walk);
  };
  walk(instance);
  return found;
}

beforeEach(() => {
  jest.clearAllMocks();
  // Fixed clock at 2026-08-12 — the WR-01 clamp anchors "Next:" to today,
  // so every date expectation must be deterministic (repo pattern:
  // syncQueue-test / seed-test useFakeTimers).
  jest.useFakeTimers({ now: new Date(2026, 7, 12) });
  mockCategories = {
    expenseCategories: [
      { id: "cat-1", name: "Housing", createdAt: ts },
      { id: "cat-2", name: "Food", createdAt: ts },
    ],
    incomeCategories: [],
  };
});

afterEach(() => {
  jest.useRealTimers();
});

describe("ScheduledEntryRow content", () => {
  it("shows the description as the primary line when present", () => {
    let root: any;
    act(() => {
      root = renderer.create(
        <ScheduledEntryRow
          entry={makeEntry()}
          onEdit={jest.fn()}
          onDelete={jest.fn()}
          onTogglePause={jest.fn()}
        />,
      );
    });
    expect(texts(root)).toContain("Rent");
  });

  it("falls back to the category name when the description is empty", () => {
    let root: any;
    act(() => {
      root = renderer.create(
        <ScheduledEntryRow
          entry={makeEntry({ description: "" })}
          onEdit={jest.fn()}
          onDelete={jest.fn()}
          onTogglePause={jest.fn()}
        />,
      );
    });
    expect(texts(root)).toContain("Housing");
  });

  it("shows 'Weekly · Next: Aug 19' for an active weekly template", () => {
    let root: any;
    act(() => {
      root = renderer.create(
        <ScheduledEntryRow
          entry={makeEntry()}
          onEdit={jest.fn()}
          onDelete={jest.fn()}
          onTogglePause={jest.fn()}
        />,
      );
    });
    expect(texts(root)).toContain("Weekly · Next: Aug 19");
  });

  it("anchors 'Next:' at lastGenerated when the engine already ran", () => {
    let root: any;
    act(() => {
      root = renderer.create(
        <ScheduledEntryRow
          entry={makeEntry({ lastGenerated: "2026-08-19" })}
          onEdit={jest.fn()}
          onDelete={jest.fn()}
          onTogglePause={jest.fn()}
        />,
      );
    });
    expect(texts(root)).toContain("Weekly · Next: Aug 26");
  });

  it("never shows a past date as 'Next:' when the engine anchor is stale (WR-01)", () => {
    // Daily template whose lastGenerated (Aug 10) predates today (Aug 12):
    // the engine-consistent next (Aug 11) is gone — the row clamps to today.
    let root: any;
    act(() => {
      root = renderer.create(
        <ScheduledEntryRow
          entry={makeEntry({
            date: "2026-01-01",
            lastGenerated: "2026-08-10",
            frequency: "daily",
          })}
          onEdit={jest.fn()}
          onDelete={jest.fn()}
          onTogglePause={jest.fn()}
        />,
      );
    });
    expect(texts(root)).toContain("Daily · Next: Aug 12");
  });

  it("shows the start date without a 'Next:' prefix for once templates", () => {
    let root: any;
    act(() => {
      root = renderer.create(
        <ScheduledEntryRow
          entry={makeEntry({ frequency: "once" })}
          onEdit={jest.fn()}
          onDelete={jest.fn()}
          onTogglePause={jest.fn()}
        />,
      );
    });
    expect(texts(root)).toContain("Once · Aug 12");
  });

  it("shows no 'Next:' when the next occurrence is beyond endDate (WR-01)", () => {
    // Monthly template starting Jan 31 with end Mar 15 and lastGenerated
    // Jan 31: the engine's next match is Mar 31 — past the end, so it will
    // never be generated and the row must not promise it.
    let root: any;
    act(() => {
      root = renderer.create(
        <ScheduledEntryRow
          entry={makeEntry({
            date: "2026-01-31",
            frequency: "monthly",
            lastGenerated: "2026-01-31",
            endDate: "2026-03-15",
          })}
          onEdit={jest.fn()}
          onDelete={jest.fn()}
          onTogglePause={jest.fn()}
        />,
      );
    });
    expect(texts(root).some((t) => t.includes("Next:"))).toBe(false);
  });

  it("renders the amount with ₱ formatting", () => {
    let root: any;
    act(() => {
      root = renderer.create(
        <ScheduledEntryRow
          entry={makeEntry()}
          onEdit={jest.fn()}
          onDelete={jest.fn()}
          onTogglePause={jest.fn()}
        />,
      );
    });
    expect(texts(root)).toContain("₱ 123.45");
  });

  it("colors the amount income-green for income and expense-red for expense", () => {
    const colorOf = (entry: any) => {
      let r: any;
      act(() => {
        r = renderer.create(
          <ScheduledEntryRow
            entry={entry}
            onEdit={jest.fn()}
            onDelete={jest.fn()}
            onTogglePause={jest.fn()}
          />,
        );
      });
      const amountText = r.root
        .findAllByType(Text)
        .find((t: any) => t.props.children === "₱ 123.45");
      const style = Array.isArray(amountText.props.style)
        ? amountText.props.style
        : [amountText.props.style];
      return style.find((s: any) => s && typeof s === "object" && s.color);
    };
    // ── Colors imported from tokens (single source of truth, 14-UI-SPEC) ──
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { colors } = require("../../theme/tokens");
    expect(colorOf(makeEntry({ type: "income", amount: 12345 }))?.color).toBe(
      colors.income,
    );
    expect(colorOf(makeEntry({ type: "expense", amount: 12345 }))?.color).toBe(
      colors.expense,
    );
  });

  it("falls back to 'Unknown' when the category id has no match", () => {
    let root: any;
    act(() => {
      root = renderer.create(
        <ScheduledEntryRow
          entry={makeEntry({ categoryId: "cat-404", description: "" })}
          onEdit={jest.fn()}
          onDelete={jest.fn()}
          onTogglePause={jest.fn()}
        />,
      );
    });
    expect(texts(root)).toContain("Unknown");
  });
});

describe("ScheduledEntryRow paused state", () => {
  it("shows the Paused badge and the frequency, never a next date", () => {
    let root: any;
    act(() => {
      root = renderer.create(
        <ScheduledEntryRow
          entry={makeEntry({ isActive: false })}
          onEdit={jest.fn()}
          onDelete={jest.fn()}
          onTogglePause={jest.fn()}
        />,
      );
    });
    const rendered = texts(root);
    expect(rendered).toContain("Paused");
    expect(rendered).toContain("Weekly");
    expect(rendered.some((t) => t.includes("Next:"))).toBe(false);
  });
});

describe("ScheduledEntryRow interactions", () => {
  it("opens edit on row tap", () => {
    const onEdit = jest.fn();
    const entry = makeEntry();
    let root: any;
    act(() => {
      root = renderer.create(
        <ScheduledEntryRow
          entry={entry}
          onEdit={onEdit}
          onDelete={jest.fn()}
          onTogglePause={jest.fn()}
        />,
      );
    });
    // Row container is the TouchableOpacity wrapping the content.
    act(() => {
      pressableWithText(root, "Rent").props.onPress();
    });
    expect(onEdit).toHaveBeenCalledWith(entry);
  });

  it("toggles pause immediately on the Pause swipe action (no confirm)", () => {
    const onTogglePause = jest.fn();
    const entry = makeEntry();
    let root: any;
    act(() => {
      root = renderer.create(
        <ScheduledEntryRow
          entry={entry}
          onEdit={jest.fn()}
          onDelete={jest.fn()}
          onTogglePause={onTogglePause}
        />,
      );
    });
    act(() => {
      pressableWithText(root, "Pause").props.onPress();
    });
    expect(onTogglePause).toHaveBeenCalledWith(entry);
  });

  it("labels the toggle Resume for a paused entry", () => {
    let root: any;
    act(() => {
      root = renderer.create(
        <ScheduledEntryRow
          entry={makeEntry({ isActive: false })}
          onEdit={jest.fn()}
          onDelete={jest.fn()}
          onTogglePause={jest.fn()}
        />,
      );
    });
    const labels = texts(root);
    expect(labels).toContain("Resume");
    expect(labels).not.toContain("Pause");
  });

  it("resumes immediately on the Resume swipe action (no confirm)", () => {
    const onTogglePause = jest.fn();
    const entry = makeEntry({ isActive: false });
    let root: any;
    act(() => {
      root = renderer.create(
        <ScheduledEntryRow
          entry={entry}
          onEdit={jest.fn()}
          onDelete={jest.fn()}
          onTogglePause={onTogglePause}
        />,
      );
    });
    act(() => {
      pressableWithText(root, "Resume").props.onPress();
    });
    expect(onTogglePause).toHaveBeenCalledWith(entry);
  });

  it("does not delete when the Alert is cancelled", () => {
    const alertSpy = jest.spyOn(Alert, "alert");
    const onDelete = jest.fn();
    let root: any;
    act(() => {
      root = renderer.create(
        <ScheduledEntryRow
          entry={makeEntry()}
          onEdit={jest.fn()}
          onDelete={onDelete}
          onTogglePause={jest.fn()}
        />,
      );
    });
    act(() => {
      pressableWithText(root, "Delete").props.onPress();
    });
    // Cancel (first button) carries no onPress — the OS dismisses the Alert;
    // tapping it can never reach onDelete. Only the destructive Delete button
    // wires up the callback.
    const cancelBtn = (alertSpy.mock.calls[0][2] as any)?.[0];
    expect(cancelBtn.text).toBe("Cancel");
    expect(cancelBtn.onPress).toBeUndefined();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("deletes only after the Alert confirmation", () => {
    const alertSpy = jest.spyOn(Alert, "alert");
    const onDelete = jest.fn();
    let root: any;
    act(() => {
      root = renderer.create(
        <ScheduledEntryRow
          entry={makeEntry()}
          onEdit={jest.fn()}
          onDelete={onDelete}
          onTogglePause={jest.fn()}
        />,
      );
    });
    act(() => {
      pressableWithText(root, "Delete").props.onPress();
    });
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy.mock.calls[0][0]).toBe("Delete this scheduled entry?");
    // Confirm the destructive button — onDelete fires with the entry id.
    const confirmBtn = (alertSpy.mock.calls[0][2] as any)?.[1];
    act(() => {
      confirmBtn?.onPress();
    });
    expect(onDelete).toHaveBeenCalledWith("s1");
  });
});
