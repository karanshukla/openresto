/**
 * @jest-environment jsdom
 */
import React from "react";
import { Linking } from "react-native";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import EmbedBooking from "@/components/embed/EmbedBooking";
import { fetchRestaurants } from "@/api/restaurants";
import { submitBooking } from "@/components/booking/submitBooking";
import { reportEmbedHeight } from "@/utils/embedHeight";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("@/api/restaurants", () => ({ fetchRestaurants: jest.fn() }));
jest.mock("@/components/booking/submitBooking", () => ({ submitBooking: jest.fn() }));
jest.mock("@/utils/embedHeight", () => ({ reportEmbedHeight: jest.fn() }));

jest.mock("@/components/booking/BookingForm", () => {
  const { Pressable, Text } = require("react-native");
  return {
    __esModule: true,
    default: ({
      restaurant,
      onSubmit,
    }: {
      restaurant: { name: string };
      onSubmit: (data: unknown) => void;
    }) => (
      <>
        <Text testID="form-restaurant">{restaurant.name}</Text>
        <Pressable
          testID="submit-trigger"
          onPress={() =>
            onSubmit({
              customerEmail: "guest@example.com",
              customerName: "Guest",
              seats: 2,
              date: "2026-11-20",
              time: "19:00",
              tableId: null,
              sectionId: null,
              tableGroupId: null,
              holdId: "hold_1",
              specialRequests: "",
            })
          }
        />
      </>
    ),
  };
});

const restaurants = [
  { id: 1, name: "Harbour", timezone: "UTC", sections: [] },
  { id: 3, name: "Shore House", timezone: "UTC", sections: [] },
];

describe("EmbedBooking", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetchRestaurants as jest.Mock).mockResolvedValue(restaurants);
  });

  it("offers a picker over every location when none is pinned", async () => {
    renderWithProviders(<EmbedBooking />);
    expect(await screen.findByLabelText("Location, Harbour")).toBeTruthy();
    expect(screen.getByTestId("form-restaurant").props.children).toBe("Harbour");

    fireEvent.press(screen.getByLabelText("Location, Harbour"));
    fireEvent.press(await screen.findByText("Shore House"));

    await waitFor(() =>
      expect(screen.getByTestId("form-restaurant").props.children).toBe("Shore House")
    );
  });

  it("books only the pinned location, without a picker", async () => {
    renderWithProviders(<EmbedBooking locationId={3} />);
    expect((await screen.findByTestId("form-restaurant")).props.children).toBe("Shore House");
    expect(screen.getAllByText("Shore House")).toHaveLength(2);
    expect(screen.queryByLabelText(/^Location/)).toBeNull();
  });

  it("falls back to every location when the pinned one is not listed", async () => {
    renderWithProviders(<EmbedBooking locationId={99} />);
    expect(await screen.findByLabelText("Location, Harbour")).toBeTruthy();
  });

  it("says booking is unavailable when there is no location", async () => {
    (fetchRestaurants as jest.Mock).mockResolvedValue([]);
    renderWithProviders(<EmbedBooking />);
    expect(await screen.findByText("Online booking isn't available right now.")).toBeTruthy();
  });

  it("shows the reference in the frame and links out to the booking", async () => {
    (submitBooking as jest.Mock).mockResolvedValue({ id: 7, bookingRef: "ABC123" });
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    renderWithProviders(<EmbedBooking locationId={1} />);

    fireEvent.press(await screen.findByTestId("submit-trigger"));

    expect((await screen.findByTestId("embed-booking-ref")).props.children).toBe("ABC123");
    expect(submitBooking).toHaveBeenCalledWith(
      restaurants[0],
      expect.objectContaining({ seats: 2 })
    );
    fireEvent.press(screen.getByTestId("embed-view-booking"));
    expect(openURL).toHaveBeenCalledWith("/booking-confirmation/ABC123?email=guest%40example.com");

    fireEvent.press(screen.getByText("Book another table"));
    expect(await screen.findByTestId("submit-trigger")).toBeTruthy();
  });

  it("stays on the form when no booking comes back", async () => {
    (submitBooking as jest.Mock).mockResolvedValue(null);
    renderWithProviders(<EmbedBooking locationId={1} />);

    fireEvent.press(await screen.findByTestId("submit-trigger"));

    await waitFor(() => expect(submitBooking).toHaveBeenCalled());
    expect(screen.queryByTestId("embed-confirmation")).toBeNull();
  });

  it("keeps the form and shows the error when the booking is refused", async () => {
    (submitBooking as jest.Mock).mockRejectedValueOnce(
      new Error("This table is no longer available.")
    );
    renderWithProviders(<EmbedBooking locationId={1} />);

    fireEvent.press(await screen.findByTestId("submit-trigger"));

    expect(await screen.findByText("This table is no longer available.")).toBeTruthy();
    expect(screen.getByTestId("submit-trigger")).toBeTruthy();
  });

  it("falls back to a generic message for a non-Error rejection", async () => {
    (submitBooking as jest.Mock).mockRejectedValueOnce("boom");
    renderWithProviders(<EmbedBooking locationId={1} />);

    fireEvent.press(await screen.findByTestId("submit-trigger"));

    expect(await screen.findByText("Something went wrong. Please try again.")).toBeTruthy();
  });

  it("reports its content height to the framing page", async () => {
    renderWithProviders(<EmbedBooking />);
    fireEvent(screen.getByTestId("embed-booking"), "layout", {
      nativeEvent: { layout: { height: 720 } },
    });
    expect(reportEmbedHeight).toHaveBeenCalledWith(720);
    await screen.findByTestId("form-restaurant");
  });
});
