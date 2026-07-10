import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { BookingConfirmationToggle } from "@/components/admin/settings/BookingConfirmationToggle";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

// Replace ToggleSwitch with a controllable stand-in so we can exercise
// BookingConfirmationToggle's own onChange handler (including its
// confirmDisabled guard) independently of ToggleSwitch's internal disabled
// handling. SubLabel is kept real so title text still renders.
jest.mock("@/components/admin/settings/settingsShared", () => {
  const RN = require("react-native");
  const actual = jest.requireActual("@/components/admin/settings/settingsShared");
  return {
    ...actual,
    ToggleSwitch: ({
      checked,
      onChange,
      disabled,
    }: {
      checked: boolean;
      onChange: (v: boolean) => void;
      disabled?: boolean;
    }) => (
      <RN.Pressable testID="mock-toggle-switch" onPress={() => onChange(!checked)}>
        <RN.Text>{`switch:${checked ? "on" : "off"}:${disabled ? "disabled" : "enabled"}`}</RN.Text>
      </RN.Pressable>
    ),
  };
});

describe("BookingConfirmationToggle", () => {
  const baseProps = {
    sendConfirmations: false,
    confirmDisabled: false,
    onToggle: jest.fn(),
    borderColor: "#ddd",
    mutedColor: "#888",
    primaryColor: "#0a7ea4",
    cardBg: "#fff",
    surface2: "#f5f5f5",
    accentSoft: "#eef",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the title and description", () => {
    render(<BookingConfirmationToggle {...baseProps} />);
    expect(screen.getByText("Booking confirmation")).toBeTruthy();
    expect(screen.getByText("Sent the moment a guest books a table.")).toBeTruthy();
    expect(screen.getByText("Booking confirmations")).toBeTruthy();
  });

  it("does not show the SMTP hint when enabled", () => {
    render(<BookingConfirmationToggle {...baseProps} confirmDisabled={false} />);
    expect(screen.queryByText("Configure and test SMTP above to enable.")).toBeNull();
  });

  it("shows the SMTP hint when disabled", () => {
    render(<BookingConfirmationToggle {...baseProps} confirmDisabled />);
    expect(screen.getByText("Configure and test SMTP above to enable.")).toBeTruthy();
  });

  it("passes the checked state through to the switch", () => {
    render(<BookingConfirmationToggle {...baseProps} sendConfirmations={true} />);
    expect(screen.getByText("switch:on:enabled")).toBeTruthy();
  });

  it("passes the disabled state through to the switch", () => {
    render(<BookingConfirmationToggle {...baseProps} confirmDisabled sendConfirmations={false} />);
    expect(screen.getByText("switch:off:disabled")).toBeTruthy();
  });

  it("calls onToggle with the negated value when the switch fires onChange", () => {
    const onToggle = jest.fn();
    render(
      <BookingConfirmationToggle {...baseProps} sendConfirmations={false} onToggle={onToggle} />
    );
    fireEvent.press(screen.getByTestId("mock-toggle-switch"));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it("calls onToggle with the negated value when the row is pressed", () => {
    const onToggle = jest.fn();
    render(
      <BookingConfirmationToggle {...baseProps} sendConfirmations={true} onToggle={onToggle} />
    );
    fireEvent.press(screen.getByText("Booking confirmation"));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it("does not call onToggle when the row is pressed while confirmDisabled", () => {
    const onToggle = jest.fn();
    render(
      <BookingConfirmationToggle
        {...baseProps}
        sendConfirmations={false}
        confirmDisabled
        onToggle={onToggle}
      />
    );
    fireEvent.press(screen.getByText("Booking confirmation"));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("does not call onToggle when the switch's onChange fires while confirmDisabled", () => {
    // Exercises BookingConfirmationToggle's own confirmDisabled guard inside
    // the ToggleSwitch onChange handler (independent of ToggleSwitch's own
    // internal disabled short-circuit, since the stand-in above always fires).
    const onToggle = jest.fn();
    render(
      <BookingConfirmationToggle
        {...baseProps}
        sendConfirmations={false}
        confirmDisabled
        onToggle={onToggle}
      />
    );
    fireEvent.press(screen.getByTestId("mock-toggle-switch"));
    expect(onToggle).not.toHaveBeenCalled();
  });
});
