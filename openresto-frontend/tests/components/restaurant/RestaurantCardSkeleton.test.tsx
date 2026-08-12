/**
 * @jest-environment jsdom
 */
import React from "react";
import { screen } from "@testing-library/react-native";
import RestaurantCardSkeleton from "@/components/restaurant/RestaurantCardSkeleton";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";

describe("RestaurantCardSkeleton", () => {
  it("stands in for a card without announcing itself to a screen reader", () => {
    renderWithProviders(<RestaurantCardSkeleton />);

    const skeleton = screen.getByTestId("restaurant-card-skeleton", {
      includeHiddenElements: true,
    });
    expect(skeleton).toBeTruthy();
    // Placeholder blocks carry no information, so they are not worth stopping on.
    expect(skeleton.props.accessibilityElementsHidden).toBe(true);
    expect(skeleton.props.importantForAccessibility).toBe("no-hide-descendants");
  });
});
