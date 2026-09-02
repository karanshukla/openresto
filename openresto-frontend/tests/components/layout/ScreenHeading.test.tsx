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

// The settings control needs the locale and theme providers; here only its presence matters.
jest.mock("@/components/layout/GuestSettingsMenu", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: ({ testID }: { testID: string }) => <View testID={testID} />,
  };
});

const setPlatform = (os: string) =>
  Object.defineProperty(Platform, "OS", { get: () => os, configurable: true });

const original = Platform.OS;
afterEach(() => setPlatform(original));

const heading = (standalone = false) =>
  render(<ScreenHeading title="Our locations" subtitle="Pick a time." standalone={standalone} />);

/**
 * Under a native Stack header the title is already in the bar, so drawing it again put the
 * same words on the page twice. A header-less tab root has no bar, so the heading is its top
 * and takes on the settings control the bar used to carry. The subtitle has no twin anywhere.
 */
describe("ScreenHeading", () => {
  it("carries the title and the subtitle on web, where nothing else names the page", () => {
    setPlatform("web");
    heading();
    expect(screen.getByText("Our locations")).toBeTruthy();
    expect(screen.getByText("Pick a time.")).toBeTruthy();
  });

  it("drops the title off web under a navigator header that already says it", () => {
    setPlatform("ios");
    heading();
    expect(screen.queryByText("Our locations")).toBeNull();
    expect(screen.queryByTestId("screen-heading-settings-open")).toBeNull();
  });

  it("keeps the subtitle off web, since no header has room for it", () => {
    setPlatform("android");
    heading();
    expect(screen.getByText("Pick a time.")).toBeTruthy();
  });

  it("is the whole top of a header-less root: title, settings control and subtitle", () => {
    setPlatform("ios");
    heading(true);
    expect(screen.getByText("Our locations")).toBeTruthy();
    expect(screen.getByTestId("screen-heading-settings-open")).toBeTruthy();
    expect(screen.getByText("Pick a time.")).toBeTruthy();
  });

  it("ignores standalone on web, whose navbar already carries the settings", () => {
    setPlatform("web");
    heading(true);
    expect(screen.getByText("Our locations")).toBeTruthy();
    expect(screen.queryByTestId("screen-heading-settings-open")).toBeNull();
  });
});
