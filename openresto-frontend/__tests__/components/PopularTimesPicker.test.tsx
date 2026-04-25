import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import PopularTimesPicker from "@/components/booking/PopularTimesPicker";
import { TimeSlotDto } from "@/api/availability";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

describe("PopularTimesPicker", () => {
  const mockSlots: TimeSlotDto[] = [
    { time: "12:00", isAvailable: true, category: "Lunch" },
    { time: "13:00", isAvailable: false, category: "Lunch" },
    { time: "18:00", isAvailable: true, category: "Dinner" },
  ];

  it("renders correctly and filters by category", () => {
    const onSelectTime = jest.fn();
    render(
      <PopularTimesPicker slots={mockSlots} selectedTime="12:00" onSelectTime={onSelectTime} />
    );

    // Default active is Lunch
    expect(screen.getByText("12:00")).toBeTruthy();
    expect(screen.queryByText("18:00")).toBeNull();

    // Switch to Dinner
    fireEvent.press(screen.getByText("Dinner"));
    expect(screen.getByText("18:00")).toBeTruthy();
    expect(screen.queryByText("12:00")).toBeNull();
  });

  it("handles slot selection", () => {
    const onSelectTime = jest.fn();
    render(<PopularTimesPicker slots={mockSlots} selectedTime="" onSelectTime={onSelectTime} />);

    fireEvent.press(screen.getByText("12:00"));
    expect(onSelectTime).toHaveBeenCalledWith("12:00");
  });

  it("disables unavailable slots", () => {
    const onSelectTime = jest.fn();
    render(<PopularTimesPicker slots={mockSlots} selectedTime="" onSelectTime={onSelectTime} />);

    fireEvent.press(screen.getByText("13:00"));
    expect(onSelectTime).not.toHaveBeenCalled();
  });

  it("shows empty state message", () => {
    render(<PopularTimesPicker slots={[]} selectedTime="" onSelectTime={jest.fn()} />);
    expect(screen.getByText(/No slots available/i)).toBeTruthy();
  });
});
