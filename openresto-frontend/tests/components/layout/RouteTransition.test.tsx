/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import RouteTransition from "@/components/layout/RouteTransition";

const mockUsePathname = jest.fn();
jest.mock("expo-router", () => ({
  usePathname: () => mockUsePathname(),
}));

function opacityOf(): number {
  const style = screen.getByTestId("route-transition").props.style;
  const flat = Array.isArray(style) ? Object.assign({}, ...style) : style;
  // Animated values render as the node itself in the test renderer; read through it.
  return typeof flat.opacity === "number" ? flat.opacity : flat.opacity.__getValue();
}

describe("RouteTransition", () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue("/");
  });

  it("renders its children", () => {
    render(
      <RouteTransition>
        <Text>Home</Text>
      </RouteTransition>
    );
    expect(screen.getByText("Home")).toBeTruthy();
  });

  it("fades the view in on mount", async () => {
    render(
      <RouteTransition>
        <Text>Home</Text>
      </RouteTransition>
    );
    expect(opacityOf()).toBe(0);
    await waitFor(() => expect(opacityOf()).toBe(1), { timeout: 1000 });
  });

  it("replays the transition when the path changes", async () => {
    const { rerender } = render(
      <RouteTransition>
        <Text>Home</Text>
      </RouteTransition>
    );
    await waitFor(() => expect(opacityOf()).toBe(1), { timeout: 1000 });

    mockUsePathname.mockReturnValue("/locations/2");
    rerender(
      <RouteTransition>
        <Text>Locations</Text>
      </RouteTransition>
    );
    // A new view arriving starts from transparent again rather than snapping in.
    expect(opacityOf()).toBe(0);
    await waitFor(() => expect(opacityOf()).toBe(1), { timeout: 1000 });
  });

  it("does not replay when only the query string changed", async () => {
    const { rerender } = render(
      <RouteTransition>
        <Text>Locations</Text>
      </RouteTransition>
    );
    await waitFor(() => expect(opacityOf()).toBe(1), { timeout: 1000 });

    // usePathname() excludes the query string, so ?time=19:30 leaves it untouched.
    rerender(
      <RouteTransition>
        <Text>Locations</Text>
      </RouteTransition>
    );
    expect(opacityOf()).toBe(1);
  });
});
