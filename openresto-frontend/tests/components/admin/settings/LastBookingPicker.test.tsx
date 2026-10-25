import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { LastBookingPicker } from "@/components/admin/settings/LastBookingPicker";

jest.mock("@/components/common/Select", () => {
  const { View, Text, Pressable } = require("react-native");
  return {
    __esModule: true,
    default: ({
      options,
      selectedValue,
      onSelect,
      accessibilityLabel,
    }: {
      options: { label: string; value: string }[];
      selectedValue?: string;
      onSelect: (v: string) => void;
      accessibilityLabel?: string;
    }) => (
      <View accessibilityLabel={accessibilityLabel}>
        <Text testID="selected">{String(selectedValue)}</Text>
        {options.map((o) => (
          <Pressable
            key={o.value}
            testID={`option-${o.value || "none"}`}
            onPress={() => onSelect(o.value)}
          >
            <Text>{o.label}</Text>
          </Pressable>
        ))}
      </View>
    ),
  };
});

describe("LastBookingPicker", () => {
  it("offers Until close first, then the window's quarter-hours up to a quarter before close", () => {
    render(
      <LastBookingPicker
        open="18:00"
        close="19:00"
        value={null}
        onChange={jest.fn()}
        accessibilityLabel="Last"
      />
    );
    expect(screen.getByText("Until close")).toBeTruthy();
    expect(screen.getByText("18:00")).toBeTruthy();
    expect(screen.getByText("18:45")).toBeTruthy();
    expect(screen.queryByText("19:00")).toBeNull();
    expect(screen.getByTestId("selected").props.children).toBe("");
  });

  it("reports a picked time and Until close as null", () => {
    const onChange = jest.fn();
    render(
      <LastBookingPicker
        open="18:00"
        close="19:00"
        value="18:30"
        onChange={onChange}
        accessibilityLabel="Last"
      />
    );
    expect(screen.getByTestId("selected").props.children).toBe("18:30");
    fireEvent.press(screen.getByText("18:15"));
    expect(onChange).toHaveBeenCalledWith("18:15");
    fireEvent.press(screen.getByText("Until close"));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("carries its accessibility label to the select", () => {
    render(
      <LastBookingPicker
        open="18:00"
        close="19:00"
        value={null}
        onChange={jest.fn()}
        accessibilityLabel="Last booking"
      />
    );
    expect(screen.getByLabelText("Last booking")).toBeTruthy();
  });
});
