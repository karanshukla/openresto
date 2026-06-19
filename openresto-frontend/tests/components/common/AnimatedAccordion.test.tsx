import React from "react";
import { render, act } from "@testing-library/react-native";
import { Animated } from "react-native";

// Import from the real file using a relative path to bypass the moduleNameMapper mock
// (moduleNameMapper maps @/components/common/AnimatedAccordion to jest-mocks/AnimatedAccordion.js)
import { AnimatedAccordion } from "../../../components/common/AnimatedAccordion";

// Capture animation start callbacks so tests can trigger them synchronously
let capturedStartCallback: (() => void) | undefined;

const timingSpy = jest.spyOn(Animated, "timing").mockImplementation(
  (_value, _config) =>
    ({
      start: (cb?: () => void) => {
        capturedStartCallback = cb;
      },
    }) as unknown as Animated.CompositeAnimation
);

beforeEach(() => {
  capturedStartCallback = undefined;
  timingSpy.mockClear();
});

describe("AnimatedAccordion", () => {
  it("renders null when initially collapsed (expanded=false)", () => {
    const { toJSON } = render(
      <AnimatedAccordion expanded={false}>
        <></>
      </AnimatedAccordion>
    );
    expect(toJSON()).toBeNull();
  });

  it("renders children inside Animated.View when initially expanded", () => {
    const { toJSON } = render(
      <AnimatedAccordion expanded>
        <></>
      </AnimatedAccordion>
    );
    expect(toJSON()).not.toBeNull();
  });

  it("animates to value 1 when initially expanded", () => {
    render(
      <AnimatedAccordion expanded>
        <></>
      </AnimatedAccordion>
    );
    const calls = timingSpy.mock.calls;
    expect(calls.some(([, config]) => config.toValue === 1)).toBe(true);
  });

  it("mounts and shows children when expanded changes from false to true", () => {
    const { rerender, toJSON } = render(
      <AnimatedAccordion expanded={false}>
        <></>
      </AnimatedAccordion>
    );
    expect(toJSON()).toBeNull();

    act(() => {
      rerender(
        <AnimatedAccordion expanded>
          <></>
        </AnimatedAccordion>
      );
    });

    expect(toJSON()).not.toBeNull();
  });

  it("animates to value 0 when collapsing", () => {
    timingSpy.mockClear();

    const { rerender } = render(
      <AnimatedAccordion expanded>
        <></>
      </AnimatedAccordion>
    );

    act(() => {
      rerender(
        <AnimatedAccordion expanded={false}>
          <></>
        </AnimatedAccordion>
      );
    });

    const calls = timingSpy.mock.calls;
    expect(calls.some(([, config]) => config.toValue === 0)).toBe(true);
  });

  it("unmounts (returns null) after collapse animation completes", () => {
    const { rerender, toJSON } = render(
      <AnimatedAccordion expanded>
        <></>
      </AnimatedAccordion>
    );
    expect(toJSON()).not.toBeNull();

    act(() => {
      rerender(
        <AnimatedAccordion expanded={false}>
          <></>
        </AnimatedAccordion>
      );
    });

    // Component is still mounted until animation finishes
    expect(toJSON()).not.toBeNull();

    // Trigger animation completion callback → setMounted(false)
    act(() => {
      capturedStartCallback?.();
    });

    expect(toJSON()).toBeNull();
  });

  it("stays mounted if re-expanded before collapse animation completes", () => {
    const { rerender, toJSON } = render(
      <AnimatedAccordion expanded>
        <></>
      </AnimatedAccordion>
    );

    act(() => {
      rerender(
        <AnimatedAccordion expanded={false}>
          <></>
        </AnimatedAccordion>
      );
    });

    // Re-expand before the collapse animation fires its callback
    act(() => {
      rerender(
        <AnimatedAccordion expanded>
          <></>
        </AnimatedAccordion>
      );
    });

    // Even if the old callback fires, it should not unmount
    act(() => {
      capturedStartCallback?.();
    });

    expect(toJSON()).not.toBeNull();
  });
});
