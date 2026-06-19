/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import BookingForm from "@/components/booking/BookingForm";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#0a7ea4", appName: "Open Resto" }),
}));

// Controllable hold status
const mockSetHoldStatus = jest.fn();
const mockReleaseCurrentHold = jest.fn();
let mockHoldStatus = "idle";

jest.mock("@/components/booking/useTableHold", () => ({
  useTableHold: () => ({
    hold: null,
    holdStatus: mockHoldStatus,
    secondsLeft: 0,
    holdId: null,
    setHoldStatus: mockSetHoldStatus,
    releaseCurrentHold: mockReleaseCurrentHold,
  }),
}));

const mockFetchAvailability = jest.fn();
jest.mock("@/api/availability", () => ({
  fetchAvailability: (...args: unknown[]) => mockFetchAvailability(...args),
}));

jest.mock("@/components/booking/HoldStatusBanner", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/booking/PopularTimesPicker", () => ({
  __esModule: true,
  default: () => {
    const { Text } = require("react-native");
    return <Text>PopularTimesPicker</Text>;
  },
}));

jest.mock("@/components/common/Input", () => ({
  __esModule: true,
  default: ({
    placeholder,
    onChangeText,
  }: {
    placeholder?: string;
    onChangeText?: (v: string) => void;
  }) => {
    const { TextInput } = require("react-native");
    return <TextInput placeholder={placeholder} onChangeText={onChangeText} />;
  },
}));

jest.mock("@/components/common/Button", () => ({
  __esModule: true,
  default: ({ children, onPress, disabled }: any) => {
    const { Pressable, Text } = require("react-native");
    return (
      <Pressable onPress={onPress} disabled={disabled} testID="submit-btn">
        <Text>{children}</Text>
      </Pressable>
    );
  },
}));

jest.mock("@/components/common/TimePicker", () => ({
  __esModule: true,
  default: ({ selectedTime }: { selectedTime: string }) => {
    const { Text } = require("react-native");
    return <Text testID="time-picker">{selectedTime}</Text>;
  },
}));

// DatePicker mock that lets tests trigger a date selection
jest.mock("@/components/common/DatePicker", () => ({
  __esModule: true,
  default: ({ onSelect }: { onSelect: (date: string) => void }) => {
    const { Pressable, Text } = require("react-native");
    return (
      <Pressable testID="date-picker-sat" onPress={() => onSelect("2026-06-20")}>
        <Text>Pick Saturday</Text>
      </Pressable>
    );
  },
}));

// Select mock: exposes section selector via testID
jest.mock("@/components/common/Select", () => ({
  __esModule: true,
  default: ({ onSelect, placeholder, selectedValue }: any) => {
    const { Pressable, Text } = require("react-native");
    if (placeholder === "Select a section") {
      return (
        <Pressable testID="section-select" onPress={() => onSelect(20)}>
          <Text>SectionSelect:{selectedValue}</Text>
        </Pressable>
      );
    }
    return <Text testID="select-other">{String(selectedValue ?? placeholder ?? "Select")}</Text>;
  },
}));

const mockRestaurantWeekdays = {
  id: 1,
  name: "Bistro",
  address: "1 Main St",
  openTime: "11:00",
  closeTime: "22:00",
  openDays: "1,2,3,4,5", // Mon–Fri only
  timezone: "UTC",
  sections: [
    {
      id: 10,
      name: "Main",
      restaurantId: 1,
      tables: [{ id: 100, name: "T1", seats: 4, sectionId: 10 }],
    },
    {
      id: 20,
      name: "Patio",
      restaurantId: 1,
      tables: [{ id: 200, name: "T2", seats: 2, sectionId: 20 }],
    },
  ],
};

const mockRestaurantAllDays = {
  ...mockRestaurantWeekdays,
  openDays: "1,2,3,4,5,6,7",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockHoldStatus = "idle";
  mockFetchAvailability.mockResolvedValue({
    slots: [{ time: "19:00", isAvailable: true, availableTableIds: [100], category: "Dinner" }],
  });
});

describe("BookingForm", () => {
  it("renders the form with Popular Times label", () => {
    render(<BookingForm restaurant={mockRestaurantAllDays} onSubmit={jest.fn()} />);
    expect(screen.getByText("Popular Times")).toBeTruthy();
  });

  it("shows 'closed on this day' when a closed day is selected", async () => {
    render(<BookingForm restaurant={mockRestaurantWeekdays} onSubmit={jest.fn()} />);
    // Wait for the initial availability fetch (today's date, which is open)
    await waitFor(() => expect(mockFetchAvailability).toHaveBeenCalledTimes(1));
    // Clear so we can assert no extra call for the closed day
    mockFetchAvailability.mockClear();

    // "2026-06-20" is a Saturday — not in openDays "1,2,3,4,5"
    await act(async () => {
      fireEvent.press(screen.getByTestId("date-picker-sat"));
    });
    await waitFor(() => {
      expect(
        screen.getByText("The restaurant is closed on this day. Please select a different date.")
      ).toBeTruthy();
    });
    // fetchAvailability should NOT be called for a closed day
    expect(mockFetchAvailability).not.toHaveBeenCalled();
  });

  it("resets hold status to idle when section is changed while held", async () => {
    mockHoldStatus = "held";
    render(<BookingForm restaurant={mockRestaurantAllDays} onSubmit={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId("section-select")).toBeTruthy());
    fireEvent.press(screen.getByTestId("section-select"));
    expect(mockSetHoldStatus).toHaveBeenCalledWith("idle");
  });

  it("resets hold status to idle when section is changed while expired", async () => {
    mockHoldStatus = "expired";
    render(<BookingForm restaurant={mockRestaurantAllDays} onSubmit={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId("section-select")).toBeTruthy());
    fireEvent.press(screen.getByTestId("section-select"));
    expect(mockSetHoldStatus).toHaveBeenCalledWith("idle");
  });

  it("does not reset hold status when section is changed while idle", async () => {
    mockHoldStatus = "idle";
    render(<BookingForm restaurant={mockRestaurantAllDays} onSubmit={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId("section-select")).toBeTruthy());
    fireEvent.press(screen.getByTestId("section-select"));
    expect(mockSetHoldStatus).not.toHaveBeenCalled();
  });
});
