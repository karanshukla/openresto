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

  /**
   * react-native-web's Modal trap activates when the open animation ends, a frame after this
   * hook has run, and hands focus to the first focusable descendant — the backdrop. A panel
   * that has lost focus hears none of the keys it exists to handle.
   */
  it("takes focus back when something else steals it while it is open", () => {
    const backdrop = document.createElement("div");
    backdrop.tabIndex = -1;
    document.body.append(backdrop);
    renderHook(() => useDialogFocus(true, ref()));

    backdrop.focus();

    expect(document.activeElement).toBe(panel);
    backdrop.remove();
  });

  it("leaves focus alone when it moves inside the popup", () => {
    const option = document.createElement("div");
    option.tabIndex = -1;
    panel.append(option);
    renderHook(() => useDialogFocus(true, ref()));

    option.focus();

    expect(document.activeElement).toBe(option);
  });

  /** Two reclaiming popups would pull the same focus between them forever. */
  it("reclaims from the innermost popup only", () => {
    const inner = document.createElement("div");
    inner.tabIndex = -1;
    document.body.append(inner);
    const outerRef = { current: panel as unknown as View };
    const innerRef = { current: inner as unknown as View };
    renderHook(() => useDialogFocus(true, outerRef));
    const innerHook = renderHook(() => useDialogFocus(true, innerRef));
    expect(document.activeElement).toBe(inner);

    trigger.focus();
    expect(document.activeElement).toBe(inner);

    innerHook.unmount();
    trigger.focus();

    expect(document.activeElement).toBe(panel);
    inner.remove();
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
