/**
 * @jest-environment jsdom
 */
import React from "react";
import { render } from "@testing-library/react-native";
import BookingConfirmationSkeleton from "@/components/booking/BookingConfirmationSkeleton";
import { AppThemeProvider } from "@/context/ThemeContext";
import { useWindowDimensions } from "react-native";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

// Mock useWindowDimensions more safely
jest.mock("react-native", () => {
  const rn = jest.requireActual("react-native");
  return {
    ...rn,
    useWindowDimensions: jest.fn().mockReturnValue({ width: 375, height: 812 }),
  };
});

describe("BookingConfirmationSkeleton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 375, height: 812 });
  });

  it("renders correctly", () => {
    const { toJSON } = render(
      <AppThemeProvider>
        <BookingConfirmationSkeleton />
      </AppThemeProvider>
    );
    expect(toJSON()).toBeTruthy();
  });

  it("renders correctly on wide screens", () => {
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 1024, height: 768 });
    const { toJSON } = render(
      <AppThemeProvider>
        <BookingConfirmationSkeleton />
      </AppThemeProvider>
    );
    expect(toJSON()).toBeTruthy();
  });
});
