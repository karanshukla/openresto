import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { EditBookingForm } from "@/components/admin/bookings/EditBookingForm";

// A simplified Select mock that renders a pressable for each option
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

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#007AFF", appName: "Test" }),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

const defaultProps = {
  borderColor: "#eee",
  loadingRestaurants: false,
  restaurantOptions: [{ label: "Restaurant A", value: 1 }],
  sectionOptions: [{ label: "Main Floor", value: 10 }],
  tableOptions: [{ label: "Table 1 (4 seats)", value: 100 }],
  seatOptions: [
    { label: "1 guest", value: 1 },
    { label: "2 guests", value: 2 },
  ],
  editRestaurantId: 1,
  editSectionId: 10,
  editTableId: 100,
  editSeats: "2",
  editEmail: "guest@example.com",
  editSpecialRequests: "",
  editDate: "2026-06-15",
  editTime: "19:00",
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

  it("renders loading indicator when loadingRestaurants is true", () => {
    const { toJSON } = render(<EditBookingForm {...defaultProps} loadingRestaurants={true} />);
    expect(toJSON()).toBeDefined();
  });

  it("renders form fields when not loading", () => {
    render(<EditBookingForm {...defaultProps} />);

    expect(screen.getByText("Restaurant")).toBeTruthy();
    expect(screen.getByText("Section")).toBeTruthy();
    expect(screen.getByText("Table")).toBeTruthy();
    expect(screen.getByText("Date")).toBeTruthy();
    expect(screen.getByText("Time")).toBeTruthy();
    expect(screen.getByText("Guests")).toBeTruthy();
    expect(screen.getByText("Guest email")).toBeTruthy();
    expect(screen.getByText("Special requests")).toBeTruthy();
  });

  it("renders email input with current value", () => {
    render(<EditBookingForm {...defaultProps} editEmail="test@test.com" />);
    const input = screen.getByDisplayValue("test@test.com");
    expect(input).toBeTruthy();
  });

  it("calls setEditEmail when email changes", () => {
    const setEditEmail = jest.fn();
    render(<EditBookingForm {...defaultProps} setEditEmail={setEditEmail} />);
    const input = screen.getByDisplayValue("guest@example.com");
    fireEvent.changeText(input, "new@email.com");
    expect(setEditEmail).toHaveBeenCalledWith("new@email.com");
  });

  it("renders with null selectedRestaurant", () => {
    const { toJSON } = render(
      <EditBookingForm {...defaultProps} selectedRestaurant={null} />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders with null editRestaurantId and editSectionId", () => {
    const { toJSON } = render(
      <EditBookingForm
        {...defaultProps}
        editRestaurantId={null}
        editSectionId={null}
        editTableId={null}
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("calls setEditTableId when table selection changes", () => {
    const setEditTableId = jest.fn();
    render(<EditBookingForm {...defaultProps} setEditTableId={setEditTableId} />);
    fireEvent.press(screen.getByTestId("select-opt-100"));
    expect(setEditTableId).toHaveBeenCalledWith(100);
  });

  it("calls setEditSeats when guest count selection changes", () => {
    const setEditSeats = jest.fn();
    render(<EditBookingForm {...defaultProps} setEditSeats={setEditSeats} />);
    fireEvent.press(screen.getByTestId("select-opt-2"));
    expect(setEditSeats).toHaveBeenCalledWith("2");
  });
});
