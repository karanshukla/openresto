/**
 * @jest-environment jsdom
 */
import React from "react";
import { render } from "@testing-library/react-native";
import BookingSkeleton from "@/components/booking/BookingSkeleton";
import { AppThemeProvider } from "@/context/ThemeContext";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

describe("BookingSkeleton", () => {
  it("renders correctly (native)", () => {
    const { toJSON } = render(
      <AppThemeProvider>
        <BookingSkeleton />
      </AppThemeProvider>
    );
    expect(toJSON()).toBeTruthy();
  });

  it("renders correctly (web)", () => {
    const RN = require("react-native");
    const original = RN.Platform.OS;
    RN.Platform.OS = "web";
    const { toJSON } = render(
      <AppThemeProvider>
        <BookingSkeleton />
      </AppThemeProvider>
    );
    expect(toJSON()).toBeTruthy();
    RN.Platform.OS = original;
  });
});
