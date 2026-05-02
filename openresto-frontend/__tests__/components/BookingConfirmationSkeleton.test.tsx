/**
 * @jest-environment jsdom
 */
import React from "react";
import { render } from "@testing-library/react-native";
import BookingConfirmationSkeleton from "@/components/booking/BookingConfirmationSkeleton";
import { AppThemeProvider } from "@/context/ThemeContext";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

// Mock useWindowDimensions more safely
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({ width: 375, height: 812 }),
}));

import useWindowDimensions from "react-native/Libraries/Utilities/useWindowDimensions";

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
