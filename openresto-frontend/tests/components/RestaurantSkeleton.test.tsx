/**
 * @jest-environment jsdom
 */
import React from "react";
import { render } from "@testing-library/react-native";
import RestaurantSkeleton from "@/components/restaurant/RestaurantSkeleton";
import { AppThemeProvider } from "@/context/ThemeContext";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

describe("RestaurantSkeleton", () => {
  it("renders correctly", () => {
    const { toJSON } = render(
      <AppThemeProvider>
        <RestaurantSkeleton />
      </AppThemeProvider>
    );
    expect(toJSON()).toBeTruthy();
  });
});
