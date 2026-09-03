/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import TimePicker, { generateTimeOptions } from "@/components/common/TimePicker";

jest.mock("@/context/BrandContext", () => ({
  useBrand: jest.fn(() => ({ appName: "Test App", primaryColor: "#000" })),
}));

jest.mock("@/utils/haptics", () => ({
  haptics: { selection: jest.fn(), press: jest.fn(), outcome: jest.fn() },
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

/**
 * The picker is a `Select` over the slots between its bounds — two hand-rolled modals, one per
 * platform, collapsed into the one control (issue #348). What is left to pin is the wiring:
 * that the bounds reach the options, that a pick comes back as an "HH:mm" string, and that the
 * `Select` underneath is still a value picker rather than a menu.
 */
describe("TimePicker", () => {
  const onSelect = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it("shows the chosen time on the trigger", () => {
    render(<TimePicker selectedTime="19:00" onSelect={onSelect} />);

    expect(screen.getByText("19:00")).toBeTruthy();
  });

  it("asks for a time when none is chosen", () => {
    render(<TimePicker onSelect={onSelect} />);

    expect(screen.getByText("Select a time")).toBeTruthy();
  });

  it("hands back the slot as an HH:mm string", () => {
    render(<TimePicker selectedTime="19:00" onSelect={onSelect} />);
    fireEvent.press(screen.getByText("19:00"));

    fireEvent.press(screen.getByLabelText("09:15"));

    expect(onSelect).toHaveBeenCalledWith("09:15");
  });

  it("offers only the slots between its bounds", () => {
    render(<TimePicker onSelect={onSelect} minTime="18:00" maxTime="19:00" />);
    fireEvent.press(screen.getByText("Select a time"));

    expect(screen.getAllByRole("option")).toHaveLength(5);
    expect(screen.queryByLabelText("09:00")).toBeNull();
  });

  it("names itself for a screen reader, alongside the time it holds", () => {
    render(<TimePicker selectedTime="19:00" onSelect={onSelect} />);

    expect(screen.getByLabelText("Time, 19:00")).toBeTruthy();
    expect(screen.getByRole("combobox")).toBeTruthy();
  });

  it("still exports the slot generator its callers reach for", () => {
    expect(generateTimeOptions("09:00", "09:30")).toEqual([
      { label: "09:00", value: "09:00" },
      { label: "09:15", value: "09:15" },
      { label: "09:30", value: "09:30" },
    ]);
  });
});
