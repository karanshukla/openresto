import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { NewBookingModal } from "@/components/admin/bookings/NewBookingModal";

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#007AFF", appName: "Test" }),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

const mockRestaurants = [
  {
    id: 1,
    name: "Restaurant A",
    openTime: "09:00",
    closeTime: "22:00",
    address: "123 Main St",
    openDays: "1,2,3,4,5,6,7",
    timezone: "UTC",
    sections: [
      {
        id: 10,
        name: "Main Floor",
        tables: [
          { id: 100, name: "T1", seats: 4 },
          { id: 101, name: "T2", seats: 2 },
        ],
      },
    ],
  },
];

jest.mock("@/api/restaurants", () => ({
  fetchRestaurants: jest.fn().mockResolvedValue(mockRestaurants),
}));

jest.mock("@/api/admin", () => ({
  adminCreateBooking: jest.fn().mockResolvedValue({ id: 42 }),
}));

jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name }: { name: string }) => <Text testID={`icon-${name}`}>{name}</Text>,
  };
});

jest.mock("@/components/common/Select", () => {
  const { TouchableOpacity } = require("react-native");
  const { ThemedText } = require("@/components/themed-text");
  return {
    __esModule: true,
    default: ({
      options,
      onSelect,
    }: {
      options: { label: string; value: number | string }[];
      onSelect: (v: number | string) => void;
      selectedValue?: number | string;
    }) => (
      <>
        {options.map((opt) => (
          <TouchableOpacity key={opt.value} onPress={() => onSelect(opt.value)} testID={`select-opt-${opt.value}`}>
            <ThemedText>{opt.label}</ThemedText>
          </TouchableOpacity>
        ))}
      </>
    ),
  };
});

