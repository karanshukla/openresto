import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { SectionBlock } from "@/components/admin/settings/SectionBlock";
import * as restaurantsApi from "@/api/restaurants";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/api/restaurants", () => ({
  updateSection: jest.fn(),
  deleteSection: jest.fn(),
  addTable: jest.fn(),
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
  confirmAction: jest.fn(),
  onSectionRenamed: jest.fn(),
  onSectionDeleted: jest.fn(),
  onTableAdded: jest.fn(),
  onTableUpdated: jest.fn(),
  onTableDeleted: jest.fn(),
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

  it("calls deleteSection and onSectionDeleted when confirmed", async () => {
    (baseProps.confirmAction as jest.Mock).mockResolvedValue(true);
    (restaurantsApi.deleteSection as jest.Mock).mockResolvedValue(true);
    render(<SectionBlock {...baseProps} section={{ ...mockSection, tables: [] }} />);
    await act(async () => {
      fireEvent.press(screen.getByTestId("section-delete-btn"));
    });
    expect(baseProps.confirmAction).toHaveBeenCalledWith(
      'Delete section "Indoor" and all its tables?'
    );
    expect(restaurantsApi.deleteSection).toHaveBeenCalledWith(42, 1);
    expect(baseProps.onSectionDeleted).toHaveBeenCalled();
  });

  it("does not delete when confirmAction returns false", async () => {
    (baseProps.confirmAction as jest.Mock).mockResolvedValue(false);
    render(<SectionBlock {...baseProps} section={{ ...mockSection, tables: [] }} />);
    await act(async () => {
      fireEvent.press(screen.getByTestId("section-delete-btn"));
    });
    expect(restaurantsApi.deleteSection).not.toHaveBeenCalled();
    expect(baseProps.onSectionDeleted).not.toHaveBeenCalled();
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
    fireEvent.changeText(screen.getByPlaceholderText("Seats"), "4");

    await act(async () => {
      fireEvent.press(screen.getByText("Add"));
    });

    expect(restaurantsApi.addTable).toHaveBeenCalledWith(42, 1, { name: "T3", seats: 4 });
    expect(baseProps.onTableAdded).toHaveBeenCalledWith(newTable);
  });

  it("uses default seats 2 when extra is non-numeric", async () => {
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
    fireEvent.changeText(screen.getByPlaceholderText("Seats"), "4");
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
    fireEvent.changeText(screen.getByPlaceholderText("Seats"), "2");
    await act(async () => {
      fireEvent.press(screen.getByText("Add"));
    });
    expect(restaurantsApi.addTable).toHaveBeenCalled();
    expect(baseProps.onTableAdded).not.toHaveBeenCalled();
  });

  it("uses default seats of 2 when extra is NaN", async () => {
    const newTable = { id: 21, name: "T5", seats: 2 };
    (restaurantsApi.addTable as jest.Mock).mockResolvedValue(newTable);
    render(<SectionBlock {...baseProps} />);
    fireEvent.press(screen.getByText("Add Table"));
    fireEvent.changeText(screen.getByPlaceholderText("Table name (e.g. T1, Booth 1)"), "T5");
    fireEvent.changeText(screen.getByPlaceholderText("Seats"), "abc");
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
});
