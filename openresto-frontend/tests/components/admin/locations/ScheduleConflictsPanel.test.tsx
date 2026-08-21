import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import { ScheduleConflictsPanel } from "@/components/admin/locations/ScheduleConflictsPanel";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/api/restaurants", () => ({
  fetchScheduleConflicts: jest.fn(),
}));

const { fetchScheduleConflicts } = require("@/api/restaurants");

const conflict = {
  bookingId: 7,
  bookingRef: "crispy-basil-truffle",
  customerName: "Ada Lovelace",
  date: "2026-09-02T10:00:00Z",
  seats: 2,
  reason: "outsideHours" as const,
};

const onOpenBooking = jest.fn();

const props = {
  restaurantId: 1,
  timezone: "UTC",
  onOpenBooking,
  refreshKey: 0,
  borderColor: "#eee",
  mutedColor: "#888",
  cardBg: "#fff",
};

describe("ScheduleConflictsPanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists an upcoming booking the current schedule no longer accepts", async () => {
    (fetchScheduleConflicts as jest.Mock).mockResolvedValue([conflict]);

    render(<ScheduleConflictsPanel {...props} />);

    await waitFor(() => expect(screen.getByTestId("schedule-conflicts-panel")).toBeTruthy());
    expect(screen.getByText(/1 upcoming booking no longer fit/)).toBeTruthy();
    expect(screen.getByText(/Ada Lovelace/)).toBeTruthy();
    expect(screen.getByText(/Now outside opening hours/)).toBeTruthy();
  });

  it("renders nothing when every upcoming booking still fits", async () => {
    (fetchScheduleConflicts as jest.Mock).mockResolvedValue([]);

    render(<ScheduleConflictsPanel {...props} />);

    await waitFor(() => expect(fetchScheduleConflicts).toHaveBeenCalled());
    expect(screen.queryByTestId("schedule-conflicts-panel")).toBeNull();
  });

  // A failed read is not an all-clear. Rendering the empty state for it would tell the admin
  // their edit stranded nobody, which is the one thing this panel exists to disprove.
  it("stays silent when the read fails rather than reporting all-clear", async () => {
    (fetchScheduleConflicts as jest.Mock).mockResolvedValue(null);

    render(<ScheduleConflictsPanel {...props} />);

    await waitFor(() => expect(fetchScheduleConflicts).toHaveBeenCalled());
    expect(screen.queryByTestId("schedule-conflicts-panel")).toBeNull();
  });

  it("re-reads when the schedule is saved again", async () => {
    (fetchScheduleConflicts as jest.Mock).mockResolvedValue([]);

    const { rerender } = render(<ScheduleConflictsPanel {...props} />);
    await waitFor(() => expect(fetchScheduleConflicts).toHaveBeenCalledTimes(1));

    rerender(<ScheduleConflictsPanel {...props} refreshKey={1} />);
    await waitFor(() => expect(fetchScheduleConflicts).toHaveBeenCalledTimes(2));
  });

  // The id, not the ref: the screen opens the booking popup over the form the conflict came
  // from, rather than sending the admin to the bookings list to search for a ref it already had.
  it("hands the stranded booking up by id instead of routing to it", async () => {
    (fetchScheduleConflicts as jest.Mock).mockResolvedValue([conflict]);

    render(<ScheduleConflictsPanel {...props} />);
    await waitFor(() => expect(screen.getByTestId("schedule-conflicts-panel")).toBeTruthy());

    fireEvent.press(screen.getByLabelText("Open booking crispy-basil-truffle"));

    expect(onOpenBooking).toHaveBeenCalledWith(7);
  });

  it("falls back to the reference when the booking has no customer name", async () => {
    (fetchScheduleConflicts as jest.Mock).mockResolvedValue([
      { ...conflict, customerName: null, reason: "closedDay", seats: 1 },
    ]);

    render(<ScheduleConflictsPanel {...props} />);

    await waitFor(() => expect(screen.getByText(/crispy-basil-truffle ·/)).toBeTruthy());
    expect(screen.getByText(/Now a closed day · 1 guest/)).toBeTruthy();
  });
});
