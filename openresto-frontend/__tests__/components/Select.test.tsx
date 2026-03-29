import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import Select from "@/components/common/Select";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

const options = [
  { label: "Option A", value: "a" },
  { label: "Option B", value: "b" },
  { label: "Option C", value: "c" },
];

describe("Select", () => {
  it("renders placeholder when no value selected", () => {
    render(<Select options={options} onSelect={jest.fn()} placeholder="Pick one" />);
    expect(screen.getByText("Pick one")).toBeTruthy();
  });

  it("renders the selected option label", () => {
    render(<Select options={options} onSelect={jest.fn()} selectedValue="b" />);
    expect(screen.getByText("Option B")).toBeTruthy();
  });

  it("renders chevron indicator", () => {
    render(<Select options={options} onSelect={jest.fn()} />);
    expect(screen.getByText("▾")).toBeTruthy();
  });

  it("opens modal when trigger is pressed", () => {
    render(<Select options={options} onSelect={jest.fn()} placeholder="Pick one" />);
    fireEvent.press(screen.getByText("Pick one"));
    // All options should now be visible in the modal
    expect(screen.getByText("Option A")).toBeTruthy();
    expect(screen.getByText("Option B")).toBeTruthy();
    expect(screen.getByText("Option C")).toBeTruthy();
  });

  it("calls onSelect when an option is pressed", () => {
    const onSelect = jest.fn();
    render(<Select options={options} onSelect={onSelect} placeholder="Pick one" />);
    fireEvent.press(screen.getByText("Pick one"));
    fireEvent.press(screen.getByText("Option A"));
    expect(onSelect).toHaveBeenCalledWith("a");
  });

  it("shows checkmark for selected option", () => {
    render(<Select options={options} onSelect={jest.fn()} selectedValue="b" />);
    // Open modal to see checkmark
    fireEvent.press(screen.getByText("Option B"));
    expect(screen.getByText("✓")).toBeTruthy();
  });
});
