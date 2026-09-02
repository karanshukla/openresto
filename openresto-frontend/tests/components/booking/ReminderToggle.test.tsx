/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, screen } from "@testing-library/react-native";
import ReminderToggle from "@/components/booking/ReminderToggle";
import { useBookingReminder } from "@/hooks/use-booking-reminder";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";

jest.mock("@/hooks/use-booking-reminder", () => ({ useBookingReminder: jest.fn() }));

const hook = useBookingReminder as jest.Mock;
const enable = jest.fn().mockResolvedValue(undefined);
const disable = jest.fn().mockResolvedValue(undefined);

function renderToggle(status: string) {
  hook.mockReturnValue({ status, enable, disable });
  return renderWithProviders(<ReminderToggle bookingRef="ref-1" email="x@y.z" separator={<></>} />);
}

beforeEach(() => jest.clearAllMocks());

describe("ReminderToggle", () => {
  it("renders nothing where reminders are unsupported", () => {
    renderToggle("unsupported");
    expect(screen.queryByTestId("reminder-toggle")).toBeNull();
  });

  it("offers to turn reminders on, and turns them on when pressed", () => {
    renderToggle("off");
    expect(screen.getByText("REMINDERS")).toBeTruthy();
    expect(screen.getByText("Remind me")).toBeTruthy();
    expect(screen.getByText(/day before and shortly before/)).toBeTruthy();
    fireEvent.press(screen.getByTestId("reminder-toggle-btn"));
    expect(enable).toHaveBeenCalled();
    expect(disable).not.toHaveBeenCalled();
  });

  it("reads as on and turns off when pressed", () => {
    renderToggle("on");
    expect(screen.getByText("Reminders on")).toBeTruthy();
    expect(screen.getByLabelText("Turn off booking reminders on this device")).toBeTruthy();
    fireEvent.press(screen.getByTestId("reminder-toggle-btn"));
    expect(disable).toHaveBeenCalled();
  });

  it("explains a refused prompt instead of re-prompting", () => {
    renderToggle("denied");
    expect(screen.getByText(/turned off for this app/)).toBeTruthy();
    fireEvent.press(screen.getByTestId("reminder-toggle-btn"));
    expect(enable).not.toHaveBeenCalled();
  });

  it("explains a failed subscription and lets the guest retry", () => {
    renderToggle("error");
    expect(screen.getByText(/Couldn't turn on reminders/)).toBeTruthy();
    fireEvent.press(screen.getByTestId("reminder-toggle-btn"));
    expect(enable).toHaveBeenCalled();
  });

  it("shows a spinner while busy", () => {
    renderToggle("busy");
    expect(screen.getByTestId("reminder-toggle")).toBeTruthy();
  });
});
