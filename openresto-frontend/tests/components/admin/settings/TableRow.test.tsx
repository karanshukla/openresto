import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { TableRow } from "@/components/admin/settings/TableRow";
import * as restaurantsApi from "@/api/restaurants";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/api/restaurants", () => ({
  updateTable: jest.fn(),
  deleteTable: jest.fn(),
}));

jest.mock("@/utils/colors", () => ({
  hexToRgba: (hex: string, _opacity: number) => hex,
}));

jest.mock("@/context/BrandContext", () => {
  const brand = { primaryColor: "#0a7ea4", appName: "Open Resto" };
  return { useBrand: () => brand };
});

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
  confirmAction: jest.fn(),
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

  it("calls confirmAction and deleteTable when delete is confirmed", async () => {
    (baseProps.confirmAction as jest.Mock).mockResolvedValue(true);
    (restaurantsApi.deleteTable as jest.Mock).mockResolvedValue(true);
    render(<TableRow {...baseProps} />);
    // Each Pressable generates 2 accessible fiber nodes; edit=0,1 delete=2,3
    const accessible = screen.UNSAFE_getAllByProps({ accessible: true });
    await act(async () => {
      fireEvent.press(accessible[2]);
    });
    expect(baseProps.confirmAction).toHaveBeenCalledWith('Delete table "T1"?');
    expect(restaurantsApi.deleteTable).toHaveBeenCalledWith(1, 2, 5);
    expect(baseProps.onDeleted).toHaveBeenCalled();
  });

  it("does not delete when confirmAction returns false", async () => {
    (baseProps.confirmAction as jest.Mock).mockResolvedValue(false);
    render(<TableRow {...baseProps} />);
    const accessible = screen.UNSAFE_getAllByProps({ accessible: true });
    await act(async () => {
      fireEvent.press(accessible[2]);
    });
    expect(restaurantsApi.deleteTable).not.toHaveBeenCalled();
    expect(baseProps.onDeleted).not.toHaveBeenCalled();
  });

  it("renders in dark mode", () => {
    render(<TableRow {...baseProps} isDark />);
    expect(screen.getByText("T1")).toBeTruthy();
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
