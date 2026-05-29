import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { EditBookingForm } from "@/components/admin/bookings/EditBookingForm";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/context/BrandContext", () => {
  const brand = { primaryColor: "#0a7ea4", appName: "Open Resto" };
  return { useBrand: () => brand };
});

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@/components/common/Select", () => {
  const { View, Text, Pressable } = require("react-native");
  return function MockSelect({
    selectedValue,
    onSelect,
    options,
  }: {
    selectedValue?: number;
    onSelect: (v: number) => void;
    options: { label: string; value: number }[];
  }) {
    return (
      <View testID="mock-select">
        {options.map((o) => (
          <Pressable key={o.value} onPress={() => onSelect(o.value)}>
            <Text>{o.label}</Text>
          </Pressable>
        ))}
      </View>
    );
  };
});

jest.mock("@/components/common/DatePicker", () => {
  const { View, Text } = require("react-native");
  return function MockDatePicker({ selectedDate }: { selectedDate?: string }) {
    return (
      <View>
        <Text testID="date-picker">{selectedDate ?? "no date"}</Text>
      </View>
    );
  };
});

jest.mock("@/components/common/TimePicker", () => {
  const { View, Text } = require("react-native");
  return function MockTimePicker({ selectedTime }: { selectedTime?: string }) {
    return (
      <View>
        <Text testID="time-picker">{selectedTime ?? "no time"}</Text>
      </View>
    );
  };
});

const baseProps = {
  borderColor: "#ddd",
  loadingRestaurants: false,
  restaurantOptions: [
    { label: "Restaurant A", value: 1 },
    { label: "Restaurant B", value: 2 },
  ],
  sectionOptions: [{ label: "Main", value: 10 }],
  tableOptions: [{ label: "Table 1", value: 100 }],
  seatOptions: [
    { label: "1", value: 1 },
    { label: "2", value: 2 },
  ],
  editRestaurantId: 1,
  editSectionId: 10,
  editTableId: 100,
  editSeats: "2",
  editEmail: "test@example.com",
  editSpecialRequests: "Window seat",
  editDate: "2026-10-01",
  editTime: "18:00",
  selectedRestaurant: { openTime: "09:00", closeTime: "22:00" },
  setEditTableId: jest.fn(),
  setEditSeats: jest.fn(),
  setEditEmail: jest.fn(),
  setEditSpecialRequests: jest.fn(),
  setEditDate: jest.fn(),
  setEditTime: jest.fn(),
  handleRestaurantChange: jest.fn(),
  handleSectionChange: jest.fn(),
};

describe("EditBookingForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows loading indicator and hides form when loadingRestaurants is true", () => {
    render(<EditBookingForm {...baseProps} loadingRestaurants />);
    // Restaurant options should not be visible while loading
    expect(screen.queryByText("Restaurant A")).toBeNull();
    expect(screen.queryByText("Restaurant B")).toBeNull();
  });

  it("renders restaurant options", () => {
    render(<EditBookingForm {...baseProps} />);
    expect(screen.getByText("Restaurant A")).toBeTruthy();
    expect(screen.getByText("Restaurant B")).toBeTruthy();
  });

  it("renders section labels", () => {
    render(<EditBookingForm {...baseProps} />);
    expect(screen.getByText("Section")).toBeTruthy();
    expect(screen.getByText("Table")).toBeTruthy();
  });

  it("renders date and time labels", () => {
    render(<EditBookingForm {...baseProps} />);
    expect(screen.getByText("Date")).toBeTruthy();
    expect(screen.getByText("Time")).toBeTruthy();
  });

  it("renders guests and email labels", () => {
    render(<EditBookingForm {...baseProps} />);
    expect(screen.getByText("Guests")).toBeTruthy();
    expect(screen.getByText("Guest email")).toBeTruthy();
  });

  it("renders special requests label and input", () => {
    render(<EditBookingForm {...baseProps} />);
    expect(screen.getByText("Special requests")).toBeTruthy();
    expect(screen.getByDisplayValue("Window seat")).toBeTruthy();
  });

  it("renders email input with current value", () => {
    render(<EditBookingForm {...baseProps} />);
    expect(screen.getByDisplayValue("test@example.com")).toBeTruthy();
  });

  it("calls setEditEmail when email input changes", () => {
    render(<EditBookingForm {...baseProps} />);
    fireEvent.changeText(screen.getByDisplayValue("test@example.com"), "new@example.com");
    expect(baseProps.setEditEmail).toHaveBeenCalledWith("new@example.com");
  });

  it("calls setEditSpecialRequests when special requests input changes", () => {
    render(<EditBookingForm {...baseProps} />);
    fireEvent.changeText(screen.getByDisplayValue("Window seat"), "Vegan menu");
    expect(baseProps.setEditSpecialRequests).toHaveBeenCalledWith("Vegan menu");
  });

  it("calls handleRestaurantChange when a restaurant is selected", () => {
    render(<EditBookingForm {...baseProps} />);
    fireEvent.press(screen.getByText("Restaurant B"));
    expect(baseProps.handleRestaurantChange).toHaveBeenCalledWith(2);
  });

  it("renders with null selectedRestaurant", () => {
    render(<EditBookingForm {...baseProps} selectedRestaurant={null} />);
    expect(screen.getByText("Restaurant A")).toBeTruthy();
  });
});
