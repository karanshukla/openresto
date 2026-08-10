/**
 * @jest-environment jsdom
 */
import React from "react";
import { screen, fireEvent } from "@testing-library/react-native";
import ScrollToTopFab from "@/components/common/ScrollToTopFab";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";

const mockWindowDimensions = { width: 375, height: 812 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  default: () => mockWindowDimensions,
}));

describe("ScrollToTopFab", () => {
  it("renders once scrollY is past the threshold", () => {
    renderWithProviders(<ScrollToTopFab scrollY={350} onPress={jest.fn()} />);
    expect(screen.getByRole("button")).toBeTruthy();
  });

  it("does not render when scrollY is at the threshold", () => {
    renderWithProviders(<ScrollToTopFab scrollY={300} onPress={jest.fn()} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  // The FAB used to be gated to portrait phones under 700px wide, which hid it
  // from exactly the wide layouts that scroll furthest. Viewport size must not
  // affect it at all now, so drive a desktop landscape window and a phone
  // portrait one through the same assertion.
  it.each([
    ["desktop landscape", { width: 1440, height: 900 }],
    ["tablet landscape", { width: 1024, height: 768 }],
    ["phone portrait", { width: 375, height: 812 }],
  ])("renders on %s", (_label, dimensions) => {
    const wdModule = require("react-native/Libraries/Utilities/useWindowDimensions");
    const original = wdModule.default;
    wdModule.default = () => dimensions;
    try {
      renderWithProviders(<ScrollToTopFab scrollY={500} onPress={jest.fn()} />);
      expect(screen.getByRole("button")).toBeTruthy();
    } finally {
      wdModule.default = original;
    }
  });

  it("calls onPress when pressed", () => {
    const onPress = jest.fn();
    renderWithProviders(<ScrollToTopFab scrollY={400} onPress={onPress} />);
    fireEvent.press(screen.getByRole("button"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
