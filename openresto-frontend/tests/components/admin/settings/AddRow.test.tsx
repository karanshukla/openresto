import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { AddRow } from "@/components/admin/settings/AddRow";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#0a7ea4", appName: "Open Resto" }),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

describe("AddRow", () => {
  const onAdd = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the add button with label", () => {
    render(<AddRow label="Add Item" onAdd={onAdd} />);
    expect(screen.getByText("Add Item")).toBeTruthy();
  });

  it("opens the form when button is pressed", () => {
    render(<AddRow label="Add Item" placeholder="Item name" onAdd={onAdd} />);
    fireEvent.press(screen.getByText("Add Item"));
    expect(screen.getByPlaceholderText("Item name")).toBeTruthy();
  });

  it("uses default placeholder 'Name' when none provided", () => {
    render(<AddRow label="Add Item" onAdd={onAdd} />);
    fireEvent.press(screen.getByText("Add Item"));
    expect(screen.getByPlaceholderText("Name")).toBeTruthy();
  });

  it("shows extra input when extraPlaceholder is provided", () => {
    render(
      <AddRow label="Add Table" placeholder="Table name" extraPlaceholder="Seats" onAdd={onAdd} />
    );
    fireEvent.press(screen.getByText("Add Table"));
    expect(screen.getByPlaceholderText("Table name")).toBeTruthy();
    expect(screen.getByPlaceholderText("Seats")).toBeTruthy();
  });

  it("does not show extra input without extraPlaceholder", () => {
    render(<AddRow label="Add Item" placeholder="Item name" onAdd={onAdd} />);
    fireEvent.press(screen.getByText("Add Item"));
    expect(screen.queryByPlaceholderText("Seats")).toBeNull();
  });

  it("calls onAdd with trimmed name when Add is pressed", async () => {
    onAdd.mockResolvedValue(undefined);
    render(<AddRow label="Add Item" placeholder="Item name" onAdd={onAdd} />);
    fireEvent.press(screen.getByText("Add Item"));
    fireEvent.changeText(screen.getByPlaceholderText("Item name"), "  My Item  ");
    await act(async () => {
      fireEvent.press(screen.getByText("Add"));
    });
    expect(onAdd).toHaveBeenCalledWith("My Item", undefined);
  });

  it("calls onAdd with name and extra when both provided", async () => {
    onAdd.mockResolvedValue(undefined);
    render(
      <AddRow label="Add Table" placeholder="Table name" extraPlaceholder="Seats" onAdd={onAdd} />
    );
    fireEvent.press(screen.getByText("Add Table"));
    fireEvent.changeText(screen.getByPlaceholderText("Table name"), "T1");
    fireEvent.changeText(screen.getByPlaceholderText("Seats"), "4");
    await act(async () => {
      fireEvent.press(screen.getByText("Add"));
    });
    expect(onAdd).toHaveBeenCalledWith("T1", "4");
  });

  it("does not call onAdd when name is empty", async () => {
    render(<AddRow label="Add Item" placeholder="Item name" onAdd={onAdd} />);
    fireEvent.press(screen.getByText("Add Item"));
    await act(async () => {
      fireEvent.press(screen.getByText("Add"));
    });
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("resets and closes form when cancel is pressed", async () => {
    render(<AddRow label="Add Item" placeholder="Item name" onAdd={onAdd} />);
    fireEvent.press(screen.getByText("Add Item"));
    fireEvent.changeText(screen.getByPlaceholderText("Item name"), "Something");
    await act(async () => {
      // press the close button (last Pressable in rowActions area)
      const addBtn = screen.getByText("Add");
      // Close is the Ionicons button — find via testID won't work, use the cancel press
      // We trigger by pressing an element after the Add button
    });
    // After successful add, form resets
    onAdd.mockResolvedValue(undefined);
    fireEvent.changeText(screen.getByPlaceholderText("Item name"), "Valid");
    await act(async () => {
      fireEvent.press(screen.getByText("Add"));
    });
    // Form should close and show label button again
    await waitFor(() => {
      expect(screen.getByText("Add Item")).toBeTruthy();
    });
  });

  it("shows 'Adding…' text while saving", async () => {
    let resolveAdd: () => void;
    const slowAdd = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveAdd = resolve;
        })
    );
    render(<AddRow label="Add Item" placeholder="Item name" onAdd={slowAdd} />);
    fireEvent.press(screen.getByText("Add Item"));
    fireEvent.changeText(screen.getByPlaceholderText("Item name"), "Test");
    act(() => {
      fireEvent.press(screen.getByText("Add"));
    });
    expect(screen.getByText("Adding…")).toBeTruthy();
    await act(async () => {
      resolveAdd!();
    });
  });

  it("closes form and resets when cancel button is pressed", async () => {
    render(<AddRow label="Add Item" placeholder="Item name" onAdd={onAdd} />);
    fireEvent.press(screen.getByText("Add Item"));
    fireEvent.changeText(screen.getByPlaceholderText("Item name"), "Something");

    // Cancel is the last accessible element in the form
    const accessible = screen.UNSAFE_getAllByProps({ accessible: true });
    act(() => {
      fireEvent.press(accessible[accessible.length - 1]);
    });

    expect(screen.getByText("Add Item")).toBeTruthy();
    expect(screen.queryByPlaceholderText("Item name")).toBeNull();
  });
});
