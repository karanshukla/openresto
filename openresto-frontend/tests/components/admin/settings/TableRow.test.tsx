import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react-native";
import { TableRow } from "@/components/admin/settings/TableRow";
import * as restaurantsApi from "@/api/restaurants";
import { useBrand } from "@/context/BrandContext";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/api/restaurants", () => ({
  updateTable: jest.fn(),
  deleteTable: jest.fn(),
  fetchTableDeleteImpact: jest.fn(),
}));

jest.mock("@/utils/colors", () => ({
  hexToRgba: (hex: string, _opacity: number) => hex,
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: jest.fn(() => ({ primaryColor: "#0a7ea4", appName: "Open Resto" })),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

const baseTable = { id: 5, name: "T1", seats: 4 };

const baseProps = {
  table: baseTable,
  restaurantId: 1,
  sectionId: 2,
  isDark: false,
  borderColor: "#ddd",
  onUpdated: jest.fn(),
  onDeleted: jest.fn(),
};

describe("TableRow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders table name and seats in view mode", () => {
    render(<TableRow {...baseProps} />);
    expect(screen.getByText("T1")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
  });

  it("renders table id fallback when name is null", () => {
    render(<TableRow {...baseProps} table={{ ...baseTable, name: null }} />);
    expect(screen.getByText("T5")).toBeTruthy();
  });

  it("enters edit mode when pencil button is pressed", () => {
    render(<TableRow {...baseProps} />);
    const accessible = screen.UNSAFE_getAllByProps({ accessible: true });
    // First accessible is the edit (pencil) button
    act(() => {
      fireEvent.press(accessible[0]);
    });
    expect(screen.getByDisplayValue("T1")).toBeTruthy();
    expect(screen.getByDisplayValue("4")).toBeTruthy();
  });

  it("shows Cancel and Save buttons in edit mode", () => {
    render(<TableRow {...baseProps} />);
    const accessible = screen.UNSAFE_getAllByProps({ accessible: true });
    act(() => {
      fireEvent.press(accessible[0]);
    });
    expect(screen.getByText("Cancel")).toBeTruthy();
    expect(screen.getByText("Save")).toBeTruthy();
  });

  it("calls updateTable and onUpdated when save is pressed with valid data", async () => {
    const updatedTable = { id: 5, name: "T1-Updated", seats: 2 };
    (restaurantsApi.updateTable as jest.Mock).mockResolvedValue(updatedTable);
    render(<TableRow {...baseProps} />);
    const accessible = screen.UNSAFE_getAllByProps({ accessible: true });
    act(() => {
      fireEvent.press(accessible[0]);
    });
    fireEvent.changeText(screen.getByDisplayValue("T1"), "T1-Updated");
    fireEvent.changeText(screen.getByDisplayValue("4"), "2");
    await act(async () => {
      fireEvent.press(screen.getByText("Save"));
    });
    expect(restaurantsApi.updateTable).toHaveBeenCalledWith(1, 2, 5, {
      name: "T1-Updated",
      seats: 2,
    });
    expect(baseProps.onUpdated).toHaveBeenCalledWith(updatedTable);
  });

  it("does not save when seats is not a valid number", async () => {
    render(<TableRow {...baseProps} />);
    const accessible = screen.UNSAFE_getAllByProps({ accessible: true });
    act(() => {
      fireEvent.press(accessible[0]);
    });
    fireEvent.changeText(screen.getByDisplayValue("4"), "abc");
    await act(async () => {
      fireEvent.press(screen.getByText("Save"));
    });
    expect(restaurantsApi.updateTable).not.toHaveBeenCalled();
  });

  it("does not save when seats is 0", async () => {
    render(<TableRow {...baseProps} />);
    const accessible = screen.UNSAFE_getAllByProps({ accessible: true });
    act(() => {
      fireEvent.press(accessible[0]);
    });
    fireEvent.changeText(screen.getByDisplayValue("4"), "0");
    await act(async () => {
      fireEvent.press(screen.getByText("Save"));
    });
    expect(restaurantsApi.updateTable).not.toHaveBeenCalled();
  });

  it("cancels edit mode when Cancel is pressed", () => {
    render(<TableRow {...baseProps} />);
    const accessible = screen.UNSAFE_getAllByProps({ accessible: true });
    act(() => {
      fireEvent.press(accessible[0]);
    });
    fireEvent.press(screen.getByText("Cancel"));
    expect(screen.getByText("T1")).toBeTruthy();
  });

  // ── Two-step delete friction (#270) ───────────────────────────────────────
  //
  // `Delete…` reveals an inline confirmation that names the consequence (incl. the count of future
  // bookings that lose their table reference) and requires a second explicit tap to destroy. Cancel
  // returns to the row. Mirrors DangerZone's deleteStep pattern.

  it("reveals an inline confirmation and fetches the impact count when Delete… is pressed", async () => {
    (restaurantsApi.fetchTableDeleteImpact as jest.Mock).mockResolvedValue({ bookings: 3 });
    render(<TableRow {...baseProps} />);
    await act(async () => {
      fireEvent.press(screen.getByText("Delete…"));
    });
    expect(restaurantsApi.fetchTableDeleteImpact).toHaveBeenCalledWith(1, 2, 5);
    // The confirm copy names the table and the concrete consequence.
    expect(screen.getByText(/Delete “T1”\?/)).toBeTruthy();
    expect(
      await screen.findByText(/3 future bookings will lose their table reference/)
    ).toBeTruthy();
    expect(screen.getByText("Yes, delete")).toBeTruthy();
    expect(screen.getByText("Cancel")).toBeTruthy();
  });

  it("deletes only after the second explicit tap (Yes, delete)", async () => {
    (restaurantsApi.fetchTableDeleteImpact as jest.Mock).mockResolvedValue({ bookings: 0 });
    (restaurantsApi.deleteTable as jest.Mock).mockResolvedValue(true);
    render(<TableRow {...baseProps} />);
    await act(async () => {
      fireEvent.press(screen.getByText("Delete…"));
    });
    // The actual delete call is NOT made by the first tap — only by the confirm tap.
    expect(restaurantsApi.deleteTable).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.press(screen.getByText("Yes, delete"));
    });
    expect(restaurantsApi.deleteTable).toHaveBeenCalledWith(1, 2, 5);
    expect(baseProps.onDeleted).toHaveBeenCalled();
  });

  it("does not delete when Cancel is pressed in the confirm step", async () => {
    (restaurantsApi.fetchTableDeleteImpact as jest.Mock).mockResolvedValue({ bookings: 1 });
    render(<TableRow {...baseProps} />);
    await act(async () => {
      fireEvent.press(screen.getByText("Delete…"));
    });
    fireEvent.press(screen.getByTestId("table-delete-cancel-btn"));
    expect(restaurantsApi.deleteTable).not.toHaveBeenCalled();
    expect(baseProps.onDeleted).not.toHaveBeenCalled();
    // Back to the idle row — the destructive confirm copy is gone.
    expect(screen.queryByText("Yes, delete")).toBeNull();
    expect(screen.getByText("Delete…")).toBeTruthy();
  });

  it("falls back to generic copy when the impact read fails or is unavailable", async () => {
    (restaurantsApi.fetchTableDeleteImpact as jest.Mock).mockResolvedValue(null);
    render(<TableRow {...baseProps} />);
    await act(async () => {
      fireEvent.press(screen.getByText("Delete…"));
    });
    expect(
      await screen.findByText(/Future bookings on this table will lose their reference/)
    ).toBeTruthy();
  });

  it("uses singular copy when exactly one future booking is affected", async () => {
    (restaurantsApi.fetchTableDeleteImpact as jest.Mock).mockResolvedValue({ bookings: 1 });
    render(<TableRow {...baseProps} />);
    await act(async () => {
      fireEvent.press(screen.getByText("Delete…"));
    });
    expect(await screen.findByText(/1 future booking will lose its table reference/)).toBeTruthy();
  });

  it("renders in dark mode", () => {
    render(<TableRow {...baseProps} isDark />);
    expect(screen.getByText("T1")).toBeTruthy();
  });

  it("renders tableIcon with seats=1 (person-outline branch)", () => {
    render(<TableRow {...baseProps} table={{ ...baseTable, seats: 1 }} />);
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("renders tableIcon with seats=8 (apps-outline branch)", () => {
    render(<TableRow {...baseProps} table={{ ...baseTable, seats: 8 }} />);
    expect(screen.getByText("8")).toBeTruthy();
  });

  it("renders tableIcon with seats=10 (albums-outline branch)", () => {
    render(<TableRow {...baseProps} table={{ ...baseTable, seats: 10 }} />);
    expect(screen.getByText("10")).toBeTruthy();
  });

  it("falls back to the default primary color when the brand has none", () => {
    (useBrand as jest.Mock).mockReturnValueOnce({ primaryColor: "", appName: "Open Resto" });
    render(<TableRow {...baseProps} />);
    const accessible = screen.UNSAFE_getAllByProps({ accessible: true });
    act(() => {
      fireEvent.press(accessible[0]);
    });
    expect(screen.getByText("Save")).toBeTruthy();
  });

  it("seeds the edit form and delete confirmation with the table id when name is null", async () => {
    (restaurantsApi.fetchTableDeleteImpact as jest.Mock).mockResolvedValue({ bookings: 0 });
    render(<TableRow {...baseProps} table={{ ...baseTable, name: null }} />);
    const accessible = screen.UNSAFE_getAllByProps({ accessible: true });
    act(() => {
      fireEvent.press(accessible[0]);
    });
    expect(screen.getByDisplayValue("")).toBeTruthy();
    expect(screen.getByText("EDITING · Table 5")).toBeTruthy();
    fireEvent.press(screen.getByText("Cancel"));

    await act(async () => {
      fireEvent.press(screen.getByText("Delete…"));
    });
    // The confirm copy falls back to the "Table {id}" label when the name is null.
    expect(await screen.findByText(/Delete “Table 5”\?/)).toBeTruthy();
  });

  it("does not call onDeleted when deleteTable resolves falsy", async () => {
    (restaurantsApi.fetchTableDeleteImpact as jest.Mock).mockResolvedValue({ bookings: 0 });
    (restaurantsApi.deleteTable as jest.Mock).mockResolvedValue(false);
    render(<TableRow {...baseProps} />);
    await act(async () => {
      fireEvent.press(screen.getByText("Delete…"));
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Yes, delete"));
    });
    expect(restaurantsApi.deleteTable).toHaveBeenCalledWith(1, 2, 5);
    expect(baseProps.onDeleted).not.toHaveBeenCalled();
  });

  it("renders the edit-mode background in dark mode", () => {
    render(<TableRow {...baseProps} isDark />);
    const accessible = screen.UNSAFE_getAllByProps({ accessible: true });
    act(() => {
      fireEvent.press(accessible[0]);
    });
    expect(screen.getByText("Save")).toBeTruthy();
  });

  it("saves with an undefined name when the name field is cleared", async () => {
    const updatedTable = { id: 5, name: null, seats: 4 };
    (restaurantsApi.updateTable as jest.Mock).mockResolvedValue(updatedTable);
    render(<TableRow {...baseProps} />);
    const accessible = screen.UNSAFE_getAllByProps({ accessible: true });
    act(() => {
      fireEvent.press(accessible[0]);
    });
    fireEvent.changeText(screen.getByDisplayValue("T1"), "   ");
    await act(async () => {
      fireEvent.press(screen.getByText("Save"));
    });
    expect(restaurantsApi.updateTable).toHaveBeenCalledWith(1, 2, 5, {
      name: undefined,
      seats: 4,
    });
  });

  it("stays in edit mode when updateTable resolves falsy", async () => {
    (restaurantsApi.updateTable as jest.Mock).mockResolvedValue(null);
    render(<TableRow {...baseProps} />);
    const accessible = screen.UNSAFE_getAllByProps({ accessible: true });
    act(() => {
      fireEvent.press(accessible[0]);
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Save"));
    });
    expect(baseProps.onUpdated).not.toHaveBeenCalled();
    expect(screen.getByText("Save")).toBeTruthy();
  });

  it("shows saving state while updating", async () => {
    let resolve: (v: typeof baseTable | null) => void;
    (restaurantsApi.updateTable as jest.Mock).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      })
    );
    render(<TableRow {...baseProps} />);
    const accessible = screen.UNSAFE_getAllByProps({ accessible: true });
    act(() => {
      fireEvent.press(accessible[0]);
    });
    act(() => {
      fireEvent.press(screen.getByText("Save"));
    });
    expect(screen.getByText("Saving…")).toBeTruthy();
    await act(async () => {
      resolve!(baseTable);
    });
  });
});
