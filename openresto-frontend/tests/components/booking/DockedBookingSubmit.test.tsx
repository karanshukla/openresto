import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import DockedBookingSubmit from "@/components/booking/DockedBookingSubmit";
import {
  BookingDockProvider,
  usePublishBookingDock,
  type BookingDockState,
} from "@/components/booking/BookingDockContext";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

const onSubmit = jest.fn();

const dockState = (over: Partial<BookingDockState> = {}): BookingDockState => ({
  holdStatus: "held",
  secondsLeft: 240,
  hasSelection: true,
  holdMessage: null,
  disabled: false,
  submitting: false,
  onSubmit,
  ...over,
});

/** Stands in for the booking form, which is what publishes in the app. */
function Publisher({ dock }: { dock: BookingDockState | null }) {
  usePublishBookingDock(dock);
  return null;
}

const renderDock = (dock: BookingDockState | null) =>
  renderWithProviders(
    <BookingDockProvider>
      <Publisher dock={dock} />
      <DockedBookingSubmit />
    </BookingDockProvider>
  );

describe("DockedBookingSubmit", () => {
  beforeEach(() => onSubmit.mockClear());

  /**
   * The sheet keeps its full height while the guest is still choosing a time, which is the part
   * that needs the room. Nothing published means nothing docked.
   */
  it("renders nothing until the form publishes a submit", () => {
    renderDock(null);

    expect(screen.queryByTestId("booking-docked-submit")).toBeNull();
  });

  it("docks the confirm once the form publishes one", () => {
    renderDock(dockState());

    expect(screen.getByTestId("booking-docked-submit")).toBeTruthy();
    expect(screen.getByText("Confirm Booking")).toBeTruthy();
  });

  it("presses through to the form's own submit", () => {
    renderDock(dockState());

    fireEvent.press(screen.getByText("Confirm Booking"));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  // The dock is the only Confirm on screen, so a form the server would reject has to show it.
  it("stays pressable-looking but inert while disabled", () => {
    renderDock(dockState({ disabled: true }));

    fireEvent.press(screen.getByText("Confirm Booking"));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("says so while the booking is in flight", () => {
    renderDock(dockState({ submitting: true }));

    expect(screen.getByText("Confirming…")).toBeTruthy();
  });

  // The countdown belongs beside the button: it is the reason there is any hurry.
  it("carries the hold countdown", () => {
    renderDock(dockState({ secondsLeft: 240 }));

    expect(screen.getByTestId("booking-docked-submit")).toBeTruthy();
    expect(screen.getByText(/4:00/)).toBeTruthy();
  });

  it("is empty outside a provider, so a form elsewhere renders its own confirm", () => {
    render(<DockedBookingSubmit />);

    expect(screen.queryByTestId("booking-docked-submit")).toBeNull();
  });
});
