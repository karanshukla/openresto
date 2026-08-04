import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react-native";
import { SectionBlock } from "@/components/admin/settings/SectionBlock";
import * as restaurantsApi from "@/api/restaurants";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/api/restaurants", () => ({
  updateSection: jest.fn(),
  deleteSection: jest.fn(),
  addTable: jest.fn(),
  fetchSectionDeleteImpact: jest.fn(),
  createTableGroup: jest.fn(),
  updateTableGroup: jest.fn(),
  deleteTableGroup: jest.fn(),
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#0a7ea4", appName: "Open Resto" }),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

const mockSection = {
  id: 1,
  name: "Indoor",
  tables: [
    { id: 10, name: "T1", seats: 4 },
    { id: 11, name: "T2", seats: 2 },
  ],
};

const baseProps = {
  section: mockSection,
  restaurantId: 42,
  isDark: false,
  borderColor: "#ddd",
  mutedColor: "#888",
  groups: [] as restaurantsApi.TableGroupDto[],
  onSectionRenamed: jest.fn(),
  onSectionDeleted: jest.fn(),
  onTableAdded: jest.fn(),
  onTableUpdated: jest.fn(),
  onTableDeleted: jest.fn(),
  onGroupsChanged: jest.fn(),
  isFirst: false,
  isLast: false,
  onMoveUp: jest.fn(),
  onMoveDown: jest.fn(),
};

