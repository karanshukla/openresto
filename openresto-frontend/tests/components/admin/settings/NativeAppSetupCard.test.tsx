/**
 * @jest-environment jsdom
 */
import React from "react";
import { Linking, Platform } from "react-native";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react-native";
import {
  NativeAppSetupCard,
  bundleIdSuffix,
  resolveServerAddress,
} from "@/components/admin/settings/NativeAppSetupCard";
import type { Brand } from "@/types";

const colorScheme = { current: "light" as "light" | "dark" };
jest.mock("@/hooks/use-color-scheme", () => ({ useColorScheme: () => colorScheme.current }));

const brand = { current: { appName: "Open Resto", primaryColor: "#0a7ea4" } as Brand };
jest.mock("@/context/BrandContext", () => ({
  useBrand: () => brand.current,
}));

jest.mock("@/hooks/use-persisted-state", () => ({
  usePersistedState: (_key: string, defaultValue: unknown) => {
    const { useState } = require("react");
    return useState(defaultValue);
  },
}));

const baseProps = { borderColor: "#ddd", mutedColor: "#888", cardBg: "#fff" };
const command = () => screen.getByTestId("native-app-setup-command").props.children as string;

const originalOS = Platform.OS;
const asWeb = () => Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });

describe("NativeAppSetupCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    asWeb();
    colorScheme.current = "light";
    brand.current = { appName: "Open Resto", primaryColor: "#0a7ea4" } as Brand;
    Object.assign(navigator, { clipboard: { writeText: jest.fn().mockResolvedValue(undefined) } });
  });

  afterEach(() => {
    Object.defineProperty(Platform, "OS", { get: () => originalOS, configurable: true });
  });

  it("fills the command in with the address the checks ran against", () => {
    render(<NativeAppSetupCard {...baseProps} serverUrl="https://bookings.example.com" />);
    expect(command()).toContain("npm run native:init --");
    expect(command()).toContain("--server https://bookings.example.com");
  });

  // The bundle id is the app's identity on both stores, and an application id segment takes
  // no hyphens — a slug dropped in verbatim would be rejected by the generator.
  it("derives a legal bundle id suffix from the brand name", () => {
    brand.current = { appName: "Chez Marie's Bistro", primaryColor: "#0a7ea4" } as Brand;
    render(<NativeAppSetupCard {...baseProps} serverUrl="https://x.example.com" />);
    expect(command()).toContain("--bundle-id com.example.chezmariesbistro");
  });

  it("keeps a leading digit out of the bundle id", () => {
    expect(bundleIdSuffix("7 Tables")).toBe("app7tables");
    expect(bundleIdSuffix("Café Böhm")).toBe("cafebohm");
  });

  it("falls back to this page's origin when the server checked none", () => {
    render(<NativeAppSetupCard {...baseProps} serverUrl={null} />);
    expect(command()).toContain(`--server ${window.location.origin}`);
  });

  it("falls back to the brand's website URL off web, then to an example", () => {
    Object.defineProperty(Platform, "OS", { get: () => "ios", configurable: true });
    expect(resolveServerAddress(null, "https://brand.example.com")).toBe(
      "https://brand.example.com"
    );
    expect(resolveServerAddress(null, undefined)).toBe("https://bookings.example.com");
    expect(resolveServerAddress("https://checked.example.com", "https://brand.example.com")).toBe(
      "https://checked.example.com"
    );
  });

  it("copies the command and confirms only once the write landed", async () => {
    render(<NativeAppSetupCard {...baseProps} serverUrl="https://x.example.com" />);
    await act(async () => {
      fireEvent.press(screen.getByTestId("native-app-setup-copy"));
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(command());
    await waitFor(() => expect(screen.getByText("Copied")).toBeTruthy());
  });

  it("says so rather than confirming when the clipboard refuses", async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockRejectedValue(new Error("denied")) },
    });
    render(<NativeAppSetupCard {...baseProps} serverUrl="https://x.example.com" />);
    await act(async () => {
      fireEvent.press(screen.getByTestId("native-app-setup-copy"));
    });

    expect(screen.queryByText("Copied")).toBeNull();
    expect(
      screen.getByText("Couldn't copy — select the command and copy it yourself.")
    ).toBeTruthy();
  });

  it("returns to its resting label once the confirmation window passes", async () => {
    jest.useFakeTimers();
    try {
      render(<NativeAppSetupCard {...baseProps} serverUrl="https://x.example.com" />);
      await act(async () => {
        fireEvent.press(screen.getByTestId("native-app-setup-copy"));
      });
      expect(screen.getByText("Copied")).toBeTruthy();

      await act(async () => {
        jest.advanceTimersByTime(2500);
      });
      expect(screen.getByText("Copy")).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it("keeps the command legible on the dark surface", () => {
    colorScheme.current = "dark";
    render(<NativeAppSetupCard {...baseProps} serverUrl="https://x.example.com" />);
    expect(screen.getByTestId("native-app-setup-command")).toBeTruthy();
  });

  it("hides the copy control off web", () => {
    Object.defineProperty(Platform, "OS", { get: () => "ios", configurable: true });
    render(<NativeAppSetupCard {...baseProps} serverUrl="https://x.example.com" />);
    expect(screen.queryByTestId("native-app-setup-copy")).toBeNull();
  });

  it("offers the guide at the configured repository", () => {
    brand.current = {
      appName: "Open Resto",
      primaryColor: "#0a7ea4",
      repositoryUrl: "https://github.com/karanshukla/openresto/",
    } as Brand;
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    render(<NativeAppSetupCard {...baseProps} serverUrl="https://x.example.com" />);

    fireEvent.press(screen.getByTestId("native-app-guide-link"));
    expect(openURL).toHaveBeenCalledWith(
      "https://github.com/karanshukla/openresto/blob/main/docs/native-app.md"
    );
  });

  // A fork configures where the guide lives; a destination the server never resolved is
  // dropped rather than rendered as a dead link.
  it("drops the guide link when no repository URL resolved", () => {
    render(<NativeAppSetupCard {...baseProps} serverUrl="https://x.example.com" />);
    expect(screen.queryByTestId("native-app-guide-link")).toBeNull();
  });

  it("collapses when the header is pressed", () => {
    render(<NativeAppSetupCard {...baseProps} serverUrl="https://x.example.com" />);
    expect(screen.getByTestId("native-app-setup-command")).toBeTruthy();
    fireEvent.press(screen.getByText("Build your app"));
    expect(screen.queryByTestId("native-app-setup-command")).toBeNull();
  });
});
