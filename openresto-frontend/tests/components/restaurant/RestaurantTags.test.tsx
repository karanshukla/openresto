/**
 * @jest-environment jsdom
 */
import React from "react";
import { screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { RestaurantTags } from "@/components/restaurant/RestaurantTags";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";
import * as useAppThemeModule from "@/hooks/use-app-theme";
import { getThemeColors } from "@/theme/theme";

describe("RestaurantTags", () => {
  it("renders nothing when there are no tags", () => {
    renderWithProviders(<RestaurantTags tags={[]} />);
    expect(screen.queryByTestId("restaurant-tags")).toBeNull();
  });

  it("renders every tag when the row is within the cap", () => {
    renderWithProviders(<RestaurantTags tags={["Vegan", "Patio", "Dog friendly"]} />);
    expect(screen.getByText("Vegan")).toBeTruthy();
    expect(screen.getByText("Patio")).toBeTruthy();
    expect(screen.getByText("Dog friendly")).toBeTruthy();
    expect(screen.queryByText(/^\+/)).toBeNull();
  });

  it("collapses the overflow into a +N chip so card heights stay level", () => {
    renderWithProviders(<RestaurantTags tags={["Vegan", "Patio", "Dog friendly", "Live music"]} />);
    expect(screen.getByText("+1")).toBeTruthy();
    expect(screen.queryByText("Live music")).toBeNull();
    expect(screen.getByLabelText("1 more tag: Live music")).toBeTruthy();
  });

  it("names every hidden tag on the overflow chip", () => {
    renderWithProviders(
      <RestaurantTags tags={["Vegan", "Patio", "Dog friendly", "Live music", "Rooftop"]} />
    );
    expect(screen.getByText("+2")).toBeTruthy();
    expect(screen.getByLabelText("2 more tags: Live music, Rooftop")).toBeTruthy();
  });

  it("lifts the chip tint in dark mode", () => {
    const spy = jest.spyOn(useAppThemeModule, "useAppTheme").mockReturnValue({
      colors: getThemeColors(true),
      isDark: true,
      primaryColor: "#0a7ea4",
    } as ReturnType<typeof useAppThemeModule.useAppTheme>);
    try {
      renderWithProviders(<RestaurantTags tags={["Vegan"]} />);
      let chip = screen.getByText("Vegan").parent;
      while (chip && !StyleSheet.flatten(chip.props.style)?.backgroundColor) {
        chip = chip.parent;
      }
      expect(StyleSheet.flatten(chip?.props.style)).toMatchObject({
        backgroundColor: "rgba(10,126,164,0.15)",
      });
    } finally {
      spy.mockRestore();
    }
  });
});
