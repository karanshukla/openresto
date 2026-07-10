/**
 * @jest-environment jsdom
 */
import React from "react";
import { screen, fireEvent, waitFor } from "@testing-library/react-native";
import BookingForm from "@/components/booking/BookingForm";
import { useTableHold } from "@/components/booking/useTableHold";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";

// Mock useTableHold
jest.mock("@/components/booking/useTableHold");
const mockReleaseCurrentHold = jest.fn();
const mockSetHoldStatus = jest.fn();

jest.mock("@/api/availability", () => ({
  fetchAvailability: jest.fn(() =>
    Promise.resolve({
      slots: [
        { time: "12:00", isAvailable: true, category: "Lunch" },
        { time: "13:00", isAvailable: true, category: "Lunch" },
        { time: "18:00", isAvailable: true, category: "Dinner" },
      ],
    })
  ),
}));

// Mock Modal to always render children (react-native-testing-library doesn't render it by default)
jest.mock("react-native", () => {
  const rn = jest.requireActual("react-native");
  rn.Modal = ({ children, visible }: any) => (visible ? children : null);
  return rn;
});

describe("BookingForm", () => {
  const mockRestaurant = {
    id: 1,
    name: "Test Resto",
    openTime: "00:00",
    closeTime: "23:59",
    openDays: "1,2,3,4,5,6,7",
    timezone: "UTC",
    sections: [
      {
        id: 10,
        name: "Main",
        tables: [
          { id: 100, name: "T1", seats: 2, sectionId: 10 },
          { id: 101, name: "T2", seats: 4, sectionId: 10 },
        ],
      },
    ],
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    (useTableHold as jest.Mock).mockReturnValue({
      holdStatus: "held",
      secondsLeft: 60,
      holdId: "h-123",
      setHoldStatus: mockSetHoldStatus,
      releaseCurrentHold: mockReleaseCurrentHold,
    });
    // Mock window.confirm
    delete (window as any).confirm;
    (window as any).confirm = jest.fn(() => true);
  });

  it("renders correctly and handles submission", async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<BookingForm restaurant={mockRestaurant} onSubmit={onSubmit} />);

    // Fill name and email (both required by isValid)
    fireEvent.changeText(screen.getByPlaceholderText("Your full name"), "Test User");
    fireEvent.changeText(screen.getByPlaceholderText("your@email.com"), "test@test.com");

    // Click submit
    fireEvent.press(screen.getByText("Confirm Booking"));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        customerName: "Test User",
        customerEmail: "test@test.com",
        holdId: "h-123",
      })
    );
  });

  it("shows warning when seats exceed table capacity", async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<BookingForm restaurant={mockRestaurant} onSubmit={onSubmit} />);

    // Select 4 guests (Table T1 has 2, T2 has 4).
    // The component defaults to best fitting table.
    // Let's force a smaller table if we can.
    // Actually, it auto-selects. Let's change guests to 4, it should pick T2.
    // Then change guests back to 2, it should pick T1.

    // Manual selection of table:
    fireEvent.press(screen.getByText("T1 (2 seats)")); // Opens Select
    // In our Select mock/impl, we just need to find the option.
    fireEvent.press(screen.getByText("T2 (4 seats)"));

    // Now change guests to 5 (more than T2)
    // We need to mock seat options or just find the one.
    fireEvent.press(screen.getByText("2 seats"));
    fireEvent.press(screen.getByText("5 seats"));

    fireEvent.changeText(screen.getByPlaceholderText("Your full name"), "Test User");
    fireEvent.changeText(screen.getByPlaceholderText("your@email.com"), "test@test.com");
    fireEvent.press(screen.getByText("Confirm Booking"));

    expect(window.confirm).toHaveBeenCalled();
    expect(onSubmit).toHaveBeenCalled();
  });

  it("does not submit when the seats-exceed-capacity confirmation is declined", async () => {
    (window as any).confirm = jest.fn(() => false);
    const onSubmit = jest.fn();
    renderWithProviders(<BookingForm restaurant={mockRestaurant} onSubmit={onSubmit} />);

    // Bumping guests to 5 (above every table's capacity) re-runs
    // auto-selection, which falls back to the first table (T1, 2 seats),
    // so submitting triggers the capacity-warning confirm().
    fireEvent.press(screen.getByText("2 seats"));
    fireEvent.press(screen.getByText("5 seats"));

    fireEvent.changeText(screen.getByPlaceholderText("Your full name"), "Test User");
    fireEvent.changeText(screen.getByPlaceholderText("your@email.com"), "test@test.com");
    fireEvent.press(screen.getByText("Confirm Booking"));

    expect(window.confirm).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("disables submit when invalid", () => {
    (useTableHold as jest.Mock).mockReturnValue({
      holdStatus: "idle",
      secondsLeft: 0,
      holdId: null,
      setHoldStatus: mockSetHoldStatus,
      releaseCurrentHold: mockReleaseCurrentHold,
    });
    const onSubmit = jest.fn();
    renderWithProviders(<BookingForm restaurant={mockRestaurant} onSubmit={onSubmit} />);

    const btn = screen.getByText("Confirm Booking");
    // Button component renders a Pressable.
    // We check if it's disabled via props if we can, or just try to press it.
    fireEvent.press(btn);
    // holdStatus "idle" makes isValid false, so handleSubmit's early-return
    // guard should keep onSubmit from ever firing.
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("renders a fallback 'Table {id}' label when a table has no name", () => {
    const restaurant = {
      ...mockRestaurant,
      sections: [
        {
          id: 10,
          name: "Main",
          tables: [
            { id: 100, name: "T1", seats: 2, sectionId: 10 },
            { id: 102, seats: 6, sectionId: 10 }, // no `name` -> falls back to "Table {id}"
          ],
        },
      ],
    };
    renderWithProviders(<BookingForm restaurant={restaurant} onSubmit={jest.fn()} />);

    // T1 (2 seats) is auto-selected by default; open the table Select to
    // reveal the full option list, including the unnamed table's fallback label.
    fireEvent.press(screen.getByText("T1 (2 seats)"));

    expect(screen.getByText("Table 102 (6 seats)")).toBeTruthy();
  });

  it("renders 'No tables available' when guests exceed all tables", () => {
    renderWithProviders(<BookingForm restaurant={mockRestaurant} onSubmit={jest.fn()} />);

    fireEvent.press(screen.getByText("2 seats"));
    fireEvent.press(screen.getByText("10 seats")); // mockRestaurant max is 4

    expect(screen.getByText("No tables available for 10 guests.")).toBeTruthy();
  });

  it("handles null fetchAvailability response without crashing", async () => {
    const { fetchAvailability } = require("@/api/availability");
    (fetchAvailability as jest.Mock).mockResolvedValueOnce(null);

    renderWithProviders(<BookingForm restaurant={mockRestaurant} onSubmit={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Confirm Booking")).toBeTruthy();
    });
  });

  it("filters tables by availableTableIds from availability slot", async () => {
    const { fetchAvailability } = require("@/api/availability");
    (fetchAvailability as jest.Mock).mockResolvedValueOnce({
      slots: [
        {
          time: "09:00",
          isAvailable: true,
          category: "Lunch" as const,
          availableTableIds: [101],
        },
      ],
    });

    renderWithProviders(
      <BookingForm restaurant={mockRestaurant} onSubmit={jest.fn()} initialTime="09:00" />
    );

    await waitFor(() => {
      // Only T2 (id 101) should be shown; T1 (id 100) should be filtered out
      expect(screen.getByText("T2 (4 seats)")).toBeTruthy();
    });
  });
});
