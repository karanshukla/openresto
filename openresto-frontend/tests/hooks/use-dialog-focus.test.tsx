/**
 * @jest-environment jsdom
 */
import { renderHook } from "@testing-library/react-native";
import { Platform, type View } from "react-native";
import { useDialogFocus } from "@/hooks/use-dialog-focus";

const originalOS = Platform.OS;
const setOS = (value: string) =>
  Object.defineProperty(Platform, "OS", { value, configurable: true });

describe("useDialogFocus", () => {
  let trigger: HTMLButtonElement;
  let panel: HTMLDivElement;

  beforeEach(() => {
    setOS("web");
    trigger = document.createElement("button");
    panel = document.createElement("div");
    panel.tabIndex = -1;
    document.body.append(trigger, panel);
    trigger.focus();
  });

  afterEach(() => {
    trigger.remove();
    panel.remove();
    setOS(originalOS);
  });

  const ref = () => ({ current: panel as unknown as View });

  /**
   * react-native-web's own Modal focuses the first focusable descendant it finds, which is the
   * full-screen backdrop — so without this the keys a popup listens for never reach it.
   */
  it("moves focus into the popup when it opens", () => {
    renderHook(() => useDialogFocus(true, ref()));

    expect(document.activeElement).toBe(panel);
  });

  it("puts focus back where it came from when it closes", () => {
    const { unmount } = renderHook(() => useDialogFocus(true, ref()));
    expect(document.activeElement).toBe(panel);

    unmount();

    expect(document.activeElement).toBe(trigger);
  });

  it("leaves focus alone while closed", () => {
    renderHook(() => useDialogFocus(false, ref()));

    expect(document.activeElement).toBe(trigger);
  });

  it("survives a popup whose ref never resolved", () => {
    expect(() => renderHook(() => useDialogFocus(true, { current: null }))).not.toThrow();
  });

  /** Native has no document to move focus within. */
  it("does nothing on native", () => {
    setOS("ios");

    renderHook(() => useDialogFocus(true, ref()));

    expect(document.activeElement).toBe(trigger);
  });
});
