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

function setReducedMotion(reduced: boolean) {
  window.matchMedia = jest
    .fn()
    .mockReturnValue({ matches: reduced }) as unknown as typeof matchMedia;
}

describe("RouteTransition", () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue("/");
    setReducedMotion(false);
  });

  it("renders its children", () => {
    render(
      <RouteTransition>
        <Text>Home</Text>
      </RouteTransition>
    );
    expect(screen.getByText("Home")).toBeTruthy();
  });

  it("leaves the first paint alone", () => {
    render(
      <RouteTransition>
        <Text>Home</Text>
      </RouteTransition>
    );
    expect(opacityOf()).toBe(1);
  });

  it("replays the transition when the path changes", async () => {
    const { rerender } = render(
      <RouteTransition>
        <Text>Home</Text>
      </RouteTransition>
    );

    mockUsePathname.mockReturnValue("/locations/2");
    rerender(
      <RouteTransition>
        <Text>Locations</Text>
      </RouteTransition>
    );
    // A new view arriving dips, but never far enough to blank the page out.
    const dipped = opacityOf();
    expect(dipped).toBeLessThan(1);
    expect(dipped).toBeGreaterThan(0.8);
    await waitFor(() => expect(opacityOf()).toBe(1), { timeout: 1000 });
  });

  it("does not replay when only the query string changed", () => {
    const { rerender } = render(
      <RouteTransition>
        <Text>Locations</Text>
      </RouteTransition>
    );

    // usePathname() excludes the query string, so ?time=19:30 leaves it untouched.
    rerender(
      <RouteTransition>
        <Text>Locations</Text>
      </RouteTransition>
    );
    expect(opacityOf()).toBe(1);
  });

  it("snaps straight to the new view when the visitor asked for reduced motion", () => {
    const { rerender } = render(
      <RouteTransition>
        <Text>Home</Text>
      </RouteTransition>
    );

    setReducedMotion(true);
    mockUsePathname.mockReturnValue("/locations/2");
    rerender(
      <RouteTransition>
        <Text>Locations</Text>
      </RouteTransition>
    );
    expect(opacityOf()).toBe(1);
  });
});