describe("SectionBlock", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders section name", () => {
    render(<SectionBlock {...baseProps} />);
    expect(screen.getByText("Indoor")).toBeTruthy();
  });

  it("shows table count and seat count", () => {
    render(<SectionBlock {...baseProps} />);
    expect(screen.getByText("2 tables · 6 seats")).toBeTruthy();
  });

  it("renders empty note when no tables", () => {
    render(<SectionBlock {...baseProps} section={{ ...mockSection, tables: [] }} />);
    expect(screen.getByText("No tables yet.")).toBeTruthy();
  });

  it("shows Edit button for the section", () => {
    render(<SectionBlock {...baseProps} />);
    expect(screen.getByTestId("section-edit-btn")).toBeTruthy();
  });

  it("switches to editing mode when Edit is pressed", () => {
    render(<SectionBlock {...baseProps} />);
    fireEvent.press(screen.getByTestId("section-edit-btn"));
    expect(screen.getByDisplayValue("Indoor")).toBeTruthy();
    expect(screen.getByText("Save")).toBeTruthy();
  });

  it("calls updateSection and onSectionRenamed when save is pressed", async () => {
    (restaurantsApi.updateSection as jest.Mock).mockResolvedValue({
      id: 1,
      name: "Outdoor",
      tables: [],
    });
    render(<SectionBlock {...baseProps} />);
    fireEvent.press(screen.getByTestId("section-edit-btn"));
    fireEvent.changeText(screen.getByDisplayValue("Indoor"), "Outdoor");
    await act(async () => {
      fireEvent.press(screen.getByText("Save"));
    });
    expect(restaurantsApi.updateSection).toHaveBeenCalledWith(42, 1, "Outdoor");
    expect(baseProps.onSectionRenamed).toHaveBeenCalledWith("Outdoor");
  });

  it("does not save when draft is empty", async () => {
    render(<SectionBlock {...baseProps} />);
    fireEvent.press(screen.getByTestId("section-edit-btn"));
    fireEvent.changeText(screen.getByDisplayValue("Indoor"), "");
    await act(async () => {
      fireEvent.press(screen.getByText("Save"));
    });
    expect(restaurantsApi.updateSection).not.toHaveBeenCalled();
  });

  it("cancels edit mode", () => {
    render(<SectionBlock {...baseProps} section={{ ...mockSection, tables: [] }} />);
    fireEvent.press(screen.getByTestId("section-edit-btn"));
    expect(screen.getByText("Save")).toBeTruthy();
    act(() => {
      fireEvent.press(screen.getByText("Cancel"));
    });
    expect(screen.getByText("Indoor")).toBeTruthy();
  });

  // ── Two-step delete friction (#270) ───────────────────────────────────────
  //
  // `Delete…` reveals an inline confirmation naming the section and the consequence (incl. the count
  // of future bookings that would lose their reference); a second explicit tap destroys. Cancel
  // returns to the header.

  it("reveals an inline confirmation and fetches the impact count when Delete… is pressed", async () => {
    (restaurantsApi.fetchSectionDeleteImpact as jest.Mock).mockResolvedValue({ bookings: 2 });
    render(<SectionBlock {...baseProps} section={{ ...mockSection, tables: [] }} />);
    await act(async () => {
      fireEvent.press(screen.getByTestId("section-delete-btn"));
    });
    expect(restaurantsApi.fetchSectionDeleteImpact).toHaveBeenCalledWith(42, 1);
    expect(await screen.findByText(/Delete section “Indoor” and all its tables\?/)).toBeTruthy();
    expect(screen.getByText(/2 future bookings affected/)).toBeTruthy();
    expect(screen.getByText("Yes, delete")).toBeTruthy();
  });

  it("deletes only after the second explicit tap (Yes, delete)", async () => {
    (restaurantsApi.fetchSectionDeleteImpact as jest.Mock).mockResolvedValue({ bookings: 0 });
    (restaurantsApi.deleteSection as jest.Mock).mockResolvedValue(true);
    render(<SectionBlock {...baseProps} section={{ ...mockSection, tables: [] }} />);
    await act(async () => {
      fireEvent.press(screen.getByTestId("section-delete-btn"));
    });
    expect(restaurantsApi.deleteSection).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.press(screen.getByText("Yes, delete"));
    });
    expect(restaurantsApi.deleteSection).toHaveBeenCalledWith(42, 1);
    expect(baseProps.onSectionDeleted).toHaveBeenCalled();
  });

  it("does not delete when Cancel is pressed in the confirm step", async () => {
    (restaurantsApi.fetchSectionDeleteImpact as jest.Mock).mockResolvedValue({ bookings: 1 });
    render(<SectionBlock {...baseProps} section={{ ...mockSection, tables: [] }} />);
    await act(async () => {
      fireEvent.press(screen.getByTestId("section-delete-btn"));
    });
    fireEvent.press(screen.getByTestId("section-delete-cancel-btn"));
    expect(restaurantsApi.deleteSection).not.toHaveBeenCalled();
    expect(baseProps.onSectionDeleted).not.toHaveBeenCalled();
    expect(screen.queryByText("Yes, delete")).toBeNull();
  });

  it("falls back to generic copy when the impact read fails or is unavailable", async () => {
    (restaurantsApi.fetchSectionDeleteImpact as jest.Mock).mockResolvedValue(null);
    render(<SectionBlock {...baseProps} section={{ ...mockSection, tables: [] }} />);
    await act(async () => {
      fireEvent.press(screen.getByTestId("section-delete-btn"));
    });
    expect(
      await screen.findByText(/Future bookings in this section will lose their reference/)
    ).toBeTruthy();
  });

  it("uses singular copy when exactly one future booking is affected", async () => {
    (restaurantsApi.fetchSectionDeleteImpact as jest.Mock).mockResolvedValue({ bookings: 1 });
    render(<SectionBlock {...baseProps} section={{ ...mockSection, tables: [] }} />);
    await act(async () => {
      fireEvent.press(screen.getByTestId("section-delete-btn"));
    });
    expect(await screen.findByText(/1 future booking affected/)).toBeTruthy();
  });

  it("renders Add Table button", () => {
    render(<SectionBlock {...baseProps} />);
    expect(screen.getByText("Add Table")).toBeTruthy();
  });

  it("opens AddRow form, submits, and calls onTableAdded", async () => {
    const newTable = { id: 20, name: "T3", seats: 4 };
    (restaurantsApi.addTable as jest.Mock).mockResolvedValue(newTable);

    render(<SectionBlock {...baseProps} />);
    fireEvent.press(screen.getByText("Add Table"));

    fireEvent.changeText(screen.getByPlaceholderText("Table name (e.g. T1, Booth 1)"), "T3");
    // Seats is now a dropdown — open it (placeholder "Seats") and pick "4 seats". The option list
    // renders inside the modal; a table tile subtitle may also show "4 seats", so pick the modal
    // option (the last match, since the modal appends after the tiles).
    fireEvent.press(screen.getByText("Seats"));
    await act(async () => {
      fireEvent.press(screen.getAllByText("4 seats").pop()!);
    });

    await act(async () => {
      fireEvent.press(screen.getByText("Add"));
    });

    expect(restaurantsApi.addTable).toHaveBeenCalledWith(42, 1, { name: "T3", seats: 4 });
    expect(baseProps.onTableAdded).toHaveBeenCalledWith(newTable);
  });

  it("uses default seats 2 when the seats dropdown is left untouched", async () => {
    const newTable = { id: 21, name: "T4", seats: 2 };
    (restaurantsApi.addTable as jest.Mock).mockResolvedValue(newTable);

    render(<SectionBlock {...baseProps} />);
    fireEvent.press(screen.getByText("Add Table"));
    fireEvent.changeText(screen.getByPlaceholderText("Table name (e.g. T1, Booth 1)"), "T4");

    await act(async () => {
      fireEvent.press(screen.getByText("Add"));
    });

    expect(restaurantsApi.addTable).toHaveBeenCalledWith(42, 1, { name: "T4", seats: 2 });
  });

  it("renders in dark mode", () => {
    render(<SectionBlock {...baseProps} isDark />);
    expect(screen.getByText("Indoor")).toBeTruthy();
  });

  it("shows 'No tables yet.' when section has no tables", () => {
    render(<SectionBlock {...baseProps} section={{ ...mockSection, tables: [] }} />);
    expect(screen.getByText("No tables yet.")).toBeTruthy();
  });

  it("does not call onSectionRenamed when updateSection returns null", async () => {
    (restaurantsApi.updateSection as jest.Mock).mockResolvedValue(null);
    render(<SectionBlock {...baseProps} />);
    fireEvent.press(screen.getByTestId("section-edit-btn"));
    fireEvent.changeText(screen.getByDisplayValue("Indoor"), "Updated");
    await act(async () => {
      fireEvent.press(screen.getByText("Save"));
    });
    expect(restaurantsApi.updateSection).toHaveBeenCalled();
    expect(baseProps.onSectionRenamed).not.toHaveBeenCalled();
  });

  it("calls addTable and onTableAdded when AddRow form is submitted", async () => {
    const newTable = { id: 20, name: "T3", seats: 4 };
    (restaurantsApi.addTable as jest.Mock).mockResolvedValue(newTable);
    render(<SectionBlock {...baseProps} />);
    fireEvent.press(screen.getByText("Add Table"));
    fireEvent.changeText(screen.getByPlaceholderText("Table name (e.g. T1, Booth 1)"), "T3");
    // Seats dropdown — pick "4 seats" (last match = the modal option; a table tile may also show it).
    fireEvent.press(screen.getByText("Seats"));
    await act(async () => {
      fireEvent.press(screen.getAllByText("4 seats").pop()!);
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Add"));
    });
    expect(restaurantsApi.addTable).toHaveBeenCalledWith(
      42,
      1,
      expect.objectContaining({ name: "T3", seats: 4 })
    );
    expect(baseProps.onTableAdded).toHaveBeenCalledWith(newTable);
  });

  it("does not call onTableAdded when addTable returns null", async () => {
    (restaurantsApi.addTable as jest.Mock).mockResolvedValue(null);
    render(<SectionBlock {...baseProps} />);
    fireEvent.press(screen.getByText("Add Table"));
    fireEvent.changeText(screen.getByPlaceholderText("Table name (e.g. T1, Booth 1)"), "T4");
    // Seats left at default (2) — no selection needed.
    await act(async () => {
      fireEvent.press(screen.getByText("Add"));
    });
    expect(restaurantsApi.addTable).toHaveBeenCalled();
    expect(baseProps.onTableAdded).not.toHaveBeenCalled();
  });

  it("uses default seats of 2 when the seats dropdown is left untouched", async () => {
    const newTable = { id: 21, name: "T5", seats: 2 };
    (restaurantsApi.addTable as jest.Mock).mockResolvedValue(newTable);
    render(<SectionBlock {...baseProps} />);
    fireEvent.press(screen.getByText("Add Table"));
    fireEvent.changeText(screen.getByPlaceholderText("Table name (e.g. T1, Booth 1)"), "T5");
    await act(async () => {
      fireEvent.press(screen.getByText("Add"));
    });
    expect(restaurantsApi.addTable).toHaveBeenCalledWith(42, 1, { name: "T5", seats: 2 });
  });

  // ── Reorder up/down move buttons (#178) ──────────────────────────────────

  it("renders move-up and move-down buttons", () => {
    render(<SectionBlock {...baseProps} />);
    expect(screen.getByTestId("section-move-up-btn")).toBeTruthy();
    expect(screen.getByTestId("section-move-down-btn")).toBeTruthy();
  });

  it("calls onMoveUp when move-up is pressed", () => {
    render(<SectionBlock {...baseProps} />);
    fireEvent.press(screen.getByTestId("section-move-up-btn"));
    expect(baseProps.onMoveUp).toHaveBeenCalled();
  });

  it("calls onMoveDown when move-down is pressed", () => {
    render(<SectionBlock {...baseProps} />);
    fireEvent.press(screen.getByTestId("section-move-down-btn"));
    expect(baseProps.onMoveDown).toHaveBeenCalled();
  });

  it("disables move-up when isFirst is true", () => {
    render(<SectionBlock {...baseProps} isFirst />);
    expect(screen.getByTestId("section-move-up-btn").props.accessibilityState?.disabled).toBe(true);
  });

  it("disables move-down when isLast is true", () => {
    render(<SectionBlock {...baseProps} isLast />);
    expect(screen.getByTestId("section-move-down-btn").props.accessibilityState?.disabled).toBe(
      true
    );
  });

  it("does not call onMoveUp when disabled at first position", () => {
    render(<SectionBlock {...baseProps} isFirst />);
    fireEvent.press(screen.getByTestId("section-move-up-btn"));
    expect(baseProps.onMoveUp).not.toHaveBeenCalled();
  });

  it("does not call onMoveDown when disabled at last position", () => {
    render(<SectionBlock {...baseProps} isLast />);
    fireEvent.press(screen.getByTestId("section-move-down-btn"));
    expect(baseProps.onMoveDown).not.toHaveBeenCalled();
  });

  // ── Combinable table groups (#273) ────────────────────────────────────────

  it("renders a group count in the section header when groups exist", () => {
    const groups: restaurantsApi.TableGroupDto[] = [
      {
        id: 1,
        name: null,
        combinedSeats: 6,
        members: [
          { id: 10, name: "T1", seats: 4 },
          { id: 11, name: "T2", seats: 2 },
        ],
      },
    ];
    render(<SectionBlock {...baseProps} groups={groups} />);
    expect(screen.getByText(/2 tables · 6 seats · 1 combinable group/)).toBeTruthy();
  });

  it("enters selection mode and creates a group when Combine is pressed", async () => {
    const created: restaurantsApi.TableGroupDto = {
      id: 1,
      name: null,
      combinedSeats: 6,
      members: [
        { id: 10, name: "T1", seats: 4 },
        { id: 11, name: "T2", seats: 2 },
      ],
    };
    (restaurantsApi.createTableGroup as jest.Mock).mockResolvedValue(created);
    const onGroupsChanged = jest.fn();
    render(<SectionBlock {...baseProps} groups={[]} onGroupsChanged={onGroupsChanged} />);

    // Tap Link on T1 to enter selection mode.
    await act(async () => {
      fireEvent.press(screen.getByTestId("table-link-btn-10"));
    });
    // Select T2.
    await act(async () => {
      fireEvent.press(screen.getByTestId("table-select-row-11"));
    });
    // Combine.
    await act(async () => {
      fireEvent.press(screen.getByTestId("section-combine-btn"));
    });

    expect(restaurantsApi.createTableGroup).toHaveBeenCalledWith(42, {
      members: expect.arrayContaining([10, 11]),
      combinedSeats: 6,
    });
    expect(onGroupsChanged).toHaveBeenCalledWith([created]);
  });

  it("dissolves a group via Unlink when down to one member", async () => {
    const groups: restaurantsApi.TableGroupDto[] = [
      {
        id: 1,
        name: null,
        combinedSeats: 6,
        members: [
          { id: 10, name: "T1", seats: 4 },
          { id: 11, name: "T2", seats: 2 },
        ],
      },
    ];
    (restaurantsApi.deleteTableGroup as jest.Mock).mockResolvedValue(true);
    const onGroupsChanged = jest.fn();
    render(<SectionBlock {...baseProps} groups={groups} onGroupsChanged={onGroupsChanged} />);

    // Unlink T10 → group drops to one member → dissolve.
    await act(async () => {
      fireEvent.press(screen.getByTestId("table-unlink-btn-10"));
    });

    expect(restaurantsApi.deleteTableGroup).toHaveBeenCalledWith(42, 1);
    expect(onGroupsChanged).toHaveBeenCalledWith([]);
  });

  it("edits combined seats via the group edit affordance", async () => {
    const groups: restaurantsApi.TableGroupDto[] = [
      {
        id: 1,
        name: null,
        combinedSeats: 6,
        members: [
          { id: 10, name: "T1", seats: 4 },
          { id: 11, name: "T2", seats: 2 },
        ],
      },
    ];
    const updated: restaurantsApi.TableGroupDto = { ...groups[0], combinedSeats: 8 };
    (restaurantsApi.updateTableGroup as jest.Mock).mockResolvedValue(updated);
    const onGroupsChanged = jest.fn();
    render(<SectionBlock {...baseProps} groups={groups} onGroupsChanged={onGroupsChanged} />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("group-edit-btn-1"));
    });
    // Combined-seats is now a dropdown seeded with the current value (6). Open it and pick "8 seats".
    fireEvent.press(screen.getByText("6 seats"));
    await act(async () => {
      fireEvent.press(screen.getByText("8 seats"));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId("group-save-combined-btn"));
    });

    expect(restaurantsApi.updateTableGroup).toHaveBeenCalledWith(42, 1, {
      name: null,
      members: [10, 11],
      combinedSeats: 8,
    });
    expect(onGroupsChanged).toHaveBeenCalledWith([updated]);
  });
});
