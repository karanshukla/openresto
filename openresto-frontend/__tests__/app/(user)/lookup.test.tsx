import React from "react";
import { render, screen } from "@testing-library/react-native";
import LookupScreen from "@/app/(user)/lookup";
import { BrandProvider } from "@/context/BrandContext";

jest.mock("@/api/bookings", () => ({
  lookupBookings: jest.fn(),
}));

jest.mock("expo-router", () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(() => ({})),
}));

describe("LookupScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders search form by default", () => {
    render(
      <BrandProvider>
        <LookupScreen />
      </BrandProvider>
    );
    expect(screen.getByText("Find My Booking")).toBeTruthy();
    expect(screen.getByPlaceholderText("e.g. crispy-basil-thyme")).toBeTruthy();
  });
});
