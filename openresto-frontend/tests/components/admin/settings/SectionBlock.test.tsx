import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { SectionBlock } from "@/components/admin/settings/SectionBlock";

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#007AFF", appName: "Test" }),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@/api/restaurants", () => ({
  updateSection: jest.fn().mockResolvedValue({ id: 10, name: "Upper Floor", tables: [] }),
  deleteSection: jest.fn().mockResolvedValue(true),
  addTable: jest.fn().mockResolvedValue({ id: 200, name: "New Table", seats: 4 }),
  updateTable: jest.fn().mockResolvedValue({}),
  deleteTable: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name }: { name: string }) => <Text testID={`icon-${name}`}>{name}</Text>,
  };
});

const mockSection = {
  id: 10,
  name: "Main Floor",
  tables: [
    { id: 100, name: "T1", seats: 4 },
    { id: 101, name: "T2", seats: 2 },
  ],
};

describe("SectionBlock", () => {
  const defaultProps = {
    section: mockSection,
    restaurantId: 1,
    isDark: false,
    borderColor: "#eee",
    mutedColor: "#888",
    confirmAction: jest.fn().mockResolvedValue(true),
    onSectionRenamed: jest.fn(),
    onSectionDeleted: jest.fn(),
    onTableAdded: jest.fn(),
    onTableUpdated: jest.fn(),
    onTableDeleted: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders section name", () => {
    render(<SectionBlock {...defaultProps} />);
    expect(screen.getByText("Main Floor")).toBeTruthy();
  });

  it("renders table names", () => {
    render(<SectionBlock {...defaultProps} />);
    expect(screen.getByText("T1")).toBeTruthy();
    expect(screen.getByText("T2")).toBeTruthy();
  });

  it("shows total seats count", () => {
    render(<SectionBlock {...defaultProps} />);
    // 4 + 2 = 6 total seats, shown as "2 tables · 6 seats"
    expect(screen.getByText("2 tables · 6 seats")).toBeTruthy();
  });

  it("renders in dark mode", () => {
    const { toJSON } = render(<SectionBlock {...defaultProps} isDark={true} />);
    expect(toJSON()).toBeDefined();
  });

  it("renders section with no tables", () => {
    const { toJSON } = render(
      <SectionBlock {...defaultProps} section={{ ...mockSection, tables: [] }} />
    );
    expect(toJSON()).toBeDefined();
  });

  it("opens rename form when edit button is pressed", () => {
    render(<SectionBlock {...defaultProps} />);
    fireEvent.press(screen.getByText("Edit"));
    expect(screen.getByDisplayValue("Main Floor")).toBeTruthy();
  });

  it("renames section on save", async () => {
    const restaurantsApi = require("@/api/restaurants");
    const onSectionRenamed = jest.fn();
    render(<SectionBlock {...defaultProps} onSectionRenamed={onSectionRenamed} />);

    fireEvent.press(screen.getByText("Edit"));
    fireEvent.changeText(screen.getByDisplayValue("Main Floor"), "Upper Floor");
    fireEvent.press(screen.getByText("Save"));

    await waitFor(() => {
      expect(restaurantsApi.updateSection).toHaveBeenCalledWith(1, 10, "Upper Floor");
    });
  });

  it("cancels rename by pressing close icon button", () => {
    render(<SectionBlock {...defaultProps} />);
    fireEvent.press(screen.getByText("Edit"));
    expect(screen.getByDisplayValue("Main Floor")).toBeTruthy();
    // Press the close icon to cancel
    fireEvent.press(screen.getByTestId("icon-close-outline"));
    expect(screen.getByText("Main Floor")).toBeTruthy();
  });

  it("does not save when draft is empty", async () => {
    const restaurantsApi = require("@/api/restaurants");
    render(<SectionBlock {...defaultProps} />);
    fireEvent.press(screen.getByText("Edit"));
    fireEvent.changeText(screen.getByDisplayValue("Main Floor"), "");
    fireEvent.press(screen.getByText("Save"));
    await waitFor(() => {
      expect(restaurantsApi.updateSection).not.toHaveBeenCalled();
    });
  });

  it("deletes section when confirmed", async () => {
    const restaurantsApi = require("@/api/restaurants");
    const onSectionDeleted = jest.fn();
    render(<SectionBlock {...defaultProps} onSectionDeleted={onSectionDeleted} />);
    // First trash-outline is the section delete; others are for individual tables
    const trashIcons = screen.getAllByTestId("icon-trash-outline");
    fireEvent.press(trashIcons[0]);
    await waitFor(() => {
      expect(restaurantsApi.deleteSection).toHaveBeenCalledWith(1, 10);
      expect(onSectionDeleted).toHaveBeenCalled();
    });
  });

  it("does not delete section when confirmation denied", async () => {
    const restaurantsApi = require("@/api/restaurants");
    const onSectionDeleted = jest.fn();
    defaultProps.confirmAction.mockResolvedValueOnce(false);
    render(<SectionBlock {...defaultProps} onSectionDeleted={onSectionDeleted} />);
    const trashIcons = screen.getAllByTestId("icon-trash-outline");
    fireEvent.press(trashIcons[0]);
    await waitFor(() => {
      expect(defaultProps.confirmAction).toHaveBeenCalled();
    });
    expect(restaurantsApi.deleteSection).not.toHaveBeenCalled();
  });

  it("deletes a table and calls onTableDeleted", async () => {
    const restaurantsApi = require("@/api/restaurants");
    restaurantsApi.deleteTable.mockResolvedValue(true);
    const onTableDeleted = jest.fn();
    render(<SectionBlock {...defaultProps} onTableDeleted={onTableDeleted} />);
    // Second trash icon is the first table's delete
    const trashIcons = screen.getAllByTestId("icon-trash-outline");
    fireEvent.press(trashIcons[1]);
    await waitFor(() => {
      expect(restaurantsApi.deleteTable).toHaveBeenCalledWith(1, 10, 100);
      expect(onTableDeleted).toHaveBeenCalledWith(100);
    });
  });

  it("adds a table via AddRow", async () => {
    const restaurantsApi = require("@/api/restaurants");
    const onTableAdded = jest.fn();
    render(<SectionBlock {...defaultProps} onTableAdded={onTableAdded} />);
    // Open AddRow
    fireEvent.press(screen.getByText("Add Table"));
    // Type a table name
    const nameInput = screen.getByPlaceholderText("Table name (e.g. T1, Booth 1)");
    fireEvent.changeText(nameInput, "T3");
    // Type seat count
    const seatsInput = screen.getByPlaceholderText("Seats");
    fireEvent.changeText(seatsInput, "4");
    // Press Add
    fireEvent.press(screen.getByText("Add"));
    await waitFor(() => {
      expect(restaurantsApi.addTable).toHaveBeenCalledWith(1, 10, { name: "T3", seats: 4 });
      expect(onTableAdded).toHaveBeenCalled();
    });
  });
});