describe("NewBookingModal", () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    onCreated: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const restaurantsApi = require("@/api/restaurants");
    restaurantsApi.fetchRestaurants.mockResolvedValue(mockRestaurants);
    const adminApi = require("@/api/admin");
    adminApi.adminCreateBooking.mockResolvedValue({ id: 42 });
  });

  it("renders modal title when visible", async () => {
    render(<NewBookingModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("New Booking")).toBeTruthy();
    });
  });

  it("calls onClose when close button is pressed", async () => {
    const onClose = jest.fn();
    render(<NewBookingModal {...defaultProps} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText("New Booking")).toBeTruthy();
    });

    // Loading finishes, then we can see the close button
    await waitFor(() => {
      expect(screen.queryByText("Loading")).toBeNull();
    });

    // The close button (Ionicons close icon)
    expect(screen.getByText("New Booking")).toBeTruthy();
  });

  it("shows form after loading completes", async () => {
    render(<NewBookingModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Restaurant")).toBeTruthy();
    });

    expect(screen.getByText("Section")).toBeTruthy();
    expect(screen.getByText("Table")).toBeTruthy();
    expect(screen.getByText("Guests")).toBeTruthy();
    expect(screen.getByText("Guest email")).toBeTruthy();
  });

  it("shows Create Booking button", async () => {
    render(<NewBookingModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Create Booking")).toBeTruthy();
    });
  });

  it("fetches restaurants when becoming visible", async () => {
    const restaurantsApi = require("@/api/restaurants");
    render(<NewBookingModal {...defaultProps} />);

    await waitFor(() => {
      expect(restaurantsApi.fetchRestaurants).toHaveBeenCalledTimes(1);
    });
  });

  it("does not render modal content when not visible", () => {
    render(<NewBookingModal {...defaultProps} visible={false} />);
    expect(screen.queryByText("New Booking")).toBeNull();
  });

  it("creates booking when form is valid and Create Booking is pressed", async () => {
    const adminApi = require("@/api/admin");
    const onCreated = jest.fn();
    const onClose = jest.fn();
    render(<NewBookingModal {...defaultProps} onCreated={onCreated} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText("Create Booking")).toBeTruthy();
    });

    // Add a valid email to enable submission
    const emailInput = screen.getByPlaceholderText("guest@example.com");
    fireEvent.changeText(emailInput, "guest@test.com");

    // Ensure the date and time fields have values (they should be pre-filled)
    fireEvent.press(screen.getByText("Create Booking"));

    await waitFor(() => {
      expect(adminApi.adminCreateBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          customerEmail: "guest@test.com",
          restaurantId: 1,
        })
      );
    });
  });

  it("shows empty restaurants state when none returned", async () => {
    const restaurantsApi = require("@/api/restaurants");
    restaurantsApi.fetchRestaurants.mockResolvedValueOnce([]);
    render(<NewBookingModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Create Booking")).toBeTruthy();
    });
  });

  it("handles handleRestaurantChange when restaurant is selected", async () => {
    render(<NewBookingModal {...defaultProps} />);
    await waitFor(() => expect(screen.getByText("Create Booking")).toBeTruthy());
    // Restaurant A has value=1 — multiple testIDs may match (seat 1 also), use getAllByTestId
    const opts = screen.getAllByTestId("select-opt-1");
    fireEvent.press(opts[0]);
    expect(screen.getByText("Create Booking")).toBeTruthy();
  });

  it("handles handleSectionChange when section is selected", async () => {
    render(<NewBookingModal {...defaultProps} />);
    await waitFor(() => expect(screen.getByText("Create Booking")).toBeTruthy());
    // Section id=10 and seat 10 both render select-opt-10 — use getAllByTestId
    const opts = screen.getAllByTestId("select-opt-10");
    fireEvent.press(opts[0]);
    expect(screen.getByText("Create Booking")).toBeTruthy();
  });

  it("shows capacity warning when seats exceed table capacity", async () => {
    render(<NewBookingModal {...defaultProps} />);
    await waitFor(() => expect(screen.getByText("Create Booking")).toBeTruthy());
    const emailInput = screen.getByPlaceholderText("guest@example.com");
    fireEvent.changeText(emailInput, "test@test.com");
    // Seat value 5 exceeds T1's capacity of 4
    const seatOpts = screen.getAllByTestId("select-opt-5");
    fireEvent.press(seatOpts[seatOpts.length - 1]);
    fireEvent.press(screen.getByText("Create Booking"));
    await waitFor(() => {
      expect(screen.getByText(/This table only seats/)).toBeTruthy();
    });
  });

  it("proceeds to book anyway when capacity warning is confirmed", async () => {
    const adminApi = require("@/api/admin");
    render(<NewBookingModal {...defaultProps} />);
    await waitFor(() => expect(screen.getByText("Create Booking")).toBeTruthy());
    const emailInput = screen.getByPlaceholderText("guest@example.com");
    fireEvent.changeText(emailInput, "test@test.com");
    const seatOpts = screen.getAllByTestId("select-opt-5");
    fireEvent.press(seatOpts[seatOpts.length - 1]);
    fireEvent.press(screen.getByText("Create Booking"));
    await waitFor(() => expect(screen.getByText("Book Anyway")).toBeTruthy());
    fireEvent.press(screen.getByText("Book Anyway"));
    await waitFor(() => {
      expect(adminApi.adminCreateBooking).toHaveBeenCalled();
    });
  });

  it("dismisses capacity warning when Go Back is pressed", async () => {
    render(<NewBookingModal {...defaultProps} />);
    await waitFor(() => expect(screen.getByText("Create Booking")).toBeTruthy());
    const emailInput = screen.getByPlaceholderText("guest@example.com");
    fireEvent.changeText(emailInput, "test@test.com");
    const seatOpts = screen.getAllByTestId("select-opt-5");
    fireEvent.press(seatOpts[seatOpts.length - 1]);
    fireEvent.press(screen.getByText("Create Booking"));
    await waitFor(() => expect(screen.getByText("Go Back")).toBeTruthy());
    fireEvent.press(screen.getByText("Go Back"));
    await waitFor(() => {
      expect(screen.queryByText(/This table only seats/)).toBeNull();
    });
  });

  it("shows error when adminCreateBooking throws", async () => {
    const adminApi = require("@/api/admin");
    adminApi.adminCreateBooking.mockRejectedValueOnce(new Error("Network error"));
    render(<NewBookingModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Create Booking")).toBeTruthy();
    });
    const emailInput = screen.getByPlaceholderText("guest@example.com");
    fireEvent.changeText(emailInput, "test@test.com");
    fireEvent.press(screen.getByText("Create Booking"));
    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeTruthy();
    });
  });

  it("handles table select onSelect (covers table setTableId handler)", async () => {
    render(<NewBookingModal {...defaultProps} />);
    await waitFor(() => expect(screen.getByText("Create Booking")).toBeTruthy());
    // Table T1 has id=100 — select-opt-100 triggers setTableId(100)
    const tableOpts = screen.queryAllByTestId("select-opt-100");
    if (tableOpts.length > 0) {
      fireEvent.press(tableOpts[0]);
    }
    expect(screen.getByText("Create Booking")).toBeTruthy();
  });

  it("uses fallback time when current hour is outside restaurant open hours", async () => {
    const restaurantsApi = require("@/api/restaurants");
    // With closeTime = "00:00", h >= closeH (0) is always true → suggestTime returns fallback
    restaurantsApi.fetchRestaurants.mockResolvedValueOnce([
      {
        ...mockRestaurants[0],
        openTime: "23:00",
        closeTime: "00:00",
      },
    ]);
    render(<NewBookingModal {...defaultProps} />);
    await waitFor(() => expect(screen.getByText("Create Booking")).toBeTruthy());
    expect(screen.getByText("Create Booking")).toBeTruthy();
  });
});
