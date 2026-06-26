/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import Select from "@/components/common/Select";

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ appName: "Test App", primaryColor: "#000" }),
}));

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

describe("Select", () => {
  const options = [
    { label: "Option 1", value: "1" },
    { label: "Option 2", value: "2" },
  ];
  const onSelect = jest.fn();

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

  it("renders in dark mode", () => {
    const mockUseColorScheme = jest.fn(() => "dark");
    jest.doMock("@/hooks/use-color-scheme", () => ({ useColorScheme: mockUseColorScheme }));
    render(<Select selectedValue="1" options={options} onSelect={onSelect} />);
    expect(screen.getByText("Option 1")).toBeTruthy();
    jest.dontMock("@/hooks/use-color-scheme");
  });

  it("shows checkmark on selected item inside modal", () => {
    render(<Select selectedValue="1" options={options} onSelect={onSelect} />);
    fireEvent.press(screen.getByText("Option 1"));
    // Inside the modal, the selected item shows a checkmark
    expect(screen.getByText("✓")).toBeTruthy();
  });
});
