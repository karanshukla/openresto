import type { RefObject } from "react";
import type { TextInputInstance } from "react-native";
import { registerFocusTarget, unregisterFocusTarget, focusTarget } from "@/utils/focusRegistry";

function mockRef(focus: () => void): RefObject<TextInputInstance | null> {
  return { current: { focus } as unknown as TextInputInstance };
}

describe("focusRegistry", () => {
  afterEach(() => {
    unregisterFocusTarget("admin-lookup");
    unregisterFocusTarget("user-lookup");
  });

  it("focuses the registered ref's current TextInput", () => {
    const focus = jest.fn();
    registerFocusTarget("admin-lookup", mockRef(focus));

    focusTarget("admin-lookup");

    expect(focus).toHaveBeenCalledTimes(1);
  });

  it("does nothing when no target is registered for the key", () => {
    expect(() => focusTarget("user-lookup")).not.toThrow();
  });

  it("does nothing after a target has been unregistered", () => {
    const focus = jest.fn();
    registerFocusTarget("admin-lookup", mockRef(focus));
    unregisterFocusTarget("admin-lookup");

    focusTarget("admin-lookup");

    expect(focus).not.toHaveBeenCalled();
  });

  it("focuses the target as soon as it registers, when focusTarget was called before it mounted", () => {
    const focus = jest.fn();

    // e.g. router.push() to the owning screen just fired; its registration
    // effect hasn't run on the next render yet.
    focusTarget("user-lookup");
    expect(focus).not.toHaveBeenCalled();

    registerFocusTarget("user-lookup", mockRef(focus));

    expect(focus).toHaveBeenCalledTimes(1);
  });

  it("does not carry a pending request over to an unrelated key's registration", () => {
    const focus = jest.fn();

    focusTarget("user-lookup");
    registerFocusTarget("admin-lookup", mockRef(focus));

    expect(focus).not.toHaveBeenCalled();
  });
});
