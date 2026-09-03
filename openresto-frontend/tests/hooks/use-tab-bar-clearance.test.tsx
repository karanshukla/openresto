import React from "react";
import { renderHook } from "@testing-library/react-native";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useTabBarClearance } from "@/hooks/use-tab-bar-clearance";

const TAB_BAR = 83;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 0, height: 0 },
      insets: { top: 47, left: 0, right: 0, bottom: TAB_BAR },
    }}
  >
    {children}
  </SafeAreaProvider>
);

const setPlatform = (os: string) =>
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });
const originalOS = Platform.OS;
afterEach(() => setPlatform(originalOS));

/**
 * Issue #426. Inside a tab the bottom inset is the tab's own (GuestTabStack's provider): the
 * bar's height on iOS, where the list runs under it, and nothing on Android, where the platform
 * lays the content out above the bar. The hook only decides that web, which has no bar, pads
 * nothing at all.
 */
describe("useTabBarClearance", () => {
  it.each(["ios", "android"])("is the tab's bottom inset on %s", (os) => {
    setPlatform(os);

    expect(renderHook(() => useTabBarClearance(), { wrapper }).result.current).toBe(TAB_BAR);
  });

  it("is nothing on web, which has no tab bar to clear", () => {
    setPlatform("web");

    expect(renderHook(() => useTabBarClearance(), { wrapper }).result.current).toBe(0);
  });
});
