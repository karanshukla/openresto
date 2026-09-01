/**
 * @jest-environment jsdom
 */
import { Linking, Platform } from "react-native";
import { openExternal } from "@/utils/openExternal";

const setPlatform = (os: string) =>
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });

describe("openExternal", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("opens a new tab on web", () => {
    setPlatform("web");
    const open = jest.fn();
    (window as unknown as { open: jest.Mock }).open = open;
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);

    openExternal("https://example.com/x");

    expect(open).toHaveBeenCalledWith("https://example.com/x", "_blank");
    expect(openURL).not.toHaveBeenCalled();
  });

  it("hands the URL to the OS on native, never to window.open", () => {
    // `window` exists in React Native but has no `open`, so the web form would throw here
    // rather than quietly doing nothing — which is the whole reason for this helper.
    setPlatform("android");
    const open = jest.fn();
    (window as unknown as { open: jest.Mock }).open = open;
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);

    openExternal("https://example.com/x");

    expect(openURL).toHaveBeenCalledWith("https://example.com/x");
    expect(open).not.toHaveBeenCalled();
  });
});
