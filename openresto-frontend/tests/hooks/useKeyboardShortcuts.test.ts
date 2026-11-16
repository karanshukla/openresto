/**
 * @jest-environment ./jest-mocks/jsdomEnvironment.js
 */
import React from "react";
import { render } from "@testing-library/react-native";
import { Platform } from "react-native";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

function Harness({ map }: { map: Record<string, (e: KeyboardEvent) => void> }) {
  useKeyboardShortcuts(map);
  return null;
}

function dispatchKeydown(
  key: string,
  opts: Partial<KeyboardEventInit & { target?: EventTarget }> = {}
) {
  const { target, ...init } = opts;
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  if (target) {
    Object.defineProperty(event, "target", { value: target, configurable: true });
  }
  window.dispatchEvent(event);
  return event;
}

describe("useKeyboardShortcuts", () => {
  beforeEach(() => {
    Platform.OS = "web";
  });

  it("fires the matching handler for a plain key", () => {
    const handler = jest.fn();
    render(React.createElement(Harness, { map: { "?": handler } }));

    dispatchKeydown("?");

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("treats a null event target as not typing", () => {
    const handler = jest.fn();
    render(React.createElement(Harness, { map: { l: handler } }));

    const event = new KeyboardEvent("keydown", { key: "l", bubbles: true, cancelable: true });
    Object.defineProperty(event, "target", { value: null, configurable: true });
    window.dispatchEvent(event);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not fire handlers for unmapped keys", () => {
    const handler = jest.fn();
    render(React.createElement(Harness, { map: { "?": handler } }));

    dispatchKeydown("x");

    expect(handler).not.toHaveBeenCalled();
  });

  it("suppresses non-Escape shortcuts while typing in an input", () => {
    const handler = jest.fn();
    render(React.createElement(Harness, { map: { l: handler } }));

    const input = document.createElement("input");
    document.body.appendChild(input);

    dispatchKeydown("l", { target: input });

    expect(handler).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it("still fires Escape while typing in an input", () => {
    const handler = jest.fn();
    render(React.createElement(Harness, { map: { Escape: handler } }));

    const input = document.createElement("input");
    document.body.appendChild(input);

    dispatchKeydown("Escape", { target: input });

    expect(handler).toHaveBeenCalledTimes(1);
    document.body.removeChild(input);
  });

  it("suppresses non-Escape shortcuts while typing in a textarea", () => {
    const handler = jest.fn();
    render(React.createElement(Harness, { map: { j: handler } }));

    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);

    dispatchKeydown("j", { target: textarea });

    expect(handler).not.toHaveBeenCalled();
    document.body.removeChild(textarea);
  });

  it("resolves a g-then-d two-key sequence", () => {
    const handler = jest.fn();
    render(React.createElement(Harness, { map: { "g d": handler } }));

    dispatchKeydown("g");
    dispatchKeydown("d");

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not treat a lone g press as a shortcut on its own", () => {
    const gHandler = jest.fn();
    const dHandler = jest.fn();
    render(React.createElement(Harness, { map: { g: gHandler, "g d": dHandler } }));

    dispatchKeydown("g");

    expect(gHandler).not.toHaveBeenCalled();
    expect(dHandler).not.toHaveBeenCalled();
  });

  it("ignores events with ctrlKey or metaKey held", () => {
    const handler = jest.fn();
    render(React.createElement(Harness, { map: { l: handler } }));

    dispatchKeydown("l", { ctrlKey: true });
    dispatchKeydown("l", { metaKey: true });

    expect(handler).not.toHaveBeenCalled();
  });

  it("attaches zero listeners on native platforms", () => {
    Platform.OS = "android";
    const addSpy = jest.spyOn(window, "addEventListener");
    const handler = jest.fn();

    render(React.createElement(Harness, { map: { l: handler } }));

    expect(addSpy).not.toHaveBeenCalledWith("keydown", expect.any(Function));
    dispatchKeydown("l");
    expect(handler).not.toHaveBeenCalled();

    addSpy.mockRestore();
  });

  it("removes the listener on unmount", () => {
    const handler = jest.fn();
    const { unmount } = render(React.createElement(Harness, { map: { l: handler } }));

    unmount();
    dispatchKeydown("l");

    expect(handler).not.toHaveBeenCalled();
  });
});
