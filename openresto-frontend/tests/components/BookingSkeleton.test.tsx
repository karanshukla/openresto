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
  it("renders correctly", () => {
    const { toJSON } = render(
      <AppThemeProvider>
        <BookingSkeleton />
      </AppThemeProvider>
    );
    expect(toJSON()).toBeTruthy();
  });
});
