import React from "react";
import { render, screen } from "@testing-library/react-native";
import WalkInNotice from "@/components/booking/WalkInNotice";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#0a7ea4", appName: "Open Resto" }),
}));

describe("WalkInNotice", () => {
  it("renders the location-wide notice", () => {
    render(<WalkInNotice scope="location" />);
    expect(screen.getByTestId("walk-in-notice")).toBeTruthy();
    expect(screen.getByText("Walk-ins only")).toBeTruthy();
    expect(screen.getByText(/first come, first served/)).toBeTruthy();
  });

  it("renders the per-day notice", () => {
    render(<WalkInNotice scope="day" />);
    expect(screen.getByText("Walk-ins only on this day")).toBeTruthy();
    expect(screen.getByText(/Pick another day/)).toBeTruthy();
  });

  it("names the specific walk-in days when daysLabel is provided", () => {
    render(<WalkInNotice scope="day" daysLabel="Saturdays and Sundays" />);
    expect(screen.getByText("Walk-ins only on this day")).toBeTruthy();
    expect(screen.getByText(/doesn't take online bookings on Saturdays and Sundays/)).toBeTruthy();
  });
});
