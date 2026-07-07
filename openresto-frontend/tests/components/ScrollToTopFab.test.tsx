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
  it("renders when mobile portrait and scrollY > 300", () => {
    const onPress = jest.fn();
    renderWithProviders(<ScrollToTopFab scrollY={350} onPress={onPress} />);
    expect(screen.getByRole("button")).toBeTruthy();
  });

  it("does not render when scrollY <= 300", () => {
    const onPress = jest.fn();
    renderWithProviders(<ScrollToTopFab scrollY={300} onPress={onPress} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("does not render on wide screens (landscape/desktop)", () => {
    const {
      default: useWindowDimensions,
    } = require("react-native/Libraries/Utilities/useWindowDimensions");
    jest.spyOn({ useWindowDimensions }, "useWindowDimensions").mockReturnValueOnce({
      width: 1024,
      height: 768,
    });

    // Override mock for this test
    const wdModule = require("react-native/Libraries/Utilities/useWindowDimensions");
    const original = wdModule.default;
    wdModule.default = () => ({ width: 1024, height: 768 });

    const onPress = jest.fn();
    renderWithProviders(<ScrollToTopFab scrollY={500} onPress={onPress} />);
    expect(screen.queryByRole("button")).toBeNull();

    wdModule.default = original;
  });

  it("calls onPress when pressed", () => {
    const onPress = jest.fn();
    renderWithProviders(<ScrollToTopFab scrollY={400} onPress={onPress} />);
    fireEvent.press(screen.getByRole("button"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
