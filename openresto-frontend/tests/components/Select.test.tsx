/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react-native";
import { Modal } from "react-native";
import Select from "@/components/common/Select";
import { useBrand } from "@/context/BrandContext";
import { useColorScheme } from "@/hooks/use-color-scheme";

jest.mock("@/context/BrandContext", () => ({
  useBrand: jest.fn(() => ({ appName: "Test App", primaryColor: "#000" })),
}));

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "light"),
}));

describe("Select", () => {
  const options = [
    { label: "Option 1", value: "1" },
    { label: "Option 2", value: "2" },
  ];
  const onSelect = jest.fn();

  beforeEach(() => {
    (useColorScheme as jest.Mock).mockReturnValue("light");
  });

  it("renders with selected option", () => {
    render(<Select selectedValue="1" options={options} onSelect={onSelect} />);
    expect(screen.getByText("Option 1")).toBeTruthy();
  });

  it("opens options when pressed and selects new one", () => {
    render(<Select selectedValue="1" options={options} onSelect={onSelect} />);
    fireEvent.press(screen.getByText("Option 1"));
    expect(screen.getByText("Option 2")).toBeTruthy();
    fireEvent.press(screen.getByText("Option 2"));
    expect(onSelect).toHaveBeenCalledWith("2");
  });

  it("shows placeholder when no selectedValue", () => {
    render(<Select options={options} onSelect={onSelect} placeholder="Choose..." />);
    expect(screen.getByText("Choose...")).toBeTruthy();
  });

  it("shows default placeholder when no selectedValue and no placeholder prop", () => {
    render(<Select options={options} onSelect={onSelect} />);
    expect(screen.getByText("Select an option")).toBeTruthy();
  });

  it("defaults to light when useColorScheme returns nothing", () => {
    (useColorScheme as jest.Mock).mockReturnValue(undefined);
    render(<Select selectedValue="1" options={options} onSelect={onSelect} />);
    expect(screen.getByText("Option 1")).toBeTruthy();
  });

  it("renders in dark mode", () => {
    (useColorScheme as jest.Mock).mockReturnValue("dark");
    render(<Select selectedValue="1" options={options} onSelect={onSelect} />);
    expect(screen.getByText("Option 1")).toBeTruthy();
  });

  it("shows checkmark on selected item inside modal", () => {
    render(<Select selectedValue="1" options={options} onSelect={onSelect} />);
    fireEvent.press(screen.getByText("Option 1"));
    // Inside the modal, the selected item shows a checkmark
    expect(screen.getByText("✓")).toBeTruthy();
  });

  it("renders the item separator in dark mode when the modal is open", () => {
    (useColorScheme as jest.Mock).mockReturnValue("dark");
    render(<Select selectedValue="1" options={options} onSelect={onSelect} />);
    fireEvent.press(screen.getByText("Option 1"));
    expect(screen.getByText("Option 2")).toBeTruthy();
  });

  it("closes the modal when the backdrop is pressed", () => {
    render(<Select selectedValue="1" options={options} onSelect={onSelect} />);
    fireEvent.press(screen.getByText("Option 1"));
    expect(screen.getByText("Option 2")).toBeTruthy();
    fireEvent.press(screen.getByTestId("select-backdrop"));
    expect(screen.queryByText("Option 2")).toBeNull();
  });

  it("closes the modal when onRequestClose fires (e.g. Android back button)", () => {
    render(<Select selectedValue="1" options={options} onSelect={onSelect} />);
    fireEvent.press(screen.getByText("Option 1"));
    expect(screen.getByText("Option 2")).toBeTruthy();
    act(() => {
      screen.UNSAFE_getByType(Modal).props.onRequestClose();
    });
    expect(screen.queryByText("Option 2")).toBeNull();
  });

  it("falls back to the default primary color when the brand has none", () => {
    (useBrand as jest.Mock).mockReturnValueOnce({ appName: "Test App", primaryColor: "" });
    render(<Select selectedValue="1" options={options} onSelect={onSelect} />);
    expect(screen.getByText("Option 1")).toBeTruthy();
  });

  it("highlights the trigger border when hovered", () => {
    render(<Select selectedValue="1" options={options} onSelect={onSelect} />);
    let node = screen.getByText("Option 1").parent;
    while (node && typeof node.props?.style !== "function") {
      node = node.parent;
    }
    const styleFn = node?.props.style as (state: { hovered: boolean }) => unknown;
    expect(typeof styleFn).toBe("function");
    const hoveredStyle = styleFn({ hovered: true });
    expect(hoveredStyle).toContainEqual({ borderColor: "#000" });
  });
});
