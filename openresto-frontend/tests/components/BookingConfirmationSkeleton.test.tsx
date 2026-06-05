/**
 * @jest-environment jsdom
 */
import React from "react";

// Mock useWindowDimensions by targeting the internal module
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({ width: 375, height: 812 }),
}));

import { render } from "@testing-library/react-native";
import { useWindowDimensions } from "react-native";
import BookingConfirmationSkeleton from "@/components/booking/BookingConfirmationSkeleton";
import { AppThemeProvider } from "@/context/ThemeContext";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

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

  it("renders wide layout when Platform.OS is web and width >= 768", () => {
    const RN = require("react-native");
    const original = RN.Platform.OS;
    RN.Platform.OS = "web";
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 1024, height: 768 });
    const { toJSON } = render(
      <AppThemeProvider>
        <BookingConfirmationSkeleton />
      </AppThemeProvider>
    );
    expect(toJSON()).toBeTruthy();
    RN.Platform.OS = original;
  });

  it("renders narrow layout when Platform.OS is web but width < 768", () => {
    const RN = require("react-native");
    const original = RN.Platform.OS;
    RN.Platform.OS = "web";
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 375, height: 812 });
    const { toJSON } = render(
      <AppThemeProvider>
        <BookingConfirmationSkeleton />
      </AppThemeProvider>
    );
    expect(toJSON()).toBeTruthy();
    RN.Platform.OS = original;
  });
});
