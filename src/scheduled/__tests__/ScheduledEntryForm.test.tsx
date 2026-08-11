// ScheduledEntryForm component tests (phase 14, SCHD-UI-07/08/09). Covers the
// add-mode empty state (Save disabled until amount + category), the frequency
// picker (5 segments; End Date row hidden for "once"), validation gating
// (end date after start date), edit-mode prefill, the missing-entry guard,
// and the save → addScheduled/updateScheduled + goBack flow.
import React from "react";
import { Alert, Text, TextInput } from "react-native";
import renderer, { act } from "react-test-renderer";

// ── Mock: react-native-safe-area-context ──────────────────────────
jest.mock("react-native-safe-area-context", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactMod = require("react");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View: RNView } = require("react-native");

  const SafeAreaView = (props: any) => ReactMod.createElement(RNView, props);
  return {
    SafeAreaView,
    SafeAreaProvider: ({ children }: any) => children,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

// ── Mock: react-native-keyboard-controller ─────────────────────────
jest.mock("react-native-keyboard-controller", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactMod = require("react");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View: RNView } = require("react-native");
  const KeyboardAwareScrollView = ({ children, ...rest }: any) =>
    ReactMod.createElement(RNView, rest, children);
  return { KeyboardAwareScrollView };
});

// ── Mock: @react-native-community/datetimepicker ───────────────────
jest.mock("@react-native-community/datetimepicker", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactMod = require("react");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View: RNView } = require("react-native");
  const DateTimePicker = (props: any) => ReactMod.createElement(RNView, props);
  return { __esModule: true, default: DateTimePicker };
});

// ── Mock: @expo/vector-icons (CategoryIcon) ─────────────────────────
jest.mock("@expo/vector-icons", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactMod = require("react");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RN = require("react-native");
  return {
    Ionicons: (props: any) => ReactMod.createElement(RN.Text, props, "icon"),
  };
});

// ── Mock: useNavigation / useRoute ─────────────────────────────────
let mockRouteParams: any;
let mockGoBack: jest.Mock;

jest.mock("@react-navigation/native", () => {
  const actual = jest.requireActual("@react-navigation/native");
  return {
    ...actual,
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: mockGoBack,
    }),
    useRoute: () => ({
      params: mockRouteParams,
    }),
  };
});

// ── Mock: ScheduledEntriesProvider (plain mock — requireActual would pull
// the real provider's firebase init chain) ──────────────────────────
let mockScheduledEntries: any[];
let mockAddScheduled: jest.Mock;
let mockUpdateScheduled: jest.Mock;

jest.mock("../ScheduledEntriesProvider", () => ({
  useScheduledEntries: () => ({
    scheduledEntries: mockScheduledEntries,
    addScheduled: mockAddScheduled,
    updateScheduled: mockUpdateScheduled,
  }),
}));

// ── Mock: CategoriesProvider (plain mock — avoid the firebase import chain)
let mockUseCategories: jest.Mock;

jest.mock("../../categories/CategoriesProvider", () => ({
  useCategories: () => mockUseCategories(),
}));

// ── Subject under test ─────────────────────────────────────────────
import ScheduledEntryForm from "../ScheduledEntryForm";
import { Timestamp } from "firebase/firestore";

const ts = new Timestamp(1_700_000_000, 0);

const categories = {
  expenseCategories: [
    { id: "cat-1", name: "Housing", createdAt: ts },
    { id: "cat-2", name: "Food", createdAt: ts },
  ],
  incomeCategories: [{ id: "cat-3", name: "Salary", createdAt: ts }],
};

const expenseEntry = {
  id: "s1",
  uid: "user-1",
  type: "expense",
  amount: 500000,
  categoryId: "cat-1",
  date: "2026-08-12",
  description: "Monthly rent",
  frequency: "monthly",
  endDate: "2027-08-12",
  lastGenerated: null,
  isActive: true,
  createdAt: ts,
  updatedAt: ts,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGoBack = jest.fn();
  mockRouteParams = { mode: "add", type: "expense" };
  mockUseCategories = jest.fn(() => categories);
  mockScheduledEntries = [expenseEntry];
  mockAddScheduled = jest.fn(async () => {});
  mockUpdateScheduled = jest.fn(async () => {});
});

