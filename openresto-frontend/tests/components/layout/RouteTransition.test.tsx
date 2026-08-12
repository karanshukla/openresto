/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import RouteTransition from "@/components/layout/RouteTransition";

const mockUsePathname = jest.fn();
jest.mock("expo-router", () => ({
  usePathname: () => mockUsePathname(),
}));

jest.mock("@/utils/webAnimation", () => ({
  ...jest.requireActual("@/utils/webAnimation"),
  animateNode: jest.fn(() => null),
}));
const mockAnimateNode = jest.requireMock("@/utils/webAnimation").animateNode as jest.Mock;

function renderAt(path: string) {
  mockUsePathname.mockReturnValue(path);
  return render(
    <RouteTransition>
      <Text>{path}</Text>
    </RouteTransition>
  );
}

describe("RouteTransition", () => {
  beforeEach(() => {
    mockAnimateNode.mockClear();
    mockAnimateNode.mockReturnValue(null);
  });

  it("renders its children", () => {
    renderAt("/");
    expect(screen.getByText("/")).toBeTruthy();
  });

  it("leaves the first paint alone", () => {
    renderAt("/");
    // A cold load has no previous view to replace, and animating it only delays the
    // content the visitor came for.
    expect(mockAnimateNode).not.toHaveBeenCalled();
  });

  it("animates the new view in when the path changes", () => {
    const { rerender } = renderAt("/");

    mockUsePathname.mockReturnValue("/locations/2");
    rerender(
      <RouteTransition>
        <Text>/locations/2</Text>
      </RouteTransition>
    );

    expect(mockAnimateNode).toHaveBeenCalledTimes(1);
    const [, keyframes] = mockAnimateNode.mock.calls[0];
    // Never from zero: the outgoing view is already gone, so a transparent frame shows
    // the bare page background across the whole viewport and reads as a blink.
    expect(keyframes[0].opacity).toBeGreaterThan(0.8);
    expect(keyframes[keyframes.length - 1].opacity).toBe(1);
  });

  it("cancels the running animation when the path changes again mid-flight", () => {
    const cancel = jest.fn();
    mockAnimateNode.mockReturnValue({ cancel });
    const { rerender } = renderAt("/");

    mockUsePathname.mockReturnValue("/locations/2");
    rerender(
      <RouteTransition>
        <Text>/locations/2</Text>
      </RouteTransition>
    );
    expect(cancel).not.toHaveBeenCalled();

    mockUsePathname.mockReturnValue("/locations/3");
    rerender(
      <RouteTransition>
        <Text>/locations/3</Text>
      </RouteTransition>
    );
    // A fast second navigation must not stack a second keyframe animation over the first.
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("does not replay when only the query string changed", () => {
    const { rerender } = renderAt("/locations");

    // usePathname() excludes the query string, so ?time=19:30 leaves it untouched.
    rerender(
      <RouteTransition>
        <Text>/locations</Text>
      </RouteTransition>
    );
    expect(mockAnimateNode).not.toHaveBeenCalled();
  });
});
