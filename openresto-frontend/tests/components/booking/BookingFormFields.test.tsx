/**
 * @jest-environment jsdom
 *
 * The party-size control is the one field that differs by platform (issue #424), and the
 * autofill hints on name and email (issue #427) are props with no visible effect, so both
 * are pinned here rather than through the two BookingForm layouts.
 */
import React from "react";
import { render, screen } from "@testing-library/react-native";
import { Platform } from "react-native";
import { EmailField, GuestsField, NameField } from "@/components/booking/BookingFormFields";

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#0a7ea4", appName: "Open Resto" }),
}));

jest.mock("expo-haptics", () => ({ selectionAsync: jest.fn() }));

const SEAT_OPTIONS = [
  { label: "1 guest", value: 1 },
  { label: "2 guests", value: 2 },
];

const renderGuests = () =>
  render(<GuestsField label="Guests" seats={2} options={SEAT_OPTIONS} onChange={jest.fn()} />);

describe("GuestsField", () => {
  const originalOS = Platform.OS;
  afterEach(() => {
    Platform.OS = originalOS;
  });

  it("offers a dropdown on web", () => {
    Platform.OS = "web";
    renderGuests();
    expect(screen.getByRole("combobox")).toBeTruthy();
    expect(screen.queryByLabelText("One more guest")).toBeNull();
  });

  it("offers a stepper off web", () => {
    Platform.OS = "ios";
    renderGuests();
    expect(screen.getByLabelText("One more guest")).toBeTruthy();
    expect(screen.getByLabelText("One fewer guest")).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("steps over the same values the dropdown offers", () => {
    Platform.OS = "ios";
    const onChange = jest.fn();
    render(<GuestsField label="Guests" seats={2} options={SEAT_OPTIONS} onChange={onChange} />);
    expect(screen.getByText("2 guests")).toBeTruthy();
    expect(screen.getByLabelText("One more guest").props.accessibilityState.disabled).toBe(true);
  });
});

describe("autofill hints", () => {
  it("offers the contact card for the name field", () => {
    render(<NameField value="" onChange={jest.fn()} />);
    const input = screen.getByLabelText("Full name");
    expect(input.props.textContentType).toBe("name");
    expect(input.props.autoComplete).toBe("name");
  });

  it("offers the saved address for the email field", () => {
    render(<EmailField value="" onChange={jest.fn()} />);
    const input = screen.getByLabelText("Email address");
    expect(input.props.textContentType).toBe("emailAddress");
    expect(input.props.autoComplete).toBe("email");
  });
});