function mount(params: any = mockRouteParams) {
  mockRouteParams = params;
  let root: any;
  act(() => {
    root = renderer.create(<ScheduledEntryForm />);
  });
  return root;
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

function pressableWithText(root: any, label: string): any {
  // Find the Text with the label, then walk up to the nearest ancestor with
  // an onPress (EntryForm test idiom) — this naturally skips wrapping
  // containers like the modal overlay.
  const textNode = root.root
    .findAllByType(Text)
    .find((t: any) => t.props.children === label);
  if (!textNode) return undefined;
  let node = textNode;
  while (node && typeof node.props?.onPress !== "function") {
    node = node.parent;
  }
  return node;
}

function amountInput(root: any): any {
  return root.root.findAllByType(TextInput)[0];
}

describe("ScheduledEntryForm add mode", () => {
  it("renders the title and the five frequency segments", () => {
    const root = mount();
    const labels = texts(root);
    expect(labels).toContain("Add Scheduled Entry");
    for (const seg of ["Once", "Daily", "Weekly", "Monthly", "Yearly"]) {
      expect(labels).toContain(seg);
    }
  });

  it("hides the End Date row when the frequency is once (SCHD-UI-08)", () => {
    const root = mount();
    // Default frequency is daily → the row is present.
    expect(texts(root)).toContain("End Date (optional)");
    // Switch to Once → the row disappears.
    act(() => {
      pressableWithText(root, "Once").props.onPress();
    });
    expect(texts(root)).not.toContain("End Date (optional)");
    // Back to Daily → it returns.
    act(() => {
      pressableWithText(root, "Daily").props.onPress();
    });
    expect(texts(root)).toContain("End Date (optional)");
  });

  it("keeps Save disabled until amount and category are set", () => {
    const root = mount();
    act(() => {
      pressableWithText(root, "Save").props.onPress();
    });
    expect(mockAddScheduled).not.toHaveBeenCalled();
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it("saves through addScheduled and goes back once the form is valid", async () => {
    const root = mount();
    act(() => {
      amountInput(root).props.onChangeText("250.00");
    });
    expect(texts(root)).toContain("₱ 250.00");
    act(() => {
      pressableWithText(root, "Select category").props.onPress();
    });
    // Bottom sheet opens → pick Housing.
    act(() => {
      pressableWithText(root, "Housing").props.onPress();
    });
    expect(texts(root)).toContain("Housing");
    act(() => {
      pressableWithText(root, "Weekly").props.onPress();
    });

    await act(async () => {
      pressableWithText(root, "Save").props.onPress();
    });

    expect(mockAddScheduled).toHaveBeenCalledTimes(1);
    const input = mockAddScheduled.mock.calls[0][0];
    expect(input.amount).toBe(25000);
    expect(input.categoryId).toBe("cat-1");
    expect(input.frequency).toBe("weekly");
    expect(input.endDate).toBeNull();
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it("shows the inline end-date error when endDate is not after start", () => {
    const root = mount();
    act(() => {
      amountInput(root).props.onChangeText("100.00");
    });
    act(() => {
      pressableWithText(root, "Select category").props.onPress();
    });
    act(() => {
      pressableWithText(root, "Housing").props.onPress();
    });

    const pickerProps = (r: any) =>
      r.root.findByType(
        require("@react-native-community/datetimepicker").default,
      ).props;

    // Set an end date via its picker (minimum = start + 1 day).
    act(() => {
      pressableWithText(root, "No end date").props.onPress();
    });
    const endMin = pickerProps(root).minimumDate;
    act(() => {
      pickerProps(root).onValueChange(undefined, endMin);
    });
    // End date = start + 1 → valid. Advance the start date beyond the end
    // date via the start picker → endDate <= startDate → inline error.
    const later = new Date(endMin.getTime() + 2 * 86_400_000);
    act(() => {
      pressableWithText(root, "Aug 12, 2026").props.onPress();
    });
    act(() => {
      pickerProps(root).onValueChange(undefined, later);
    });

    expect(texts(root)).toContain("End date must be after the start date.");
    // Save stays disabled.
    act(() => {
      pressableWithText(root, "Save").props.onPress();
    });
    expect(mockAddScheduled).not.toHaveBeenCalled();
  });
});

describe("ScheduledEntryForm edit mode", () => {
  it("pre-fills the fields from the existing entry", () => {
    const root = mount({ mode: "edit", type: "expense", id: "s1" });
    const labels = texts(root);
    expect(labels).toContain("Edit Scheduled Entry");
    expect(labels).toContain("Housing");
    expect(labels).toContain("Monthly");
    expect(labels).toContain("End Date (optional)");
    // Description lives in the TextInput value.
    const desc = root.root
      .findAllByType(TextInput)
      .find((t: any) => t.props.value === "Monthly rent");
    expect(desc).toBeTruthy();
  });

  it("alerts and goes back when the entry no longer exists", () => {
    const alertSpy = jest.spyOn(Alert, "alert");
    mount({ mode: "edit", type: "expense", id: "missing" });
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy.mock.calls[0][0]).toBe("Entry not found");
    expect(alertSpy.mock.calls[0][1]).toBe(
      "This scheduled entry may have been deleted.",
    );
    // The OK button navigates back.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const okBtn = (alertSpy.mock.calls[0][2] as any)?.[0];
    act(() => {
      okBtn?.onPress();
    });
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it("saves through updateScheduled in edit mode", async () => {
    const root = mount({ mode: "edit", type: "expense", id: "s1" });
    act(() => {
      root.root
        .findAllByType(TextInput)
        .find((t: any) => t.props.value === "Monthly rent")
        .props.onChangeText("Rent (updated)");
    });

    await act(async () => {
      pressableWithText(root, "Save").props.onPress();
    });

    expect(mockUpdateScheduled).toHaveBeenCalledTimes(1);
    expect(mockUpdateScheduled.mock.calls[0][0]).toBe("s1");
    expect(mockUpdateScheduled.mock.calls[0][1].description).toBe(
      "Rent (updated)",
    );
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});
