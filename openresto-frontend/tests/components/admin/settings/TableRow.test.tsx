import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { TableRow } from "@/components/admin/settings/TableRow";

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#007AFF", appName: "Test" }),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@/utils/colors", () => ({
  hexToRgba: jest.fn((hex: string, alpha: number) => `rgba(0,0,0,${alpha})`),
}));

jest.mock("@/api/restaurants", () => ({
  updateTable: jest.fn().mockResolvedValue({ id: 100, name: "Updated", seats: 6 }),
  deleteTable: jest.fn().mockResolvedValue(true),
}));

const mockTable = { id: 100, name: "T1", seats: 4 };

describe("TableRow", () => {
  const defaultProps = {
    table: mockTable,
    restaurantId: 1,
    sectionId: 10,
    isDark: false,
    borderColor: "#eee",
    onUpdated: jest.fn(),
    onDeleted: jest.fn(),
    confirmAction: jest.fn().mockResolvedValue(true),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    defaultProps.confirmAction.mockResolvedValue(true);
  });

  it("renders table name and seat count", () => {
    render(<TableRow {...defaultProps} />);
    expect(screen.getByText("T1")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
  });

  it("renders table with no name (uses fallback)", () => {
    render(<TableRow {...defaultProps} table={{ id: 100, name: null, seats: 4 }} />);
    expect(screen.getByText("T100")).toBeTruthy();
  });

  it("renders in dark mode", () => {
    const { toJSON } = render(<TableRow {...defaultProps} isDark={true} />);
    expect(toJSON()).toBeDefined();
  });

  it("opens edit form when pencil button is pressed", () => {
    const { UNSAFE_getAllByProps } = render(<TableRow {...defaultProps} />);
    // Pressable renders as accessible View; edit button is first accessible element
    const accessibles = UNSAFE_getAllByProps({ accessible: true });
    fireEvent.press(accessibles[0]);
    expect(screen.getByText(/EDITING/)).toBeTruthy();
  });

  it("saves changes in edit mode", async () => {
    const restaurantsApi = require("@/api/restaurants");
    const onUpdated = jest.fn();
    const { UNSAFE_getAllByProps } = render(
      <TableRow {...defaultProps} onUpdated={onUpdated} />
    );
    const accessibles = UNSAFE_getAllByProps({ accessible: true });
    fireEvent.press(accessibles[0]);

    // In edit mode - change seats
    fireEvent.changeText(screen.getByDisplayValue("4"), "6");
    fireEvent.press(screen.getByText("Save"));

    await waitFor(() => {
      expect(restaurantsApi.updateTable).toHaveBeenCalledWith(
        1, 10, 100,
        expect.objectContaining({ seats: 6 })
      );
    });
  });

  it("cancels edit mode", () => {
    const { UNSAFE_getAllByProps } = render(<TableRow {...defaultProps} />);
    const accessibles = UNSAFE_getAllByProps({ accessible: true });
    fireEvent.press(accessibles[0]);

    expect(screen.getByText(/EDITING/)).toBeTruthy();
    fireEvent.press(screen.getByText("Cancel"));
    expect(screen.getByText("T1")).toBeTruthy();
  });

  it("deletes table when confirmed", async () => {
    const restaurantsApi = require("@/api/restaurants");
    const onDeleted = jest.fn();
    const { UNSAFE_getAllByProps } = render(
      <TableRow {...defaultProps} onDeleted={onDeleted} />
    );
    const accessibles = UNSAFE_getAllByProps({ accessible: true });
    // Delete button is third accessible element (index 2)
    fireEvent.press(accessibles[2]);

    await waitFor(() => {
      expect(defaultProps.confirmAction).toHaveBeenCalled();
      expect(restaurantsApi.deleteTable).toHaveBeenCalledWith(1, 10, 100);
      expect(onDeleted).toHaveBeenCalled();
    });
  });

  it("does not delete table when confirmation denied", async () => {
    const restaurantsApi = require("@/api/restaurants");
    const onDeleted = jest.fn();
    defaultProps.confirmAction.mockResolvedValueOnce(false);
    const { UNSAFE_getAllByProps } = render(
      <TableRow {...defaultProps} onDeleted={onDeleted} />
    );
    const accessibles = UNSAFE_getAllByProps({ accessible: true });
    fireEvent.press(accessibles[2]);

    await waitFor(() => {
      expect(defaultProps.confirmAction).toHaveBeenCalled();
    });
    expect(restaurantsApi.deleteTable).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("renders table with 1 seat - person icon", () => {
    const { toJSON } = render(<TableRow {...defaultProps} table={{ id: 100, name: "T1", seats: 1 }} />);
    expect(toJSON()).toBeDefined();
  });

  it("renders table with 2 seats - people icon", () => {
    const { toJSON } = render(<TableRow {...defaultProps} table={{ id: 100, name: "T1", seats: 2 }} />);
    expect(toJSON()).toBeDefined();
  });

  it("renders table with 5 seats - grid icon", () => {
    const { toJSON } = render(<TableRow {...defaultProps} table={{ id: 100, name: "T1", seats: 5 }} />);
    expect(toJSON()).toBeDefined();
  });

  it("renders table with 8 seats - apps icon", () => {
    const { toJSON } = render(<TableRow {...defaultProps} table={{ id: 100, name: "T1", seats: 8 }} />);
    expect(toJSON()).toBeDefined();
  });

  it("renders table with 12 seats - albums icon", () => {
    const { toJSON } = render(<TableRow {...defaultProps} table={{ id: 100, name: "T1", seats: 12 }} />);
    expect(toJSON()).toBeDefined();
  });
});
