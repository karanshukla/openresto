import React from "react";
import { render, screen } from "@testing-library/react-native";
import { Platform } from "react-native";
import ScreenHeading from "@/components/layout/ScreenHeading";

jest.mock("@/hooks/use-app-theme", () => ({
  useAppTheme: () => ({
    brand: { appName: "Test App", primaryColor: "#0a7ea4" },
    colors: { muted: "#666" },
    primaryColor: "#0a7ea4",
    isDark: false,
  }),
}));

const setPlatform = (os: string) =>
  Object.defineProperty(Platform, "OS", { get: () => os, configurable: true });

const original = Platform.OS;
afterEach(() => setPlatform(original));

const heading = () => render(<ScreenHeading title="Our locations" subtitle="Pick a time." />);

/**
 * The native Stack header already names the screen, so drawing the title again put the same
 * words on the page twice — once in the bar, once under it. The subtitle has no such twin.
 */
describe("ScreenHeading", () => {
  it("carries the title and the subtitle on web, where nothing else names the page", () => {
    setPlatform("web");
    heading();
    expect(screen.getByText("Our locations")).toBeTruthy();
    expect(screen.getByText("Pick a time.")).toBeTruthy();
  });

  it("drops the title off web, where the navigator header already says it", () => {
    setPlatform("ios");
    heading();
    expect(screen.queryByText("Our locations")).toBeNull();
  });

  it("keeps the subtitle off web, since no header has room for it", () => {
    setPlatform("android");
    heading();
    expect(screen.getByText("Pick a time.")).toBeTruthy();
  });
});
