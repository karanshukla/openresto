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

// Stub social-links fetch so the large-party notice modal renders without a
// network call. Returns no contact links by default; individual tests override.
jest.mock("@/api/restaurants", () => ({
  ...jest.requireActual("@/api/restaurants"),
  fetchSocialLinks: jest.fn(() => Promise.resolve([])),
}));

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
      resolvedTableId: null,
      resolvedSectionId: null,
      setHoldStatus: mockSetHoldStatus,
      releaseCurrentHold: mockReleaseCurrentHold,
    });
    // Mock window.confirm
    delete (window as any).confirm;
    (window as any).confirm = jest.fn(() => true);
  });

  /**
   * The form defaults to "Any section" (table dropdown hidden). Tests that exercise the
   * explicit-table path call this to switch into the "Main" section first.
   */
  function selectMainSection() {
    // The section Select's trigger shows the selected option label. Open the modal, then
    // pick "Main".
    fireEvent.press(screen.getByText("Any section"));
    fireEvent.press(screen.getByText("Main"));
  }

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

  it("shows warning when the selected table can't seat the party", async () => {
    // This section has only a 2-seat table while the location's largest (in
    // Main) seats 4, so booking 3 guests here lands the auto-select on an
    // undersized table — the per-table confirm path, distinct from the global
    // large-party guard (3 <= 4 max capacity).
    const onSubmit = jest.fn();
    const restaurant = {
      ...mockRestaurant,
      sections: [
        mockRestaurant.sections[0],
        { id: 11, name: "Patio", tables: [{ id: 102, name: "P1", seats: 2, sectionId: 11 }] },
      ],
    };
    renderWithProviders(<BookingForm restaurant={restaurant} onSubmit={onSubmit} />);

    // Open the section list and pick the Patio (2-seat-only) section.
    fireEvent.press(screen.getByText("Any section"));
    fireEvent.press(screen.getByText("Patio"));

    // 3 guests > Patio's 2-seat table, but <= the location's 4-seat max.
    fireEvent.press(screen.getByText("2 seats"));
    fireEvent.press(screen.getByText("3 seats"));

    fireEvent.changeText(screen.getByPlaceholderText("Your full name"), "Test User");
    fireEvent.changeText(screen.getByPlaceholderText("your@email.com"), "test@test.com");
    fireEvent.press(screen.getByText("Confirm Booking"));

    expect(window.confirm).toHaveBeenCalled();
    expect(onSubmit).toHaveBeenCalled();
  });

  it("does not submit when the seats-exceed-capacity confirmation is declined", async () => {
    (window as any).confirm = jest.fn(() => false);
    const onSubmit = jest.fn();
    const restaurant = {
      ...mockRestaurant,
      sections: [
        mockRestaurant.sections[0],
        { id: 11, name: "Patio", tables: [{ id: 102, name: "P1", seats: 2, sectionId: 11 }] },
      ],
    };
    renderWithProviders(<BookingForm restaurant={restaurant} onSubmit={onSubmit} />);

    fireEvent.press(screen.getByText("Any section"));
    fireEvent.press(screen.getByText("Patio"));

    fireEvent.press(screen.getByText("2 seats"));
    fireEvent.press(screen.getByText("3 seats"));

    fireEvent.changeText(screen.getByPlaceholderText("Your full name"), "Test User");
    fireEvent.changeText(screen.getByPlaceholderText("your@email.com"), "test@test.com");
    fireEvent.press(screen.getByText("Confirm Booking"));

    expect(window.confirm).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // ── Large-party guard (interim: block parties bigger than any single table) ─

  it("blocks submission and shows the large-party notice when the party exceeds the largest table", async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<BookingForm restaurant={mockRestaurant} onSubmit={onSubmit} />);

    // mockRestaurant's largest table seats 4. Bump to 5 to trip the global guard.
    fireEvent.press(screen.getByText("2 seats"));
    fireEvent.press(screen.getByText("5 seats"));

    // The inline bubble renders with the cap copy…
    expect(screen.getAllByText(/Our largest table seats 4/).length).toBeGreaterThan(0);
    // …and the modal auto-opens on the over-capacity change.
    await waitFor(() => expect(screen.getByText(/needs to be arranged directly/)).toBeTruthy());

    fireEvent.changeText(screen.getByPlaceholderText("Your full name"), "Test User");
    fireEvent.changeText(screen.getByPlaceholderText("your@email.com"), "test@test.com");
    fireEvent.press(screen.getByText("Confirm Booking"));

    // Guard short-circuits isValid, so the submit handler never runs.
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("reopens the large-party modal when tapping the inline bubble", async () => {
    renderWithProviders(<BookingForm restaurant={mockRestaurant} onSubmit={jest.fn()} />);

    fireEvent.press(screen.getByText("2 seats"));
    fireEvent.press(screen.getByText("5 seats"));

    await waitFor(() => expect(screen.getByText(/needs to be arranged directly/)).toBeTruthy());
    // Dismiss, then re-open via the bubble's Contact us affordance.
    fireEvent.press(screen.getByText("Got it"));
    expect(screen.queryByText(/needs to be arranged directly/)).toBeNull();

    fireEvent.press(screen.getByText(/Contact us/));
    expect(screen.getByText(/needs to be arranged directly/)).toBeTruthy();
  });

  it("lists every configured social link as a contact option in the modal", async () => {
    const { fetchSocialLinks } = require("@/api/restaurants");
    (fetchSocialLinks as jest.Mock).mockResolvedValueOnce([
      {
        id: 1,
        label: "Call us",
        url: "tel:+15551234567",
        iconKey: "call-outline",
        sortOrder: 2,
      },
      {
        id: 2,
        label: "Email",
        url: "mailto:hi@resto.com",
        iconKey: "mail-outline",
        sortOrder: 1,
      },
    ]);

    renderWithProviders(<BookingForm restaurant={mockRestaurant} onSubmit={jest.fn()} />);

    fireEvent.press(screen.getByText("2 seats"));
    fireEvent.press(screen.getByText("5 seats"));

    // Both configured links render (sorted by sortOrder), regardless of icon
    // key — the restaurant controls what shows up. ("Email" alone collides
    // with the email input field, so assert via a more specific text.)
    await waitFor(() => expect(screen.getByText("Call us")).toBeTruthy());
    expect(screen.getAllByText("Email").length).toBeGreaterThan(0);
    // The empty-state fallback must NOT render.
    expect(screen.queryByText(/No contact details are listed/)).toBeNull();
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

    // Switch out of "Any section" so the explicit table dropdown is visible.
    selectMainSection();

    // T1 (2 seats) is auto-selected by default; open the table Select to
    // reveal the full option list, including the unnamed table's fallback label.
    fireEvent.press(screen.getByText("T1 (2 seats)"));

    expect(screen.getByText("Table 102 (6 seats)")).toBeTruthy();
  });

  it("renders 'No tables available' when guests exceed all tables", () => {
    renderWithProviders(<BookingForm restaurant={mockRestaurant} onSubmit={jest.fn()} />);

    // Switch out of "Any section" so the explicit table dropdown is visible.
    selectMainSection();

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

    // Switch out of "Any section" so the explicit table dropdown is visible.
    selectMainSection();

    await waitFor(() => {
      // Only T2 (id 101) should be shown; T1 (id 100) should be filtered out
      expect(screen.getByText("T2 (4 seats)")).toBeTruthy();
    });
  });

  // ── Combinable table groups (#274) ────────────────────────────────────────

  it("renders combinable groups in the dropdown with the expected label", async () => {
    const { fetchAvailability } = require("@/api/availability");
    (fetchAvailability as jest.Mock).mockResolvedValueOnce({
      slots: [
        {
          time: "09:00",
          isAvailable: true,
          category: "Lunch" as const,
          availableTableIds: [],
          availableGroupIds: [7],
        },
      ],
    });

    const restaurantWithNamedGroup = {
      ...mockRestaurant,
      groups: [
        {
          id: 7,
          name: "Window booths",
          combinedSeats: 6,
          members: [
            { id: 100, name: "T1", seats: 2 },
            { id: 101, name: "T2", seats: 4 },
          ],
        },
      ],
    } as any;

    renderWithProviders(
      <BookingForm
        restaurant={restaurantWithNamedGroup}
        onSubmit={jest.fn()}
        initialTime="09:00"
        initialSeats={5}
      />
    );
    selectMainSection();

    // No single table fits a party of 5, so the trigger shows the placeholder. Open the dropdown
    // to reveal the group option.
    await waitFor(() => expect(screen.getByText("Select a table")).toBeTruthy());
    fireEvent.press(screen.getByText("Select a table"));

    // A named group uses its name in the label.
    await waitFor(() => {
      expect(screen.getByText("Window booths (6 seats)")).toBeTruthy();
    });
  });

  it("uses the member-names fallback label for an unnamed group", async () => {
    const { fetchAvailability } = require("@/api/availability");
    (fetchAvailability as jest.Mock).mockResolvedValueOnce({
      slots: [
        {
          time: "09:00",
          isAvailable: true,
          category: "Lunch" as const,
          availableTableIds: [],
          availableGroupIds: [7],
        },
      ],
    });

    const restaurantWithUnnamedGroup = {
      ...mockRestaurant,
      groups: [
        {
          id: 7,
          name: null,
          combinedSeats: 6,
          members: [
            { id: 100, name: "T1", seats: 2 },
            { id: 101, name: "T2", seats: 4 },
          ],
        },
      ],
    } as any;

    renderWithProviders(
      <BookingForm
        restaurant={restaurantWithUnnamedGroup}
        onSubmit={jest.fn()}
        initialTime="09:00"
        initialSeats={5}
      />
    );
    selectMainSection();

    // No single table fits a party of 5, so the trigger shows the placeholder. Open the dropdown
    // to reveal the group option.
    await waitFor(() => expect(screen.getByText("Select a table")).toBeTruthy());
    fireEvent.press(screen.getByText("Select a table"));

    // An unnamed group falls back to "Tables T1 + T2 (6 seats combined)".
    await waitFor(() => {
      expect(screen.getByText("Tables T1 + T2 (6 seats combined)")).toBeTruthy();
    });
  });
});
