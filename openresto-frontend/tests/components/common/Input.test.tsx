import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import Input from "@/components/common/Input";

/**
 * Input's job is to *ask* to be revealed; what that costs in measurement and scrolling is
 * `KeyboardAwareScroll`'s own test. Mocking the hook keeps this about the request.
 */
const mockReveal = jest.fn();
let mockRevealAvailable = true;
jest.mock("@/components/common/KeyboardAwareScroll", () => ({
  useScrollFieldIntoView: () => (mockRevealAvailable ? mockReveal : null),
}));

describe("Input", () => {
  beforeEach(() => {
    mockReveal.mockClear();
    mockRevealAvailable = true;
  });

  it("asks to be scrolled into view when it takes focus", () => {
    render(<Input testID="field" />);

    fireEvent(screen.getByTestId("field"), "focus");

    expect(mockReveal).toHaveBeenCalledTimes(1);
    // The ref handed over is the wrapper, not the TextInput: the field's own padding is part
    // of what has to clear the keyboard.
    expect(mockReveal.mock.calls[0][0].current).toBeTruthy();
  });

  // The reveal is additive; a caller that wants its own focus handling still gets it.
  it("still runs the caller's own onFocus", () => {
    const onFocus = jest.fn();
    render(<Input testID="field" onFocus={onFocus} />);

    fireEvent(screen.getByTestId("field"), "focus");

    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  /**
   * On web, and anywhere outside a `KeyboardAwareScroll`, there is nothing to ask. The field
   * has to keep working — this is every admin form, which is web-only.
   */
  it("focuses normally with nothing listening", () => {
    mockRevealAvailable = false;
    const onFocus = jest.fn();
    render(<Input testID="field" onFocus={onFocus} />);

    fireEvent(screen.getByTestId("field"), "focus");

    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(mockReveal).not.toHaveBeenCalled();
  });
});
